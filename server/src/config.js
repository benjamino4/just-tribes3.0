export const DEFAULTS = {
  // Labels
  sparks_label: 'Sparks',
  kinship_label: 'Kinship',
  stars_label: 'Stars',

  // Economy
  ash_minutes: 30,
  ash_cap: 3,
  ash_unit: 90,
  found_sparks: 25000,
  checkin_base: 250,
  checkin_streak_step: 40,
  checkin_streak_max: 1000,
  kinship_checkin: 15,
  kinship_ash: 8,
  kinship_share: 12,
  kinship_donate_div: 50,

  // Switches
  maintenance: 0,
  allow_arena: 1,
  allow_store: 1,
  allow_guest: 0,
  allow_war: 1,

  // Trials
  trials_reset_at: '',
  tasks_per_day: 3,

  // Spin
  spin_cooldown_hours: 24,
  spin_free_per_day: 1,
  spin_max_paid_per_day: 3,
  spin_stars_per_paid: 25,

  // Streaks
  streak_insurance_price: 20,
  streak_insurance_per_month: 3,

  // First pack
  first_pack_enabled: 1,
  first_pack_sparks: 2500,
  first_pack_kinship: 25,
  first_pack_relic_slug: 'firestone',
  first_pack_window_hours: 24,

  // Referrals
  referral_reward: 500,

  // Rank
  rank_starting_rating: 1000,
  rank_win_delta: 25,
  rank_loss_delta: 20,
  rank_decay_days: 7,
  rank_decay_amount: 15,

  // Seats
  seat_recalc_day: 0,        // 0 = Sunday
  seat_recalc_hour: 20,      // UTC hour

  // War
  war_duration_minutes: 30,
  war_cooldown_minutes: 60,
  war_front_count: 3,
  war_score_per_win: 1,
  war_bonus_streak_3: 2,
  war_final_5_seconds: 300,
  war_tiebreaker_seconds: 60,
  war_max_concurrent_per_tribe: 1,

  // Forgotten
  forgotten_enabled: 1,
  forgotten_escalation_rate: 0.15,

  // Duels
  duel_ranked_enabled: 1,
  duel_staked_enabled: 1,
  duel_stake_min: 50,
  duel_stake_max: 5000,
  duel_burn_pct: 5,

  // Game weights (per archetype)
  game_weight_reaction: 30,
  game_weight_memory: 25,
  game_weight_choice: 20,
  game_weight_sequence: 15,
  game_weight_deduction: 10,

  // Terrain biases (weights per archetype per terrain)
  terrain_plains:    JSON.stringify({ reaction: 60, choice: 25, memory: 15, sequence: 0,  deduction: 0 }),
  terrain_forest:    JSON.stringify({ memory: 40, choice: 30, sequence: 20, reaction: 10, deduction: 0 }),
  terrain_ruins:     JSON.stringify({ deduction: 35, choice: 30, memory: 20, reaction: 15, sequence: 0 }),
  terrain_ashlands:  JSON.stringify({ reaction: 60, sequence: 25, choice: 10, deduction: 5,  memory: 0 }),
  terrain_hills:     JSON.stringify({ sequence: 40, choice: 25, reaction: 20, memory: 15, deduction: 0 }),
  terrain_swamp:     JSON.stringify({ deduction: 45, memory: 30, choice: 15, reaction: 10, sequence: 0 }),

  // Kiva
  kiva_max_messages: 500,
  kiva_message_max_length: 280,

  // Emoji
  emoji_free_default: JSON.stringify(['reaction-fire','reaction-clap','reaction-swords','reaction-thumbsup','reaction-joy']),

  // Performance
  perf_benchmark_enabled: 1,
  perf_default_tier: 'balanced',
  perf_auto_downgrade_battery_pct: 20,

  // Tribe
  tribe_level_caps:  JSON.stringify([5, 8, 12, 18, 25, 35, 50, 70, 90, 120]),
  tribe_level_costs: JSON.stringify([0, 25000, 60000, 140000, 300000, 600000, 1200000, 2400000, 4800000, 9600000]),
  tribe_level_names: JSON.stringify(['Band','Camp','Village','Settlement','Stronghold','Fortress','Domain','Realm','Empire','Kingdom']),

  // Store
  pin_message_stars: 130,
  tribe_name_perk_stars: 400,
  tribe_icon_perk_stars: 500,
  tribe_banner_perk_stars: 260,
  tribe_name_max_len: 24,
  tribe_icon_max_kb: 130,
  tribe_name_fonts: JSON.stringify([
    { id: 'default', name: 'Standard', css: 'var(--font-display)' },
    { id: 'runic',   name: 'Runecarve', css: '"Cinzel", Georgia, serif' },
    { id: 'blade',   name: 'Bladeforge', css: '"Oswald", Impact, sans-serif' },
    { id: 'ash',     name: 'Ashen Hand', css: '"Caveat", cursive' },
    { id: 'monol',   name: 'Monolith',  css: '"Bebas Neue", Arial Narrow, sans-serif' }
  ]),
  tribe_name_styles: JSON.stringify([
    { id: 'plain',  name: 'Plain' },
    { id: 'ember',  name: 'Ember Glow',  color: '#ff7a18' },
    { id: 'gold',   name: 'Gilded',      color: '#ffcf7a' },
    { id: 'frost',  name: 'Frostbrand',  color: '#8ddcff' },
    { id: 'blood',  name: 'Bloodrune',   color: '#e05545' },
    { id: 'void',   name: 'Voidfire',    color: '#b58cff' }
  ])
};

export function parseJSON(v, fallback) {
  if (typeof v !== 'string') return v ?? fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

export const CFG = { ...DEFAULTS };

export async function loadConfig(q) {
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

export async function setConfig(q, k, v) {
  if (!(k in DEFAULTS)) throw new Error('unknown key: ' + k);
  const def = DEFAULTS[k];
  if (typeof def === 'number' && String(v).trim() === '') {
    await q('DELETE FROM config WHERE k=$1', [k]);
    CFG[k] = def;
    return CFG[k];
  }
  if (typeof def === 'number' && isNaN(Number(v))) {
    throw new Error(`${k} expects a number`);
  }
  await q(
    `INSERT INTO config(k,v) VALUES ($1,$2)
     ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v`,
    [k, String(v)]
  );
  const n = Number(v);
  CFG[k] = (typeof def === 'number' && !isNaN(n)) ? n : v;
  return CFG[k];
}

export function cfgJSON(key, fallback) {
  return parseJSON(CFG[key], fallback);
}