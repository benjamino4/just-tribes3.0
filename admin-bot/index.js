import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { q } from '../server/db.js';
import {
  judgeWithRanking,
  listProviders,
  activeProviders,
  getProvider,
  addProvider,
  toggleProvider,
  deleteProvider,
  chatProvider,
  testProvider,
} from '../server/ai.js';
import { buildPointsMap } from '../server/scoring.js';

// ═════════════════════════════════════════
// HUBRIS — ADMIN BOT  (a SEPARATE bot from the public game bot)
// The creator controls EVERYTHING about the Mini App from here, in chat:
//   • create / edit / reschedule / reopen / delete the daily call
//   • resolve + award Ichor (AI judges or manual ranking)
//   • announce a call to every player
//   • give / take / set Ichor, reset streaks, ban / unban, delete users
//   • create / edit / toggle / delete quests
//   • broadcast, live stats, mini-app-wide actions, danger zone
// Only ADMIN_TELEGRAM_ID is ever answered.
// ═════════════════════════════════════════
const ADMIN = Number(process.env.ADMIN_TELEGRAM_ID);
const ADMIN_SET = Number.isFinite(ADMIN) && ADMIN > 0;

if (!process.env.ADMIN_BOT_TOKEN) {
  console.error('✗ ADMIN_BOT_TOKEN is missing. Set it in your environment (a DIFFERENT bot token from the public game bot) and restart.');
}
// No polling here: this bot receives updates by webhook when it rides on the
// web service (free tier), and only self-polls when launched as its own worker.
const bot = new TelegramBot(process.env.ADMIN_BOT_TOKEN, { polling: false });

// Public bot handle (no polling) — used only to message players as the game bot.
const publicBot = process.env.BOT_TOKEN
  ? new TelegramBot(process.env.BOT_TOKEN, { polling: false })
  : null;
const MINI_APP_URL = process.env.MINI_APP_URL || '';

const isAdmin = (msg) => ADMIN_SET && msg?.from?.id === ADMIN;
const UNIT = 'Ichor';

// Single-admin conversation state.
// S.chat (when set) is the running message history [{role,content}] for a
// freeform chat with a chosen AI provider; S.chatId is that provider's id.
const S = { mode: null, draft: {}, ctx: {}, chat: null, chatId: null };
function reset() { S.mode = null; S.draft = {}; S.ctx = {}; S.chat = null; S.chatId = null; }

const esc = (s) => String(s ?? '');
const fmt = (d) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

// ─── Reveal-time parser ─────────────────────────────
// Accepts:  +8h  +30m  +2d   |   20:00 (today/tomorrow)   |   2026-10-09 20:00
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

// ─── Menus ──────────────────────────────
function homeMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '◈ Statistics', callback_data: 'stats' }],
        [{ text: '＋ New Call', callback_data: 'new' }, { text: '▤ Calls', callback_data: 'calls' }],
        [{ text: '◆ Quests', callback_data: 'quests' }, { text: '● Users', callback_data: 'users' }],
        [{ text: '▧ Broadcast', callback_data: 'bc' }, { text: '⚙ Mini App', callback_data: 'miniapp' }],
        [{ text: '◇ AI', callback_data: 'ai' }],
        [{ text: '⚠ Danger Zone', callback_data: 'danger' }],
      ],
    },
  };
}
const backRow = [{ text: '‹ Home', callback_data: 'home' }];

function send(chatId, text, extra = {}) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', disable_web_page_preview: true, ...extra });
}

// ═══ Guard + entry (onboarding that actually tells you what's wrong) ═══
function greet(chatId) {
  reset();
  return send(chatId,
    '◈ *HUBRIS — Control*\n\nYou are the creator. Everything in the Mini App is made and changed from here.',
    homeMenu());
}

// The #1 reason /start "does nothing": ADMIN_TELEGRAM_ID is unset or wrong,
// so the old bot silently ignored everyone. Now we always answer /start and
// tell the sender their numeric id so they can configure it.
function onboard(msg) {
  const chatId = msg.chat.id;
  const id = msg.from.id;
  if (!ADMIN_SET) {
    return send(chatId,
      '⚠ *Admin not configured yet.*\n\n' +
      'This bot has no `ADMIN_TELEGRAM_ID` set, so nobody can command it.\n\n' +
      `Your numeric Telegram ID is:\n\u2192 \`${id}\`\n\n` +
      'Set `ADMIN_TELEGRAM_ID` to that value in your environment (Render → the admin worker → Environment), redeploy, then send /start again.');
  }
  // Configured but this isn't the admin.
  return send(chatId,
    '⛔ *Not authorized.*\n\n' +
    `This admin bot only answers the creator.\n\nYour ID is \`${id}\`.\n` +
    (id !== ADMIN
      ? `The configured admin ID is \`${ADMIN}\`. If that’s wrong, update \`ADMIN_TELEGRAM_ID\` and redeploy.`
      : ''));
}

