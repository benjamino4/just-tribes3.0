import { q } from './db.js';

export async function list(userId, { limit = 40 } = {}) {
  const lim = Math.max(1, Math.min(100, Number(limit) || 40));
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

export async function markOneSeen(userId, id) {
  await q('UPDATE notifications SET seen_at=now() WHERE user_id=$1 AND id=$2', [userId, id]);
  return { ok: true };
}