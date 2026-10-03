import { q } from './db.js';
import { CFG, DEFAULTS, setConfig } from './config.js';
import { readLive, writeLive, listLive, listVersions, revertLive } from './live.js';
import * as Forgotten from './forgotten.js';

const TOKEN = process.env.ADMIN_BOT_TOKEN || '';
const ADMIN_IDS = new Set(
  (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
);
const fmt = (v) => (Number(v) || 0).toLocaleString('en-US');

async function send(chatId, text, keyboard = null) {
  if (!TOKEN || !chatId) return;
  try {
    const body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (keyboard) body.reply_markup = keyboard;
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) { console.error('[admin_bot] send', e.message); }
}

async function audit(adminId, action, detail, extra = {}) {
  try {
    await q(
      'INSERT INTO audit (admin_id, action, detail, before_json, after_json) VALUES ($1,$2,$3,$4,$5)',
      [String(adminId || ''), action, detail,
       extra.before ? JSON.stringify(extra.before) : null,
       extra.after ? JSON.stringify(extra.after) : null]
    );
  } catch {}
}

const MAIN_MENU = {
  inline_keyboard: [
    [{ text: '👥 Players', callback_data: 'menu:players' }, { text: '🏛 Tribes', callback_data: 'menu:tribes' }],
    [{ text: '🎮 Games', callback_data: 'menu:games' }, { text: '⚔️ Wars', callback_data: 'menu:wars' }],
    [{ text: '👻 Forgotten', callback_data: 'menu:forgotten' }, { text: '💰 Economy', callback_data: 'menu:economy' }],
    [{ text: '📝 Content', callback_data: 'menu:content' }, { text: '⚙️ Config', callback_data: 'menu:config' }],
    [{ text: '📜 Audit', callback_data: 'menu:audit' }, { text: '📣 Broadcast', callback_data: 'menu:broadcast' }]
  ]
};

const pendingResets = new Map();
const pendingInputs = new Map();

function setPending(adminId, kind, data = {}) {
  const t = setTimeout(() => pendingResets.delete(String(adminId)), 120000);
  pendingResets.set(String(adminId), { kind, data, timer: t });
}
function clearPending(adminId) {
  const p = pendingResets.get(String(adminId));
  if (p) { clearTimeout(p.timer); pendingResets.delete(String(adminId)); }
}

async function runCommand(adminId, cmd, args, chatId) {
  switch (cmd) {
    case 'start':
    case 'help':
      return { text: '<b>🔥 TRIBES — Admin Console</b>\n\nTap a button below to begin.', keyboard: MAIN_MENU };

    case 'stats': {
      const u = (await q('SELECT count(*)::int n, coalesce(sum(sparks),0)::bigint e FROM users')).rows[0];
      const t = (await q('SELECT count(*)::int n FROM tribes WHERE forgotten=false')).rows[0];
      const w = (await q("SELECT count(*)::int n FROM wars WHERE status='active'")).rows[0];
      const f = (await q('SELECT count(*)::int n FROM forgotten_ones WHERE active=true')).rows[0];
      return { text:
        `<b>Overview</b>\n` +
        `Users: ${fmt(u.n)} · Sparks: ${fmt(u.e)}\n` +
        `Tribes: ${fmt(t.n)}\n` +
        `Active wars: ${w.n}\n` +
        `Forgotten Ones: ${f.n}`
      };
    }

    case 'player': {
      const s = String(args[0] || '').trim();
      if (!s) return { text: 'Usage: /player <id|username>' };
      const r = /^\d+$/.test(s)
        ? await q('SELECT id, username, first_name, role, sparks, kinship, stars, banned, tribe_id, rank_rating FROM users WHERE id=$1', [s])
        : await q('SELECT id, username, first_name, role, sparks, kinship, stars, banned, tribe_id, rank_rating FROM users WHERE username ILIKE $1 LIMIT 5', ['%' + s + '%']);
      if (!r.rowCount) return { text: 'No such player.' };
      return { text: r.rows.map((u) =>
        `<b>${u.first_name || u.username || u.id}</b> (${u.id})\n` +
        `${fmt(u.sparks)} 🔥 · ${fmt(u.kinship)} 🏛 · ${fmt(u.stars)} ⭐\n` +
        `Rank: ${u.rank_rating} · ${u.banned ? 'BANNED' : 'ok'} · tribe ${u.tribe_id || '—'}`
      ).join('\n\n') };
    }

    case 'ban': {
      const id = Number(args[0]); const reason = args.slice(1).join(' ');
      if (!id) return { text: 'Usage: /ban <id> <reason>' };
      await q('UPDATE users SET banned=true, ban_reason=$1 WHERE id=$2', [reason.slice(0, 200), id]);
      await audit(adminId, 'ban', `${id}: ${reason}`);
      return { text: `✅ Banned ${id}` };
    }

    case 'unban': {
      const id = Number(args[0]);
      if (!id) return { text: 'Usage: /unban <id>' };
      await q('UPDATE users SET banned=false, ban_reason=NULL WHERE id=$1', [id]);
      await audit(adminId, 'unban', String(id));
      return { text: `✅ Unbanned ${id}` };
    }

    case 'grant': {
      const id = Number(args[0]);
      const kind = String(args[1] || '');
      const amount = Math.floor(Number(args[2]) || 0);
      if (!id || !['sparks', 'kinship', 'stars'].includes(kind)) {
        return { text: 'Usage: /grant <id> <sparks|kinship|stars> <amount>' };
      }
      const before = (await q(`SELECT ${kind} FROM users WHERE id=$1`, [id])).rows[0];
      await q(`UPDATE users SET ${kind} = ${kind} + $1 WHERE id=$2`, [amount, id]);
      await audit(adminId, 'grant', `${amount} ${kind} -> ${id}`,
        { before: before ? Number(before[kind]) : null, after: before ? Number(before[kind]) + amount : null });
      return { text: `✅ Granted ${amount} ${kind} to ${id}` };
    }

    case 'broadcast': {
      const text = args.join(' ');
      if (!text) return { text: 'Usage: /broadcast <message>' };
      const ids = (await q('SELECT id FROM users WHERE banned=false')).rows;
      const { notify } = await import('./notifications.js');
      for (const r of ids) {
        await notify({ userId: r.id, type: 'system', title: 'Announcement', body: text, severity: 'info' });
      }
      await audit(adminId, 'broadcast', `${ids.length} users`);
      return { text: `📣 Sent to ${ids.length}` };
    }

    case 'config': {
      const keys = Object.keys(DEFAULTS);
      return { text: `<b>Config keys (${keys.length})</b>\n` + keys.slice(0, 60).join('\n') + (keys.length > 60 ? '\n…' : '') };
    }

    case 'set': {
      const [k, ...rest] = args;
      const v = rest.join(' ');
      if (!(k in DEFAULTS)) return { text: 'Unknown key' };
      const val = await setConfig(k, v, adminId);
      return { text: `✅ ${k} = ${val}` };
    }

    case 'reset': {
      setPending(adminId, 'progression');
      return { text: '⚠️ Progression reset requested. Reply <code>RESET</code> to confirm within 2 minutes.' };
    }

    case 'factory': {
      setPending(adminId, 'factory');
      return { text: '🛑 Factory reset requested. Reply <code>FACTORY</code> to confirm within 2 minutes.' };
    }

    case 'RESET': {
      const p = pendingResets.get(String(adminId));
      if (!p || p.kind !== 'progression') return { text: 'Nothing pending.' };
      clearPending(adminId);
      await q(`UPDATE users SET sparks = 500, kinship = 0, streak = 0, last_checkin = NULL,
        ash_ready_at = NULL, ash_count = 0, role = 'Toddler', tribe_id = NULL,
        rank_rating = 1000`);
      await q(`UPDATE tribes SET treasury = 0, members = 0, kinship_total = 0,
        donated_total = 0, members_total = 0, wins = 0, losses = 0, level = 1`);
      await audit(adminId, 'resetProgression', 'complete');
      return { text: '✅ Progression reset complete.' };
    }

    case 'FACTORY': {
      const p = pendingResets.get(String(adminId));
      if (!p || p.kind !== 'factory') return { text: 'Nothing pending.' };
      clearPending(adminId);
      const tables = ['war_matches','war_fronts','wars','duels','rank_history','seat_assignments',
        'live_feed','kiva_messages','kiva_reads','referral_events','code_redemptions',
        'relic_slots','user_relics','payments','audit'];
      for (const t of tables) {
        try { await q(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`); } catch {}
      }
      await q('UPDATE users SET tribe_id = NULL, sparks = 500, stars = 0, kinship = 0, role = \'Toddler\', streak = 0, last_checkin = NULL, banned = false, rank_rating = 1000');
      await q('UPDATE tribe_names SET claimed_by_tribe_id = NULL');
      await q('DELETE FROM tribes');
      await audit(adminId, 'factoryReset', 'complete');
      return { text: '✅ Factory reset complete.' };
    }

    case 'audit': {
      const lim = Math.min(Number(args[0]) || 20, 100);
      const rows = (await q(
        'SELECT admin_id, action, detail, created_at FROM audit ORDER BY id DESC LIMIT $1', [lim]
      )).rows;
      return { text: rows.map((r) =>
        `${new Date(r.created_at).toISOString().slice(0, 19)} · ${r.action} · ${r.detail || ''} (by ${r.admin_id})`
      ).join('\n') || 'No audit entries.' };
    }

    case 'forgotten': {
      const sub = args[0] || 'list';
      if (sub === 'list') {
        const rows = (await q(
          'SELECT id, name, rank_rating, personality, rank_games, rank_wins FROM forgotten_ones WHERE active=true ORDER BY rank_rating DESC LIMIT 30'
        )).rows;
        return { text: rows.map((r) =>
          `${r.name} · rank ${r.rank_rating} · ${r.personality} · ${r.rank_wins}/${r.rank_games}`
        ).join('\n') || 'No Forgotten Ones.' };
      }
      if (sub === 'stats') {
        const n = (await q('SELECT count(*)::int AS n FROM forgotten_ones WHERE active=true')).rows[0];
        const matches = (await q('SELECT count(*)::int AS n FROM forgotten_matches')).rows[0];
        return { text: `Forgotten Ones: ${n.n}\nTotal matches played: ${matches.n}` };
      }
      return { text: 'Usage: /forgotten [list|stats]' };
    }

    default:
      return { text: 'Unknown command. Type /help' };
  }
}

async function handleCallback(adminId, data, chatId, messageId) {
  if (data === 'menu:main') {
    await send(chatId, '🔥 <b>TRIBES — Admin Console</b>', MAIN_MENU);
    return;
  }
  if (data.startsWith('menu:')) {
    const section = data.slice(5);
    const menus = {
      players: { text: '👥 <b>Players</b>\n\n/player <id>\n/ban <id> <reason>\n/unban <id>\n/grant <id> <kind> <amount>', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] } },
      tribes: { text: '🏛 <b>Tribes</b>\n\nUse SQL or web to manage tribes directly.', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] } },
      games: { text: '🎮 <b>Games</b>\n\nAll games are configured via the game_defs table.\nUse /set to adjust weights.', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] } },
      wars: { text: '⚔️ <b>Wars</b>\n\nWars auto-resolve. Duration: /set war_duration_minutes <n>', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] } },
      forgotten: { text: '👻 <b>Forgotten Ones</b>\n\n/forgotten list\n/forgotten stats', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] } },
      economy: { text: '💰 <b>Economy</b>\n\n/set checkin_base <n>\n/set ash_unit <n>\n/set found_sparks <n>', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] } },
      content: {
        text: '📝 <b>Content</b>\n\nEdit live content files:',
        keyboard: { inline_keyboard: [
          [{ text: 'Verses', callback_data: 'edit:verses.json' }, { text: 'Help', callback_data: 'edit:help.json' }],
          [{ text: 'Colors', callback_data: 'edit:colors.json' }, { text: 'Game Texts', callback_data: 'edit:game_texts.json' }],
          [{ text: '← Back', callback_data: 'menu:main' }]
        ] }
      },
      config: { text: '⚙️ <b>Config</b>\n\n/set <key> <value>\n/config to list all keys', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] } },
      audit: { text: '📜 <b>Audit</b>\n\n/audit 50 — last 50 actions', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] } },
      broadcast: { text: '📣 <b>Broadcast</b>\n\n/broadcast <message>', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] } },
    };
    const m = menus[section];
    if (m) await send(chatId, m.text, m.keyboard);
    return;
  }
  if (data.startsWith('edit:')) {
    const file = data.slice(5);
    const content = await readLive(file);
    const preview = JSON.stringify(content, null, 2).slice(0, 3500);
    await send(chatId,
      `📝 <b>${file}</b>\n\n<code>${preview}</code>\n\nSend the new JSON content to update.`,
      { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:content' }]] }
    );
    setPending(adminId, 'edit_file', { file });
    return;
  }
}

export async function adminBotWebhook(update) {
  if (update.callback_query) {
    const cq = update.callback_query;
    const from = cq.from?.id;
    const chat = cq.message?.chat?.id;
    if (!ADMIN_IDS.has(String(from))) {
      await send(chat, '⛔ Unauthorized.');
      return;
    }
    try {
      await handleCallback(from, cq.data, chat, cq.message.message_id);
    } catch (e) {
      await send(chat, '⚠️ ' + e.message);
    }
    return;
  }

  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return;
  const from = msg.from?.id;
  const chat = msg.chat?.id;
  if (!ADMIN_IDS.has(String(from))) {
    await send(chat, '⛔ Unauthorized.');
    return;
  }

  // Check if waiting for input (file edit)
  const pending = pendingResets.get(String(from));
  if (pending && pending.kind === 'edit_file') {
    try {
      const newContent = JSON.parse(msg.text);
      await writeLive(pending.data.file, newContent, from, 'admin bot edit');
      clearPending(from);
      await send(chat, `✅ Updated ${pending.data.file}`);
    } catch (e) {
      await send(chat, `⚠️ Invalid JSON: ${e.message}\n\nTry again or /cancel.`);
    }
    return;
  }

  const parts = msg.text.trim().split(/\s+/);
  const cmdRaw = parts[0].toLowerCase().replace(/^\//, '').split('@')[0];
  const cmd = (cmdRaw === 'reset' || cmdRaw === 'factory') && parts.length === 1 ? cmdRaw.toUpperCase() : cmdRaw;
  try {
    const out = await runCommand(from, cmd, parts.slice(1), chat);
    await send(chat, out.text, out.keyboard);
  } catch (e) {
    await send(chat, '⚠️ ' + e.message);
  }
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