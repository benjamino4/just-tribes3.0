// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/admin_bot.js
// PURPOSE: The admin panel. A Telegram bot. Inline keyboards, forms,
//          CRUD on everything. Rate-limited. Audit-logged.
// DEPENDS ON: db.js, config.js, admin_edit.js, notifications.js,
//             forgotten.js, rank.js, relics.js, lib/sanitizeSvg.js
// ═══════════════════════════════════════════════════════════════════
import { q } from './db.js';
import { CFG, DEFAULTS, setConfig } from './config.js';
import { sanitizeSvg, isValidKey, slugifyKey } from './lib/sanitizeSvg.js';
import * as Forgotten from './forgotten.js';
import * as Rank from './rank.js';
import * as Relics from './relics.js';
import * as AdminEdit from './admin_edit.js';

const TOKEN = process.env.ADMIN_BOT_TOKEN || '';
const ADMIN_IDS = new Set(
  (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
);

const fmt = (v) => (Number(v) || 0).toLocaleString('en-US');

async function send(chatId, text, keyboard = null) {
  if (!TOKEN || !chatId) return;
  try {
    const body = {
      chat_id: chatId, text, parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) { console.error('[admin_bot] send', e.message); }
}

async function answerCallback(callbackId, text = '') {
  if (!TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId, text })
    });
  } catch {}
}

