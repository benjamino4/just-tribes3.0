import { q } from './db.js';

export const DEFAULTS = {
  sparks_label: 'Sparks', kinship_label: 'Kinship', stars_label: 'Stars',
  ash_minutes: 30, ash_cap: 3, ash_unit: 90,
  found_sparks: 25000,
  checkin_base: 250, checkin_streak_step: 40, checkin_streak_max: 1000,
  maintenance: 0, allow_arena: 1, allow_store: 1, allow_guest: 0, allow_war: 1,
  spin_cooldown_hours: 24, spin_free_per_day: 1, spin_max_paid_per_day: 3, spin_stars_per_paid: 25,
  first_pack_enabled: 1, first_pack_sparks: 2500, first_pack_kinship: 25,
  referral_reward_sparks: 1000, referral_reward_kinship: 50,
  rank_starting_rating: 1000, rank_win_delta: 25, rank_loss_delta: 20,
  rank_decay_days: 7, rank_decay_amount: 15,
  mm_bot_fallback_sec: 45, mm_rating_window: 250, mm_stale_sec: 120,
  friendly_challenge_ttl_min: 30,
  seat_recalc_day: 0, seat_recalc_hour: 20,
  war_duration_minutes: 5, war_cooldown_minutes: 10,
  war_front_count: 3, war_score_per_win: 1,
  war_final_5_seconds: 30,
  forgotten_enabled: 1, forgotten_substitution_rank_pct: 0.7,
  duel_ranked_enabled: 1, duel_staked_enabled: 1,
  duel_stake_min: 50, duel_stake_max: 5000, duel_burn_pct: 5,
  game_weight_reaction: 30, game_weight_memory: 25,
  game_weight_choice: 20, game_weight_sequence: 15, game_weight_deduction: 10,
  terrain_plains:    JSON.stringify({ match3: 40, stacker: 30, jumper: 30 }),
  terrain_forest:    JSON.stringify({ catch: 40, memory: 30, constellation: 30 }),
  terrain_ruins:     JSON.stringify({ cascade: 40, flow: 30, line: 30 }),
  terrain_ashlands:  JSON.stringify({ reflex: 40, cascade: 30, wells: 30 }),
  terrain_hills:     JSON.stringify({ sort: 40, bloom: 30, lanes: 30 }),
  terrain_swamp:     JSON.stringify({ hands: 40, bid: 30, masks: 30 }),
  kiva_max_messages: 500, kiva_message_max_length: 280,
  kiva_pin_cost_stars: 50, kiva_pin_max: 3,
  perf_benchmark_enabled: 1, perf_default_tier: 'balanced',
};

export const CFG = { ...DEFAULTS };

export async function loadConfig() {
  try {
    const r = await q('SELECT k, v FROM config');
    for (const row of r.rows) {
      if (!(row.k in DEFAULTS)) continue;
      const def = DEFAULTS[row.k];
      const n = Number(row.v);
      if (typeof def === 'number' && row.v !== '' && !isNaN(n)) CFG[row.k] = n;
      else CFG[row.k] = row.v;
    }
  } catch (e) { console.warn('[config] load skipped:', e.message); }
  return CFG;
}

export async function setConfig(k, v, adminId = null) {
  if (!(k in DEFAULTS)) throw new Error('unknown key: ' + k);
  const def = DEFAULTS[k];
  const before = CFG[k];
  if (typeof def === 'number' && String(v).trim() === '') {
    await q('DELETE FROM config WHERE k=$1', [k]);
    CFG[k] = def;
  } else {
    if (typeof def === 'number' && isNaN(Number(v))) throw new Error(`${k} expects a number`);
    await q(
      `INSERT INTO config(k,v,category,label,type) VALUES ($1,$2,'general',$1,$3)
       ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v, updated_at=now()`,
      [k, String(v), typeof def]
    );
    const n = Number(v);
    CFG[k] = (typeof def === 'number' && !isNaN(n)) ? n : v;
  }
  await logAudit(adminId, 'config_set', `${k} = ${v}`, { before, after: CFG[k], key: k });
  return CFG[k];
}

export function cfgJSON(key, fallback) {
  const v = CFG[key];
  if (typeof v !== 'string') return v ?? fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

async function logAudit(adminId, action, detail, extra = {}) {
  try {
    await q(
      'INSERT INTO audit (admin_id, action, detail, before_json, after_json) VALUES ($1,$2,$3,$4,$5)',
      [String(adminId || ''), action, detail,
       extra.before ? JSON.stringify(extra.before) : null,
       extra.after ? JSON.stringify(extra.after) : null]
    );
  } catch {}
}