// ---------------------------------------------------------------------------
// Telegram Mini App auth. Verifies initData HMAC, upserts the user, and
// enforces username presence (hard-block; client shows a gate with a deep
// link to tg://settings).
// ---------------------------------------------------------------------------
import crypto from 'crypto';
import { q } from './db.js';

const BOT_TOKEN   = process.env.BOT_TOKEN || '';
const ALLOW_GUEST = process.env.ALLOW_GUEST === '1';

export function verifyInitData(initData){
  if (!initData || !BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const pairs = [...params.entries()].map(([k,v]) => `${k}=${v}`).sort();
  const dcs = pairs.join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calc = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  if (calc !== hash) return null;
  const authDate = Number(params.get('auth_date') || 0);
  if (authDate && (Date.now()/1000 - authDate) > 86400) return null;
  try { return JSON.parse(params.get('user') || 'null'); } catch { return null; }
}

// Returns { user } on success, or { error:'no_username' } so the router can
// send a structured 401 the client understands.
export async function resolveUser(req){
  const initData = req.get('X-Init-Data') || req.body?.initData || '';
  let tgUser = verifyInitData(initData);

  if (!tgUser && ALLOW_GUEST){
    const gid = req.get('X-Guest-Id');
    if (gid && /^g\d{6,}$/.test(gid)){
      tgUser = {
        id: Number(gid.slice(1)) % 2147483647 + 1000000000,
        username: 'wanderer_guest',
        first_name: 'Wanderer',
        is_guest: true,
      };
    }
  }
  if (!tgUser) return null;

  // Hard-block: no Telegram username → no play.
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
    [tgUser.id, tgUser.username || null, tgUser.first_name || 'Kin',
     tgUser.photo_url || null, !!tgUser.is_guest]
  );
  return { user: r.rows[0] };
}