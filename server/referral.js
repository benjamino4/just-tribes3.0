// ═══ Referral reward engine ═══
// Turns referrals into a real, calculated Ichor payout for the referrer.
// Two admin-tunable modes (app_settings):
//   referral_reward_type = 'points'  → flat bounty the instant a new soul is
//                                      attributed to a referrer (one-off).
//   referral_reward_type = 'percent' → referrer earns N% of each referred
//                                      soul's pick winnings, calculated at
//                                      every challenge reveal.
// referral_reward_value = the number N for whichever mode is active.
// Every payout also bumps users.referral_earned so the Summon screen can show
// a running, verifiable total.
import { getSettings } from './settings.js';

export async function getReferralConfig() {
  try {
    const s = await getSettings(['referral_reward_type', 'referral_reward_value']);
    const type = (s.referral_reward_type || 'percent').trim();
    const value = Math.max(0, Number(s.referral_reward_value) || 0);
    return { type: type === 'points' ? 'points' : 'percent', value };
  } catch {
    return { type: 'percent', value: 0 };
  }
}

// Flat per-head bounty. Call right after a new soul's referred_by is set.
// Safe no-op unless the active mode is 'points' with a positive value.
// Returns the Ichor awarded to the referrer (0 if none).
export async function creditReferralFlat(q, referrerId) {
  if (!referrerId) return 0;
  const { type, value } = await getReferralConfig();
  if (type !== 'points' || value <= 0) return 0;
  try {
    await q(
      `UPDATE users SET points = points + $1, referral_earned = COALESCE(referral_earned,0) + $1
       WHERE telegram_id = $2`,
      [value, referrerId]
    );
    return value;
  } catch { return 0; }
}

// Percentage cut of a referred soul's winnings on ONE challenge. Call once a
// challenge is resolved and picks.points_earned is final. Safe no-op unless the
// active mode is 'percent' with a positive value. Idempotent-ish: intended to
// run exactly once per resolution (reopening + re-resolving may double-credit,
// matching the existing 'points not clawed back' behaviour).
export async function creditReferralPercentForChallenge(q, challengeId) {
  const { type, value } = await getReferralConfig();
  if (type !== 'percent' || value <= 0) return 0;
  try {
    const { rows } = await q(
      `WITH bonus AS (
         SELECT u.referred_by AS rid,
                FLOOR(SUM(p.points_earned) * $2 / 100.0)::int AS amt
         FROM picks p
         JOIN users u ON u.telegram_id = p.telegram_id
         WHERE p.challenge_id = $1
           AND u.referred_by IS NOT NULL
           AND p.points_earned > 0
         GROUP BY u.referred_by
       )
       UPDATE users ref
       SET points = points + b.amt,
           referral_earned = COALESCE(referral_earned,0) + b.amt
       FROM bonus b
       WHERE ref.telegram_id = b.rid AND b.amt > 0
       RETURNING b.amt`,
      [challengeId, value]
    );
    return rows.reduce((t, r) => t + (r.amt || 0), 0);
  } catch (e) {
    console.error('referral percent credit failed:', e.message);
    return 0;
  }
}