async function audit(adminId, action, target, detail, beforeJson = null, afterJson = null) {
  try {
    await q(
      `INSERT INTO audit (admin_id, action, target, detail, before_json, after_json)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [String(adminId || ''), action, target, detail || '',
       beforeJson ? JSON.stringify(beforeJson) : null,
       afterJson ? JSON.stringify(afterJson) : null]
    );
  } catch {}
}

const MAIN_MENU = [
  [{ text: '👥 Players', callback_data: 'menu:players' }, { text: '🏛 Tribes', callback_data: 'menu:tribes' }],
  [{ text: '🎮 Games', callback_data: 'menu:games' }, { text: '⚔️ Wars', callback_data: 'menu:wars' }],
  [{ text: '👁 Forgotten', callback_data: 'menu:forgotten' }, { text: '💰 Economy', callback_data: 'menu:economy' }],
  [{ text: '📝 Content', callback_data: 'menu:content' }, { text: '⚙️ Config', callback_data: 'menu:config' }],
  [{ text: '📋 Audit', callback_data: 'menu:audit' }, { text: '📣 Broadcast', callback_data: 'menu:broadcast' }],
  [{ text: '🧪 Test Tools', callback_data: 'menu:test' }, { text: '📖 Help', callback_data: 'menu:help' }]
];

const BACK_MENU = [[{ text: '← Back', callback_data: 'menu:main' }]];

const pendingResets = new Map();

function setPending(adminId, kind) {
  const t = setTimeout(() => pendingResets.delete(String(adminId)), 60000);
  pendingResets.set(String(adminId), { kind, timer: t });
}
function clearPending(adminId) {
  const p = pendingResets.get(String(adminId));
  if (p) { clearTimeout(p.timer); pendingResets.delete(String(adminId)); }
}

const CONVERSATION = new Map();

function setConversation(adminId, state) {
  CONVERSATION.set(String(adminId), state);
}
function clearConversation(adminId) {
  CONVERSATION.delete(String(adminId));
}

async function renderMain(chatId) {
  const stats = (await q('SELECT count(*)::int AS n FROM users WHERE banned=false')).rows[0];
  const tribes = (await q('SELECT count(*)::int AS n FROM tribes WHERE forgotten=false')).rows[0];
  const wars = (await q("SELECT count(*)::int AS n FROM wars WHERE status='active'")).rows[0];
  const forgotten = (await q('SELECT count(*)::int AS n FROM forgotten_ones WHERE active=true')).rows[0];
  const text = [
    '<b>🔥 TRIBES — Admin Console</b>',
    '',
    `Players: ${fmt(stats.n)}`,
    `Tribes: ${fmt(tribes.n)}`,
    `Active wars: ${wars.n}`,
    `Forgotten Ones: ${fmt(forgotten.n)}`,
    '',
    'Choose a section:'
  ].join('\n');
  await send(chatId, text, MAIN_MENU);
}

async function renderPlayers(chatId) {
  await send(chatId, '<b>👥 Players</b>\n\nSearch for a player:', [
    [{ text: '🔍 Search by ID', callback_data: 'players:byid' }],
    [{ text: '🔍 Search by Name', callback_data: 'players:byname' }],
    [{ text: '📋 Recent', callback_data: 'players:recent' }],
    [{ text: '🚫 Banned', callback_data: 'players:banned' }],
    [{ text: '💰 Top Sparks', callback_data: 'players:topsparks' }],
    [{ text: '🏆 Top Rank', callback_data: 'players:toprank' }],
    [{ text: '← Back', callback_data: 'menu:main' }]
  ]);
}

async function renderGames(chatId) {
  const games = (await q('SELECT slug, name, active FROM game_defs ORDER BY sort_order')).rows;
  const rows = games.map((g) => ([{
    text: `${g.active ? '✅' : '⏸'} ${g.name}`,
    callback_data: `games:view:${g.slug}`
  }]));
  rows.push([{ text: '➕ Add a Game', callback_data: 'games:add' }]);
  rows.push([{ text: '🧪 Force Next Match', callback_data: 'games:force' }]);
  rows.push(BACK_MENU[0]);
  await send(chatId, '<b>🎮 Games</b>', rows);
}

async function renderConfig(chatId) {
  const keys = Object.keys(DEFAULTS);
  const categories = [...new Set(Object.keys(DEFAULTS).map((k) => k.split('_')[0]))].slice(0, 20);
  const rows = categories.map((c) => ([{
    text: c, callback_data: `config:cat:${c}`
  }]));
  rows.push([{ text: '🔍 All Keys', callback_data: 'config:all' }]);
  rows.push(BACK_MENU[0]);
  await send(chatId, `<b>⚙️ Config</b>\n\n${keys.length} keys`, rows);
}

async function renderForgotten(chatId) {
  const ones = await Forgotten.listAll();
  const text = [
    '<b>👁 The Forgotten Ones</b>',
    '',
    `World population: ${ones.length}`,
    '',
    ...ones.slice(0, 15).map((f) => `${f.name} · ${f.personality} · ${fmt(f.rank_rating)}`),
    ones.length > 15 ? '… and ' + (ones.length - 15) + ' more' : ''
  ].filter(Boolean).join('\n');
  await send(chatId, text, [
    [{ text: '🔄 Refresh', callback_data: 'forgotten:list' }],
    [{ text: '➕ Spawn a Forgotten One', callback_data: 'forgotten:spawn' }],
    [{ text: '👤 Lookup', callback_data: 'forgotten:lookup' }],
    BACK_MENU[0]
  ]);
}

async function renderWars(chatId) {
  const wars = (await q(
    `SELECT w.id, w.attacker_id, w.defender_id, w.end_at, t.name AS attacker_name
       FROM wars w LEFT JOIN tribes t ON t.id = w.attacker_id
      WHERE w.status='active' ORDER BY w.start_at DESC LIMIT 10`
  )).rows;
  const text = wars.length ? [
    '<b>⚔️ Active Wars</b>', '',
    ...wars.map((w) => `#${w.id} — ${w.attacker_name || 'Attacker'} vs Defender · ends ${new Date(w.end_at).toLocaleTimeString()}`)
  ].join('\n') : '<b>⚔️ Active Wars</b>\n\nNo active wars.';
  await send(chatId, text, [
    [{ text: '🔄 Refresh', callback_data: 'wars:list' }],
    [{ text: '⚡ Force a War Tick', callback_data: 'wars:tick' }],
    BACK_MENU[0]
  ]);
}

async function renderAudit(chatId) {
  const rows = (await q(
    'SELECT admin_id, action, target, detail, created_at FROM audit ORDER BY id DESC LIMIT 15'
  )).rows;
  const text = ['<b>📋 Recent Admin Actions</b>', '',
    ...rows.map((r) => `${new Date(r.created_at).toLocaleString()} · ${r.action} · ${r.target || ''} (by ${r.admin_id})`)
  ].join('\n');
  await send(chatId, text, [
    [{ text: '🔄 Refresh', callback_data: 'audit:recent' }],
    BACK_MENU[0]
  ]);
}

async function renderContent(chatId) {
  await send(chatId, '<b>📝 Content</b>', [
    [{ text: '😀 Emojis', callback_data: 'content:emoji' }],
    [{ text: '💎 Relics', callback_data: 'content:relics' }],
    [{ text: '📜 Verses', callback_data: 'content:verses' }],
    [{ text: '📄 Files', callback_data: 'content:files' }],
    BACK_MENU[0]
  ]);
}

async function renderHelp(chatId) {
  await send(chatId, [
    '<b>📖 Admin Help</b>',
    '',
    'Sections:',
    '• <b>Players</b> — find, edit, ban',
    '• <b>Tribes</b> — inspect, dissolve',
    '• <b>Games</b> — enable/disable/edit',
    '• <b>Wars</b> — force ticks, view active',
    '• <b>Forgotten</b> — the AI opponents',
    '• <b>Economy</b> — rewards, prices',
    '• <b>Content</b> — emojis, relics, verses',
    '• <b>Config</b> — every game rule',
    '• <b>Audit</b> — every action ever taken',
    '• <b>Broadcast</b> — message all players',
    '• <b>Test Tools</b> — force scenarios',
    '',
    'Type /start anytime to return to the main menu.'
  ].join('\n'), BACK_MENU);
}

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const data = query.data;
  const adminId = query.from.id;

  if (!ADMIN_IDS.has(String(adminId))) {
    await answerCallback(query.id, 'Unauthorized');
    return;
  }

  await answerCallback(query.id, '');

  if (data === 'menu:main') return renderMain(chatId);
  if (data === 'menu:players') return renderPlayers(chatId);
  if (data === 'menu:tribes') return send(chatId, '<b>🏛 Tribes</b>\n\nComing in this session. Use /start to refresh.', BACK_MENU);
  if (data === 'menu:games') return renderGames(chatId);
  if (data === 'menu:wars') return renderWars(chatId);
  if (data === 'menu:forgotten') return renderForgotten(chatId);
  if (data === 'menu:economy') return send(chatId, '<b>💰 Economy</b>\n\nUse Config → Economy to edit rewards.', BACK_MENU);
  if (data === 'menu:content') return renderContent(chatId);
  if (data === 'menu:config') return renderConfig(chatId);
  if (data === 'menu:audit') return renderAudit(chatId);
  if (data === 'menu:broadcast') return send(chatId, '<b>📣 Broadcast</b>\n\nSend /broadcast &lt;message&gt; to message all players.', BACK_MENU);
  if (data === 'menu:test') return send(chatId, '<b>🧪 Test Tools</b>\n\nSend /test to see options.', BACK_MENU);
  if (data === 'menu:help') return renderHelp(chatId);

  if (data === 'players:byid') {
    setConversation(adminId, { kind: 'players_byid' });
    return send(chatId, 'Send the player ID:', BACK_MENU);
  }
  if (data === 'players:byname') {
    setConversation(adminId, { kind: 'players_byname' });
    return send(chatId, 'Send the player name:', BACK_MENU);
  }
  if (data === 'players:recent') {
    const rows = (await q(
      'SELECT id, first_name, username, rank_rating FROM users ORDER BY last_seen_at DESC LIMIT 10'
    )).rows;
    return send(chatId, '<b>Recent players</b>\n\n' + rows.map((u) => `• ${u.first_name || u.username} (${u.id}) — rank ${u.rank_rating}`).join('\n'), BACK_MENU);
  }
  if (data === 'players:banned') {
    const rows = (await q(
      'SELECT id, first_name, username, ban_reason FROM users WHERE banned=true LIMIT 20'
    )).rows;
    return send(chatId, '<b>Banned players</b>\n\n' + (rows.length ? rows.map((u) => `• ${u.first_name || u.username} (${u.id}) — ${u.ban_reason || ''}`).join('\n') : 'None.'), BACK_MENU);
  }
  if (data === 'players:topsparks') {
    const rows = (await q(
      'SELECT id, first_name, sparks FROM users ORDER BY sparks DESC LIMIT 10'
    )).rows;
    return send(chatId, '<b>Top by Sparks</b>\n\n' + rows.map((u) => `• ${u.first_name} (${u.id}) — ${fmt(u.sparks)}`).join('\n'), BACK_MENU);
  }
  if (data === 'players:toprank') {
    const rows = (await q(
      'SELECT id, first_name, rank_rating FROM users ORDER BY rank_rating DESC LIMIT 10'
    )).rows;
    return send(chatId, '<b>Top by Rank</b>\n\n' + rows.map((u) => `• ${u.first_name} (${u.id}) — ${u.rank_rating}`).join('\n'), BACK_MENU);
  }

  if (data.startsWith('games:view:')) {
    const slug = data.slice('games:view:'.length);
    const g = (await q('SELECT * FROM game_defs WHERE slug=$1', [slug])).rows[0];
    if (!g) return send(chatId, 'Game not found.', BACK_MENU);
    return send(chatId, [
      `<b>🎮 ${g.name}</b>`,
      '',
      `Slug: ${g.slug}`,
      `Archetype: ${g.archetype}`,
      `Engine: ${g.engine}`,
      `Material: ${g.material}`,
      `Active: ${g.active ? '✅' : '⏸'}`,
      '',
      g.description || ''
    ].join('\n'), [
      [{ text: g.active ? '⏸ Disable' : '✅ Enable', callback_data: `games:toggle:${slug}` }],
      BACK_MENU[0]
    ]);
  }

  if (data.startsWith('games:toggle:')) {
    const slug = data.slice('games:toggle:'.length);
    const g = (await q('SELECT active FROM game_defs WHERE slug=$1', [slug])).rows[0];
    if (!g) return;
    await q('UPDATE game_defs SET active=$1 WHERE slug=$2', [!g.active, slug]);
    await audit(adminId, 'game_toggle', slug, `active=${!g.active}`);
    return send(chatId, `Game ${slug} is now ${!g.active ? 'active' : 'disabled'}.`, BACK_MENU);
  }

  if (data.startsWith('config:cat:')) {
    const cat = data.slice('config:cat:'.length);
    const keys = Object.keys(DEFAULTS).filter((k) => k.startsWith(cat));
    const text = [`<b>⚙️ ${cat}</b>`, '',
      ...keys.slice(0, 30).map((k) => `${k} = ${CFG[k]}`)
    ].join('\n');
    const rows = keys.slice(0, 10).map((k) => ([{
      text: `✏️ ${k}`, callback_data: `config:edit:${k}`
    }]));
    rows.push(BACK_MENU[0]);
    return send(chatId, text, rows);
  }

  if (data === 'config:all') {
    const keys = Object.keys(DEFAULTS).slice(0, 60);
    return send(chatId, '<b>All config keys</b>\n\n' + keys.join('\n'), BACK_MENU);
  }

  if (data.startsWith('config:edit:')) {
    const key = data.slice('config:edit:'.length);
    setConversation(adminId, { kind: 'config_edit', key });
    return send(chatId, `Current <b>${key}</b> = ${CFG[key]}\n\nSend the new value (or "reset" to restore default):`, BACK_MENU);
  }

  if (data === 'forgotten:list') return renderForgotten(chatId);
  if (data === 'forgotten:spawn') {
    setConversation(adminId, { kind: 'forgotten_spawn' });
    return send(chatId, 'Send a name for the new Forgotten One (or "random"):', BACK_MENU);
  }
  if (data === 'forgotten:lookup') {
    setConversation(adminId, { kind: 'forgotten_lookup' });
    return send(chatId, 'Send a Forgotten One name or ID:', BACK_MENU);
  }

  if (data === 'wars:list') return renderWars(chatId);
  if (data === 'wars:tick') {
    const { warTick } = await import('./war.js');
    const r = await warTick();
    await audit(adminId, 'war_tick', null, JSON.stringify(r));
    return send(chatId, `War tick: ${JSON.stringify(r)}`, BACK_MENU);
  }

  if (data === 'audit:recent') return renderAudit(chatId);

  if (data === 'content:files') {
    return send(chatId, 'File editing is available via /edit &lt;path&gt;. Allowed dirs: server/src/live, web/src/content, web/src/styles/games.', BACK_MENU);
  }
  if (data === 'content:emoji') {
    return send(chatId, 'Emoji management: /emoji list — /emoji delete &lt;key&gt;', BACK_MENU);
  }
}

