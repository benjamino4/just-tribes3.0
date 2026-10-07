import crypto from 'crypto';

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

export function requireUser(req, res, next) {
  const initData = req.headers['x-init-data'] || req.body?.initData;
  const user = verifyInitData(initData, process.env.BOT_TOKEN);
  if (!user?.id) return res.status(401).json({ error: 'unauthorized' });
  req.tgUser = user;
  next();
}