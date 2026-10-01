import { resolveUser } from './auth.js';
import { CFG } from './config.js';

const buckets = new Map();

export function rateLimit(key, perMin) {
  return (req, res, next) => {
    const id = `${key}:${req.user?.id || req.ip}`;
    const now = Date.now();
    const b = buckets.get(id) || { n: 0, resetAt: now + 60000 };
    if (now > b.resetAt) { b.n = 0; b.resetAt = now + 60000; }
    b.n++;
    buckets.set(id, b);
    if (b.n > perMin) return res.status(429).json({ error: 'slow down' });
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
}, 60000).unref();

export async function authMiddleware(req, res, next) {
  try {
    const r = await resolveUser(req);
    if (!r) {
      return res.status(401).json({
        error: 'unauthorized',
        hint: 'Open this Mini App inside Telegram.',
      });
    }
    if (r.error === 'no_username') {
      return res.status(401).json({
        error: 'no_username',
        hint: 'Set a Telegram username to enter the tribes.',
        deepLink: 'tg://settings',
      });
    }
    const u = r.user;
    if (u.banned) {
      return res.status(403).json({
        error: 'banned',
        reason: u.ban_reason || 'You were banished.',
      });
    }
    if (Number(CFG.maintenance) && req.method !== 'GET') {
      return res.status(503).json({ error: 'maintenance' });
    }
    req.user = u;
    next();
  } catch (e) { next(e); }
}