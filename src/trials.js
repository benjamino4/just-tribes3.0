/* =====================================================================
   Trials — admin-managed repeatable actions.
   Per-user state stored as JSONB on users.trials_state.
===================================================================== */
import { q } from './db.js';

export async function listTrials(includeInactive = false){
  const r = await q(
    `SELECT id, slug, name, glyph, hint, reward_ember, reward_loyalty,
            cooldown_hours, max_per_window, window_hours, window_start_utc,
            active, sort_order, kind, minigame
       FROM trial_defs
      ${includeInactive ? '' : 'WHERE active = true'}
      ORDER BY sort_order, id`
  );
  return r.rows;
}

export function trialAvailable(trial, stateRow, nowMs = Date.now()){
  const slug = trial.slug;
  const st = (stateRow && stateRow[slug]) || null;

  if (trial.window_hours > 0){
    const hour = new Date(nowMs).getUTCHours();
    const start = trial.window_start_utc;
    const end = (start + trial.window_hours) % 24;
    const inWindow = start <= end
      ? (hour >= start && hour < end)
      : (hour >= start || hour < end);
    if (!inWindow) return { ok:false, reason:'outside_window' };
  }

  if (!st) return { ok:true };

  const lastMs = st.last_at ? new Date(st.last_at).getTime() : 0;
  const cdMs = (trial.cooldown_hours || 0) * 3600 * 1000;
  if (nowMs - lastMs < cdMs) return { ok:false, reason:'cooldown', nextIn: cdMs - (nowMs - lastMs) };

  if (trial.max_per_window > 0 && (st.count || 0) >= trial.max_per_window){
    const cycle = cdMs * trial.max_per_window;
    if (nowMs - lastMs < cycle)
      return { ok:false, reason:'window_full', nextIn: cycle - (nowMs - lastMs) };
  }
  return { ok:true };
}

/**
 * Complete a trial. Pass `{ miss: true }` to consume the cooldown
 * without granting rewards (used by the Sift minigame on a wrong pick).
 */
export async function completeTrial(user, trial, opts = {}, nowMs = Date.now()){
  const miss = !!opts.miss;
  const state = user.trials_state || {};
  const cur = state[trial.slug] || { last_at: 0, count: 0 };
  const nextCount = (nowMs - (cur.last_at ? new Date(cur.last_at).getTime() : 0)
                     > (trial.cooldown_hours||0)*3600*1000 * (trial.max_per_window||1))
    ? 1
    : (cur.count || 0) + 1;
  state[trial.slug] = { last_at: new Date(nowMs).toISOString(), count: nextCount };

  const rewardEmber   = miss ? 0 : trial.reward_ember;
  const rewardLoyalty = miss ? 0 : trial.reward_loyalty;

  await q(
    `UPDATE users
        SET ember   = ember   + $1,
            loyalty = loyalty + $2,
            trials_state = $3::jsonb
      WHERE id = $4`,
    [rewardEmber, rewardLoyalty, JSON.stringify(state), user.id]
  );

  if (user.tribe_id && rewardLoyalty){
    await q('UPDATE tribes SET loyalty_total = loyalty_total + $1 WHERE id=$2',
      [rewardLoyalty, user.tribe_id]);
  }
  return { reward_ember: rewardEmber, reward_loyalty: rewardLoyalty, miss };
}

export async function resetAllTrials(){
  await q(`UPDATE users SET trials_state = '{}'::jsonb`);
  await q(`INSERT INTO config(k,v) VALUES ('trials_reset_at', $1)
             ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v`,
    [new Date().toISOString()]);
  return { reset_at: new Date().toISOString() };
}