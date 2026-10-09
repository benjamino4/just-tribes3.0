import crypto from 'crypto';
import { q } from './db.js';

export function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const computed = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computed !== hash) return null;
    return JSON.parse(params.get('user') || '{}');
  } catch {
    return null;
  }
}

export async function requireUser(req, res, next) {
  const initData = req.headers['x-init-data'] || req.body?.initData;
  const user = verifyInitData(initData, process.env.BOT_TOKEN);
  if (!user?.id) return res.status(401).json({ error: 'unauthorized' });
  // Pull the (signed) deep-link payload so referral attribution can't be spoofed:
  // `startapp=<sigil>` arrives here as start_param inside the verified initData.
  try {
    const params = new URLSearchParams(initData);
    req.startParam = (params.get('start_param') || '').trim();
  } catch { req.startParam = ''; }
  // The admin can ban a user from the admin bot — blocked here app-wide.
  try {
    const { rows } = await q(`SELECT banned FROM users WHERE telegram_id=$1`, [user.id]);
    if (rows.length && rows[0].banned) return res.status(403).json({ error: 'banned' });
  } catch { /* if the column/table isn't ready yet, don't block */ }
  req.tgUser = user;
  next();
}