// TRIBES-FILE: server/src/trials.js
// PHASE: 3 — Economy
// Trials — repeatable skill challenges with per-user JSONB cooldown state.

import { q } from './db.js';
import { CFG } from './config.js';

export async function listTrials(includeInactive = false) {
  return (await q(
    `SELECT id, slug, name, glyph, hint, reward_ember, reward_renown,
            cooldown_hours, max_per_window, window_hours, window_start_utc,
            active, sort_order, kind, minigame
       FROM trial_defs
      ${includeInactive ? '' : 'WHERE active = true'}
      ORDER BY sort_order, id`
  )).rows;
}

export function trialAvailable(trial, stateRow, nowMs = Date.now()) {
  const slug = trial.slug;
  const st = (stateRow && stateRow[slug]) || null;

  if (trial.window_hours > 0) {
    const hour = new Date(nowMs).getUTCHours();
    const start = trial.window_start_utc;
    const end = (start + trial.window_hours) % 24;
    const inWindow = start <= end
      ? (hour >= start && hour < end)
      : (hour >= start || hour < end);
    if (!inWindow) return { ok: false, reason: 'outside_window' };
  }

  if (!st) return { ok: true };

  const lastMs = st.last_at ? new Date(st.last_at).getTime() : 0;
  const cdMs = (trial.cooldown_hours || 0) * 3600 * 1000;
  if (nowMs - lastMs < cdMs) {
    return { ok: false, reason: 'cooldown', nextIn: cdMs - (nowMs - lastMs) };
  }

  if (trial.max_per_window > 0 && (st.count || 0) >= trial.max_per_window) {
    const cycle = cdMs * trial.max_per_window;
    if (nowMs - lastMs < cycle) {
      return { ok: false, reason: 'window_full', nextIn: cycle - (nowMs - lastMs) };
    }
  }
  return { ok: true };
}

export async function completeTrial(user, trial, opts = {}, nowMs = Date.now()) {
  const miss = !!opts.miss;
  const state = user.trials_state || {};
  const cur = state[trial.slug] || { last_at: 0, count: 0 };
  const cdMs = (trial.cooldown_hours || 0) * 3600 * 1000 * (trial.max_per_window || 1);
  const since = nowMs - (cur.last_at ? new Date(cur.last_at).getTime() : 0);
  const nextCount = since > cdMs ? 1 : (cur.count || 0) + 1;
  state[trial.slug] = { last_at: new Date(nowMs).toISOString(), count: nextCount };

  const rewardEmber = miss ? 0 : trial.reward_ember;
  const rewardRenown = miss ? 0 : trial.reward_renown;

  await q(
    `UPDATE users
        SET ember   = ember   + $1,
            renown  = renown  + $2,
            trials_state = $3::jsonb
      WHERE id = $4`,
    [rewardEmber, rewardRenown, JSON.stringify(state), user.id]
  );

  if (user.tribe_id && rewardRenown) {
    await q(
      'UPDATE tribes SET renown_total = renown_total + $1 WHERE id=$2',
      [rewardRenown, user.tribe_id]
    );
  }

  await q(
    `INSERT INTO trial_log (user_id, slug) VALUES ($1, $2)`,
    [user.id, trial.slug]
  );

  return { reward_ember: rewardEmber, reward_renown: rewardRenown, miss };
}

export async function resetAllTrials() {
  await q(`UPDATE users SET trials_state = '{}'::jsonb`);
  const now = new Date().toISOString();
  await q(
    `INSERT INTO config(k,v) VALUES ('trials_reset_at', $1)
     ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v`,
    [now]
  );
  return { reset_at: now };
}

/* ---------- sift server-side seed ---------- */
export function siftCorrectIndex(userId, dayKey) {
  const seed = `${userId}:${dayKey}`;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h * 33) ^ seed.charCodeAt(i)) >>> 0;
  return h % 5;
}