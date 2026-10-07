import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';
import 'dotenv/config';
import { q } from '../server/db.js';
import { judgeWithRanking } from '../server/ai.js';
import { buildPointsMap } from '../server/scoring.js';

// ═════════════════════════════════════════════════════
// HUBRIS — ADMIN BOT  (a SEPARATE bot from the public game bot)
// The creator controls everything from here, in chat:
//   • create the daily call   • set the reveal time
//   • resolve + award Ichor    • read live statistics
//   • manage quests / users    • broadcast to everyone
// Only ADMIN_TELEGRAM_ID is ever answered. Everyone else sees nothing.
// ═════════════════════════════════════════════════════
const ADMIN = Number(process.env.ADMIN_TELEGRAM_ID);
const bot = new TelegramBot(process.env.ADMIN_BOT_TOKEN, { polling: true });

// Public bot handle (no polling) — used only to broadcast as the game bot.
const publicBot = process.env.BOT_TOKEN
  ? new TelegramBot(process.env.BOT_TOKEN, { polling: false })
  : null;

const isAdmin = (msg) => msg?.from?.id === ADMIN;
const UNIT = 'Ichor';

// Single-admin conversation state.
const S = { mode: null, draft: {}, ctx: {} };
function reset() { S.mode = null; S.draft = {}; S.ctx = {}; }

const esc = (s) => String(s ?? '');
const fmt = (d) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

// ─── Reveal-time parser ─────────────────────────────────────────
// Accepts:  +8h  +30m  +2d   |   20:00 (today)   |   2026-10-09 20:00
function parseReveal(text) {
  const t = text.trim();
  let m;
  if ((m = t.match(/^\+(\d+)\s*([hmd])$/i))) {
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const ms = unit === 'h' ? 3600e3 : unit === 'm' ? 60e3 : 86400e3;
    return new Date(Date.now() + n * ms);
  }
  if ((m = t.match(/^(\d{1,2}):(\d{2})$/))) {
    const d = new Date();
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    if (d <= new Date()) d.setDate(d.getDate() + 1);
    return d;
  }
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/))) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0);
    return isNaN(d) ? null : d;
  }
  const d = new Date(t);
  return isNaN(d) ? null : d;
}

// ─── Menus ─────────────────────────────────────────────────
function homeMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '◈ Statistics', callback_data: 'stats' }],
        [{ text: '＋ New Call', callback_data: 'new' }, { text: '▤ Calls', callback_data: 'calls' }],
        [{ text: '◆ Quests', callback_data: 'quests' }, { text: '● Users', callback_data: 'users' }],
        [{ text: '▧ Broadcast', callback_data: 'bc' }],
      ],
    },
  };
}
const backRow = [{ text: '‹ Home', callback_data: 'home' }];

function send(chatId, text, extra = {}) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', disable_web_page_preview: true, ...extra });
}
// ═══ Guard + entry ══════════════════════════════════════════
function greet(chatId) {
  reset();
  return send(chatId,
    '◈ *HUBRIS — Control*\n\nYou are the creator. Everything in the Mini App is made here.',
    homeMenu());
}

bot.onText(/\/start|\/home|\/menu/, (msg) => {
  if (!isAdmin(msg)) return;
  greet(msg.chat.id);
});
bot.onText(/\/cancel/, (msg) => {
  if (!isAdmin(msg)) return;
  reset();
  send(msg.chat.id, 'Cancelled.', homeMenu());
});