async function handleMessage(msg) {
  const from = msg.from?.id;
  const chat = msg.chat?.id;
  const text = (msg.text || '').trim();

  if (!ADMIN_IDS.has(String(from))) {
    await send(chat, '⛔ Unauthorized.');
    return;
  }

  const conv = CONVERSATION.get(String(from));

  if (conv?.kind === 'players_byid' || conv?.kind === 'players_byname') {
    clearConversation(from);
    const s = text;
    const r = /^\d+$/.test(s) && conv.kind === 'players_byid'
      ? await q('SELECT id, first_name, username, role, sparks, kinship, stars, banned, tribe_id, rank_rating FROM users WHERE id=$1', [s])
      : await q('SELECT id, first_name, username, role, sparks, kinship, stars, banned, tribe_id, rank_rating FROM users WHERE first_name ILIKE $1 LIMIT 5', ['%' + s + '%']);
    if (!r.rowCount) return send(chat, 'No such player.', BACK_MENU);
    const u = r.rows[0];
    return send(chat, [
      `<b>👤 ${u.first_name || u.username}</b> (${u.id})`,
      '',
      `Sparks: ${fmt(u.sparks)}`,
      `Kinship: ${fmt(u.kinship)}`,
      `Stars: ${fmt(u.stars)}`,
      `Rank: ${u.rank_rating}`,
      `Tribe: ${u.tribe_id || '—'}`,
      `Banned: ${u.banned ? 'yes' : 'no'}`
    ].join('\n'), [
      [{ text: '💰 Grant Sparks', callback_data: `players:grant:${u.id}:sparks` }],
      [{ text: '🏛 Grant Kinship', callback_data: `players:grant:${u.id}:kinship` }],
      [{ text: u.banned ? '✅ Unban' : '🚫 Ban', callback_data: `players:${u.banned ? 'unban' : 'ban'}:${u.id}` }],
      BACK_MENU[0]
    ]);
  }

  if (conv?.kind === 'config_edit') {
    clearConversation(from);
    const key = conv.key;
    try {
      const val = text.toLowerCase() === 'reset' ? '' : text;
      const newVal = await setConfig(q, key, val);
      await audit(from, 'config_edit', key, `${CFG[key]} → ${newVal}`);
      return send(chat, `✅ <b>${key}</b> = ${newVal}`, BACK_MENU);
    } catch (e) {
      return send(chat, '⚠️ ' + e.message, BACK_MENU);
    }
  }

  if (conv?.kind === 'forgotten_spawn') {
    clearConversation(from);
    const name = text.toLowerCase() === 'random' ? null : text;
    const fo = await Forgotten.createOne({ personality: null });
    if (name) await q('UPDATE forgotten_ones SET name=$1 WHERE id=$2', [name, fo.id]);
    await audit(from, 'forgotten_spawn', null, name || fo.name);
    return send(chat, `Forgotten One "${name || fo.name}" spawned with rank ${fo.rank_rating}.`, BACK_MENU);
  }

  if (conv?.kind === 'forgotten_lookup') {
    clearConversation(from);
    const r = /^\d+$/.test(text)
      ? await q('SELECT * FROM forgotten_ones WHERE id=$1', [text])
      : await q('SELECT * FROM forgotten_ones WHERE name ILIKE $1 LIMIT 5', ['%' + text + '%']);
    if (!r.rowCount) return send(chat, 'No such Forgotten One.', BACK_MENU);
    const f = r.rows[0];
    return send(chat, [
      `<b>👁 ${f.name}</b> (${f.id})`,
      '',
      `Personality: ${f.personality}`,
      `Rank: ${f.rank_rating}`,
      `Wins / Games: ${f.rank_wins} / ${f.rank_games}`,
      `Archetype: ${f.preferred_archetype}`,
      `Tribe: ${f.tribe_id || '—'}`
    ].join('\n'), BACK_MENU);
  }

  // Command-based fallback
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase().replace(/^\//, '').split('@')[0];

  try {
    if (!text) return;
    if (cmd === 'start' || cmd === 'help' || cmd === 'menu') return renderMain(chat);
    if (cmd === 'stats') {
      const u = (await q('SELECT count(*)::int n, coalesce(sum(sparks),0)::bigint e FROM users')).rows[0];
      const t = (await q('SELECT count(*)::int n, coalesce(sum(treasury),0)::bigint p FROM tribes')).rows[0];
      const w = (await q("SELECT count(*)::int n FROM wars WHERE status='active'")).rows[0];
      return send(chat, `<b>Overview</b>\nUsers: ${fmt(u.n)} · Sparks: ${fmt(u.e)}\nTribes: ${fmt(t.n)} · Pyre: ${fmt(t.p)}\nActive wars: ${w.n}`, BACK_MENU);
    }
    if (cmd === 'player') {
      const s = parts[1];
      const r = /^\d+$/.test(s)
        ? await q('SELECT id, username, first_name, role, sparks, kinship, stars, banned, tribe_id FROM users WHERE id=$1', [s])
        : await q('SELECT id, username, first_name, role, sparks, kinship, stars, banned, tribe_id FROM users WHERE username ILIKE $1 LIMIT 5', ['%' + s + '%']);
      if (!r.rowCount) return send(chat, 'No such player.', BACK_MENU);
      return send(chat, r.rows.map((u) => `<b>${u.first_name || u.username || u.id}</b> (${u.id})\n${fmt(u.sparks)} 🔥 · ${fmt(u.kinship)} 🏛 · ${fmt(u.stars)} ⭐\n${u.banned ? 'BANNED' : 'ok'} · tribe ${u.tribe_id || '—'}`).join('\n\n'), BACK_MENU);
    }
    if (cmd === 'ban') {
      const id = Number(parts[1]);
      const reason = parts.slice(2).join(' ');
      if (!id) return send(chat, 'Usage: /ban <id> <reason>');
      await q('UPDATE users SET banned=true, ban_reason=$1 WHERE id=$2', [reason.slice(0, 200), id]);
      await audit(from, 'ban', String(id), reason);
      return send(chat, `Banned ${id}`, BACK_MENU);
    }
    if (cmd === 'unban') {
      const id = Number(parts[1]);
      await q('UPDATE users SET banned=false, ban_reason=NULL WHERE id=$1', [id]);
      await audit(from, 'unban', String(id));
      return send(chat, `Unbanned ${id}`, BACK_MENU);
    }
    if (cmd === 'grant') {
      const id = Number(parts[1]);
      const kind = String(parts[2] || '');
      const amount = Math.floor(Number(parts[3]) || 0);
      if (!id || !['sparks', 'kinship', 'stars'].includes(kind)) return send(chat, 'Usage: /grant <id> <sparks|kinship|stars> <amount>');
      await q(`UPDATE users SET ${kind} = ${kind} + $1 WHERE id=$2`, [amount, id]);
      await audit(from, 'grant', String(id), `${amount} ${kind}`);
      return send(chat, `Granted ${amount} ${kind} to ${id}`, BACK_MENU);
    }
    if (cmd === 'broadcast') {
      const body = parts.slice(1).join(' ');
      if (!body) return send(chat, 'Usage: /broadcast <message>');
      const ids = (await q('SELECT id FROM users WHERE banned=false')).rows;
      const { notify } = await import('./notifications.js');
      for (const r of ids) {
        await notify({ userId: r.id, type: 'system', title: 'Announcement', body, severity: 'info', action_kind: 'inbox' });
      }
      await audit(from, 'broadcast', null, `${ids.length} users`);
      return send(chat, `📣 Sent to ${ids.length}`, BACK_MENU);
    }
    if (cmd === 'audit') {
      const lim = Math.min(Number(parts[1]) || 20, 100);
      const rows = (await q('SELECT admin_id, action, detail, created_at FROM audit ORDER BY id DESC LIMIT $1', [lim])).rows;
      return send(chat, rows.map((r) => `${new Date(r.created_at).toISOString().slice(0, 19)} · ${r.action} · ${r.detail || ''} (by ${r.admin_id})`).join('\n') || 'Nothing.', BACK_MENU);
    }
    if (cmd === 'reset') {
      setPending(from, 'progression');
      return send(chat, '⚠️ Progression reset requested. Reply <code>RESET</code> to confirm within 60s.');
    }
    if (cmd === 'factory') {
      setPending(from, 'factory');
      return send(chat, '🛑 Factory reset requested. Reply <code>FACTORY</code> to confirm within 60s.');
    }
    if (text === 'RESET') {
      const p = pendingResets.get(String(from));
      if (!p || p.kind !== 'progression') return send(chat, 'Nothing pending.');
      clearPending(from);
      await q(`UPDATE users SET sparks = 500, kinship = 0, streak = 0, last_checkin = NULL,
                ash_ready_at = NULL, ash_count = 0, role = 'Toddler', tribe_id = NULL,
                trials_state = '{}'::jsonb, name_color = NULL, avatar_glow = NULL`);
      await q(`UPDATE tribes SET treasury = 0, members = 0, kinship_total = 0,
                donated_total = 0, members_total = 0, ash_total = 0, quests_total = 0,
                checkins_total = 0, relics_total = 0, shares_total = 0, wins = 0, losses = 0, level = 1`);
      await audit(from, 'resetProgression', null, 'complete');
      return send(chat, '✅ Progression reset complete.', BACK_MENU);
    }
    if (text === 'FACTORY') {
      const p = pendingResets.get(String(from));
      if (!p || p.kind !== 'factory') return send(chat, 'Nothing pending.');
      clearPending(from);
      const tables = ['war_matches','war_fronts','wars','war_substitutions','duels','rank_history','seat_assignments',
        'live_feed','kiva_messages','kiva_reads','kiva_curfews','trial_log','daily_quest_log',
        'spin_log','referral_events','first_pack_claims','streak_insurance','code_redemptions',
        'relic_events','relic_slots','user_relics','push_queue','payments','ledger',
        'audit','admin_feed','notifications'];
      for (const t of tables) {
        try { await q(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`); } catch {}
      }
      await q("UPDATE users SET tribe_id = NULL, sparks = 500, stars = 0, kinship = 0, role = 'Toddler', streak = 0, last_checkin = NULL, banned = false, blessed = false, referred_by = NULL, referral_code = NULL");
      await q('UPDATE tribe_names SET claimed_by_tribe_id = NULL');
      await q('DELETE FROM tribes');
      await audit(from, 'factoryReset', null, 'complete');
      return send(chat, '✅ Factory reset complete.', BACK_MENU);
    }
    if (cmd === 'edit') {
      const p = parts[1];
      if (!p) return send(chat, 'Usage: /edit <path>');
      try {
        const r = await AdminEdit.readFile(p, from);
        setConversation(from, { kind: 'edit_apply', path: p });
        return send(chat, `File ${p} (${r.size} bytes)\n\nSend the new content. Or reply "cancel".`, BACK_MENU);
      } catch (e) { return send(chat, '⚠️ ' + e.message, BACK_MENU); }
    }
    if (conv?.kind === 'edit_apply' && text.toLowerCase() !== 'cancel') {
      clearConversation(from);
      try {
        await AdminEdit.writeFile(from, conv.path, text, 'admin edit');
        await audit(from, 'edit_file', conv.path, 'written');
        return send(chat, `✅ ${conv.path} updated.`, BACK_MENU);
      } catch (e) { return send(chat, '⚠️ ' + e.message, BACK_MENU); }
    }
    return send(chat, 'Unknown command. /help');
  } catch (e) {
    await send(chat, '⚠️ ' + e.message);
  }
}

export async function adminBotWebhook(update) {
  if (update.callback_query) return await handleCallback(update.callback_query);
  const msg = update.message || update.edited_message;
  if (!msg) return;
  return await handleMessage(msg);
}

export async function setupAdminBot(baseUrl) {
  if (!TOKEN) { console.log('[admin_bot] ADMIN_BOT_TOKEN not set'); return; }
  const secret = process.env.ADMIN_WEBHOOK_SECRET || '';
  if (!secret) { console.warn('[admin_bot] ADMIN_WEBHOOK_SECRET missing — webhook will fail closed'); return; }
  if (!baseUrl) { console.log('[admin_bot] no base url'); return; }
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: baseUrl.replace(/\/$/, '') + '/api/admin/webhook',
        allowed_updates: ['message', 'callback_query'],
        secret_token: secret
      })
    });
    console.log('[admin_bot] webhook set');
  } catch (e) { console.error('[admin_bot] setup', e.message); }
}