import { q } from './db.js';

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

export async function equip(userId, relicId) {
  const relic = await byId(relicId);
  if (!relic || !relic.active) throw new Error('relic unavailable');
  const owns = await q('SELECT 1 FROM user_relics WHERE user_id=$1 AND relic_id=$2', [userId, relicId]);
  if (!owns.rowCount) throw new Error('you do not own that relic');
  await q(
    `INSERT INTO relic_slots (user_id, category, relic_id) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, category) DO UPDATE SET relic_id=EXCLUDED.relic_id`,
    [userId, relic.category, relicId]
  );
  return { ok: true, slot: relic.category, relic_id: relicId };
}

export async function unequip(userId, category) {
  await q('UPDATE relic_slots SET relic_id=NULL WHERE user_id=$1 AND category=$2', [userId, category]);
  return { ok: true };
}