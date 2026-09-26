/* =====================================================================
   TRIBES — runtime config.
   DEFAULTS is the source of truth; DB rows in `config` override on boot
   and every admin edit re-saves and hot-swaps CFG in memory.
===================================================================== */

export const DEFAULTS = {
  // ---------- economy ----------
  ashMinutes: 30,
  ashCap: 3,
  ashUnit: 90,
  foundEmber: 25000,
  checkin_base: 250,
  checkin_streakStep: 40,
  checkin_streakMax: 1000,
  renown_checkin: 15,
  renown_ash: 8,
  renown_share: 12,
  renown_donateDiv: 50,

  // ---------- switches ----------
  maintenance: 0,
  allowWar: 1,
  allowStore: 1,
  allowGuest: 0,

  // ---------- trials / tasks ----------
  trials_reset_at: '',
  tasks_per_day: 3,

  // ---------- spin ----------
  spin_cooldown_hours: 24,
  spin_free_per_day: 1,
  spin_max_paid_per_day: 3,
  spin_stars_per_paid: 25,

  // ---------- streaks ----------
  streak_insurance_price: 20,
  streak_insurance_per_month: 3,

  // ---------- first pack ----------
  first_pack_enabled: 1,
  first_pack_ember: 2500,
  first_pack_renown: 25,
  first_pack_relic_slug: 'firestone',
  first_pack_window_hours: 24,

  // ---------- referrals ----------
  referral_reward: 500,

  // ---------- pack defaults ----------
  pack_pity_epic: 6,
  pack_draw_cost_default: 400,

  // ---------- emoji sets (point 6) ----------
  emoji_free_default: JSON.stringify(['🔥','🙌','⚔️','👍','😂']),
  emoji_sets: JSON.stringify([
    { id: 'spirits',  name: 'Spirits of the Flame',  price: 120,  emojis: ['flame_flicker','spark_orbit','skull_pulse','moon_phase','bolt_strike'] },
    { id: 'ancestors',name: "Ancestors' Blessings",  price: 260,  emojis: ['eye_blink','eagle_flap','wolf_gaze','rune_draw','halo_glow'] },
    { id: 'rites',    name: 'Blood Rites',           price: 420,  emojis: ['dagger_drip','blood_seal','wound_open','crack_spread','ember_trail'] },
    { id: 'winter',   name: "Winter's Grasp",        price: 420,  emojis: ['ice_crystal','frost_breath','snowfall','freeze_shatter','aurora_wave'] },
  ]),

  // ---------- Kiva (points 5, 8, 9) ----------
  kiva_max_messages: 500,
  kiva_seal_price: 60,
  kiva_boons: JSON.stringify([
    { id: 'heralds_voice', name: "Herald's Voice", price: 100, desc: 'Your messages glow gold for 24h.' },
    { id: 'echo_stone',    name: 'Echo Stone',     price: 250, desc: 'Tribe-wide: retain the last 500 messages.' },
    { id: 'ember_ink',     name: 'Ember Ink',      price: 150, desc: 'Animated ember trail on your text.' },
    { id: 'whisper_veil',  name: 'Whisper Veil',   price: 180, desc: 'Send one anonymous message per day.' },
    { id: 'rally_horn',    name: 'Rally Horn',     price: 200, desc: 'Announce your next war action to the tribe.' },
  ]),

  // ---------- war (points 11, 17) ----------
  war_cap_hours: 72,
  war_front_count: 3,
  war_front_names: JSON.stringify(['North', 'Center', 'South']),
  war_stake_min: 15,
  war_stake_max: 40,
  war_stake_by_level: JSON.stringify([15,15,15,20,20,20,30,30,30,40]),
  war_defender_bonus_pct: 10,
  war_matchmaking_level_cap: 2,
  war_terrain_bonus_pct: 35,
  war_terrain_penalty_pct: 20,
  war_hint_enabled: 1,
  war_vengeance_tokens: 3,
  war_vengeance_bonus_pct: 25,
  war_vengeance_ttl_h: 168,
  war_blood_alliance_enabled: 1,
  war_momentum_interval_h: 6,
  war_rout_threshold: 4,
  war_rout_bonus_pct: 20,
  war_legendary_chance: 0.6,
  war_legendary_duration_min: 60,
  war_legendary_multiplier: 3.0,
  war_spoils_pyre_pct: 50,
  war_spoils_contrib_pct: 30,
  war_spoils_chest_pct: 20,
  war_spoils_top_count: 5,
  war_spoils_warband_ember: 500,
  war_relic_drop_enabled: 1,
  war_relic_drop_count: 3,
  war_relic_drop_rarity_max: 'epic',
  war_rivalry_threshold: 3,

  war_stances: JSON.stringify([
    { id:'assault',  name:'Assault',  desc:'+30% first 12h, -20% last 12h', first:1.3, last:0.8, durMult:1.0 },
    { id:'siege',    name:'Siege',    desc:'-20% first 24h, +50% last 24h', first:0.8, last:1.5, durMult:1.0 },
    { id:'skirmish', name:'Skirmish', desc:'No modifiers, half duration',   first:1.0, last:1.0, durMult:0.5 },
  ]),

  war_cries: JSON.stringify([
    { id:'thunder',  name:'Thunder Drum',  cost:5000,  effect:'tribe_buff',    magnitude:0.05, duration_h:6 },
    { id:'blood',    name:'Blood Oath',    cost:15000, effect:'double_next',   magnitude:2.0,  count:10 },
    { id:'ancestor', name:'Ancestor Call', cost:30000, effect:'instant_score', magnitude:500 },
  ]),

  // ---------- seasons ----------
  season_length_weeks: 6,
  season_auto_rollover: 0,
  season_titles_count: 3,
  season_pass_stars_price: 800,

  // ---------- spies ----------
  spy_cost_ember: 2000,
  spy_duration_min: 30,
  spy_base_catch: 0.20,
  spy_counter_step: 0.20,
  spy_counter_cost: 1500,
  spy_counter_hours: 12,

  // ---------- tribe levels ----------
  tribe_level_caps:  JSON.stringify([5, 8, 12, 18, 25, 35, 50, 70, 90, 120]),
  tribe_level_costs: JSON.stringify([0, 25000, 60000, 140000, 300000, 600000, 1200000, 2400000, 4800000, 9600000]),
  tribe_level_names: JSON.stringify(['Band','Camp','Village','Settlement','Stronghold','Fortress','Domain','Realm','Empire','Kingdom']),
};

