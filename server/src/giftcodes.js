// =====================================================================
// Gift codes — universal reward system.
// =====================================================================
import { q } from './db.js';
import { notifyAndBroadcast } from './notifications.js';
import { feedWrite } from './feed.js';
import { grant as grantRelic, grantShard } from './relics.js';

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
    'SELECT times FROM code_redemptions WHERE code=$1 AND user_id=$2',
    [code, userId]
  )).rows[0];
  if (mine && Number(mine.times) >= (row.per_user_limit || 1)) {
    return { valid: false, reason: 'already_used' };
  }

  if (row.scope === 'tribe') {
    const u = (await q('SELECT tribe_id FROM users WHERE id=$1', [userId])).rows[0];
    if (!u || Number(u.tribe_id) !== Number(row.scope_tribe_id)) {
      return { valid: false, reason: 'wrong_tribe' };
    }
  }

  const remaining = row.max_uses > 0
    ? Math.max(0, Number(row.max_uses) - Number(row.uses))
    : null;

  return {
    valid: true, code, name: row.note || 'Gift',
    kind: row.kind, payload: row.payload,
    hero: row.hero_image_svg || row.hero_image_url || null,
    remaining, expires_at: row.expires_at,
  };
}

async function applyPayload(user, kind, payload) {
  const p = payload || {};
  const results = [];
  const items = kind === 'bundle' && Array.isArray(p.items) ? p.items : [{ kind, ...p }];

  for (const item of items) {
    switch (item.kind) {
      case 'ember':
        await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [Number(item.amount) || 0, user.id]);
        results.push({ kind: 'ember', amount: Number(item.amount) || 0 });
        break;
      case 'renown':
        await q('UPDATE users SET renown = renown + $1 WHERE id=$2', [Number(item.amount) || 0, user.id]);
        if (user.tribe_id) {
          await q('UPDATE tribes SET renown_total = renown_total + $1 WHERE id=$2',
            [Number(item.amount) || 0, user.tribe_id]);
        }
        results.push({ kind: 'renown', amount: Number(item.amount) || 0 });
        break;
      case 'stars':
        await q('UPDATE users SET stars = stars + $1 WHERE id=$2', [Number(item.amount) || 0, user.id]);
        results.push({ kind: 'stars', amount: Number(item.amount) || 0 });
        break;
      case 'relic':
        if (item.relic_slug) {
          await grantRelic(user.id, item.relic_slug, { detail: 'gift code', tribeId: user.tribe_id });
          results.push({ kind: 'relic', slug: item.relic_slug });
        }
        break;
      case 'shards':
        await grantShard(user.id, Number(item.amount) || 1);
        results.push({ kind: 'shards', amount: Number(item.amount) || 1 });
        break;
      case 'emoji':
        if (item.emoji_key) {
          const eid = (await q('SELECT id FROM emoji_defs WHERE key=$1', [item.emoji_key])).rows[0]?.id;
          if (eid) {
            await q(
              'INSERT INTO user_emoji_defs (user_id, emoji_id, source) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
              [user.id, eid, 'code']
            );
            results.push({ kind: 'emoji', key: item.emoji_key });
          }
        }
        break;
      case 'emoji_set':
        if (item.set_slug) {
          await q(
            'INSERT INTO user_emoji_sets (user_id, set_slug) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [user.id, item.set_slug]
          );
          results.push({ kind: 'emoji_set', slug: item.set_slug });
        }
        break;
      case 'cosmetic':
        if (item.cosmetic_kind === 'name_color' && item.value) {
          await q('UPDATE users SET name_color=$1 WHERE id=$2', [item.value, user.id]);
          results.push({ kind: 'cosmetic', name: 'name_color', value: item.value });
        } else if (item.cosmetic_kind === 'avatar_glow' && item.value) {
          await q('UPDATE users SET avatar_glow=$1 WHERE id=$2', [item.value, user.id]);
          results.push({ kind: 'cosmetic', name: 'avatar_glow', value: item.value });
        }
        break;
    }
  }
  return results;
}

function summarize(summary) {
  if (!Array.isArray(summary) || !summary.length) return null;
  return summary.map((s) => {
    if (s.kind === 'ember') return `+${Number(s.amount).toLocaleString()} Ember`;
    if (s.kind === 'renown') return `+${s.amount} Renown`;
    if (s.kind === 'stars') return `+${s.amount} Stars`;
    if (s.kind === 'relic') return `Relic: ${s.slug}`;
    if (s.kind === 'emoji') return `Emoji: ${s.key}`;
    return s.kind;
  }).join(' · ');
}

