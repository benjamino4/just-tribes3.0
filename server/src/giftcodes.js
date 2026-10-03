import { q } from './db.js';

function normalizeCode(c) {
  return String(c || '').trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '').slice(0, 32);
}

export async function preview(userId, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return { valid: false, reason: 'empty' };
  const row = (await q('SELECT * FROM codes WHERE code=$1', [code])).rows[0];
  if (!row) return { valid: false, reason: 'not_found' };
  if (!row.active) return { valid: false, reason: 'revoked' };
  if (Number(row.max_uses) > 0 && Number(row.uses) >= Number(row.max_uses)) {
    return { valid: false, reason: 'exhausted' };
  }
  const mine = (await q(
    'SELECT times FROM code_redemptions WHERE code=$1 AND user_id=$2', [code, userId]
  )).rows[0];
  if (mine && Number(mine.times) >= (row.per_user_limit || 1)) return { valid: false, reason: 'already_used' };
  return { valid: true, code, name: 'Gift', kind: row.kind, amount: Number(row.amount) || 0 };
}

export async function redeem(user, rawCode) {
  const code = normalizeCode(rawCode);
  const p = await preview(user.id, code);
  if (!p.valid) throw new Error('Invalid code: ' + p.reason);
  const row = (await q('SELECT * FROM codes WHERE code=$1 FOR UPDATE', [code])).rows[0];
  // Guarded, race-safe global-use increment: fails closed when exhausted.
  const incd = await q(
    'UPDATE codes SET uses = uses + 1 WHERE code=$1 AND (max_uses = 0 OR uses < max_uses) RETURNING uses',
    [code]
  );
  if (!incd.rowCount) throw new Error('Invalid code: exhausted');
  const existing = (await q(
    'SELECT times FROM code_redemptions WHERE code=$1 AND user_id=$2', [code, user.id]
  )).rows[0];
  if (existing) {
    await q('UPDATE code_redemptions SET times = times + 1, at = now() WHERE code=$1 AND user_id=$2', [code, user.id]);
  } else {
    await q('INSERT INTO code_redemptions (code, user_id, times) VALUES ($1,$2,1)', [code, user.id]);
  }
  const amount = Number(row.amount) || 0;
  if (row.kind === 'sparks') await q('UPDATE users SET sparks = sparks + $1 WHERE id=$2', [amount, user.id]);
  if (row.kind === 'kinship') await q('UPDATE users SET kinship = kinship + $1 WHERE id=$2', [amount, user.id]);
  if (row.kind === 'stars') await q('UPDATE users SET stars = stars + $1 WHERE id=$2', [amount, user.id]);
  return { ok: true, code, kind: row.kind, amount };
}