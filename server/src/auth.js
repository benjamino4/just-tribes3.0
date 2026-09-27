// TRIBES-FILE: server/src/auth.js
// PHASE: 2 — Identity & shell
// Verifies Telegram initData HMAC + upserts user. Guest fallback if
// ALLOW_GUEST=1 and no initData present.

import crypto from 'crypto';
import { q } from './db.js';

const BOT_TOKEN   = process.env.BOT_TOKEN || '';
const ALLOW_GUEST = process.env.ALLOW_GUEST === '1';

/**
 * Verify Telegram WebApp initData per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Returns the parsed user object (or null on failure / expired).
 */
export function verifyInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;

  let params;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const pairs = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort();
  const dcs = pairs.join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calc = crypto.createHmac('sha256', secret).update(dcs).digest('hex');

  // constant-time compare
  const a = Buffer.from(calc, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // reject stale auth (older than 24h)
  const authDate = Number(params.get('auth_date') || 0);
  if (authDate && (Date.now() / 1000 - authDate) > 86400) return null;

  try {
    return JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
}

/**
 * Resolve the current user from a request.
 * Returns:
 *   { user }         — authenticated
 *   { error: '...' } — rejected with a reason
 *   null             — no auth at all
 */
export async function resolveUser(req) {
  const initData =
    req.get('X-Init-Data') ||
    (req.body && req.body.initData) ||
    '';

  let tgUser = verifyInitData(initData);

  if (!tgUser && ALLOW_GUEST) {
    const gid = req.get('X-Guest-Id');
    if (gid && /^g\d{6,}$/.test(gid)) {
      tgUser = {
        id: Number(gid.slice(1)) % 2147483647 + 1000000000,
        username: 'wanderer_guest',
        first_name: 'Wanderer',
        is_guest: true,
      };
    }
  }

  if (!tgUser) return null;

  // Telegram users must have a username set (spec rule)
  if (!tgUser.username && !tgUser.is_guest) {
    return { error: 'no_username' };
  }

  const r = await q(
    `INSERT INTO users (id, username, first_name, photo_url, is_guest)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE
       SET username   = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           photo_url  = EXCLUDED.photo_url,
           is_guest   = EXCLUDED.is_guest
     RETURNING *`,
    [
      tgUser.id,
      tgUser.username || null,
      tgUser.first_name || 'Kin',
      tgUser.photo_url || null,
      !!tgUser.is_guest,
    ]
  );

  return { user: r.rows[0] };
}