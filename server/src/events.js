import { q } from './db.js';

const subscribers = new Map();

export function subscribe(userId, res) {
  const k = Number(userId);
  if (!subscribers.has(k)) subscribers.set(k, new Set());
  subscribers.get(k).add(res);
  res.on('close', () => {
    const s = subscribers.get(k);
    if (s) { s.delete(res); if (!s.size) subscribers.delete(k); }
  });
}

function broadcast(userId, payload) {
  const set = subscribers.get(Number(userId));
  if (!set || !set.size) return;
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) { try { res.write(line); } catch {} }
}

export async function emit({
  userId, tribeId, tier = 'island', kind,
  title, body = null, icon = 'spark', severity = 'info',
  action_kind = null, action_data = null, sticky = false, ttl = 30,
}) {
  const row = {
    user_id: userId || null, tribe_id: tribeId || null,
    tier, kind, title, body, icon, severity, action_kind, action_data,
    sticky, ttl, at: Date.now(),
  };
  if (tier === 'island' && userId) {
    try {
      await q(
        `INSERT INTO notifications (user_id, type, icon, severity, title, body, action_kind, action_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [userId, kind || 'system', icon, severity, title, body, action_kind,
         action_data ? JSON.stringify(action_data) : null]
      );
    } catch (e) { console.warn('[events] insert notif', e.message); }
    broadcast(userId, row);
  }
  if (tier === 'ticker' && tribeId) {
    try {
      await q(
        `INSERT INTO live_feed (tribe_id, kind, actor_id, target_id, data)
         VALUES ($1,$2,$3,$4,$5)`,
        [tribeId, kind, userId || null, action_data?.target_id || null,
         JSON.stringify({ title, body, icon, severity, action_data })]
      );
    } catch (e) { console.warn('[events] insert feed', e.message); }
    const memberIds = (await q(
      'SELECT id FROM users WHERE tribe_id=$1 AND banned=false', [tribeId]
    )).rows;
    for (const m of memberIds) broadcast(m.id, row);
  }
}

export async function emitTribe(tribeId, opts) {
  const members = (await q(
    'SELECT id FROM users WHERE tribe_id=$1 AND banned=false', [tribeId]
  )).rows;
  for (const m of members) await emit({ ...opts, userId: m.id, tribeId });
}

setInterval(() => {
  for (const set of subscribers.values()) {
    for (const res of set) { try { res.write(': ping\n'); } catch {} }
  }
}, 25000).unref();