import { q } from './db.js';
import { verifyInitData } from './auth.js';
import { CFG } from './config.js';

const MAX_MESSAGES = Number(CFG.kiva_max_messages) || 500;
const subscribers = new Map();

export async function postMessage(tribeId, userId, body, kind = 'chat') {
  const maxLen = Number(CFG.kiva_message_max_length) || 280;
  const clean = String(body || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
  if (!clean) throw new Error('empty message');
  const r = await q(
    `INSERT INTO kiva_messages (tribe_id, user_id, body, kind)
     VALUES ($1,$2,$3,$4)
     RETURNING id, tribe_id, user_id, body, kind, pinned, created_at`,
    [tribeId, userId, clean, kind]
  );
  await q(
    `DELETE FROM kiva_messages
     WHERE tribe_id=$1 AND id < (SELECT COALESCE(MIN(id),0) FROM (
       SELECT id FROM kiva_messages WHERE tribe_id=$1
       ORDER BY id DESC LIMIT $2) s)`,
    [tribeId, MAX_MESSAGES]
  );
  const msg = r.rows[0];
  broadcast(tribeId, { type: 'message', message: msg });
  return msg;
}

export async function listMessages(tribeId, sinceId = 0, limit = 50) {
  return (await q(
    `SELECT m.id, m.user_id, m.body, m.kind, m.pinned, m.created_at,
     u.username, u.first_name, u.name_color, u.role
     FROM kiva_messages m JOIN users u ON u.id = m.user_id
     WHERE m.tribe_id=$1 AND m.id > $2
     ORDER BY m.id ASC LIMIT $3`,
    [tribeId, sinceId, Math.min(limit, 200)]
  )).rows;
}

export async function latestMessages(tribeId, limit = 50) {
  const r = await q(
    `SELECT * FROM (
      SELECT m.id, m.user_id, m.body, m.kind, m.pinned, m.created_at,
      u.username, u.first_name, u.name_color, u.role
      FROM kiva_messages m JOIN users u ON u.id = m.user_id
      WHERE m.tribe_id=$1 ORDER BY m.id DESC LIMIT $2) s
    ORDER BY id ASC`,
    [tribeId, Math.min(limit, 100)]
  );
  return r.rows;
}

export async function markRead(tribeId, userId, lastSeenId) {
  await q(
    `INSERT INTO kiva_reads (tribe_id, user_id, last_seen_id)
     VALUES ($1,$2,$3)
     ON CONFLICT (tribe_id, user_id) DO UPDATE
     SET last_seen_id=GREATEST(kiva_reads.last_seen_id, EXCLUDED.last_seen_id)`,
    [tribeId, userId, Number(lastSeenId) || 0]
  );
}

export async function unreadCount(tribeId, userId) {
  const r = (await q(
    `SELECT COUNT(*)::int AS n FROM kiva_messages m
     LEFT JOIN kiva_reads r ON r.tribe_id=m.tribe_id AND r.user_id=$2
     WHERE m.tribe_id=$1 AND m.id > COALESCE(r.last_seen_id, 0) AND m.user_id <> $2`,
    [tribeId, userId]
  )).rows[0];
  return r ? r.n : 0;
}

export function subscribe(tribeId, res) {
  const key = Number(tribeId);
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(res);
  res.on('close', () => {
    const set = subscribers.get(key);
    if (set) { set.delete(res); if (!set.size) subscribers.delete(key); }
  });
}

function broadcast(tribeId, payload) {
  const set = subscribers.get(Number(tribeId));
  if (!set || !set.size) return;
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) { try { res.write(line); } catch {} }
}

export function kivaSse(req, res) {
  const tribeId = Number(req.query.tribeId);
  const initData = req.query.initData || '';
  if (!tribeId) return res.status(400).end();
  const tgUser = verifyInitData(initData);
  if (!tgUser) return res.status(401).end();
  q('SELECT tribe_id FROM users WHERE id=$1', [tgUser.id])
    .then((r) => {
      const actual = r.rows[0]?.tribe_id;
      if (!actual || Number(actual) !== tribeId) { res.status(403).end(); return; }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 5000\n');
      subscribe(tribeId, res);
    })
    .catch(() => res.status(500).end());
}

setInterval(() => {
  for (const set of subscribers.values()) {
    for (const res of set) { try { res.write(': ping\n'); } catch {} }
  }
}, 25000).unref();