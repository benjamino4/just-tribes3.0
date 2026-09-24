// ---------------------------------------------------------------------------
// Tunable economy + catalogs. Defaults live here; admins override via the
// `config` table. routes.js and the UI read from CFG.
// ---------------------------------------------------------------------------
export const DEFAULTS = {
  // idle Ash
  ashMinutes: 30, ashCap: 3, ashUnit: 90,
  // tribe founding
  foundEmber: 25000,
  // check-in
  checkin_base: 250, checkin_streakStep: 40, checkin_streakMax: 1000,
  // loyalty gains
  loy_checkin: 15, loy_ash: 8, loy_share: 12, loy_donateDiv: 50,
  // war
  warRewardMult: 1, warStakeMult: 1,
  // flags
  maintenance: 0, allowWar: 1, allowStore: 1,

  // Phase 1
  trials_reset_at: '',
  bonfire_active_id: '',
  territory_enabled: 0,
  starter_bundle_price_stars: 150,
  starter_bundle_ember: 10000,
  starter_bundle_relic: 'firestone',

  // Level table — stored as JSON strings so they fit the config(k,v) shape.
  // Admin can edit via the Warden console; parsed at read time.
  tribe_level_caps:  JSON.stringify([5,8,12,18,25,35,50,70,90,120]),
  tribe_level_costs: JSON.stringify([0,25000,60000,140000,300000,600000,1200000,2400000,4800000,9600000]),
  tribe_level_names: JSON.stringify(['Band','Camp','Village','Settlement','Stronghold','Fortress','Domain','Realm','Empire','Kingdom']),
};

// Fixed catalogs (not admin-editable in Phase 1).
export const PALETTES = {
  ember: { accent:'#ff7a18', accent2:'#ff9d3c', gold:'#ffcf7a', tint:'rgba(255,122,24,.14)', glow:'rgba(255,122,24,.35)' },
  jade:  { accent:'#2adc8c', accent2:'#4fe6a4', gold:'#c9f5d9', tint:'rgba(42,220,140,.12)', glow:'rgba(42,220,140,.32)' },
  frost: { accent:'#5ac8ff', accent2:'#8ddcff', gold:'#d6f0ff', tint:'rgba(90,200,255,.12)', glow:'rgba(90,200,255,.32)' },
  blood: { accent:'#c0392b', accent2:'#e05545', gold:'#ffc0b3', tint:'rgba(192,57,43,.14)',  glow:'rgba(192,57,43,.35)' },
  gold:  { accent:'#e3a008', accent2:'#ffc93c', gold:'#ffe9a8', tint:'rgba(227,160,8,.13)',  glow:'rgba(227,160,8,.34)' },
  void:  { accent:'#9a6bff', accent2:'#b58cff', gold:'#e0d2ff', tint:'rgba(154,107,255,.13)',glow:'rgba(154,107,255,.34)' },
};

export const BANNERS = [
  'sun','moon','wolf','bear','spear','shield','tree','flame',
];

export function parseJSON(v, fallback) {
  if (typeof v !== 'string') return v ?? fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

export const CFG = { ...DEFAULTS };

export async function loadConfig(q){
  try{
    const r = await q('SELECT k,v FROM config');
    for (const row of r.rows){
      if (!(row.k in DEFAULTS)) continue;
      const def = DEFAULTS[row.k];
      const n = Number(row.v);
      if (typeof def === 'number' && !isNaN(n) && row.v !== '') CFG[row.k] = n;
      else CFG[row.k] = row.v;
    }
  }catch(e){ /* table may not exist yet on first boot */ }
  return CFG;
}

export async function setConfig(q, k, v){
  if (!(k in DEFAULTS)) throw new Error('unknown key: ' + k);
  const def = DEFAULTS[k];
  if (typeof def === 'number' && v !== '' && isNaN(Number(v))) {
    throw new Error(`${k} expects a number`);
  }
  await q(`INSERT INTO config(k,v) VALUES ($1,$2) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v`, [k, String(v)]);
  const n = Number(v);
  CFG[k] = (typeof def === 'number' && v !== '' && !isNaN(n)) ? n : v;
  return CFG[k];
}

export async function resetConfig(q){
  await q('DELETE FROM config');
  for (const k of Object.keys(CFG)) delete CFG[k];
  Object.assign(CFG, DEFAULTS);
  return CFG;
}