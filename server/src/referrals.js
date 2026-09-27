// TRIBES-FILE: server/src/referrals.js
// PHASE: 3 — Economy
// Referral code claim + summary.

import { q } from './db.js';
import { CFG } from './config.js';

export async function summary(userId) {
  const rows = (await q(
    `SELECT r.rewarded_at, u.first_name, u.username
       FROM referral_events r
       JOIN users u ON u.id = r.referee_id
      WHERE r.referrer_id=$1
      ORDER BY r.rewarded_at DESC LIMIT 20`,
    [userId]
  )).rows;
  const agg = (await q(
    `SELECT count(*)::int AS n, coalesce(sum(reward_ember),0)::bigint AS e
       FROM referral_events WHERE referrer_id=$1`,
    [userId]
  )).rows[0];
  return { invited: agg.n, earned: Number(agg.e), list: rows };
}

export async function claim(user, code) {
  if (user.referred_by) throw new Error('already claimed');
  code = String(code || '').trim().toUpperCase();
  if (!code || code === user.referral_code) throw new Error('bad code');

  const ref = (await q('SELECT id FROM users WHERE referral_code=$1', [code])).rows[0];
  if (!ref) throw new Error('no such code');

  const reward = Number(CFG.referral_reward) || 500;

  await q('UPDATE users SET referred_by=$1 WHERE id=$2', [ref.id, user.id]);
  await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [reward, user.id]);
  await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [reward, ref.id]);
  await q(
    `INSERT INTO referral_events (referrer_id, referee_id, reward_ember, note)
     VALUES ($1,$2,$3,'welcome bonus')
     ON CONFLICT DO NOTHING`,
    [ref.id, user.id, reward]
  );

  return { ok: true, reward };
}