bot.onText(/^\/(start|home|menu)\b/, (msg) => {
  if (!isAdmin(msg)) return onboard(msg);
  greet(msg.chat.id);
});
bot.onText(/^\/myid\b/, (msg) => {
  send(msg.chat.id, `Your Telegram ID: \`${msg.from.id}\``);
});
bot.onText(/^\/cancel\b/, (msg) => {
  if (!isAdmin(msg)) return;
  reset();
  send(msg.chat.id, 'Cancelled.', homeMenu());
});
bot.onText(/^\/help\b/, (msg) => {
  if (!isAdmin(msg)) return onboard(msg);
  send(msg.chat.id,
    '*Commands*\n/start — open the control panel\n/cancel — abort the current step\n/myid — show your Telegram ID\n\nEverything else is driven by the on-screen buttons.',
    homeMenu());
});
// ═══ Callback router ═════════════════════════
bot.on('callback_query', async (query) => {
  if (!ADMIN_SET || query.from.id !== ADMIN) { try { bot.answerCallbackQuery(query.id); } catch {} return; }
  const chatId = query.message.chat.id;
  const data = query.data || '';
  try { bot.answerCallbackQuery(query.id); } catch {}
  try {
    // top level
    if (data === 'home') return greet(chatId);
    if (data === 'noop') return;
    if (data === 'stats') return showStats(chatId);
    if (data === 'new') return startNewCall(chatId);
    if (data === 'calls') return listCalls(chatId);
    if (data === 'quests') return listQuests(chatId);
    if (data === 'users') return listUsers(chatId);
    if (data === 'miniapp') return miniAppMenu(chatId);
    if (data === 'danger') return dangerMenu(chatId);
    if (data === 'bc') { S.mode = 'broadcast'; return send(chatId, '▧ Type the broadcast message. It goes to *every* player as the game bot.\n\n/cancel to stop.', { reply_markup: { inline_keyboard: [backRow] } }); }

    // quests
    if (data === 'quest_add') return questTypeMenu(chatId);
    if (data.startsWith('qnew:')) return startQuestBuild(chatId, data.split(':')[1]);
    if (data.startsWith('qtog:')) return toggleQuest(chatId, data.split(':')[1]);
    if (data.startsWith('qdel:')) return deleteQuest(chatId, data.split(':')[1]);
    if (data.startsWith('qrew:')) { S.mode = 'quest_rew'; S.ctx.qid = data.split(':')[1]; return send(chatId, `Send the new reward (number) for quest \`${S.ctx.qid}\`.`); }

    // calls
    if (data.startsWith('resolve:')) return startResolve(chatId, data.split(':')[1]);
    if (data.startsWith('rAI:')) return resolveWithAI(chatId, data.split(':')[1]);
    if (data.startsWith('rMan:')) return startManualResolve(chatId, data.split(':')[1]);
    // reason chooser (after a ranking is locked)
    if (data === 'rsnAI') return finalizeResolution(chatId, S.ctx.aiReason || '', true);
    if (data === 'rsnNone') return finalizeResolution(chatId, '', false);
    if (data === 'rsnCustom') { S.mode = 'resolve_reason'; return send(chatId, '✎ Send the reason players will see for this result.'); }
    if (data.startsWith('del:')) return deleteCall(chatId, data.split(':')[1]);
    if (data.startsWith('cedit:')) return editCallMenu(chatId, data.split(':')[1]);
    if (data.startsWith('cedq:')) { S.mode = 'edit_question'; S.ctx.id = data.split(':')[1]; return send(chatId, 'Send the new *question* text.'); }
    if (data.startsWith('cedo:')) { S.mode = 'edit_options'; S.ctx.id = data.split(':')[1]; return send(chatId, 'Send the new *options*, one per line (`id|text` or plain). 2–6.\n\n⚠ Existing picks keep their letter; keep ids if picks exist.'); }
    if (data.startsWith('cedr:')) { S.mode = 'edit_reveal'; S.ctx.id = data.split(':')[1]; return send(chatId, 'Send the new *reveal time*: `+8h` · `20:00` · `2026-10-09 20:00`'); }
    if (data.startsWith('creopen:')) return reopenCall(chatId, data.split(':')[1]);
    if (data.startsWith('cann:')) return announceCall(chatId, data.split(':')[1]);

    // users
    if (data.startsWith('user:')) return userDetail(chatId, data.split(':')[1]);
    if (data === 'ufind') { S.mode = 'user_find'; return send(chatId, 'Send a numeric Telegram id or @username to find a player.'); }
    if (data === 'giftall') { S.mode = 'gift_all'; return send(chatId, `Send an amount of ${UNIT} to add to *every* player (use a negative number to deduct).`); }
    if (data.startsWith('uset:')) { S.mode = 'user_points'; S.ctx.uid = data.split(':')[1]; return send(chatId, `Send the new ${UNIT} *total* for user \`${S.ctx.uid}\`.`); }
    if (data.startsWith('uadd:')) { S.mode = 'user_add'; S.ctx.uid = data.split(':')[1]; return send(chatId, `Send how much ${UNIT} to *add* to \`${S.ctx.uid}\` (negative to deduct).`); }
    if (data.startsWith('ustk:')) return resetStreak(chatId, data.split(':')[1]);
    if (data.startsWith('uban:')) return toggleBan(chatId, data.split(':')[1]);
    if (data.startsWith('udel:')) return deleteUser(chatId, data.split(':')[1]);

    // mini-app-wide
    if (data === 'ma_streak0') return confirm(chatId, 'ma_streak0', 'reset *every* player’s current streak to 0');
    if (data === 'ma_remind') { S.mode = 'remind'; return send(chatId, 'Send the reminder message to push to all players (as the game bot).'); }

    // AI
    if (data === 'ai') return aiMenu(chatId);
    if (data === 'ai_list') return aiList(chatId);
    if (data === 'ai_pick') return aiPickToChat(chatId);
    if (data.startsWith('aichat:')) return startChat(chatId, data.slice('aichat:'.length));
    if (data === 'ai_endchat') { const was = !!S.chat; reset(); return send(chatId, was ? '◇ Chat ended.' : 'No chat was open.', aiKb()); }
    if (data === 'ai_add') { S.mode = 'ai_add'; return send(chatId, '◇ *Register an AI provider*\n\nSend it on one line as:\n`name | endpoint_url | model | api_key`\n\nThe endpoint must be an OpenAI-compatible `chat/completions` URL, e.g.\n`myai | https://api.example.com/v1/chat/completions | gpt-4o-mini | sk-...`\n\n/cancel to stop.', { reply_markup: { inline_keyboard: [[{ text: '‹ AI', callback_data: 'ai' }]] } }); }
    if (data.startsWith('aitog:')) return aiToggle(chatId, data.slice('aitog:'.length));
    if (data.startsWith('aidel:')) return aiDelete(chatId, data.slice('aidel:'.length));
    if (data.startsWith('aitest:')) return aiTest(chatId, data.slice('aitest:'.length));

    // danger zone (two-step confirm)
    if (data === 'dz_leader') return confirm(chatId, 'dz_leader', `zero out *all* ${UNIT} for every player (reset the leaderboard)`);
    if (data === 'dz_picks') return confirm(chatId, 'dz_picks', 'delete *all* picks from *all* calls');
    if (data === 'dz_calls') return confirm(chatId, 'dz_calls', 'delete *all* calls and their picks');
    if (data === 'dz_users') return confirm(chatId, 'dz_users', 'delete *all* users (full wipe of players)');
    if (data.startsWith('do:')) return runDanger(chatId, data.split(':')[1]);
  } catch (e) {
    console.error(e);
    send(chatId, '⚠ ' + (e.message || 'error'), homeMenu());
  }
});

