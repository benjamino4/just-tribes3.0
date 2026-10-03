// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/streaks.js
// PURPOSE: Streak insurance purchase.
// DEPENDS ON: db.js
// ═══════════════════════════════════════════════════════════════════
import { q } from './db.js';

export async function config() {
  const c = (await q('SELECT * FROM streak_insurance_config WHERE id=1')).rows[0];
  return c || { enabled: false, price_stars: 20 };
}

export async function purchase(user) {
  const c = await config();
  if (!c.enabled) throw new Error('not available');
  if (Number(user.stars || 0) < c.price_stars) {
    const e = new Error('Not enough Stars'); e.need = c.price_stars; throw e;
  }
  await q('UPDATE users SET stars = stars - $1 WHERE id=$2', [c.price_stars, user.id]);
  await q(
    `INSERT INTO streak_insurance (user_id, stars_spent, covers_until, active)
     VALUES ($1, $2, (CURRENT_DATE + INTERVAL '1 day')::date, true)
     ON CONFLICT (user_id) DO UPDATE
       SET stars_spent = streak_insurance.stars_spent + EXCLUDED.stars_spent,
           covers_until = EXCLUDED.covers_until, active = true, purchased_at = now()`,
    [user.id, c.price_stars]
  );
  return { ok: true, price: c.price_stars };
}