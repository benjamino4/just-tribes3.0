import { q } from './db.js';

export const TIERS = ['common', 'rare', 'epic', 'legendary'];
export const CATEGORIES = ['flame', 'blade', 'voice'];

export async function catalog() {
  return (await q(
    `SELECT id, slug, name, description, tier, category,
            effect_key, effect_value, icon_svg, sort_order
       FROM relics WHERE active=true ORDER BY sort_order, id`
  )).rows;
}

export async function byId(id) {
  return (await q('SELECT * FROM relics WHERE id=$1', [id])).rows[0] || null;
}
export async function bySlug(slug) {
  return (await q('SELECT * FROM relics WHERE slug=$1', [slug])).rows[0] || null;
}

export async function stateFor(userId) {
  const cat = await catalog();
  const owned = (await q(
    'SELECT relic_id, count, first_at FROM user_relics WHERE user_id=$1', [userId]
  )).rows;
  const ownedMap = {};
  for (const o of owned) ownedMap[o.relic_id] = o;
  const slots = (await q(
    'SELECT category, relic_id FROM relic_slots WHERE user_id=$1', [userId]
  )).rows;
  const slotMap = {};
  for (const s of slots) slotMap[s.category] = Number(s.relic_id);

  return {
    catalog: cat.map((r) => ({
      ...r,
      effect_value: Number(r.effect_value) || 0,
      owned: !!ownedMap[r.id],
      count: ownedMap[r.id] ? Number(ownedMap[r.id].count) : 0,
      equipped: slotMap[r.category] === Number(r.id)
    })),
    slots: slotMap,
    categories: CATEGORIES
  };
}

export async function grant(userId, relicRef, opts = {}) {
  const relic = typeof relicRef === 'number' ? await byId(relicRef)
    : (typeof relicRef === 'string' ? await bySlug(relicRef) : relicRef);
  if (!relic) throw new Error('no such relic');
  const before = (await q(
    'SELECT count FROM user_relics WHERE user_id=$1 AND relic_id=$2', [userId, relic.id]
  )).rows[0];
  await q(
    `INSERT INTO user_relics (user_id, relic_id, count) VALUES ($1,$2,1)
     ON CONFLICT (user_id, relic_id) DO UPDATE SET count = user_relics.count + 1`,
    [userId, relic.id]
  );
  await logEvent(userId, 'pull', relic, opts.detail || null);
  return { relic, isNew: !before };
}

export async function equip(userId, relicId) {
  const relic = await byId(relicId);
  if (!relic || !relic.active) throw new Error('relic unavailable');
  const owns = await q('SELECT 1 FROM user_relics WHERE user_id=$1 AND relic_id=$2',
    [userId, relicId]);
  if (!owns.rowCount) throw new Error('you do not own that relic');
  await q(
    `INSERT INTO relic_slots (user_id, category, relic_id) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, category) DO UPDATE SET relic_id=EXCLUDED.relic_id`,
    [userId, relic.category, relicId]
  );
  await logEvent(userId, 'equip', relic, null);
  return { ok: true, slot: relic.category, relic_id: relicId };
}

export async function unequip(userId, category) {
  await q('UPDATE relic_slots SET relic_id=NULL WHERE user_id=$1 AND category=$2',
    [userId, category]);
  return { ok: true };
}

async function logEvent(userId, kind, relic, detail) {
  try {
    await q(
      `INSERT INTO relic_events (user_id, kind, relic_id, relic_slug, tier, detail)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, kind, relic?.id || null, relic?.slug || null, relic?.tier || null, detail || null]
    );
  } catch {}
}

export async function packs() {
  return (await q(
    `SELECT slug, name, description, price_stars, pool, odds_json, anim_preset
       FROM relic_packs WHERE active=true ORDER BY price_stars ASC`
  )).rows;
}

export async function openPack(user, slug) {
  const pk = (await q('SELECT * FROM relic_packs WHERE slug=$1 AND active=true', [slug])).rows[0];
  if (!pk) throw new Error('no such pack');
  const price = Number(pk.price_stars) || 0;
  const blessed = !!user.blessed;
  if (!blessed && Number(user.stars || 0) < price) {
    const e = new Error('Not enough Stars'); e.need = price; throw e;
  }
  const tiers = ['common', 'rare', 'epic', 'legendary'];
  const odds = pk.odds_json || { common: 0.7, rare: 0.25, epic: 0.045, legendary: 0.005 };
  const roll = Math.random();
  let acc = 0, chosen = 'common';
  for (const t of tiers) { acc += Number(odds[t] || 0); if (roll <= acc) { chosen = t; break; } }

  const pool = (await q(
    `SELECT * FROM relics WHERE active=true AND tier=$1 ORDER BY random() LIMIT 1`, [chosen]
  )).rows[0] || (await q('SELECT * FROM relics WHERE active=true ORDER BY random() LIMIT 1')).rows[0];
  if (!pool) throw new Error('no relics available');

  if (!blessed) await q('UPDATE users SET stars = stars - $1 WHERE id=$2', [price, user.id]);
  await grant(user.id, pool, { detail: `from ${pk.name}` });

  const balance = (await q('SELECT stars FROM users WHERE id=$1', [user.id])).rows[0];
  return { ok: true, relic: pool, tier: pool.tier, cost: blessed ? 0 : price, blessed, stars: Number(balance?.stars || 0) };
}

export async function effectiveBonuses(userId) {
  const rows = (await q(
    `SELECT r.effect_key, r.effect_value
       FROM relic_slots s JOIN relics r ON r.id = s.relic_id
      WHERE s.user_id=$1`, [userId]
  )).rows;
  const out = {};
  for (const r of rows) out[r.effect_key] = Number(r.effect_value) || 0;
  return out;
}