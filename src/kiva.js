// ---------------------------------------------------------------------------
// Kiva — tribe message board. SSE broadcast with polling fallback.
// Retention: last 500 messages per tribe (rolled on insert).
// ---------------------------------------------------------------------------
import { q } from './db.js';

const KIVA_MAX = 500;
const subscribers = new Map(); // tribeId -> Set<res>

export async function postMessage(tribeId, userId, body, kind = 'chat'){
  const clean = String(body || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (!clean) throw new Error('empty message');
  const r = await q(
    `INSERT INTO kiva_messages (tribe_id, user_id, body, kind)
     VALUES ($1,$2,$3,$4) RETURNING id, tribe_id, user_id, body, kind, pinned, created_at`,
    [tribeId, userId, clean, kind]
  );
  // prune
  await q(
    `DELETE FROM kiva_messages
      WHERE tribe_id=$1
        AND id < (SELECT COALESCE(MIN(id),0) FROM (
             SELECT id FROM kiva_messages WHERE tribe_id=$1
             ORDER BY id DESC LIMIT $2
           ) s)`,
    [tribeId, KIVA_MAX]
  );
  const msg = r.rows[0];
  broadcast(tribeId, { type:'message', message: msg });
  return msg;
}

export async function listMessages(tribeId, sinceId = 0, limit = 50){
  const r = await q(
    `SELECT m.id, m.user_id, m.body, m.kind, m.pinned, m.created_at,
            u.username, u.first_name, u.name_color, u.avatar_glow, u.role
       FROM kiva_messages m
       JOIN users u ON u.id = m.user_id
      WHERE m.tribe_id=$1 AND m.id > $2
      ORDER BY m.id ASC
      LIMIT $3`,
    [tribeId, sinceId, Math.min(limit, 200)]
  );
  return r.rows;
}

export async function latestMessages(tribeId, limit = 50){
  const r = await q(
    `SELECT * FROM (
       SELECT m.id, m.user_id, m.body, m.kind, m.pinned, m.created_at,
              u.username, u.first_name, u.name_color, u.avatar_glow, u.role
         FROM kiva_messages m
         JOIN users u ON u.id = m.user_id
        WHERE m.tribe_id=$1
        ORDER BY m.id DESC
        LIMIT $2
     ) s ORDER BY id ASC`,
    [tribeId, Math.min(limit, 100)]
  );
  return r.rows;
}

export async function setPin(tribeId, messageId, pinned){
  const r = await q(
    `UPDATE kiva_messages SET pinned=$1 WHERE id=$2 AND tribe_id=$3 RETURNING id, pinned`,
    [!!pinned, messageId, tribeId]
  );
  if (!r.rowCount) throw new Error('no such message');
  const row = r.rows[0];
  broadcast(tribeId, { type:'pin', id: row.id, pinned: row.pinned });
  return row;
}

export async function markRead(tribeId, userId, lastSeenId){
  await q(
    `INSERT INTO kiva_reads (tribe_id, user_id, last_seen_id) VALUES ($1,$2,$3)
     ON CONFLICT (tribe_id, user_id) DO UPDATE SET last_seen_id=GREATEST(kiva_reads.last_seen_id, EXCLUDED.last_seen_id)`,
    [tribeId, userId, Number(lastSeenId)||0]
  );
}

export function subscribe(tribeId, res){
  const key = Number(tribeId);
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(res);
  res.on('close', () => {
    const set = subscribers.get(key);
    if (set) { set.delete(res); if (!set.size) subscribers.delete(key); }
  });
}

function broadcast(tribeId, payload){
  const set = subscribers.get(Number(tribeId));
  if (!set || !set.size) return;
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set){ try { res.write(line); } catch {} }
}

// keep-alive ping so Render/proxies don't reap idle streams
setInterval(() => {
  for (const set of subscribers.values()) for (const res of set){ try { res.write(': ping\n\n'); } catch {} }
}, 25000).unref();