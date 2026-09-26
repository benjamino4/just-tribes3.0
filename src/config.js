/* =====================================================================
   TRIBES — Runtime config (DB-overridable) with defaults.
===================================================================== */
export const DEFAULTS = {
  // idle ash
  ashMinutes: 30, ashCap: 3, ashUnit: 90,
  foundEmber: 25000,
  checkin_base: 250, checkin_streakStep: 40, checkin_streakMax: 1000,
  loy_checkin: 15, loy_ash: 8, loy_share: 12, loy_donateDiv: 50,
  warRewardMult: 1, warStakeMult: 1,
  maintenance: 0, allowWar: 1, allowStore: 1,

  // Phase 1
  trials_reset_at: '',
  bonfire_active_id: '',
  starter_bundle_price_stars: 150,
  starter_bundle_ember: 10000,
  starter_bundle_relic: 'firestone',
  tribe_level_caps:  JSON.stringify([5,8,12,18,25,35,50,70,90,120]),
  tribe_level_costs: JSON.stringify([0,25000,60000,140000,300000,600000,1200000,2400000,4800000,9600000]),
  tribe_level_names: JSON.stringify(['Band','Camp','Village','Settlement','Stronghold','Fortress','Domain','Realm','Empire','Kingdom']),
  calendar_rewards: JSON.stringify([
    { day:1, ember:500 }, { day:2, ember:1000 }, { day:3, ember:1500, loyalty:10 },
    { day:4, ember:2500 }, { day:5, ember:4000, loyalty:25 }, { day:6, ember:6500 },
    { day:7, ember:12000, loyalty:50, cosmetic:'name_color_ember' },
  ]),
  notify_max_per_day: 4,

  // War revamp
  war_cap_hours: 72,
  war_front_count: 3,
  war_front_names: JSON.stringify(['North','Center','South']),
  war_stake_min: 15,
  war_stake_max: 40,
  war_stake_by_level: JSON.stringify([15,15,15,20,20,20,30,30,30,40]),
  war_defender_bonus_pct: 10,
  war_mercy_rule: 0,
  war_stances: JSON.stringify([
    { id:'assault',  name:'Assault',  desc:'+30% first 12h, -20% last 12h', first:1.3, last:0.8, durMult:1.0 },
    { id:'siege',    name:'Siege',    desc:'-20% first 24h, +50% last 24h', first:0.8, last:1.5, durMult:1.0 },
    { id:'skirmish', name:'Skirmish', desc:'No modifiers, half duration',   first:1.0, last:1.0, durMult:0.5 },
  ]),
  war_cries: JSON.stringify([
    { id:'thunder',  name:'Thunder Drum', cost:5000,  effect:'tribe_buff',   magnitude:0.05, duration_h:6 },
    { id:'blood',    name:'Blood Oath',   cost:15000, effect:'double_next',  magnitude:2.0, count:10 },
    { id:'ancestor', name:'Ancestor Call',cost:30000, effect:'instant_score',magnitude:500 },
  ]),
  war_cry_stars_enabled: 1,
  war_cry_stars_price: 150,
  war_momentum_interval_h: 6,
  war_momentum_token_pct: 15,
  war_rout_threshold: 4,
  war_rout_bonus_pct: 20,
  war_legendary_chance: 0.6,
  war_legendary_duration_min: 60,
  war_legendary_multiplier: 3.0,
  war_legendary_stars_price: 400,
  war_defender_fortify_cost: 8000,
  war_defender_fortify_pct: 30,
  war_defender_fortify_h: 6,
  war_defender_fortify_max: 3,
  war_defender_fortify_stars: 80,
  war_defender_ambush_cost: 12000,
  war_defender_ambush_pct: 50,
  war_defender_ambush_max: 2,
  war_defender_rally_cost: 20000,
  war_defender_rally_pct: 10,
  war_defender_rally_h: 24,
  war_defender_rally_max: 1,
  war_spoils_pyre_pct: 50,
  war_spoils_contrib_pct: 30,
  war_spoils_chest_pct: 20,
  war_spoils_top_count: 5,
  war_spoils_curve: 'weighted',
  war_spoils_warband_ember: 500,   // flat ember to every winning-side kin who fought
  war_relic_drop_enabled: 1,       // 1 = drop relics to winners on resolve
  war_relic_drop_count: 3,         // how many top winners can receive a relic
  war_relic_drop_rarity_max: 'epic', // cap on which rarities can drop (common..legendary)
  war_rivalry_threshold: 3,
  war_rivalry_tribute_mult: 2.0,
  war_rivalry_banner: 1,
  war_action_rally_cost: 500,
  war_action_rally_points: 25,
  war_action_chant_cost: 2000,
  war_action_chant_points: 150,
  war_action_raid_cost: 10000,
  war_action_raid_points: 800,
  war_action_raid_cooldown_h: 4,
  season_length_weeks: 6,
  season_auto_rollover: 0,
  season_titles_count: 3,
  season_pass_stars_price: 800,
  war_chest_topup_stars: 100,
  war_chest_topup_ember: 5000,
  rally_burst_stars: 50,
  rally_burst_limit_per_war: 3,
  momentum_lock_stars: 250,
  momentum_lock_limit: 2,
  chronicle_share_enabled: 1,
  chronicle_retention: 50,
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

export function parseJSON(v, fallback){
  if (typeof v !== 'string') return v ?? fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

export const CFG = { ...DEFAULTS };

export async function loadConfig(q){
  try{
    const r = await q('SELECT k,v FROM config');
    for (const row of r.rows){
      if (!(row.k in DEFAULTS)) {
        console.warn('[config] unknown key in DB, ignored:', row.k);
        continue;
      }
      const def = DEFAULTS[row.k];
      const n = Number(row.v);
      if (typeof def === 'number' && row.v !== '' && !isNaN(n)) CFG[row.k] = n;
      else CFG[row.k] = row.v;
    }
  }catch(e){}
  return CFG;
}

export async function setConfig(q, k, v){
  if (!(k in DEFAULTS)) throw new Error('unknown key: ' + k);
  const def = DEFAULTS[k];

  // empty string on a numeric key → reset to default
  if (typeof def === 'number' && String(v).trim() === ''){
    await q('DELETE FROM config WHERE k=$1', [k]);
    CFG[k] = def;
    return CFG[k];
  }
  if (typeof def === 'number' && isNaN(Number(v))){
    throw new Error(`${k} expects a number`);
  }
  await q(`INSERT INTO config(k,v) VALUES ($1,$2)
           ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v`, [k, String(v)]);
  const n = Number(v);
  CFG[k] = (typeof def === 'number' && !isNaN(n)) ? n : v;
  return CFG[k];
}

export async function resetConfig(q){
  await q('DELETE FROM config');
  for (const k of Object.keys(CFG)) delete CFG[k];
  Object.assign(CFG, DEFAULTS);
  return CFG;
}

export function cfgJSON(key, fallback){
  return parseJSON(CFG[key], fallback);
}
