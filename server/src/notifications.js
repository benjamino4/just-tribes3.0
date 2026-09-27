// TRIBES-FILE: server/src/notifications.js
// PHASE: 7 — Meta & Admin
// In-app notification queue (Dynamic Island on the client).
// Every significant event writes one row + optionally queues a Telegram push.

import { q } from './db.js';
import { enqueue as pushEnqueue } from './push.js';

/* Icon catalog — the client picks the animated icon by this key. */
export const ICON = {
  kiva:      'kiva-flame',
  tribe:     'tribe-shield',
  war:       'war-swords',
  pack:      'relic-spark',
  system:    'crown',
  payment:   'res-stars',
  blessing:  'halo',
  streak:    'trials-scroll',
  curfew:    'lock',
  win:       'check',
  loss:      'bolt',
};

/**
 * Write a notification.
 * @param {object} opts
 * @param {number} opts.userId
 * @param {string} opts.type        — logical type (kiva|tribe|war|pack|system|payment|blessing|streak|curfew|win|loss)
 * @param {string} opts.title       — short headline shown in the island
 * @param {string} [opts.body]      — longer text shown when expanded
 * @param {string} [opts.severity]  — info | success | warn | danger
 * @param {string} [opts.action_kind]  — route hint ('kiva', 'war', etc.)
 * @param {object} [opts.action_data]  — { id, tribe_id, etc. }
 * @param {boolean} [opts.push]     — also queue a Telegram push
 */
export async function notify({
  userId, type, title, body = null, severity = 'info',
  action_kind = null, action_data = null, push = false,
}) {
  const icon = ICON[type] || ICON.system;
  try {
    await q(
      `INSERT INTO notifications (user_id, type, icon, severity, title, body, action_kind, action_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, type, icon, severity, title, body, action_kind,
       action_data ? JSON.stringify(action_data) : null]
    );
  } catch (e) {
    console.warn('[notif] insert', e.message);
  }

  if (push) {
    const text = `🔔 ${title}${body ? '\n' + body : ''}`;
    try { await pushEnqueue(userId, text); } catch {}
  }
}

/** Fan out to every member of a tribe. */
export async function notifyTribe(tribeId, opts) {
  const ids = (await q(
    'SELECT id FROM users WHERE tribe_id=$1 AND banned=false',
    [tribeId]
  )).rows;
  for (const r of ids) {
    await notify({ ...opts, userId: r.id });
  }
}

/** Bulk notify every non-banned user. */
export async function notifyAll(opts) {
  const ids = (await q(
    'SELECT id FROM users WHERE banned=false'
  )).rows;
  for (const r of ids) {
    await notify({ ...opts, userId: r.id });
  }
}

export async function list(userId, { sinceId = 0, limit = 40, unreadOnly = false } = {}) {
  const lim = Math.max(1, Math.min(100, Number(limit) || 40));
  if (unreadOnly) {
    return (await q(
      `SELECT id, type, icon, severity, title, body, action_kind, action_data, seen_at, created_at
         FROM notifications
        WHERE user_id=$1 AND seen_at IS NULL
        ORDER BY id DESC LIMIT $2`,
      [userId, lim]
    )).rows;
  }
  if (sinceId > 0) {
    return (await q(
      `SELECT id, type, icon, severity, title, body, action_kind, action_data, seen_at, created_at
         FROM notifications
        WHERE user_id=$1 AND id > $2
        ORDER BY id ASC LIMIT $3`,
      [userId, sinceId, lim]
    )).rows;
  }
  return (await q(
    `SELECT id, type, icon, severity, title, body, action_kind, action_data, seen_at, created_at
       FROM notifications
      WHERE user_id=$1
      ORDER BY id DESC LIMIT $2`,
    [userId, lim]
  )).rows;
}

export async function unreadCount(userId) {
  const r = (await q(
    'SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND seen_at IS NULL',
    [userId]
  )).rows[0];
  return r ? r.n : 0;
}

export async function markSeen(userId, ids) {
  if (!ids?.length) {
    await q(
      'UPDATE notifications SET seen_at=now() WHERE user_id=$1 AND seen_at IS NULL',
      [userId]
    );
    return { ok: true, all: true };
  }
  await q(
    `UPDATE notifications SET seen_at=now()
      WHERE user_id=$1 AND id = ANY($2::bigint[])`,
    [userId, ids]
  );
  return { ok: true, count: ids.length };
}

export async function markOneSeen(userId, id) {
  await q(
    'UPDATE notifications SET seen_at=now() WHERE user_id=$1 AND id=$2',
    [userId, id]
  );
  return { ok: true };
}

/* ---------- SSE ---------- */
const subscribers = new Map();   // userId -> Set<res>

export function subscribe(userId, res) {
  const key = Number(userId);
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(res);
  res.on('close', () => {
    const s = subscribers.get(key);
    if (s) { s.delete(res); if (!s.size) subscribers.delete(key); }
  });
}

export function broadcast(userId, payload) {
  const set = subscribers.get(Number(userId));
  if (!set || !set.size) return;
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) { try { res.write(line); } catch {} }
}

/* The notify() above already writes rows. For clients subscribed via SSE,
   the row id is the cursor — they poll /api/notifications since the last
   id and we broadcast a hint that new rows exist. */
export async function notifyAndBroadcast(opts) {
  await notify(opts);
  broadcast(opts.userId, { type: 'ping' });
}

setInterval(() => {
  for (const set of subscribers.values()) {
    for (const res of set) { try { res.write(': ping\n\n'); } catch {} }
  }
}, 25000).unref();