export async function redeem(user, rawCode) {
  const code = normalizeCode(rawCode);
  const p = await preview(user.id, code);
  if (!p.valid) {
    const msg = {
      not_found: 'That code does not exist.',
      revoked: 'That code has been revoked.',
      not_started: 'That code is not yet active.',
      expired: 'That code has expired.',
      exhausted: 'That code has been fully claimed.',
      already_used: 'You have already used that code.',
      wrong_tribe: 'That code is for a different tribe.',
    }[p.reason] || 'Invalid code.';
    throw new Error(msg);
  }

  const row = (await q('SELECT * FROM codes WHERE code=$1 FOR UPDATE', [code])).rows[0];

  const existing = (await q(
    'SELECT times FROM code_redemptions WHERE code=$1 AND user_id=$2',
    [code, user.id]
  )).rows[0];

  if (existing) {
    await q(
      'UPDATE code_redemptions SET times = times + 1, at = now() WHERE code=$1 AND user_id=$2',
      [code, user.id]
    );
  } else {
    await q(
      'INSERT INTO code_redemptions (code, user_id, times) VALUES ($1,$2,1)',
      [code, user.id]
    );
  }

  await q('UPDATE codes SET uses = uses + 1 WHERE code=$1', [code]);

  const summary = await applyPayload(user, row.kind, row.payload || { amount: row.amount });

  try {
    await q(
      'UPDATE code_grants SET redeemed_at = now() WHERE code=$1 AND user_id=$2',
      [code, user.id]
    );
  } catch {}

  try {
    await notifyAndBroadcast({
      userId: user.id,
      type: 'system',
      title: 'Gift redeemed',
      body: row.note || 'You received a gift.',
      severity: 'success',
      action_kind: 'hearth',
      celebrate: {
        kind: 'gift',
        title: 'Gift received',
        subtitle: row.note || `Code ${code}`,
        emoji: 'reaction-fire',
        tone: 'gold',
        reward: summarize(summary),
      },
    });
  } catch {}

  feedWrite({
    type: 'code', icon: 'gift', severity: 'success',
    text: `${user.first_name || user.username || user.id} redeemed ${code}`,
    detail: { code, summary }, actor: user.id,
  });

  return {
    ok: true, code, summary,
    gift: { kind: row.kind, payload: row.payload, name: row.note },
  };
}

export async function pending(userId) {
  try {
    return (await q(
      `SELECT c.code, c.kind, c.payload, c.note, c.expires_at, g.granted_at
         FROM code_grants g
         JOIN codes c ON c.code = g.code
        WHERE g.user_id=$1 AND g.redeemed_at IS NULL
          AND c.active = true
          AND (c.expires_at IS NULL OR c.expires_at > now())
        ORDER BY g.granted_at DESC LIMIT 50`,
      [userId]
    )).rows;
  } catch { return []; }
}

export async function adminList({ q: query = '', active = null, limit = 100 } = {}) {
  const like = '%' + (query || '') + '%';
  const params = [like];
  let where = "WHERE ($1 = '%%' OR code ILIKE $1 OR note ILIKE $1)";
  if (active !== null) { params.push(!!active); where += ` AND active = $${params.length}`; }
  params.push(Math.min(limit, 500));
  return (await q(
    `SELECT code, kind, payload, amount, max_uses, uses, per_user_limit,
            note, expires_at, starts_at, scope, scope_tribe_id,
            hero_image_svg, hero_image_url, campaign, active, created_by, created_at
       FROM codes ${where}
       ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  )).rows;
}

export async function adminCreate(adminId, data) {
  const code = normalizeCode(data.code || ('GIFT-' + Math.random().toString(36).slice(2, 8).toUpperCase()));
  if (code.length < 4) throw new Error('code must be 4+ characters');
  const kind = String(data.kind || 'ember');
  const payload = data.payload || (kind === 'ember' ? { amount: Number(data.amount) || 0 } : {});
  await q(
    `INSERT INTO codes (code, kind, amount, payload, max_uses, per_user_limit, note,
                        expires_at, starts_at, scope, scope_tribe_id,
                        hero_image_svg, hero_image_url, campaign, active, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [code, kind, Number(data.amount) || 0, JSON.stringify(payload),
     Number(data.max_uses) || 0, Number(data.per_user_limit) || 1,
     data.note || null, data.expires_at || null, data.starts_at || null,
     data.scope || 'global', data.scope_tribe_id || null,
     data.hero_image_svg || null, data.hero_image_url || null,
     data.campaign || null, data.active !== false, adminId || null]
  );
  return { code };
}

export async function adminRevoke(adminId, code) {
  await q('UPDATE codes SET active=false WHERE code=$1', [code]);
  return { ok: true };
}

export async function adminDelete(adminId, code) {
  await q('DELETE FROM codes WHERE code=$1', [code]);
  return { ok: true };
}

export async function grantToUser(adminId, code, userId) {
  const exists = await q('SELECT 1 FROM codes WHERE code=$1', [code]);
  if (!exists.rowCount) throw new Error('no such code');
  const userExists = await q('SELECT 1 FROM users WHERE id=$1', [userId]);
  if (!userExists.rowCount) throw new Error('no such user');
  await q(
    `INSERT INTO code_grants (code, user_id, granted_by) VALUES ($1,$2,$3)
     ON CONFLICT (code, user_id) DO NOTHING`,
    [code, userId, adminId || null]
  );
  try {
    await notifyAndBroadcast({
      userId, type: 'system', title: 'A gift awaits',
      body: `Open your gift box to claim code ${code}.`,
      severity: 'success', action_kind: 'hearth',
    });
  } catch {}
  return { ok: true };
}
