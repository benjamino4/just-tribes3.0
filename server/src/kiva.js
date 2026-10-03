// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/kiva.js
// PURPOSE: Tribe chat. SSE. Polls. Seals. Curfew.
// DEPENDS ON: db.js, config.js, auth.js
// ═══════════════════════════════════════════════════════════════════
import { q } from './db.js';
import { verifyInitData } from './auth.js';
import { CFG } from './config.js';

const MAX_MESSAGES = Number(CFG.kiva_max_messages) || 500;
const subscribers = new Map();

export async function postMessage(tribeId, userId, body, kind = 'chat', poll = null) {
  const maxLen = Number(CFG.kiva_message_max_length) || 280;
  const clean = poll ? null : String(body || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
  if (!poll && !clean) throw new Error('empty message');

  if (kind === 'chat') {
    const curfew = (await q(
      `SELECT started_by, ends_at FROM kiva_curfews
        WHERE tribe_id=$1 AND ends_at > now()`, [tribeId]
    )).rows[0];
    if (curfew && Number(curfew.started_by) !== Number(userId)) {
      throw new Error('A Curfew is in effect — only the Chief may speak.');
    }
  }

  const r = await q(
    `INSERT INTO kiva_messages (tribe_id, user_id, body, kind, poll_data)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, tribe_id, user_id, body, kind, pinned, poll_data, created_at`,
    [tribeId, userId, clean, kind, poll ? JSON.stringify(poll) : null]
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

export async function setSeal(tribeId, messageId, userId, sealed) {
  const msg = (await q(
    'SELECT id, pinned FROM kiva_messages WHERE id=$1 AND tribe_id=$2', [messageId, tribeId]
  )).rows[0];
  if (!msg) throw new Error('no such message');
  await q(
    `UPDATE kiva_messages SET pinned=$1, sealed_at=$2, sealed_by=$3
      WHERE id=$4 AND tribe_id=$5`,
    [!!sealed, sealed ? new Date() : null, sealed ? userId : null, messageId, tribeId]
  );
  const row = (await q('SELECT id, pinned, sealed_at, sealed_by FROM kiva_messages WHERE id=$1',
    [messageId])).rows[0];
  broadcast(tribeId, { type: 'seal', id: row.id, pinned: row.pinned });
  return row;
}

export async function votePoll(tribeId, messageId, userId, optionIndex) {
  const msg = (await q('SELECT id, poll_data FROM kiva_messages WHERE id=$1 AND tribe_id=$2',
    [messageId, tribeId])).rows[0];
  if (!msg || !msg.poll_data) throw new Error('no such poll');
  const poll = msg.poll_data;
  const idx = Number(optionIndex);
  if (!Array.isArray(poll.opts) || idx < 0 || idx >= poll.opts.length) throw new Error('bad option');
  poll.voters = poll.voters || {};
  if (poll.voters[userId] != null) throw new Error('you already voted');
  poll.opts[idx].v = (poll.opts[idx].v || 0) + 1;
  poll.voters[userId] = idx;
  await q('UPDATE kiva_messages SET poll_data=$1::jsonb WHERE id=$2',
    [JSON.stringify(poll), messageId]);
  broadcast(tribeId, { type: 'poll', id: messageId, poll });
  return poll;
}

export async function startCurfew(tribeId, userId, hours) {
  const h = Math.max(1, Math.min(24, Number(hours) || 3));
  const ends = new Date(Date.now() + h * 3600 * 1000);
  await q(
    `INSERT INTO kiva_curfews (tribe_id, started_by, ends_at)
     VALUES ($1,$2,$3)
     ON CONFLICT (tribe_id) DO UPDATE
       SET started_by=EXCLUDED.started_by, started_at=now(), ends_at=EXCLUDED.ends_at`,
    [tribeId, userId, ends]
  );
  broadcast(tribeId, { type: 'curfew', started_by: userId, ends_at: ends });
  return { ok: true, ends_at: ends };
}

export async function endCurfew(tribeId, userId) {
  const row = (await q(
    'SELECT started_by FROM kiva_curfews WHERE tribe_id=$1 AND ends_at > now()', [tribeId]
  )).rows[0];
  if (!row) throw new Error('no active curfew');
  if (Number(row.started_by) !== Number(userId)) throw new Error('only the caller can lift it');
  await q('DELETE FROM kiva_curfews WHERE tribe_id=$1', [tribeId]);
  broadcast(tribeId, { type: 'curfew', ended: true });
  return { ok: true };
}

export async function activeCurfew(tribeId) {
  return (await q(
    `SELECT started_by, ends_at FROM kiva_curfews WHERE tribe_id=$1 AND ends_at > now()`,
    [tribeId]
  )).rows[0] || null;
}

export async function listMessages(tribeId, sinceId = 0, limit = 50) {
  return (await q(
    `SELECT m.id, m.user_id, m.body, m.kind, m.pinned, m.poll_data, m.created_at,
            u.username, u.first_name, u.name_color, u.avatar_glow, u.role
       FROM kiva_messages m JOIN users u ON u.id = m.user_id
      WHERE m.tribe_id=$1 AND m.id > $2
      ORDER BY m.id ASC LIMIT $3`,
    [tribeId, sinceId, Math.min(limit, 200)]
  )).rows;
}

export async function latestMessages(tribeId, limit = 50) {
  const r = await q(
    `SELECT * FROM (
       SELECT m.id, m.user_id, m.body, m.kind, m.pinned, m.poll_data, m.created_at,
              u.username, u.first_name, u.name_color, u.avatar_glow, u.role
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
  const guestId = req.query.guestId || '';
  if (!tribeId) return res.status(400).end();

  const tgUser = verifyInitData(initData);
  const allowGuest = process.env.ALLOW_GUEST === '1';
  let userId = null;
  if (tgUser) userId = tgUser.id;
  else if (allowGuest && guestId && /^g\d{6,}$/.test(guestId)) {
    userId = Number(guestId.slice(1)) % 2147483647 + 1000000000;
  }
  if (!userId) return res.status(401).end();

  q('SELECT tribe_id FROM users WHERE id=$1', [userId])
    .then((r) => {
      const actual = r.rows[0]?.tribe_id;
      if (!actual || Number(actual) !== tribeId) { res.status(403).end(); return; }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 5000\n\n');
      subscribe(tribeId, res);
    })
    .catch(() => res.status(500).end());
}

setInterval(() => {
  for (const set of subscribers.values()) {
    for (const res of set) { try { res.write(': ping\n\n'); } catch {} }
  }
}, 25000).unref();