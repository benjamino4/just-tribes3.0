// TRIBES-FILE: server/src/firstpack.js
// PHASE: 3 — Economy
// First-time user bundle. 24h window after signup.

import { q } from './db.js';

export async function status(user) {
  const cfg = (await q('SELECT * FROM first_pack_config WHERE id=1')).rows[0];
  if (!cfg || !cfg.enabled) return { available: false };
  const already = await q('SELECT 1 FROM first_pack_claims WHERE user_id=$1', [user.id]);
  if (already.rowCount) return { available: false, claimed: true };

  const created = new Date(user.created_at).getTime();
  const expires = created + cfg.duration_hours * 3600 * 1000;
  if (Date.now() > expires) return { available: false, expired: true };

  return {
    available: true,
    ember: Number(cfg.reward_ember),
    renown: Number(cfg.reward_renown),
    relic_slug: cfg.free_relic_slug,
    expires_at: new Date(expires).toISOString(),
  };
}

export async function claim(user) {
  const s = await status(user);
  if (!s.available) throw new Error(s.claimed ? 'already claimed' : s.expired ? 'offer expired' : 'not available');

  const cfg = (await q('SELECT * FROM first_pack_config WHERE id=1')).rows[0];

  await q(
    'UPDATE users SET ember = ember + $1, renown = renown + $2 WHERE id=$3',
    [cfg.reward_ember, cfg.reward_renown, user.id]
  );
  if (user.tribe_id && cfg.reward_renown) {
    await q(
      'UPDATE tribes SET renown_total = renown_total + $1 WHERE id=$2',
      [cfg.reward_renown, user.tribe_id]
    );
  }
  await q(
    `INSERT INTO first_pack_claims (user_id, reward_paid) VALUES ($1, $2)`,
    [user.id, JSON.stringify({
      ember: Number(cfg.reward_ember),
      renown: Number(cfg.reward_renown),
      relic: cfg.free_relic_slug,
    })]
  );

  return { ok: true, ember: Number(cfg.reward_ember), renown: Number(cfg.reward_renown) };
}