export const PALETTES = {
  ember: { accent:'#ff7a18', accent2:'#ff9d3c', gold:'#ffcf7a' },
  jade:  { accent:'#2adc8c', accent2:'#4fe6a4', gold:'#c9f5d9' },
  frost: { accent:'#5ac8ff', accent2:'#8ddcff', gold:'#d6f0ff' },
  blood: { accent:'#c0392b', accent2:'#e05545', gold:'#ffc0b3' },
  gold:  { accent:'#e3a008', accent2:'#ffc93c', gold:'#ffe9a8' },
  void:  { accent:'#9a6bff', accent2:'#b58cff', gold:'#e0d2ff' },
};

export const BANNERS = ['sun','moon','wolf','bear','spear','shield','tree','flame'];

export function parseJSON(v, fallback) {
  if (typeof v !== 'string') return v ?? fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

export const CFG = { ...DEFAULTS };

/* Load DB overrides on boot. `q` is our pg helper. */
export async function loadConfig(q) {
  try {
    const r = await q('SELECT k, v FROM config');
    for (const row of r.rows) {
      if (!(row.k in DEFAULTS)) {
        console.warn('[config] unknown key in DB, ignored:', row.k);
        continue;
      }
      const def = DEFAULTS[row.k];
      const n = Number(row.v);
      if (typeof def === 'number' && row.v !== '' && !isNaN(n)) CFG[row.k] = n;
      else CFG[row.k] = row.v;
    }
  } catch (e) {
    console.warn('[config] load skipped:', e.message);
  }
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

export async function resetConfig(q) {
  await q('DELETE FROM config');
  for (const k of Object.keys(CFG)) delete CFG[k];
  Object.assign(CFG, DEFAULTS);
  return CFG;
}

export function cfgJSON(key, fallback) {
  return parseJSON(CFG[key], fallback);
     }
