// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/events.js
// PURPOSE: The unified event system. Every notification in the app
//          flows through here. Three tiers: island, ticker, toast.
//          Persists to DB. Broadcasts via SSE.
// DEPENDS ON: db.js
// ═══════════════════════════════════════════════════════════════════
import { q } from './db.js';

const subscribers = new Map();   // userId -> Set<res>
const tribeSubscribers = new Map(); // tribeId -> Set<res>

function keyOf(id) { return Number(id); }

export function subscribe(userId, res) {
  const k = keyOf(userId);
  if (!subscribers.has(k)) subscribers.set(k, new Set());
  subscribers.get(k).add(res);
  res.on('close', () => {
    const s = subscribers.get(k);
    if (s) { s.delete(res); if (!s.size) subscribers.delete(k); }
  });
}

export function subscribeTribe(tribeId, res) {
  const k = Number(tribeId);
  if (!tribeSubscribers.has(k)) tribeSubscribers.set(k, new Set());
  tribeSubscribers.get(k).add(res);
  res.on('close', () => {
    const s = tribeSubscribers.get(k);
    if (s) { s.delete(res); if (!s.size) tribeSubscribers.delete(k); }
  });
}

function broadcast(userId, payload) {
  const set = subscribers.get(keyOf(userId));
  if (!set || !set.size) return;
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) { try { res.write(line); } catch {} }
}

function broadcastTribe(tribeId, payload) {
  const set = tribeSubscribers.get(Number(tribeId));
  if (!set || !set.size) return;
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) { try { res.write(line); } catch {} }
}

export async function emit({
  userId, tribeId, tier = 'island', kind,
  title, body = null, icon = 'spark',
  severity = 'info', action_kind = null, action_data = null,
  sticky = false, ttl = 30,
}) {
  const row = {
    user_id: userId || null, tribe_id: tribeId || null,
    tier, kind, title, body, icon, severity,
    action_kind, action_data,
    sticky, ttl,
    at: Date.now(),
  };

  if (tier === 'island' && userId) {
    try {
      const r = await q(
        `INSERT INTO notifications (user_id, type, icon, severity, title, body, action_kind, action_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [userId, kind || 'system', icon, severity, title, body, action_kind,
         action_data ? JSON.stringify(action_data) : null]
      );
      row.id = r.rows[0].id;
    } catch (e) { console.warn('[events] insert notif', e.message); }
    broadcast(userId, row);
  }

  if (tier === 'ticker' && tribeId) {
    try {
      const r = await q(
        `INSERT INTO live_feed (tribe_id, kind, actor_id, target_id, data)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [tribeId, kind, userId || null, action_data?.target_id || null,
         JSON.stringify({ title, body, icon, severity, action_data })]
      );
      row.id = r.rows[0].id;
    } catch (e) { console.warn('[events] insert feed', e.message); }

    try {
      const memberIds = (await q(
        'SELECT id FROM users WHERE tribe_id=$1 AND banned=false',
        [tribeId]
      )).rows;
      for (const m of memberIds) broadcast(m.id, row);
    } catch {}
    broadcastTribe(tribeId, row);
  }

  if (tier === 'toast' && userId) {
    broadcast(userId, row);
  }

  return row;
}

export async function emitTribe(tribeId, opts) {
  const members = (await q(
    'SELECT id FROM users WHERE tribe_id=$1 AND banned=false',
    [tribeId]
  )).rows;
  const out = [];
  for (const m of members) {
    out.push(await emit({ ...opts, userId: m.id, tribeId }));
  }
  return out;
}

setInterval(() => {
  for (const set of subscribers.values()) {
    for (const res of set) { try { res.write(': ping\n\n'); } catch {} }
  }
  for (const set of tribeSubscribers.values()) {
    for (const res of set) { try { res.write(': ping\n\n'); } catch {} }
  }
}, 25000).unref();