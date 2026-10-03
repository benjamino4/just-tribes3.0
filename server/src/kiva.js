import { q } from './db.js';
import { verifyInitData } from './auth.js';
import { CFG } from './config.js';
import { emit } from './events.js';

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
  // Island notification: ping every tribe member (except the sender) that a
  // new Kiva message has arrived, so the whole tribe sees it on their island.
  try {
    const sender = (await q(
      'SELECT first_name, username FROM users WHERE id=$1', [userId]
    )).rows[0] || {};
    const who = sender.first_name || sender.username || 'A tribemate';
    const preview = clean.length > 90 ? clean.slice(0, 89) + '…' : clean;
    const members = (await q(
      'SELECT id FROM users WHERE tribe_id=$1 AND banned=false AND id <> $2',
      [tribeId, userId]
    )).rows;
    for (const m of members) {
      emit({
        userId: m.id, tribeId, tier: 'island', kind: 'kiva',
        icon: 'chat', severity: 'info',
        title: `${who} in Kiva`, body: preview,
        action_kind: 'open_kiva', action_data: { tribeId },
        ttl: 20,
      }).catch(() => {});
    }
  } catch (e) { console.warn('[kiva] island notify', e.message); }
  return msg;
}

export async function listMessages(tribeId, sinceId = 0, limit = 50) {
  const rows = (await q(
    `SELECT m.id, m.user_id, m.body, m.kind, m.pinned, m.pinned_at, m.created_at,
     u.username, u.first_name, u.name_color, u.role
     FROM kiva_messages m JOIN users u ON u.id = m.user_id
     WHERE m.tribe_id=$1 AND m.id > $2
     ORDER BY m.id ASC LIMIT $3`,
    [tribeId, sinceId, Math.min(limit, 200)]
  )).rows;
  return attachReactions(rows);
}

export async function latestMessages(tribeId, limit = 50) {
  const r = await q(
    `SELECT * FROM (
      SELECT m.id, m.user_id, m.body, m.kind, m.pinned, m.pinned_at, m.created_at,
      u.username, u.first_name, u.name_color, u.role
      FROM kiva_messages m JOIN users u ON u.id = m.user_id
      WHERE m.tribe_id=$1 ORDER BY m.id DESC LIMIT $2) s
    ORDER BY id ASC`,
    [tribeId, Math.min(limit, 100)]
  );
  return attachReactions(r.rows);
}

// Returns the currently pinned messages for a tribe (newest pin first).
export async function pinnedMessages(tribeId) {
  const rows = (await q(
    `SELECT m.id, m.user_id, m.body, m.kind, m.pinned, m.pinned_at, m.created_at,
     u.username, u.first_name, u.name_color, u.role
     FROM kiva_messages m JOIN users u ON u.id = m.user_id
     WHERE m.tribe_id=$1 AND m.pinned=true
     ORDER BY m.pinned_at DESC NULLS LAST, m.id DESC`,
    [tribeId]
  )).rows;
  return attachReactions(rows);
}

// Aggregates reactions for a batch of messages into a compact per-message shape:
//   reactions: [{ key, count, mine }]
async function attachReactions(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => Number(r.id));
  const rx = (await q(
    `SELECT message_id, emoji_key, user_id FROM kiva_reactions
     WHERE message_id = ANY($1::bigint[])`,
    [ids]
  )).rows;
  const byMsg = new Map();
  for (const r of rx) {
    const mid = Number(r.message_id);
    if (!byMsg.has(mid)) byMsg.set(mid, new Map());
    const m = byMsg.get(mid);
    const prev = m.get(r.emoji_key) || { key: r.emoji_key, count: 0, users: [] };
    prev.count += 1; prev.users.push(Number(r.user_id));
    m.set(r.emoji_key, prev);
  }
  for (const row of rows) {
    const m = byMsg.get(Number(row.id));
    row.reactions = m ? Array.from(m.values()).map((e) => ({ key: e.key, count: e.count, users: e.users })) : [];
  }
  return rows;
}

// Toggles a single-user reaction on a message. Returns the fresh aggregate for
// that message and broadcasts it so every open Kiva updates in real time.
export async function toggleReaction(tribeId, userId, messageId, emojiKey) {
  const key = String(emojiKey || '').trim().slice(0, 40);
  if (!/^[a-z0-9_]{2,40}$/i.test(key)) throw new Error('bad reaction');
  const owns = (await q(
    'SELECT 1 FROM kiva_messages WHERE id=$1 AND tribe_id=$2', [messageId, tribeId]
  )).rowCount;
  if (!owns) throw new Error('no such message');
  const existed = (await q(
    'DELETE FROM kiva_reactions WHERE message_id=$1 AND user_id=$2 AND emoji_key=$3',
    [messageId, userId, key]
  )).rowCount;
  if (!existed) {
    await q(
      `INSERT INTO kiva_reactions (message_id, tribe_id, user_id, emoji_key)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [messageId, tribeId, userId, key]
    );
  }
  const agg = (await q(
    `SELECT emoji_key, user_id FROM kiva_reactions WHERE message_id=$1`, [messageId]
  )).rows;
  const map = new Map();
  for (const r of agg) {
    const prev = map.get(r.emoji_key) || { key: r.emoji_key, count: 0, users: [] };
    prev.count += 1; prev.users.push(Number(r.user_id));
    map.set(r.emoji_key, prev);
  }
  const reactions = Array.from(map.values());
  broadcast(tribeId, { type: 'reaction', message_id: Number(messageId), reactions });
  return { ok: true, message_id: Number(messageId), reactions, active: !existed };
}

// Premium: pin a message to the top of the Kiva by spending Stars. Atomic Star
// deduction; capped number of pins per tribe (oldest pin is released when full).
export async function pinMessage(tribeId, userId, messageId) {
  const cost = Number(CFG.kiva_pin_cost_stars) || 50;
  const maxPins = Number(CFG.kiva_pin_max) || 3;
  const msg = (await q(
    'SELECT id, pinned FROM kiva_messages WHERE id=$1 AND tribe_id=$2',
    [messageId, tribeId]
  )).rows[0];
  if (!msg) throw new Error('no such message');
  if (msg.pinned) return { ok: true, already: true };
  const upd = await q(
    'UPDATE users SET stars = stars - $1 WHERE id=$2 AND stars >= $1 RETURNING stars',
    [cost, userId]
  );
  if (!upd.rowCount) { const e = new Error('not enough Stars'); e.need = cost; throw e; }
  // Release the oldest pin if we're at the cap.
  const pins = (await q(
    'SELECT id FROM kiva_messages WHERE tribe_id=$1 AND pinned=true ORDER BY pinned_at ASC NULLS FIRST, id ASC',
    [tribeId]
  )).rows;
  if (pins.length >= maxPins) {
    const drop = pins.slice(0, pins.length - maxPins + 1).map((p) => Number(p.id));
    await q('UPDATE kiva_messages SET pinned=false WHERE id = ANY($1::bigint[])', [drop]);
  }
  await q(
    'UPDATE kiva_messages SET pinned=true, pinned_by=$2, pinned_at=now() WHERE id=$1',
    [messageId, userId]
  );
  broadcast(tribeId, { type: 'pin', message_id: Number(messageId), pinned: true });
  return { ok: true, stars: Number(upd.rows[0].stars), spent: cost };
}

export async function unpinMessage(tribeId, messageId) {
  await q('UPDATE kiva_messages SET pinned=false WHERE id=$1 AND tribe_id=$2', [messageId, tribeId]);
  broadcast(tribeId, { type: 'pin', message_id: Number(messageId), pinned: false });
  return { ok: true };
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