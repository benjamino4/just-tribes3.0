// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/referrals.js
// PURPOSE: Referral tiers, invite rewards, passive earnings.
// DEPENDS ON: db.js, config.js, events.js
// ═══════════════════════════════════════════════════════════════════
import { q } from './db.js';
import { CFG } from './config.js';
import { emit } from './events.js';

export async function tierFor(inviteCount) {
  return (await q(
    `SELECT slug, name, min_invites, max_invites, sparks_per, kinship_per,
            passive_pct, star_back_pct
       FROM referral_tiers
      WHERE min_invites <= $1 AND (max_invites IS NULL OR max_invites >= $1)
      ORDER BY min_invites DESC LIMIT 1`, [inviteCount]
  )).rows[0] || { slug: 'none', name: 'None', sparks_per: 0, kinship_per: 0, passive_pct: 0, star_back_pct: 0 };
}

export async function listTiers() {
  return (await q(
    'SELECT * FROM referral_tiers ORDER BY sort_order'
  )).rows;
}

export async function summary(userId) {
  const rows = (await q(
    `SELECT r.rewarded_at, u.first_name, u.username
       FROM referral_events r JOIN users u ON u.id = r.referee_id
      WHERE r.referrer_id=$1 ORDER BY r.rewarded_at DESC LIMIT 20`, [userId]
  )).rows;
  const agg = (await q(
    `SELECT count(*)::int AS n, coalesce(sum(reward_sparks),0)::bigint AS e
       FROM referral_events WHERE referrer_id=$1`, [userId]
  )).rows[0];
  const tier = await tierFor(agg.n);
  return { invited: agg.n, earned: Number(agg.e), list: rows, tier };
}

export async function claim(user, code) {
  if (user.referred_by) throw new Error('already claimed');
  code = String(code || '').trim().toUpperCase();
  if (!code || code === user.referral_code) throw new Error('bad code');
  const ref = (await q('SELECT id FROM users WHERE referral_code=$1', [code])).rows[0];
  if (!ref) throw new Error('no such code');

  const reward = Number(CFG.referral_reward) || 500;
  const kinshipBonus = 25;

  await q('UPDATE users SET referred_by=$1, sparks = sparks + $2, kinship = kinship + $3 WHERE id=$4',
    [ref.id, reward, kinshipBonus, user.id]);
  await q('UPDATE users SET sparks = sparks + $1, kinship = kinship + $2 WHERE id=$3',
    [reward, kinshipBonus, ref.id]);

  await q(
    `INSERT INTO referral_events (referrer_id, referee_id, reward_sparks, note)
     VALUES ($1,$2,$3,'welcome bonus') ON CONFLICT DO NOTHING`,
    [ref.id, user.id, reward]
  );

  await emit({
    userId: ref.id, tier: 'island', kind: 'referral_joined',
    title: `${user.first_name || 'Someone'} joined from your invite`,
    body: `+${reward} Sparks, +${kinshipBonus} Kinship`,
    icon: 'gift', severity: 'success',
    action_kind: 'profile'
  });

  return { ok: true, reward, kinship: kinshipBonus };
}

export async function generateCode(userId) {
  const r = Math.random().toString(36).slice(2, 8).toUpperCase() + userId.toString(36).slice(-3).toUpperCase();
  await q('UPDATE users SET referral_code=$1 WHERE id=$2 AND referral_code IS NULL', [r, userId]);
  return r;
}