import { q } from './db.js';

// Lists every active emoji set with its glyphs and whether the user already owns
// it. Premium sets have price_stars > 0 and must be unlocked with Stars.
export async function stateFor(userId) {
  const sets = (await q(
    `SELECT slug, name, description, price_stars, emoji_keys
     FROM emoji_sets WHERE active = true ORDER BY sort_order, id`
  )).rows;
  const owned = new Set(
    (await q('SELECT set_slug FROM user_emoji_sets WHERE user_id=$1', [userId]))
      .rows.map((r) => r.set_slug)
  );
  const defs = (await q(
    `SELECT key, name, svg, set_slug, price_stars, builtin
     FROM emoji_defs WHERE active = true ORDER BY sort_order, id`
  )).rows;
  const bySet = {};
  for (const d of defs) {
    (bySet[d.set_slug] = bySet[d.set_slug] || []).push(d);
  }
  const stars = Number(
    (await q('SELECT stars FROM users WHERE id=$1', [userId])).rows[0]?.stars || 0
  );
  return {
    stars,
    sets: sets.map((s) => ({
      slug: s.slug, name: s.name, description: s.description,
      price_stars: Number(s.price_stars) || 0,
      premium: (Number(s.price_stars) || 0) > 0,
      owned: owned.has(s.slug) || (Number(s.price_stars) || 0) === 0,
      emojis: (bySet[s.slug] || []).map((d) => ({ key: d.key, name: d.name, svg: d.svg }))
    }))
  };
}

// Unlocks a premium set by spending Stars. Atomic: the deduction only succeeds if
// the user truly has enough Stars.
export async function unlock(user, slug) {
  const set = (await q(
    'SELECT slug, name, price_stars FROM emoji_sets WHERE slug=$1 AND active=true', [slug]
  )).rows[0];
  if (!set) throw new Error('no such set');
  const price = Number(set.price_stars) || 0;
  const already = (await q(
    'SELECT 1 FROM user_emoji_sets WHERE user_id=$1 AND set_slug=$2', [user.id, slug]
  )).rowCount;
  if (already || price === 0) return { ok: true, owned: true };
  const upd = await q(
    'UPDATE users SET stars = stars - $1 WHERE id=$2 AND stars >= $1 RETURNING stars',
    [price, user.id]
  );
  if (!upd.rowCount) throw new Error('not enough Stars');
  await q(
    `INSERT INTO user_emoji_sets (user_id, set_slug) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`, [user.id, slug]
  );
  return { ok: true, owned: true, stars: Number(upd.rows[0].stars), spent: price };
}
