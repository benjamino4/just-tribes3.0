import { q } from './db.js';
import { CFG, DEFAULTS, setConfig } from './config.js';
import { sanitizeSvg, isValidKey, slugifyKey, isSvg } from './lib/sanitizeSvg.js';
import { notifyTribe } from './notifications.js';

const TOKEN = process.env.ADMIN_BOT_TOKEN || '';
const ADMIN_IDS = new Set(
  (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
);

const fmt = (v) => (Number(v) || 0).toLocaleString('en-US');

async function send(chatId, text) {
  if (!TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, text, parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
  } catch (e) { console.error('[admin_bot] send', e.message); }
}

async function audit(adminId, action, detail) {
  try {
    await q(
      'INSERT INTO audit (admin_id, action, detail) VALUES ($1,$2,$3)',
      [String(adminId || ''), action, detail || '']
    );
  } catch {}
}

const HELP = [
  '<b>TRIBES — Admin Console</b>',
  '',
  '/stats',
  '/player &lt;id|username&gt;',
  '/ban &lt;id&gt; &lt;reason&gt;',
  '/unban &lt;id&gt;',
  '/grant &lt;id&gt; &lt;sparks|kinship|stars&gt; &lt;amount&gt;',
  '/broadcast &lt;message&gt;',
  '/config — list every key',
  '/set &lt;key&gt; &lt;value&gt;',
  '/reset — reset progression (confirm with RESET)',
  '/factory — factory reset (confirm with FACTORY)',
  '/audit [limit]',
  '/emoji list',
  '/help'
].join('\n');

const pendingResets = new Map();

function setPending(adminId, kind) {
  const t = setTimeout(() => pendingResets.delete(String(adminId)), 60000);
  pendingResets.set(String(adminId), { kind, timer: t });
}
function clearPending(adminId) {
  const p = pendingResets.get(String(adminId));
  if (p) { clearTimeout(p.timer); pendingResets.delete(String(adminId)); }
}

async function runCommand(adminId, cmd, a) {
  switch (cmd) {
    case 'start': case 'help': return HELP;

    case 'stats': {
      const u = (await q('SELECT count(*)::int n, coalesce(sum(sparks),0)::bigint e FROM users')).rows[0];
      const t = (await q('SELECT count(*)::int n, coalesce(sum(treasury),0)::bigint p FROM tribes')).rows[0];
      const w = (await q("SELECT count(*)::int n FROM wars WHERE status='active'")).rows[0];
      return `<b>Overview</b>\nUsers: ${fmt(u.n)} · Sparks: ${fmt(u.e)}\nTribes: ${fmt(t.n)} · Pyre: ${fmt(t.p)}\nActive wars: ${w.n}`;
    }

    case 'player': {
      const s = String(a[0] || '').trim();
      if (!s) return 'Usage: /player <id|username>';
      const r = /^\d+$/.test(s)
        ? await q('SELECT id, username, first_name, role, sparks, kinship, stars, banned, tribe_id FROM users WHERE id=$1', [s])
        : await q('SELECT id, username, first_name, role, sparks, kinship, stars, banned, tribe_id FROM users WHERE username ILIKE $1 LIMIT 5', ['%' + s + '%']);
      if (!r.rowCount) return 'No such player.';
      return r.rows.map((u) => `<b>${u.first_name || u.username || u.id}</b> (${u.id})\n${fmt(u.sparks)} 🔥 · ${fmt(u.kinship)} 🏛 · ${fmt(u.stars)} ⭐\n${u.banned ? 'BANNED' : 'ok'} · tribe ${u.tribe_id || '—'}`).join('\n\n');
    }

    case 'ban': {
      const id = Number(a[0]); const reason = a.slice(1).join(' ');
      if (!id) return 'Usage: /ban <id> <reason>';
      await q('UPDATE users SET banned=true, ban_reason=$1 WHERE id=$2', [reason.slice(0, 200), id]);
      await audit(adminId, 'ban', `${id}: ${reason}`);
      return `Banned ${id}`;
    }

    case 'unban': {
      const id = Number(a[0]);
      if (!id) return 'Usage: /unban <id>';
      await q('UPDATE users SET banned=false, ban_reason=NULL WHERE id=$1', [id]);
      await audit(adminId, 'unban', String(id));
      return `Unbanned ${id}`;
    }

    case 'grant': {
      const id = Number(a[0]);
      const kind = String(a[1] || '');
      const amount = Math.floor(Number(a[2]) || 0);
      if (!id || !['sparks', 'kinship', 'stars'].includes(kind)) return 'Usage: /grant <id> <sparks|kinship|stars> <amount>';
      await q(`UPDATE users SET ${kind} = ${kind} + $1 WHERE id=$2`, [amount, id]);
      await audit(adminId, 'grant', `${amount} ${kind} -> ${id}`);
      return `Granted ${amount} ${kind} to ${id}`;
    }

    case 'broadcast': {
      const text = a.join(' ');
      if (!text) return 'Usage: /broadcast <message>';
      const ids = (await q('SELECT id FROM users WHERE banned=false')).rows;
      const { notify } = await import('./notifications.js');
      for (const r of ids) {
        await notify({ userId: r.id, type: 'system', title: 'Announcement', body: text, severity: 'info', action_kind: 'inbox' });
      }
      await audit(adminId, 'broadcast', `${ids.length} users`);
      return `📣 Sent to ${ids.length}`;
    }

    case 'config': {
      const keys = Object.keys(DEFAULTS);
      return `<b>Config keys (${keys.length})</b>\n` + keys.slice(0, 60).join('\n') + (keys.length > 60 ? '\n…' : '');
    }

    case 'set': {
      const [k, ...rest] = a;
      const v = rest.join(' ');
      if (!(k in DEFAULTS)) return 'Unknown key';
      const val = await setConfig(q, k, v);
      await audit(adminId, 'config', `${k} = ${v}`);
      return `✅ ${k} = ${val}`;
    }

    case 'reset': {
      setPending(adminId, 'progression');
      return '⚠️ Progression reset requested. Reply <code>RESET</code> to confirm within 60s.';
    }

    case 'factory': {
      setPending(adminId, 'factory');
      return '🛑 Factory reset requested. Reply <code>FACTORY</code> to confirm within 60s.';
    }

    case 'RESET': {
      const p = pendingResets.get(String(adminId));
      if (!p || p.kind !== 'progression') return 'Nothing pending.';
      clearPending(adminId);
      await q(`UPDATE users SET sparks = 500, kinship = 0, streak = 0, last_checkin = NULL,
                ash_ready_at = NULL, ash_count = 0, role = 'Toddler', tribe_id = NULL,
                trials_state = '{}'::jsonb, name_color = NULL, avatar_glow = NULL`);
      await q(`UPDATE tribes SET treasury = 0, members = 0, kinship_total = 0,
                donated_total = 0, members_total = 0, ash_total = 0, quests_total = 0,
                checkins_total = 0, relics_total = 0, shares_total = 0, wins = 0, losses = 0, level = 1`);
      await audit(adminId, 'resetProgression', 'complete');
      return '✅ Progression reset complete.';
    }

    case 'FACTORY': {
      const p = pendingResets.get(String(adminId));
      if (!p || p.kind !== 'factory') return 'Nothing pending.';
      clearPending(adminId);
      const tables = ['war_matches','war_fronts','wars','duels','rank_history','seat_assignments',
        'live_feed','kiva_messages','kiva_reads','kiva_curfews','trial_log','daily_quest_log',
        'spin_log','referral_events','first_pack_claims','streak_insurance','code_redemptions',
        'code_grants','relic_events','relic_slots','user_relics','push_queue','payments','ledger',
        'audit','admin_feed','notifications'];
      for (const t of tables) {
        try { await q(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`); } catch {}
      }
      await q('UPDATE users SET tribe_id = NULL, sparks = 500, stars = 0, kinship = 0, role = \'Toddler\', streak = 0, last_checkin = NULL, banned = false, blessed = false, referred_by = NULL, referral_code = NULL');
      await q('UPDATE tribe_names SET claimed_by_tribe_id = NULL');
      await q('DELETE FROM tribes');
      await audit(adminId, 'factoryReset', 'complete');
      return '✅ Factory reset complete.';
    }

    case 'audit': {
      const lim = Math.min(Number(a[0]) || 20, 100);
      const rows = (await q(
        'SELECT admin_id, action, detail, created_at FROM audit ORDER BY id DESC LIMIT $1',
        [lim]
      )).rows;
      return rows.map((r) => `${new Date(r.created_at).toISOString().slice(0, 19)} · ${r.action} · ${r.detail || ''} (by ${r.admin_id})`).join('\n');
    }

    case 'emoji': {
      const sub = a[0] || 'help';
      if (sub === 'list') {
        const rows = (await q(
          'SELECT key, name, set_slug, builtin FROM emoji_defs ORDER BY sort_order, id LIMIT 30'
        )).rows;
        return rows.map((r) => `:${r.key}: — ${r.name}${r.set_slug ? ` [${r.set_slug}]` : ''}${r.builtin ? ' (builtin)' : ''}`).join('\n') || 'No emojis.';
      }
      return 'Usage: /emoji list';
    }

    default: return 'Unknown command. /help';
  }
}

export async function adminBotWebhook(update) {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return;
  const from = msg.from?.id;
  const chat = msg.chat?.id;
  if (!ADMIN_IDS.has(String(from))) {
    await send(chat, '⛔ Unauthorized.');
    return;
  }
  const parts = msg.text.trim().split(/\s+/);
  const cmdRaw = parts[0].toLowerCase().replace(/^\//, '').split('@')[0];
  const cmd = cmdRaw === 'reset' && parts.length === 1 ? 'reset' : cmdRaw;
  try {
    const out = await runCommand(from, cmd, parts.slice(1));
    await send(chat, out);
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
        allowed_updates: ['message'],
        secret_token: secret
      })
    });
    console.log('[admin_bot] webhook set');
  } catch (e) { console.error('[admin_bot] setup', e.message); }
}