// ═══ Callback router ═══════════════════════════════════════
bot.on('callback_query', async (query) => {
  if (query.from.id !== ADMIN) { try { bot.answerCallbackQuery(query.id); } catch {} return; }
  const chatId = query.message.chat.id;
  const data = query.data || '';
  try { bot.answerCallbackQuery(query.id); } catch {}
  try {
    if (data === 'home') return greet(chatId);
    if (data === 'stats') return showStats(chatId);
    if (data === 'new') return startNewCall(chatId);
    if (data === 'calls') return listCalls(chatId);
    if (data === 'quests') return listQuests(chatId);
    if (data === 'users') return listUsers(chatId);
    if (data === 'bc') { S.mode = 'broadcast'; return send(chatId, 'Type the broadcast message. It goes to *every* player as the game bot.\n\n/cancel to stop.', { reply_markup: { inline_keyboard: [backRow] } }); }
    if (data === 'quest_add') { S.mode = 'quest_add'; return send(chatId, 'New quest. Send as:\n`title | reward | description | url`\n(url optional)\n\n/cancel to stop.'); }
    if (data.startsWith('resolve:')) return startResolve(chatId, data.split(':')[1]);
    if (data.startsWith('rAI:')) return resolveWithAI(chatId, data.split(':')[1]);
    if (data.startsWith('rMan:')) return startManualResolve(chatId, data.split(':')[1]);
    if (data.startsWith('del:')) return deleteCall(chatId, data.split(':')[1]);
    if (data.startsWith('qtog:')) return toggleQuest(chatId, data.split(':')[1]);
    if (data.startsWith('qdel:')) return deleteQuest(chatId, data.split(':')[1]);
    if (data.startsWith('upts:')) { S.mode = 'user_points'; S.ctx.uid = data.split(':')[1]; return send(chatId, `Send the new ${UNIT} total for user \`${S.ctx.uid}\`.`); }
  } catch (e) {
    console.error(e);
    send(chatId, '⚠ ' + (e.message || 'error'), homeMenu());
  }
});

// ═══ Statistics ══════════════════════════════════════════
async function showStats(chatId) {
  const [u, p, qc, open] = await Promise.all([
    q(`SELECT COUNT(*)::int c FROM users`),
    q(`SELECT COUNT(*)::int c FROM picks`),
    q(`SELECT COUNT(*)::int c FROM quest_completions`),
    q(`SELECT COUNT(*)::int c FROM challenges WHERE status='open'`),
  ]);
  const { rows: top } = await q(`SELECT first_name, username, points FROM users ORDER BY points DESC LIMIT 5`);
  const { rows: recent } = await q(`SELECT challenge_date, question, status FROM challenges ORDER BY challenge_date DESC LIMIT 5`);
  const leaders = top.length
    ? top.map((t, i) => `${i + 1}. ${esc(t.first_name || t.username || 'Anon')} — *${t.points}* ${UNIT}`).join('\n')
    : '_none yet_';
  const calls = recent.length
    ? recent.map(r => `• ${r.challenge_date} · _${r.status}_ — ${esc(r.question).slice(0, 40)}`).join('\n')
    : '_none yet_';
  send(chatId,
    `◈ *Statistics*\n\n` +
    `Players: *${u.rows[0].c}*\nPicks: *${p.rows[0].c}*\nQuests done: *${qc.rows[0].c}*\nOpen calls: *${open.rows[0].c}*\n\n` +
    `*Top ${UNIT}*\n${leaders}\n\n*Recent calls*\n${calls}`,
    { reply_markup: { inline_keyboard: [backRow] } });
}

