/* =====================================================================
   Kiva — tribe chat. SSE broadcast with tribe-membership auth.
   Retention: last 500 messages per tribe.
===================================================================== */
import { q } from './db.js';
import { verifyInitData } from './auth.js';

const KIVA_MAX = 500;
const subscribers = new Map();

function escapeHTML(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// Emoji alive — wrap recognized emojis so the client can animate them
const EMOJI_RE = /(\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{1F900}-\u{1F9FF})/u;

export async function postMessage(tribeId, userId, body, kind = 'chat'){
  const clean = String(body || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (!clean) throw new Error('empty message');
  const r = await q(
    `INSERT INTO kiva_messages (tribe_id, user_id, body, kind)
     VALUES ($1,$2,$3,$4) RETURNING id, tribe_id, user_id, body, kind, pinned, created_at`,
    [tribeId, userId, clean, kind]
  );
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

/* ---------- SSE route with real auth ---------- */
export function kivaSse(req, res){
  const tribeId = Number(req.query.tribeId);
  const initData = req.query.initData || '';
  const guestId = req.query.guestId || '';

  if (!tribeId) return res.status(400).end();

  // Verify Telegram initData (or guest)
  const tgUser = verifyInitData(initData);
  const allowGuest = process.env.ALLOW_GUEST === '1';
  let userId = null;

  if (tgUser) userId = tgUser.id;
  else if (allowGuest && guestId && /^g\d{6,}$/.test(guestId)){
    userId = Number(guestId.slice(1)) % 2147483647 + 1000000000;
  }

  if (!userId) return res.status(401).end();

  // Verify the user is actually in that tribe
  q('SELECT tribe_id FROM users WHERE id=$1', [userId])
    .then(r => {
      const actual = r.rows[0]?.tribe_id;
      if (!actual || Number(actual) !== tribeId){
        res.status(403).end();
        return;
      }
      res.writeHead(200, {
        'Content-Type':'text/event-stream',
        'Cache-Control':'no-cache, no-transform',
        'Connection':'keep-alive',
        'X-Accel-Buffering':'no',
      });
      res.write('retry: 5000\n\n');
      subscribe(tribeId, res);
    })
    .catch(() => res.status(500).end());
}

setInterval(() => {
  for (const set of subscribers.values())
    for (const res of set){ try { res.write(': ping\n\n'); } catch {} }
}, 25000).unref();