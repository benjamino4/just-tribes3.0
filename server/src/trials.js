import { q } from './db.js';
import { CFG } from './config.js';
import { pickGameForArchetypeWeights } from './games/index.js';

export async function listTrials() {
  return (await q(
    `SELECT id, slug, name, glyph, hint, reward_sparks, reward_kinship,
            cooldown_hours, archetype_bias, active, sort_order
       FROM trial_defs WHERE active=true ORDER BY sort_order, id`
  )).rows;
}

export function trialAvailable(trial, stateRow, nowMs = Date.now()) {
  const st = (stateRow && stateRow[trial.slug]) || null;
  if (!st) return { ok: true };
  const lastMs = st.last_at ? new Date(st.last_at).getTime() : 0;
  const cdMs = (trial.cooldown_hours || 0) * 3600 * 1000;
  if (nowMs - lastMs < cdMs) return { ok: false, reason: 'cooldown', nextIn: cdMs - (nowMs - lastMs) };
  return { ok: true };
}

export function pickGameForTrial(trial) {
  const arch = trial.archetype_bias;
  if (arch) return pickGameForArchetypeWeights({ [arch]: 100 });
  return pickGameForArchetypeWeights({
    reaction: 30, memory: 25, choice: 20, sequence: 15, deduction: 10
  });
}

export async function completeTrial(user, trial, nowMs = Date.now()) {
  const state = user.trials_state || {};
  const cur = state[trial.slug] || { last_at: 0, count: 0 };
  state[trial.slug] = { last_at: new Date(nowMs).toISOString(), count: (cur.count || 0) + 1 };

  await q(
    `UPDATE users SET sparks = sparks + $1, kinship = kinship + $2, trials_state = $3::jsonb
      WHERE id = $4`,
    [trial.reward_sparks, trial.reward_kinship, JSON.stringify(state), user.id]
  );
  if (user.tribe_id && trial.reward_kinship) {
    await q('UPDATE tribes SET kinship_total = kinship_total + $1 WHERE id=$2',
      [trial.reward_kinship, user.tribe_id]);
  }
  await q('INSERT INTO trial_log (user_id, slug) VALUES ($1, $2)', [user.id, trial.slug]);
  return { reward_sparks: trial.reward_sparks, reward_kinship: trial.reward_kinship };
}