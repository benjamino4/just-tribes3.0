// TRIBES-FILE: server/src/admin_bot.js
// PHASE: 7 — Meta & Admin
// Telegram admin bot. Only responds to IDs in ADMIN_IDS.
// Requires ADMIN_BOT_TOKEN and a webhook URL.

import { q } from './db.js';
import { CFG, DEFAULTS, setConfig } from './config.js';
import { previewReset, resetProgression, factoryReset } from './admin_reset.js';
import * as Bonfires from './bonfires.js';
import { notifyAll } from './notifications.js';

const TOKEN    = process.env.ADMIN_BOT_TOKEN || '';
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
        disable_web_page_preview: true,
      }),
    });
  } catch (e) { console.error('[admin_bot] send', e.message); }
}

const HELP = [
  '<b>TRIBES — Admin Console</b>',
  '',
  '/stats',
  '/broadcast &lt;message&gt;',
  '/bonfire &lt;title&gt; &lt;metric&gt; &lt;multiplier&gt; &lt;hours&gt;',
  '/maintenance &lt;on|off&gt;',
  '/resetprogress',
  '/factoryreset',
  '/set &lt;key&gt; &lt;value&gt;',
  '/help',
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
      const u = (await q('SELECT count(*)::int n, sum(ember)::bigint e FROM users')).rows[0];
      const t = (await q('SELECT count(*)::int n, sum(treasury)::bigint p FROM tribes')).rows[0];
      const w = (await q("SELECT count(*)::int n FROM wars WHERE status='active'")).rows[0];
      return `<b>Overview</b>\nUsers: ${fmt(u.n)} · Ember: ${fmt(u.e)}\nTribes: ${fmt(t.n)} · Pyre: ${fmt(t.p)}\nActive wars: ${w.n}`;
    }

    case 'broadcast': {
      const text = a.join(' ');
      if (!text) return 'Usage: /broadcast message';
      const ids = (await q('SELECT id FROM users WHERE banned=false')).rows;
      for (const r of ids) {
        await notifyAll({
          type: 'system', title: 'Announcement', body: text,
          severity: 'info', action_kind: 'inbox', push: true, userId: r.id,
        });
      }
      return `📣 Sent to ${ids.length}`;
    }

    case 'bonfire': {
      const [title, metric, mult, hours] = a;
      if (!title || !metric) return 'Usage: /bonfire title metric multiplier hours';
      const r = await Bonfires.create(adminId, {
        title, metric,
        multiplier: Number(mult) || 2,
        end_at: new Date(Date.now() + (Number(hours) || 2) * 3600 * 1000),
      });
      return `🔥 Bonfire ${r.title} (${r.metric} ×${r.multiplier})`;
    }

    case 'maintenance': {
      const on = /^(on|1|true|yes)$/i.test(a[0] || '');
      await setConfig(q, 'maintenance', on ? 1 : 0);
      return `🔧 Maintenance ${on ? 'ON' : 'off'}`;
    }

    case 'set': {
      const [k, v] = a;
      if (!(k in DEFAULTS)) return 'Unknown key';
      const val = await setConfig(q, k, v);
      return `✅ ${k} = ${val}`;
    }

    case 'resetprogress': {
      const p = await previewReset();
      setPending(adminId, 'progression');
      return `⚠️ Progression reset requested.\nUsers with progress: ${p.usersWithProgress}\nTribes: ${p.tribes}\nActive wars: ${p.activeWars}\n\nReply <code>RESET</code> to confirm within 60s.`;
    }

    case 'factoryreset': {
      const p = await previewReset();
      setPending(adminId, 'factory');
      return `🛑 Factory reset requested.\nTribes: ${p.tribes}\nWars: ${p.totalWars}\nKiva: ${p.kivaMessages}\n\nReply <code>FACTORY</code> to confirm within 60s.`;
    }

    case 'reset': {
      const p = pendingResets.get(String(adminId));
      if (!p || p.kind !== 'progression') return 'Nothing pending.';
      clearPending(adminId);
      await resetProgression(adminId);
      return '✅ Progression reset complete.';
    }

    case 'factory': {
      const p = pendingResets.get(String(adminId));
      if (!p || p.kind !== 'factory') return 'Nothing pending.';
      clearPending(adminId);
      await factoryReset(adminId);
      return '✅ Factory reset complete.';
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
  const cmd = parts[0].toLowerCase().replace(/^\//, '').split('@')[0];
  try {
    const out = await runCommand(from, cmd, parts.slice(1));
    await send(chat, out);
  } catch (e) {
    await send(chat, '⚠️ ' + e.message);
  }
}

export async function setupAdminBot(baseUrl) {
  if (!TOKEN) { console.log('[admin_bot] ADMIN_BOT_TOKEN not set'); return; }
  if (!baseUrl) { console.log('[admin_bot] no base url'); return; }
  try {
    const secret = process.env.ADMIN_WEBHOOK_SECRET || '';
    await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: baseUrl.replace(/\/$/, '') + '/api/admin/webhook',
        allowed_updates: ['message'],
        secret_token: secret || undefined,
      }),
    });
    console.log('[admin_bot] webhook set');
  } catch (e) { console.error('[admin_bot] setup', e.message); }
}