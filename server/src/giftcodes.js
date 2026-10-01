import { q } from './db.js';
import { emit } from './events.js';
import { grant as grantRelic } from './relics.js';

function normalizeCode(c) {
  return String(c || '').trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '').slice(0, 32);
}

export async function preview(userId, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return { valid: false, reason: 'empty' };
  const row = (await q('SELECT * FROM codes WHERE code=$1', [code])).rows[0];
  if (!row) return { valid: false, reason: 'not_found' };
  if (!row.active) return { valid: false, reason: 'revoked' };
  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return { valid: false, reason: 'not_started' };
  if (row.expires_at && new Date(row.expires_at).getTime() < now) return { valid: false, reason: 'expired' };
  if (row.max_uses > 0 && Number(row.uses) >= row.max_uses) return { valid: false, reason: 'exhausted' };
  const mine = (await q(
    'SELECT times FROM code_redemptions WHERE code=$1 AND user_id=$2', [code, userId]
  )).rows[0];
  if (mine && Number(mine.times) >= (row.per_user_limit || 1)) return { valid: false, reason: 'already_used' };
  return {
    valid: true, code,
    name: row.note || 'Gift',
    kind: row.kind, payload: row.payload
  };
}

async function applyPayload(user, kind, payload) {
  const p = payload || {};
  const results = [];
  const items = kind === 'bundle' && Array.isArray(p.items) ? p.items : [{ kind, ...p }];
  for (const item of items) {
    switch (item.kind) {
      case 'sparks':
        await q('UPDATE users SET sparks = sparks + $1 WHERE id=$2', [Number(item.amount) || 0, user.id]);
        results.push({ kind: 'sparks', amount: Number(item.amount) || 0 });
        break;
      case 'kinship':
        await q('UPDATE users SET kinship = kinship + $1 WHERE id=$2', [Number(item.amount) || 0, user.id]);
        if (user.tribe_id) await q('UPDATE tribes SET kinship_total = kinship_total + $1 WHERE id=$2',
          [Number(item.amount) || 0, user.tribe_id]);
        results.push({ kind: 'kinship', amount: Number(item.amount) || 0 });
        break;
      case 'stars':
        await q('UPDATE users SET stars = stars + $1 WHERE id=$2', [Number(item.amount) || 0, user.id]);
        results.push({ kind: 'stars', amount: Number(item.amount) || 0 });
        break;
      case 'relic':
        if (item.relic_slug) {
          await grantRelic(user.id, item.relic_slug, { detail: 'gift code' });
          results.push({ kind: 'relic', slug: item.relic_slug });
        }
        break;
      case 'emoji_set':
        if (item.set_slug) {
          await q('INSERT INTO user_emoji_sets (user_id, set_slug) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [user.id, item.set_slug]);
          results.push({ kind: 'emoji_set', slug: item.set_slug });
        }
        break;
    }
  }
  return results;
}

export async function redeem(user, rawCode) {
  const code = normalizeCode(rawCode);
  const p = await preview(user.id, code);
  if (!p.valid) {
    const msgs = {
      not_found: 'That code does not exist.',
      revoked: 'That code has been revoked.',
      not_started: 'That code is not yet active.',
      expired: 'That code has expired.',
      exhausted: 'That code has been fully claimed.',
      already_used: 'You have already used that code.'
    };
    throw new Error(msgs[p.reason] || 'Invalid code.');
  }
  const row = (await q('SELECT * FROM codes WHERE code=$1 FOR UPDATE', [code])).rows[0];
  const existing = (await q(
    'SELECT times FROM code_redemptions WHERE code=$1 AND user_id=$2', [code, user.id]
  )).rows[0];
  if (existing) {
    await q('UPDATE code_redemptions SET times = times + 1, at = now() WHERE code=$1 AND user_id=$2',
      [code, user.id]);
  } else {
    await q('INSERT INTO code_redemptions (code, user_id, times) VALUES ($1,$2,1)', [code, user.id]);
  }
  await q('UPDATE codes SET uses = uses + 1 WHERE code=$1', [code]);
  const summary = await applyPayload(user, row.kind, row.payload || { amount: row.amount });
  await emit({
    userId: user.id, tier: 'island', kind: 'gift_redeemed',
    title: 'Gift redeemed', body: row.note || 'You received a gift.',
    icon: 'gift', severity: 'success', action_kind: 'hearth'
  });
  return { ok: true, code, summary };
}

export async function adminCreate(adminId, data) {
  const code = normalizeCode(data.code || ('GIFT-' + Math.random().toString(36).slice(2, 8).toUpperCase()));
  if (code.length < 4) throw new Error('code must be 4+ characters');
  const kind = String(data.kind || 'sparks');
  const payload = data.payload || (kind === 'sparks' ? { amount: Number(data.amount) || 0 } : {});
  await q(
    `INSERT INTO codes (code, kind, amount, payload, max_uses, per_user_limit, note,
                        expires_at, starts_at, scope, scope_tribe_id, active, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [code, kind, Number(data.amount) || 0, JSON.stringify(payload),
     Number(data.max_uses) || 0, Number(data.per_user_limit) || 1,
     data.note || null, data.expires_at || null, data.starts_at || null,
     data.scope || 'global', data.scope_tribe_id || null,
     data.active !== false, adminId || null]
  );
  return { code };
}

export async function adminRevoke(code) {
  await q('UPDATE codes SET active=false WHERE code=$1', [code]);
  return { ok: true };
}

export async function adminDelete(code) {
  await q('DELETE FROM codes WHERE code=$1', [code]);
  return { ok: true };
}