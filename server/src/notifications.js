// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/notifications.js
// PURPOSE: Thin wrapper over events.js for the notification list.
//          Provide list, unread, markSeen.
// DEPENDS ON: db.js, events.js, push.js
// ═══════════════════════════════════════════════════════════════════
import { q } from './db.js';
import { enqueue as pushEnqueue } from './push.js';

export const ICON = {
  kiva: 'kiva-flame', tribe: 'tribe-shield', war: 'war-swords',
  pack: 'relic-spark', system: 'crown', payment: 'res-stars',
  blessing: 'halo', streak: 'trials-scroll', curfew: 'lock',
  win: 'check', loss: 'bolt'
};

export async function notify({ userId, type, title, body = null, severity = 'info',
  action_kind = null, action_data = null, push = false }) {
  const icon = ICON[type] || ICON.system;
  let id = null;
  try {
    const r = await q(
      `INSERT INTO notifications (user_id, type, icon, severity, title, body, action_kind, action_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [userId, type, icon, severity, title, body, action_kind,
       action_data ? JSON.stringify(action_data) : null]
    );
    id = r.rows[0].id;
  } catch (e) { console.warn('[notif] insert', e.message); }
  if (push) {
    const text = `🔔 ${title}${body ? '\n' + body : ''}`;
    try { await pushEnqueue(userId, text); } catch {}
  }
  return { id };
}

export async function list(userId, { sinceId = 0, limit = 40, unreadOnly = false } = {}) {
  const lim = Math.max(1, Math.min(100, Number(limit) || 40));
  if (unreadOnly) {
    return (await q(
      `SELECT id, type, icon, severity, title, body, action_kind, action_data, seen_at, created_at
         FROM notifications WHERE user_id=$1 AND seen_at IS NULL
        ORDER BY id DESC LIMIT $2`, [userId, lim]
    )).rows;
  }
  if (sinceId > 0) {
    return (await q(
      `SELECT id, type, icon, severity, title, body, action_kind, action_data, seen_at, created_at
         FROM notifications WHERE user_id=$1 AND id > $2
        ORDER BY id ASC LIMIT $3`, [userId, sinceId, lim]
    )).rows;
  }
  return (await q(
    `SELECT id, type, icon, severity, title, body, action_kind, action_data, seen_at, created_at
       FROM notifications WHERE user_id=$1
      ORDER BY id DESC LIMIT $2`, [userId, lim]
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
    await q('UPDATE notifications SET seen_at=now() WHERE user_id=$1 AND seen_at IS NULL', [userId]);
    return { ok: true, all: true };
  }
  await q('UPDATE notifications SET seen_at=now() WHERE user_id=$1 AND id = ANY($2::bigint[])',
    [userId, ids]);
  return { ok: true, count: ids.length };
}

export async function markOneSeen(userId, id) {
  await q('UPDATE notifications SET seen_at=now() WHERE user_id=$1 AND id=$2', [userId, id]);
  return { ok: true };
}