// ═══ New call (conversation) ═════════════════════════════════
function startNewCall(chatId) {
  reset();
  S.mode = 'new_question';
  S.draft = {};
  send(chatId, '＋ *New Call* — step 1 / 3\n\nSend the *question* players will decide on.\n\n/cancel to stop.');
}
// ═══ Text / conversation handler ══════════════════════════════
bot.on('message', async (msg) => {
  if (!isAdmin(msg)) return;                 // ignore the whole world but the creator
  if (!msg.text || msg.text.startsWith('/')) return;  // commands handled elsewhere
  if (!S.mode) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  try {
    switch (S.mode) {
      case 'new_question':
        S.draft.question = text;
        S.mode = 'new_options';
        return send(chatId,
          '＋ *New Call* — step 2 / 3\n\nSend the *options*, one per line. Either plain lines or `id|text`:\n\n`Hold the line`\n`Push now`\n\n(2–6 options)');
      case 'new_options': {
        const opts = parseOptions(text);
        if (opts.length < 2) return send(chatId, 'Need at least 2 options. Try again.');
        if (opts.length > 6) return send(chatId, 'Max 6 options. Try again.');
        S.draft.options = opts;
        S.mode = 'new_reveal';
        return send(chatId,
          '＋ *New Call* — step 3 / 3\n\nWhen should the *result be revealed*?\n\n`+8h`  ·  `20:00`  ·  `2026-10-09 20:00`');
      }
      case 'new_reveal': {
        const when = parseReveal(text);
        if (!when || when <= new Date()) return send(chatId, 'Could not read a future time. Try `+8h` or `20:00`.');
        S.draft.reveal_at = when;
        return finalizeNewCall(chatId);
      }
      case 'resolve_outcome': {
        await q(`UPDATE challenges SET outcome_text=$1 WHERE id=$2`, [text, S.ctx.id]);
        return send(chatId,
          `Outcome saved. How should ${UNIT} be awarded?`,
          { reply_markup: { inline_keyboard: [
            [{ text: '◈ Let the judges rank', callback_data: 'rAI:' + S.ctx.id }],
            [{ text: '✎ Rank manually', callback_data: 'rMan:' + S.ctx.id }],
            backRow,
          ] } });
      }
      case 'resolve_manual': {
        const order = text.split(/[\s,>›]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
        const ids = (S.ctx.options || []).map(o => o.id.toLowerCase());
        const valid = order.filter(id => ids.includes(id));
        if (valid.length !== ids.length) {
          return send(chatId, `Rank *all* options best→worst by id, e.g. \`${ids.join(' ')}\``);
        }
        return applyResolution(chatId, S.ctx.id, valid, [], 'Ranked by the creator.');
      }
      case 'quest_add': {
        const [title, reward, description, url] = text.split('|').map(s => (s || '').trim());
        if (!title || !reward || isNaN(Number(reward)))
          return send(chatId, 'Format: `title | reward | description | url`');
        const { rows } = await q(
          `INSERT INTO quests (title, description, reward, action_url)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [title, description || '', Number(reward), url || null]);
        reset();
        return send(chatId, `◆ Quest #${rows[0].id} created (+${reward} ${UNIT}).`, homeMenu());
      }
      case 'user_points': {
        const pts = Number(text);
        if (isNaN(pts)) return send(chatId, 'Send a number.');
        const { rows } = await q(`UPDATE users SET points=$1 WHERE telegram_id=$2 RETURNING first_name, username`, [pts, S.ctx.uid]);
        reset();
        if (!rows.length) return send(chatId, 'No such user.', homeMenu());
        return send(chatId, `Set ${esc(rows[0].first_name || rows[0].username || S.ctx.uid)} to *${pts}* ${UNIT}.`, homeMenu());
      }
      case 'broadcast': {
        reset();
        return doBroadcast(chatId, text);
      }
    }
  } catch (e) {
    console.error(e);
    reset();
    send(chatId, '⚠ ' + (e.message || 'error'), homeMenu());
  }
});

function parseOptions(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const letters = 'abcdefgh';
  return lines.map((line, i) => {
    if (line.includes('|')) {
      const [id, ...rest] = line.split('|');
      return { id: id.trim().toLowerCase(), text: rest.join('|').trim() };
    }
    return { id: letters[i], text: line };
  });
}

async function finalizeNewCall(chatId) {
  const d = S.draft;
  const today = new Date().toISOString().split('T')[0];
  try {
    const { rows } = await q(
      `INSERT INTO challenges (challenge_date, question, options, use_ai, reveal_at, status)
       VALUES ($1,$2,$3,TRUE,$4,'open') RETURNING id`,
      [today, d.question, JSON.stringify(d.options), d.reveal_at]);
    reset();
    send(chatId,
      `◈ *Call #${rows[0].id} is live.*\n\n*${esc(d.question)}*\n` +
      d.options.map(o => `· *${o.id.toUpperCase()}* — ${esc(o.text)}`).join('\n') +
      `\n\nReveal · ${fmt(d.reveal_at)}`,
      homeMenu());
  } catch (e) {
    reset();
    if (String(e.message).includes('duplicate') || e.code === '23505')
      return send(chatId, 'A call already exists for today. Delete it first from ▤ Calls.', homeMenu());
    throw e;
  }
}
// ═══ Calls: list / resolve / delete ════════════════════════════
async function listCalls(chatId) {
  const { rows } = await q(
    `SELECT c.id, c.challenge_date, c.question, c.status, c.reveal_at,
       (SELECT COUNT(*)::int FROM picks p WHERE p.challenge_id=c.id) picks
     FROM challenges c ORDER BY c.challenge_date DESC LIMIT 10`);
  if (!rows.length) return send(chatId, 'No calls yet. Create one with ＋ New Call.', { reply_markup: { inline_keyboard: [backRow] } });
  const kb = [];
  for (const r of rows) {
    const label = `${r.status === 'revealed' ? '✓' : r.status === 'closed' ? '○' : '●'} ${r.challenge_date} · ${r.picks}p · ${esc(r.question).slice(0, 22)}`;
    const row = [];
    if (r.status !== 'revealed') row.push({ text: '◈ Resolve', callback_data: 'resolve:' + r.id });
    row.push({ text: '✕ Del', callback_data: 'del:' + r.id });
    kb.push([{ text: label, callback_data: 'noop' }]);
    kb.push(row);
  }
  kb.push(backRow);
  send(chatId, '▤ *Calls* — newest first', { reply_markup: { inline_keyboard: kb } });
}

async function startResolve(chatId, id) {
  const { rows } = await q(`SELECT * FROM challenges WHERE id=$1`, [id]);
  if (!rows.length) return send(chatId, 'Gone.', homeMenu());
  const ch = rows[0];
  S.ctx = { id, options: ch.options };
  S.mode = 'resolve_outcome';
  send(chatId,
    `◈ *Resolve call #${id}*\n\n*${esc(ch.question)}*\n` +
    ch.options.map(o => `· *${o.id.toUpperCase()}* — ${esc(o.text)}`).join('\n') +
    `\n\nSend the *outcome* — what actually happened. (This is what the judges weigh.)`);
}

async function resolveWithAI(chatId, id) {
  const { rows } = await q(`SELECT * FROM challenges WHERE id=$1`, [id]);
  if (!rows.length) return send(chatId, 'Gone.', homeMenu());
  const ch = rows[0];
  if (!ch.outcome_text) { S.ctx = { id, options: ch.options }; S.mode = 'resolve_outcome'; return send(chatId, 'Send the outcome text first.'); }
  send(chatId, '◈ The judges are deliberating…');
  const verdict = await judgeWithRanking(ch.question, ch.outcome_text, ch.options);
  if (!verdict.ranking || !verdict.ranking.length)
    return send(chatId, 'No judge responded (check AI keys). Try ✎ Rank manually.', { reply_markup: { inline_keyboard: [[{ text: '✎ Rank manually', callback_data: 'rMan:' + id }], backRow] } });
  return applyResolution(chatId, id, verdict.ranking, verdict.votes || [], verdict.reason || '');
}

function startManualResolve(chatId, id) {
  q(`SELECT options FROM challenges WHERE id=$1`, [id]).then(({ rows }) => {
    if (!rows.length) return send(chatId, 'Gone.', homeMenu());
    S.ctx = { id, options: rows[0].options };
    S.mode = 'resolve_manual';
    const ids = rows[0].options.map(o => o.id).join(' ');
    send(chatId, `✎ Rank *all* options best→worst by id:\n\n\`${ids}\``);
  });
}

// Build ranking → persist → award Ichor → update streaks
async function applyResolution(chatId, id, ranking, ai_votes, ai_reason) {
  const { map, ordered } = buildPointsMap(ranking);
  const winner_id = ranking[0];

  await q(
    `UPDATE challenges SET winner_id=$1, ranking=$2, ai_votes=$3, ai_reason=$4,
       status='revealed', resolved_at=NOW() WHERE id=$5`,
    [winner_id, JSON.stringify(ordered), JSON.stringify(ai_votes), ai_reason, id]);

  for (const [optionId, points] of Object.entries(map)) {
    await q(`UPDATE picks SET points_earned=$1 WHERE challenge_id=$2 AND choice=$3`, [points, id, optionId]);
  }
  await q(
    `UPDATE users u SET points = u.points + COALESCE(p.points_earned,0)
     FROM picks p WHERE p.telegram_id=u.telegram_id AND p.challenge_id=$1`, [id]);
  await q(
    `UPDATE users u
     SET streak = CASE WHEN p.choice=$2 THEN u.streak+1 ELSE 0 END,
         best_streak = GREATEST(u.best_streak, u.streak + CASE WHEN p.choice=$2 THEN 1 ELSE 0 END)
     FROM picks p WHERE p.telegram_id=u.telegram_id AND p.challenge_id=$1`, [id, winner_id]);

  reset();
  const line = ordered.map(o => `*${o.id.toUpperCase()}* · #${o.rank} · +${o.points}`).join('\n');
  send(chatId,
    `◈ *Call #${id} resolved.*\n\nConsensus: ${ranking.map(x => x.toUpperCase()).join(' › ')}\n\n${line}` +
    (ai_reason ? `\n\n_“${esc(ai_reason)}”_` : '') +
    `\n\n${UNIT} awarded and streaks updated.`,
    homeMenu());
}

async function deleteCall(chatId, id) {
  await q(`DELETE FROM picks WHERE challenge_id=$1`, [id]);
  await q(`DELETE FROM challenges WHERE id=$1`, [id]);
  send(chatId, `Call #${id} deleted.`, { reply_markup: { inline_keyboard: [[{ text: '▤ Calls', callback_data: 'calls' }], backRow] } });
}

// ═══ Quests ════════════════════════════════════════════
async function listQuests(chatId) {
  const { rows } = await q(
    `SELECT q.*, (SELECT COUNT(*)::int FROM quest_completions c WHERE c.quest_id=q.id) done
     FROM quests q ORDER BY created_at DESC LIMIT 20`);
  const kb = [[{ text: '＋ New Quest', callback_data: 'quest_add' }]];
  for (const r of rows) {
    kb.push([{ text: `${r.is_active ? '●' : '○'} ${esc(r.title).slice(0, 24)} · +${r.reward} · ${r.done}✓`, callback_data: 'noop' }]);
    kb.push([
      { text: r.is_active ? 'Deactivate' : 'Activate', callback_data: 'qtog:' + r.id },
      { text: '✕ Delete', callback_data: 'qdel:' + r.id },
    ]);
  }
  kb.push(backRow);
  send(chatId, '◆ *Quests*', { reply_markup: { inline_keyboard: kb } });
}
async function toggleQuest(chatId, id) {
  await q(`UPDATE quests SET is_active = NOT is_active WHERE id=$1`, [id]);
  listQuests(chatId);
}
async function deleteQuest(chatId, id) {
  await q(`DELETE FROM quest_completions WHERE quest_id=$1`, [id]);
  await q(`DELETE FROM quests WHERE id=$1`, [id]);
  listQuests(chatId);
}

// ═══ Users ═══════════════════════════════════════════
async function listUsers(chatId) {
  const { rows } = await q(
    `SELECT telegram_id, first_name, username, points, streak FROM users ORDER BY points DESC LIMIT 12`);
  if (!rows.length) return send(chatId, 'No players yet.', { reply_markup: { inline_keyboard: [backRow] } });
  const kb = rows.map(u => [{
    text: `${esc(u.first_name || u.username || u.telegram_id)} · ${u.points} ${UNIT} · ✎`,
    callback_data: 'upts:' + u.telegram_id,
  }]);
  kb.push(backRow);
  send(chatId, `● *Users* — tap to adjust ${UNIT}`, { reply_markup: { inline_keyboard: kb } });
}

// ═══ Broadcast (via the public game bot) ═══════════════════════
async function doBroadcast(chatId, message) {
  const sender = publicBot || bot;
  const { rows } = await q(`SELECT telegram_id FROM users`);
  let sent = 0, failed = 0;
  send(chatId, `▧ Sending to ${rows.length} players…`);
  for (const u of rows) {
    try { await sender.sendMessage(u.telegram_id, message); sent++; }
    catch { failed++; }
    await new Promise(r => setTimeout(r, 40));
  }
  send(chatId, `▧ Done. Sent ${sent}, failed ${failed}.`, homeMenu());
}

// ═══ Auto-close at reveal time + nudge the creator ═════════════════
cron.schedule('* * * * *', async () => {
  try {
    const { rows } = await q(`SELECT id, question FROM challenges WHERE status='open' AND reveal_at <= NOW()`);
    for (const ch of rows) {
      await q(`UPDATE challenges SET status='closed' WHERE id=$1`, [ch.id]);
      try {
        await send(ADMIN,
          `○ *Call #${ch.id} closed* — entries are in.\n\n_${esc(ch.question).slice(0, 60)}_\n\nResolve it to award ${UNIT}.`,
          { reply_markup: { inline_keyboard: [[{ text: '◈ Resolve now', callback_data: 'resolve:' + ch.id }]] } });
      } catch {}
    }
  } catch (e) { console.error(e); }
});

bot.on('polling_error', (e) => console.error('admin polling_error', e.code || e.message));
console.log('✓ HUBRIS admin bot running');
