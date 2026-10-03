// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/firstpack.js
// PURPOSE: First-pack offer for new players within 24h of signup.
// DEPENDS ON: db.js
// ═══════════════════════════════════════════════════════════════════
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
    sparks: Number(cfg.reward_sparks),
    kinship: Number(cfg.reward_kinship),
    relic_slug: cfg.free_relic_slug,
    expires_at: new Date(expires).toISOString()
  };
}

export async function claim(user) {
  const s = await status(user);
  if (!s.available) throw new Error(s.claimed ? 'already claimed' : s.expired ? 'offer expired' : 'not available');
  const cfg = (await q('SELECT * FROM first_pack_config WHERE id=1')).rows[0];
  await q('UPDATE users SET sparks = sparks + $1, kinship = kinship + $2 WHERE id=$3',
    [cfg.reward_sparks, cfg.reward_kinship, user.id]);
  if (user.tribe_id && cfg.reward_kinship) {
    await q('UPDATE tribes SET kinship_total = kinship_total + $1 WHERE id=$2',
      [cfg.reward_kinship, user.tribe_id]);
  }
  await q(
    `INSERT INTO first_pack_claims (user_id, reward_paid) VALUES ($1,$2)`,
    [user.id, JSON.stringify({
      sparks: Number(cfg.reward_sparks),
      kinship: Number(cfg.reward_kinship),
      relic: cfg.free_relic_slug
    })]
  );
  return { ok: true, sparks: Number(cfg.reward_sparks), kinship: Number(cfg.reward_kinship) };
}