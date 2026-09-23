// ---------------------------------------------------------------------------
// Tunable game economy. Defaults live here; admins can override any key at
// runtime (persisted in the `config` table) WITHOUT a redeploy. routes.js and
// the war engine read from CFG so changes take effect immediately.
// ---------------------------------------------------------------------------
export const DEFAULTS = {
  // idle Ash
  ashMinutes: 30, ashCap: 3, ashUnit: 90,
  // tribe founding
  foundEmber: 25000,
  // daily rites (Ember rewards)
  quest_cry: 120, quest_feed: 250, quest_stoke: 300, quest_invite: 500, quest_ash: 180,
  // daily blessing (check-in)
  checkin_base: 250, checkin_streakStep: 40, checkin_streakMax: 1000,
  // loyalty gains
  loy_checkin: 15, loy_ash: 8, loy_quest: 10, loy_share: 12, loy_donateDiv: 50,
  // war
  warRewardMult: 1, warStakeMult: 1,
  // flags
  maintenance: 0, allowWar: 1, allowStore: 1,
};

export const CFG = { ...DEFAULTS };

export async function loadConfig(q){
  try{
    const r = await q('SELECT k,v FROM config');
    for (const row of r.rows){ const n = Number(row.v); CFG[row.k] = (row.v!=='' && !isNaN(n)) ? n : row.v; }
  }catch(e){ /* table may not exist yet on first boot */ }
  return CFG;
}

export async function setConfig(q, k, v){
  await q(`INSERT INTO config(k,v) VALUES ($1,$2) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v`, [k, String(v)]);
  const n = Number(v); CFG[k] = (String(v)!=='' && !isNaN(n)) ? n : v;
  return CFG[k];
}

export async function resetConfig(q){
  await q('DELETE FROM config');
  for (const k of Object.keys(CFG)) delete CFG[k];
  Object.assign(CFG, DEFAULTS);
  return CFG;
}