function confirm(chatId, action, phrase) {
  return send(chatId,
    `⚠ *Confirm*\n\nThis will ${phrase}. This cannot be undone.`,
    { reply_markup: { inline_keyboard: [
      [{ text: '✗ Yes, do it', callback_data: 'do:' + action }],
      backRow,
    ] } });
}
// ═══ Statistics ══════════════════════════
async function showStats(chatId) {
  const [u, p, qc, open, bans] = await Promise.all([
    q(`SELECT COUNT(*)::int c FROM users`),
    q(`SELECT COUNT(*)::int c FROM picks`),
    q(`SELECT COUNT(*)::int c FROM quest_completions`),
    q(`SELECT COUNT(*)::int c FROM challenges WHERE status='open'`),
    q(`SELECT COUNT(*)::int c FROM users WHERE banned=TRUE`),
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
    `Players: *${u.rows[0].c}* (banned: ${bans.rows[0].c})\nPicks: *${p.rows[0].c}*\nQuests done: *${qc.rows[0].c}*\nOpen calls: *${open.rows[0].c}*\n\n` +
    `*Top ${UNIT}*\n${leaders}\n\n*Recent calls*\n${calls}`,
    { reply_markup: { inline_keyboard: [[{ text: '↻ Refresh', callback_data: 'stats' }], backRow] } });
}

// ═══ New call (conversation) ════════════════════
function startNewCall(chatId) {
  reset();
  S.mode = 'new_question';
  S.draft = {};
  send(chatId, '＋ *New Call* — step 1 / 3\n\nSend the *question* players will decide on.\n\n/cancel to stop.');
}

// ═══ Text / conversation handler ══════════════════
bot.on('message', async (msg) => {
  if (!ADMIN_SET || msg?.from?.id !== ADMIN) return;   // ignore the whole world but the creator
  if (!msg.text) return;
  // Commands are handled elsewhere — except /skip, which some builder steps accept.
  if (msg.text.startsWith('/') && msg.text.trim() !== '/skip') return;
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
      case 'edit_question': {
        await q(`UPDATE challenges SET question=$1 WHERE id=$2`, [text, S.ctx.id]);
        const id = S.ctx.id; reset();
        return send(chatId, `✎ Question updated for call #${id}.`, { reply_markup: { inline_keyboard: [[{ text: '‹ Call', callback_data: 'cedit:' + id }], backRow] } });
      }
      case 'edit_options': {
        const opts = parseOptions(text);
        if (opts.length < 2 || opts.length > 6) return send(chatId, 'Need 2–6 options. Try again.');
        await q(`UPDATE challenges SET options=$1 WHERE id=$2`, [JSON.stringify(opts), S.ctx.id]);
        const id = S.ctx.id; reset();
        return send(chatId, `✎ Options updated for call #${id}.`, { reply_markup: { inline_keyboard: [[{ text: '‹ Call', callback_data: 'cedit:' + id }], backRow] } });
      }
      case 'edit_reveal': {
        const when = parseReveal(text);
        if (!when) return send(chatId, 'Could not read that time. Try `+8h` or `20:00`.');
        await q(`UPDATE challenges SET reveal_at=$1 WHERE id=$2`, [when, S.ctx.id]);
        const id = S.ctx.id; reset();
        return send(chatId, `✎ Reveal time set to ${fmt(when)} for call #${id}.`, { reply_markup: { inline_keyboard: [[{ text: '‹ Call', callback_data: 'cedit:' + id }], backRow] } });
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
        // Manual ranking has no AI reason — go straight to the reason chooser.
        S.ctx = { id: S.ctx.id, ranking: valid, votes: [], aiReason: '' };
        return askReason(chatId);
      }
      case 'resolve_reason': {
        const reason = text.trim();
        return finalizeResolution(chatId, reason, true);
      }
      case 'quest_build': {
        const [title, reward, description, url] = text.split('|').map(s => (s || '').trim());
        if (!title || !reward || isNaN(Number(reward)))
          return send(chatId, 'Format: `title | reward | description | url`');
        S.draft.title = title;
        S.draft.reward = Number(reward);
        S.draft.description = description || '';
        S.draft.url = url || null;
        S.mode = 'quest_terms';
        if (S.draft.action_type === 'terms') {
          return send(chatId, '§ Send the *Terms & Conditions* text players must agree to before completing this quest.');
        }
        return send(chatId, 'Attach *Terms & Conditions* players must agree to before completing?\n\nSend the T&C text now, or /skip for none.');
      }
      case 'quest_terms': {
        const skip = text.trim() === '/skip';
        if (skip && S.draft.action_type === 'terms')
          return send(chatId, 'A Terms & Conditions quest needs its T&C text. Please send it (or /cancel).');
        const requires_terms = S.draft.action_type === 'terms' ? true : !skip;
        const terms_text = skip ? null : text.trim();
        const d = S.draft;
        const { rows } = await q(
          `INSERT INTO quests (title, description, reward, action_url, action_type, requires_terms, terms_text)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [d.title, d.description, d.reward, d.url, d.action_type, requires_terms, terms_text]);
        reset();
        return send(chatId, `◆ Quest #${rows[0].id} created (+${d.reward} ${UNIT})${requires_terms ? ' · T&C required' : ''}.`, homeMenu());
      }
      case 'quest_rew': {
        const r = Number(text);
        if (isNaN(r)) return send(chatId, 'Send a number.');
        await q(`UPDATE quests SET reward=$1 WHERE id=$2`, [r, S.ctx.qid]);
        reset();
        return send(chatId, `◆ Reward updated to +${r} ${UNIT}.`, { reply_markup: { inline_keyboard: [[{ text: '◆ Quests', callback_data: 'quests' }], backRow] } });
      }
      case 'user_points': {
        const pts = Number(text);
        if (isNaN(pts)) return send(chatId, 'Send a number.');
        const { rows } = await q(`UPDATE users SET points=$1 WHERE telegram_id=$2 RETURNING first_name, username`, [pts, S.ctx.uid]);
        const uid = S.ctx.uid; reset();
        if (!rows.length) return send(chatId, 'No such user.', homeMenu());
        return send(chatId, `Set ${esc(rows[0].first_name || rows[0].username || uid)} to *${pts}* ${UNIT}.`, { reply_markup: { inline_keyboard: [[{ text: '‹ User', callback_data: 'user:' + uid }], backRow] } });
      }
      case 'user_add': {
        const d = Number(text);
        if (isNaN(d)) return send(chatId, 'Send a number (negative to deduct).');
        const { rows } = await q(`UPDATE users SET points = GREATEST(0, points + $1) WHERE telegram_id=$2 RETURNING first_name, username, points`, [d, S.ctx.uid]);
        const uid = S.ctx.uid; reset();
        if (!rows.length) return send(chatId, 'No such user.', homeMenu());
        return send(chatId, `${d >= 0 ? 'Added' : 'Deducted'} ${Math.abs(d)} ${UNIT}. ${esc(rows[0].first_name || rows[0].username || uid)} now has *${rows[0].points}*.`, { reply_markup: { inline_keyboard: [[{ text: '‹ User', callback_data: 'user:' + uid }], backRow] } });
      }
      case 'user_find': {
        let uid = text.replace('@', '').trim();
        let rows;
        if (/^\d+$/.test(uid)) {
          ({ rows } = await q(`SELECT telegram_id FROM users WHERE telegram_id=$1`, [uid]));
        } else {
          ({ rows } = await q(`SELECT telegram_id FROM users WHERE lower(username)=lower($1)`, [uid]));
        }
        reset();
        if (!rows.length) return send(chatId, 'No matching player.', { reply_markup: { inline_keyboard: [[{ text: '● Users', callback_data: 'users' }], backRow] } });
        return userDetail(chatId, rows[0].telegram_id);
      }
      case 'gift_all': {
        const d = Number(text);
        if (isNaN(d) || d === 0) return send(chatId, 'Send a non-zero number.');
        const { rowCount } = await q(`UPDATE users SET points = GREATEST(0, points + $1)`, [d]);
        reset();
        return send(chatId, `◈ ${d >= 0 ? 'Gifted' : 'Deducted'} ${Math.abs(d)} ${UNIT} ${d >= 0 ? 'to' : 'from'} *${rowCount}* players.`, homeMenu());
      }
      case 'remind': {
        reset();
        return doBroadcast(chatId, text);
      }
      case 'broadcast': {
        reset();
        return doBroadcast(chatId, text);
      }
      case 'ai_add': {
        const parts = text.split('|').map(s => (s || '').trim());
        const [name, url, model, key] = parts;
        if (parts.length < 4 || !name || !url || !model || !key)
          return send(chatId, 'Format: `name | endpoint_url | model | api_key`\nAll four are required.');
        if (!/^https?:\/\//i.test(url))
          return send(chatId, 'The endpoint must be a full `https://.../chat/completions` URL.');
        const id = await addProvider(name, url, model, key);
        reset();
        return send(chatId, `◇ Provider *${esc(name)}* registered (#${id}). It is active and will now judge calls and is available to chat.`, aiKb());
      }
      case 'ai_chat': {
        if (!S.chat || !S.chatId) { reset(); return send(chatId, 'Chat is no longer open.', aiKb()); }
        S.chat.push({ role: 'user', content: text });
        // keep history bounded (last ~20 turns)
        if (S.chat.length > 40) S.chat = S.chat.slice(-40);
        bot.sendChatAction(chatId, 'typing').catch(() => {});
        const r = await chatProvider(S.chatId, S.chat);
        if (r.error) {
          // drop the user turn we couldn't answer so history stays clean
          S.chat.pop();
          return send(chatId, `⚠ ${esc(r.error)} — the provider didn't answer. Try again or /cancel.`, chatControls());
        }
        S.chat.push({ role: 'assistant', content: r.content });
        return send(chatId, r.content || '(empty reply)', chatControls());
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
    const id = rows[0].id;
    reset();
    send(chatId,
      `◈ *Call #${id} is live.*\n\n*${esc(d.question)}*\n` +
      d.options.map(o => `· *${o.id.toUpperCase()}* — ${esc(o.text)}`).join('\n') +
      `\n\nReveal · ${fmt(d.reveal_at)}`,
      { reply_markup: { inline_keyboard: [
        [{ text: '▧ Announce to all players', callback_data: 'cann:' + id }],
        backRow,
      ] } });
  } catch (e) {
    reset();
    if (String(e.message).includes('duplicate') || e.code === '23505')
      return send(chatId, 'A call already exists for today. Delete or edit it from ▤ Calls.', homeMenu());
    throw e;
  }
}
// ═══ Calls: list / edit / resolve / reopen / announce / delete ═══
async function listCalls(chatId) {
  const { rows } = await q(
    `SELECT c.id, c.challenge_date, c.question, c.status, c.reveal_at,
       (SELECT COUNT(*)::int FROM picks p WHERE p.challenge_id=c.id) picks
     FROM challenges c ORDER BY c.challenge_date DESC LIMIT 10`);
  if (!rows.length) return send(chatId, 'No calls yet. Create one with ＋ New Call.', { reply_markup: { inline_keyboard: [[{ text: '＋ New Call', callback_data: 'new' }], backRow] } });
  const kb = [];
  for (const r of rows) {
    const dot = r.status === 'revealed' ? '✓' : r.status === 'closed' ? '○' : '●';
    kb.push([{ text: `${dot} ${r.challenge_date} · ${r.picks}p · ${esc(r.question).slice(0, 24)}`, callback_data: 'cedit:' + r.id }]);
  }
  kb.push([{ text: '＋ New Call', callback_data: 'new' }]);
  kb.push(backRow);
  send(chatId, '▤ *Calls* — tap one to manage', { reply_markup: { inline_keyboard: kb } });
}

async function editCallMenu(chatId, id) {
  const { rows } = await q(`SELECT * FROM challenges WHERE id=$1`, [id]);
  if (!rows.length) return send(chatId, 'Gone.', homeMenu());
  const c = rows[0];
  const picks = (await q(`SELECT COUNT(*)::int c FROM picks WHERE challenge_id=$1`, [id])).rows[0].c;
  const kb = [];
  if (c.status !== 'revealed') kb.push([{ text: '◈ Resolve + award', callback_data: 'resolve:' + id }]);
  if (c.status === 'revealed' || c.status === 'closed') kb.push([{ text: '↺ Reopen for picks', callback_data: 'creopen:' + id }]);
  kb.push([{ text: '✎ Question', callback_data: 'cedq:' + id }, { text: '✎ Options', callback_data: 'cedo:' + id }]);
  kb.push([{ text: '✎ Reveal time', callback_data: 'cedr:' + id }, { text: '▧ Announce', callback_data: 'cann:' + id }]);
  kb.push([{ text: '✗ Delete call', callback_data: 'del:' + id }]);
  kb.push([{ text: '‹ Calls', callback_data: 'calls' }, ...backRow]);
  send(chatId,
    `*Call #${id}* · _${c.status}_ · ${picks} picks\n\n*${esc(c.question)}*\n` +
    c.options.map(o => `· *${o.id.toUpperCase()}* — ${esc(o.text)}`).join('\n') +
    `\n\nReveal · ${fmt(c.reveal_at)}` +
    (c.outcome_text ? `\nOutcome · ${esc(c.outcome_text)}` : ''),
    { reply_markup: { inline_keyboard: kb } });
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
  // Stash the ranking, then let the admin choose the reason to publish.
  S.ctx = { id, ranking: verdict.ranking, votes: verdict.votes || [], aiReason: verdict.reason || '' };
  return askReason(chatId);
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

// Build ranking → persist → award Ichor → update streaks.
// show_reason controls whether players see ANY reason at all; ai_reason now
// holds either the judges' reason OR an admin-authored custom reason.
async function applyResolution(chatId, id, ranking, ai_votes, ai_reason, show_reason = true) {
  const { map, ordered } = buildPointsMap(ranking);
  const winner_id = ranking[0];

  await q(
    `UPDATE challenges SET winner_id=$1, ranking=$2, ai_votes=$3, ai_reason=$4,
       show_reason=$5, status='revealed', resolved_at=NOW() WHERE id=$6`,
    [winner_id, JSON.stringify(ordered), JSON.stringify(ai_votes), ai_reason, show_reason, id]);

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
  const reasonLine = (show_reason && ai_reason) ? `\n\n_“${esc(ai_reason)}”_`
    : (!show_reason ? `\n\n_(no reason shown to players)_` : '');
  send(chatId,
    `◈ *Call #${id} resolved.*\n\nConsensus: ${ranking.map(x => x.toUpperCase()).join(' › ')}\n\n${line}` +
    reasonLine +
    `\n\n${UNIT} awarded and streaks updated.`,
    { reply_markup: { inline_keyboard: [[{ text: '▧ Announce result', callback_data: 'cann:' + id }], backRow] } });
}

// After a ranking is decided (AI or manual) the admin chooses what reason —
// if any — players will see. Fully customizable: AI's words, your own, or none.
function askReason(chatId) {
  const kb = [];
  if (S.ctx.aiReason) kb.push([{ text: '◈ Use the judges’ reason', callback_data: 'rsnAI' }]);
  kb.push([{ text: '✎ Write a custom reason', callback_data: 'rsnCustom' }]);
  kb.push([{ text: '∅ Publish with no reason', callback_data: 'rsnNone' }]);
  kb.push(backRow);
  send(chatId,
    `Ranking locked: ${(S.ctx.ranking || []).map(x => x.toUpperCase()).join(' › ')}\n\n` +
    `What reason should players see?` +
    (S.ctx.aiReason ? `\n\nThe judges said:\n_“${esc(S.ctx.aiReason)}”_` : ''),
    { reply_markup: { inline_keyboard: kb } });
}

// Commit using whatever ranking/votes were stashed on S.ctx.
function finalizeResolution(chatId, reason, show) {
  const { id, ranking, votes } = S.ctx;
  return applyResolution(chatId, id, ranking, votes || [], reason || '', show);
}

async function reopenCall(chatId, id) {
  await q(`UPDATE challenges SET status='open', winner_id=NULL, ranking=NULL, ai_votes=NULL, ai_reason=NULL, outcome_text=NULL, resolved_at=NULL WHERE id=$1`, [id]);
  await q(`UPDATE picks SET points_earned=0 WHERE challenge_id=$1`, [id]);
  send(chatId, `↺ Call #${id} reopened for picks. (Awarded ${UNIT} is not clawed back automatically — adjust users if needed.)`, { reply_markup: { inline_keyboard: [[{ text: '‹ Call', callback_data: 'cedit:' + id }], backRow] } });
}

async function announceCall(chatId, id) {
  const { rows } = await q(`SELECT * FROM challenges WHERE id=$1`, [id]);
  if (!rows.length) return send(chatId, 'Gone.', homeMenu());
  const c = rows[0];
  let text;
  if (c.status === 'revealed') {
    text = `◈ HUBRIS — result is in.\n\n${c.question}\n\nBest call: ${String(c.winner_id || '').toUpperCase()}. Open the app to see where you ranked.`;
  } else {
    text = `◈ HUBRIS — today's call is live.\n\n${c.question}\n\nLock in your pick before ${fmt(c.reveal_at)}. The sharpest call pays the most ${UNIT}.`;
  }
  const extra = MINI_APP_URL ? { reply_markup: { inline_keyboard: [[{ text: '◈ Open HUBRIS', url: MINI_APP_URL }]] } } : {};
  return doBroadcast(chatId, text, extra);
}

async function deleteCall(chatId, id) {
  await q(`DELETE FROM picks WHERE challenge_id=$1`, [id]);
  await q(`DELETE FROM challenges WHERE id=$1`, [id]);
  send(chatId, `Call #${id} deleted.`, { reply_markup: { inline_keyboard: [[{ text: '▤ Calls', callback_data: 'calls' }], backRow] } });
}
// ═══ Quests ════════════════════════════
// Quest types the admin builds from the bot. Each carries a monochrome glyph
// the Mini App renders; 'terms' always gates completion on an "I agree" step.
const QUEST_TYPES = {
  x_follow: { label: 'Follow-X quest', glyph: '✕' },
  task:     { label: 'Task',          glyph: '◆' },
  research: { label: 'Research task',  glyph: '◇' },
  terms:    { label: 'T&C agreement',  glyph: '§' },
  link:     { label: 'Link task',      glyph: '◈' },
};
function questTypeLabel(t) { return (QUEST_TYPES[t] || QUEST_TYPES.link).label; }

function questTypeMenu(chatId) {
  reset();
  send(chatId, '◆ *New Quest* — choose a type', { reply_markup: { inline_keyboard: [
    [{ text: '✕ Follow an X account', callback_data: 'qnew:x_follow' }],
    [{ text: '◆ Link / generic task', callback_data: 'qnew:task' }],
    [{ text: '◇ AI / research task', callback_data: 'qnew:research' }],
    [{ text: '§ Terms & Conditions', callback_data: 'qnew:terms' }],
    backRow,
  ] } });
}

function startQuestBuild(chatId, type) {
  if (!QUEST_TYPES[type]) type = 'task';
  reset();
  S.mode = 'quest_build';
  S.draft = { action_type: type };
  const hint = type === 'x_follow'
    ? 'Send: `title | reward | description | x_profile_url`\ne.g. `Follow us on X | 50 | Follow @hubris for the alpha | https://x.com/hubris`'
    : type === 'research'
    ? 'Send: `title | reward | description | url`\ne.g. `Read the partner report | 80 | Review our revenue-share partner | https://…`'
    : type === 'terms'
    ? 'Send: `title | reward | description | url`\n(url optional — you’ll paste the T&C text next)'
    : 'Send: `title | reward | description | url`\n(url optional)';
  send(chatId, `◆ *New ${questTypeLabel(type)}*\n\n${hint}\n\n/cancel to stop.`);
}

async function listQuests(chatId) {
  const { rows } = await q(
    `SELECT q.*, (SELECT COUNT(*)::int FROM quest_completions c WHERE c.quest_id=q.id) done
     FROM quests q ORDER BY created_at DESC LIMIT 20`);
  const kb = [[{ text: '＋ New Quest', callback_data: 'quest_add' }]];
  for (const r of rows) {
    const g = (QUEST_TYPES[r.action_type] || QUEST_TYPES.link).glyph;
    const tc = r.requires_terms ? ' §' : '';
    kb.push([{ text: `${r.is_active ? '●' : '○'} ${g} ${esc(r.title).slice(0, 22)}${tc} · +${r.reward} · ${r.done}✓`, callback_data: 'noop' }]);
    kb.push([
      { text: r.is_active ? 'Deactivate' : 'Activate', callback_data: 'qtog:' + r.id },
      { text: '✎ Reward', callback_data: 'qrew:' + r.id },
      { text: '✗ Delete', callback_data: 'qdel:' + r.id },
    ]);
  }
  kb.push(backRow);
  send(chatId, '◆ *Quests*', { reply_markup: { inline_keyboard: kb } });
}
async function toggleQuest(chatId, id) { await q(`UPDATE quests SET is_active = NOT is_active WHERE id=$1`, [id]); listQuests(chatId); }
async function deleteQuest(chatId, id) {
  await q(`DELETE FROM quest_completions WHERE quest_id=$1`, [id]);
  await q(`DELETE FROM quests WHERE id=$1`, [id]);
  listQuests(chatId);
}

// ═══ Users ════════════════════════════
async function listUsers(chatId) {
  const { rows } = await q(
    `SELECT telegram_id, first_name, username, points, banned FROM users ORDER BY points DESC LIMIT 12`);
  const kb = [[{ text: '◌ Find player', callback_data: 'ufind' }, { text: `◈ Gift all`, callback_data: 'giftall' }]];
  for (const u of rows) {
    kb.push([{
      text: `${u.banned ? '⛔ ' : ''}${esc(u.first_name || u.username || u.telegram_id)} · ${u.points} ${UNIT}`,
      callback_data: 'user:' + u.telegram_id,
    }]);
  }
  kb.push(backRow);
  if (!rows.length) return send(chatId, 'No players yet.', { reply_markup: { inline_keyboard: [[{ text: '◌ Find player', callback_data: 'ufind' }], backRow] } });
  send(chatId, `● *Users* — tap a player to manage`, { reply_markup: { inline_keyboard: kb } });
}

async function userDetail(chatId, uid) {
  const { rows } = await q(`SELECT * FROM users WHERE telegram_id=$1`, [uid]);
  if (!rows.length) return send(chatId, 'No such user.', { reply_markup: { inline_keyboard: [[{ text: '● Users', callback_data: 'users' }], backRow] } });
  const u = rows[0];
  const picks = (await q(`SELECT COUNT(*)::int c FROM picks WHERE telegram_id=$1`, [uid])).rows[0].c;
  const kb = [
    [{ text: `◈ Set ${UNIT}`, callback_data: 'uset:' + uid }, { text: '± Adjust', callback_data: 'uadd:' + uid }],
    [{ text: '↺ Reset streak', callback_data: 'ustk:' + uid }, { text: u.banned ? '✓ Unban' : '⛔ Ban', callback_data: 'uban:' + uid }],
    [{ text: '✗ Delete player', callback_data: 'udel:' + uid }],
    [{ text: '● Users', callback_data: 'users' }, ...backRow],
  ];
  send(chatId,
    `● *${esc(u.first_name || u.username || uid)}*${u.banned ? '  ⛔ _banned_' : ''}\n\n` +
    `ID: \`${u.telegram_id}\`\n${u.username ? '@' + esc(u.username) + '\n' : ''}` +
    `${UNIT}: *${u.points}*\nStreak: *${u.streak}* (best ${u.best_streak})\nPicks: *${picks}*`,
    { reply_markup: { inline_keyboard: kb } });
}
async function resetStreak(chatId, uid) {
  await q(`UPDATE users SET streak=0 WHERE telegram_id=$1`, [uid]);
  userDetail(chatId, uid);
}
async function toggleBan(chatId, uid) {
  await q(`UPDATE users SET banned = NOT COALESCE(banned,FALSE) WHERE telegram_id=$1`, [uid]);
  userDetail(chatId, uid);
}
async function deleteUser(chatId, uid) {
  await q(`DELETE FROM picks WHERE telegram_id=$1`, [uid]);
  await q(`DELETE FROM quest_completions WHERE telegram_id=$1`, [uid]);
  await q(`DELETE FROM users WHERE telegram_id=$1`, [uid]);
  send(chatId, `Player \`${uid}\` deleted.`, { reply_markup: { inline_keyboard: [[{ text: '● Users', callback_data: 'users' }], backRow] } });
}

// ═══ Mini-app-wide controls ═══════════════════
function miniAppMenu(chatId) {
  send(chatId,
    '⚙ *Mini App controls*\n\nActions that touch the whole app at once.',
    { reply_markup: { inline_keyboard: [
      [{ text: `◈ Gift ${UNIT} to everyone`, callback_data: 'giftall' }],
      [{ text: '↺ Reset all streaks', callback_data: 'ma_streak0' }],
      [{ text: '▧ Push a reminder', callback_data: 'ma_remind' }],
      backRow,
    ] } });
}

// ═══ Danger zone ════════════════════════
function dangerMenu(chatId) {
  send(chatId,
    '⚠ *Danger Zone*\n\nDestructive, irreversible actions. Each asks for confirmation.',
    { reply_markup: { inline_keyboard: [
      [{ text: `Reset leaderboard (${UNIT} → 0)`, callback_data: 'dz_leader' }],
      [{ text: 'Wipe all picks', callback_data: 'dz_picks' }],
      [{ text: 'Delete all calls', callback_data: 'dz_calls' }],
      [{ text: 'Delete all players', callback_data: 'dz_users' }],
      backRow,
    ] } });
}
async function runDanger(chatId, action) {
  let msg = 'Done.';
  if (action === 'ma_streak0') { await q(`UPDATE users SET streak=0`); msg = 'All streaks reset to 0.'; }
  else if (action === 'dz_leader') { await q(`UPDATE users SET points=0`); msg = `Leaderboard reset — all ${UNIT} set to 0.`; }
  else if (action === 'dz_picks') { await q(`DELETE FROM picks`); msg = 'All picks wiped.'; }
  else if (action === 'dz_calls') { await q(`DELETE FROM picks`); await q(`DELETE FROM challenges`); msg = 'All calls and picks deleted.'; }
  else if (action === 'dz_users') { await q(`DELETE FROM picks`); await q(`DELETE FROM quest_completions`); await q(`DELETE FROM users`); msg = 'All players deleted.'; }
  send(chatId, '✓ ' + msg, homeMenu());
}

// ═══ Broadcast (via the public game bot) ══════════════
async function doBroadcast(chatId, message, extra = {}) {
  const sender = publicBot || bot;
  const { rows } = await q(`SELECT telegram_id FROM users WHERE COALESCE(banned,FALSE)=FALSE`);
  let sent = 0, failed = 0;
  send(chatId, `▧ Sending to ${rows.length} players…`);
  for (const u of rows) {
    try { await sender.sendMessage(u.telegram_id, message, extra); sent++; }
    catch { failed++; }
    await new Promise(r => setTimeout(r, 40));
  }
  send(chatId, `▧ Done. Sent ${sent}, failed ${failed}.`, homeMenu());
}

// ═══ Auto-close at reveal time + nudge the creator ═══════════
cron.schedule('* * * * *', async () => {
  try {
    const { rows } = await q(`SELECT id, question FROM challenges WHERE status='open' AND reveal_at <= NOW()`);
    for (const ch of rows) {
      await q(`UPDATE challenges SET status='closed' WHERE id=$1`, [ch.id]);
      if (!ADMIN_SET) continue;
      try {
        await send(ADMIN,
          `○ *Call #${ch.id} closed* — entries are in.\n\n_${esc(ch.question).slice(0, 60)}_\n\nResolve it to award ${UNIT}.`,
          { reply_markup: { inline_keyboard: [[{ text: '◈ Resolve now', callback_data: 'resolve:' + ch.id }]] } });
      } catch {}
    }
  } catch (e) { console.error(e); }
});

// ═══ Boot: self-heal columns (legacy DBs) ══════════════
(async () => {
  try {
    await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT FALSE`);
  } catch (e) { console.error('self-heal skipped:', e.message); }
})();

bot.on('error', (e) => console.error('admin bot error', e.code || e.message));

// ═══ Webhook wiring (lets this bot ride on the web service, free tier) ═══════
// Unguessable path derived from the token so only Telegram can reach it.
const ADMIN_WEBHOOK_SECRET = process.env.ADMIN_BOT_TOKEN
  ? crypto.createHash('sha256').update('hubris-admin:' + process.env.ADMIN_BOT_TOKEN).digest('hex').slice(0, 40)
  : 'disabled';
export const adminWebhookPath = `/tg/admin/${ADMIN_WEBHOOK_SECRET}`;
export const adminBot = bot;

// Feed one Telegram update (parsed JSON body) into the bot's handlers.
export function handleAdminUpdate(update) {
  try { bot.processUpdate(update); } catch (e) { console.error('admin update error', e.message); }
}

// Register the webhook with Telegram. Call once on web-service boot.
export async function registerAdminWebhook(baseUrl) {
  if (!process.env.ADMIN_BOT_TOKEN) return console.warn('⚠ ADMIN_BOT_TOKEN missing — admin bot disabled.');
  if (!baseUrl) return console.warn('⚠ MINI_APP_URL missing — cannot register the admin webhook.');
  const url = baseUrl.replace(/\/+$/, '') + adminWebhookPath;
  try {
    await bot.setWebHook(url, { allowed_updates: ['message', 'callback_query'] });
    console.log('✓ admin webhook registered' + (ADMIN_SET ? ` (admin ${ADMIN})` : ' — ⚠ ADMIN_TELEGRAM_ID not set'));
  } catch (e) { console.error('✗ admin webhook failed:', e.message); }
}

// Standalone mode: `npm run admin` as its own (paid) worker still polls.
const __adminIsMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (__adminIsMain) {
  if (!process.env.ADMIN_BOT_TOKEN) {
    console.error('✗ ADMIN_BOT_TOKEN is missing. Set it and restart.');
  } else {
    bot.startPolling();
    bot.on('polling_error', (e) => console.error('admin polling_error', e.code || e.message));
    console.log('✓ HUBRIS admin bot polling' + (ADMIN_SET ? ` (admin ${ADMIN})` : ' — ⚠ ADMIN_TELEGRAM_ID not set'));
  }
}
