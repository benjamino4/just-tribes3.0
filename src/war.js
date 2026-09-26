/* =====================================================================
   TRIBES — War engine.
===================================================================== */
import { q } from './db.js';
import { CFG, cfgJSON } from './config.js';
import { distributeSpoils } from './spoils.js';

export const CHALLENGES = [
  { id:'loyalty_surge', name:'Loyalty Surge',   glyph:'🔥', metric:'loyalty_total',  min:800,  max:2500, days:3, stake:20, reward:6000,
    desc:'Accumulate the most Loyalty for your tribe before the fire dies.' },
  { id:'great_hoard',   name:'The Great Hoard',  glyph:'🪨', metric:'donated_total',  min:15000,max:60000,days:3, stake:25, reward:8000,
    desc:'Stoke the Great Pyre — donate the most Ember of the two tribes.' },
  { id:'call_to_arms',  name:'Call to Arms',     glyph:'📯', metric:'members_total',  min:3,    max:12,   days:3, stake:18, reward:5000,
    desc:'Recruit new kin. The tribe that grows fastest wins.' },
  { id:'ash_harvest',   name:'Ash Harvest',      glyph:'☄️', metric:'ash_total',      min:20,   max:80,   days:3, stake:15, reward:4500,
    desc:'Gather idle Ash relentlessly. Most harvests takes the spoils.' },
  { id:'quest_frenzy',  name:'Trial Frenzy',     glyph:'⚔️', metric:'quests_total',   min:25,   max:90,   days:3, stake:20, reward:5500,
    desc:'Complete the most trials across the whole tribe.' },
  { id:'firekeepers',   name:'Firekeepers',      glyph:'🕯️', metric:'checkins_total', min:20,   max:70,   days:3, stake:15, reward:4000,
    desc:'Keep the fire fed — most daily check-ins wins.' },
  { id:'relic_hunt',    name:'Relic Hunt',       glyph:'🏺', metric:'relics_total',   min:4,    max:16,   days:3, stake:22, reward:6500,
    desc:'Unearth ancient relics. The richer collection triumphs.' },
  { id:'war_chant',     name:'War Chant',        glyph:'📣', metric:'shares_total',   min:10,   max:40,   days:3, stake:18, reward:5000,
    desc:'Spread the War Chant — most invite shares carries the day.' },
  { id:'blitz_raid',    name:'Blitz Raid',       glyph:'⚡', metric:'loyalty_total',  min:400,  max:1200, days:2, stake:30, reward:7000,
    desc:'A lightning raid — first to the Loyalty goal wins instantly.' },
  { id:'endurance',     name:'The Long Winter',  glyph:'🌬️', metric:'donated_total', min:20000, max:70000, days:3, stake:28, reward:9000,
    desc:'Outlast the cold — hoard the deepest Pyre over three long days.' },
];

/* =====================================================================
   BATCH A — terrain + tactics catalogs.
   Terrain is rolled per front on war creation and stored in
   war_fronts.terrain. Each terrain favours some tactics and resists
   others, applied as a multiplier inside recordAction.
===================================================================== */
export const TERRAIN = [
  { id:'plains',   name:'Open Plains', glyph:'🌾', desc:'Flat ground. Rewards direct force and cavalry.',
    favors:['charge','rally'],           resists:['night_raid','flank'] },
  { id:'forest',   name:'Deep Forest', glyph:'🌲', desc:'Cover everywhere. Rewards flanking and stealth.',
    favors:['flank','skirmish_strike'],  resists:['charge','siege_push'] },
  { id:'hills',    name:'High Hills',  glyph:'⛰️', desc:'Elevation favours skirmishers and probing.',
    favors:['skirmish_strike','probe'],  resists:['charge'] },
  { id:'swamp',    name:'Black Swamp', glyph:'🪨', desc:'Mud and mist. Night raids thrive; heavy pushes bog down.',
    favors:['night_raid','probe'],       resists:['siege_push','charge'] },
  { id:'ruins',    name:'Old Ruins',   glyph:'🏰', desc:'Broken walls. Siege engines and firestorms dominate.',
    favors:['siege_push','firestorm'],   resists:['skirmish_strike'] },
  { id:'ashlands', name:'The Ashlands', glyph:'🌋', desc:'Scorched earth. Fire spreads; morale rallies falter.',
    favors:['firestorm','raid'],         resists:['rally'] },
];
export const TERRAIN_IDS = TERRAIN.map(t => t.id);
export const terrainById = id => TERRAIN.find(t => t.id === id) || null;

// Offensive tactics flow through /war/action -> recordAction.
// rally/chant/raid keep their legacy config keys so the Warden can still tune them.
export const OFFENSIVE_TACTICS = [
  { id:'rally',           name:'Rally',             glyph:'🔥', cost:500,   base:25,  desc:'Cheap, steady pressure. Good anywhere.' },
  { id:'chant',           name:'War Chant',         glyph:'📣', cost:2000,  base:150, desc:'Rouse the kin for a bigger surge.' },
  { id:'raid',            name:'Raid',              glyph:'⚔️', cost:10000, base:800, desc:'Expensive alpha strike on a front.' },
  { id:'charge',          name:'Cavalry Charge',    glyph:'🐎', cost:4000,  base:300, desc:'Smashes open ground; useless in cover.' },
  { id:'flank',           name:'Flanking Maneuver', glyph:'💨', cost:3000,  base:220, desc:'Slips through forest and broken lines.' },
  { id:'siege_push',      name:'Siege Push',        glyph:'🪨', cost:6000,  base:480, desc:'Grinds fortifications and ruins down.' },
  { id:'skirmish_strike', name:'Skirmish Strike',   glyph:'🏹', cost:1200,  base:90,  desc:'Fast harassment; thrives on high ground.' },
  { id:'night_raid',      name:'Night Raid',        glyph:'🌑', cost:5000,  base:380, desc:'Strikes under cover of dark and mist.' },
  { id:'firestorm',       name:'Firestorm',         glyph:'🌋', cost:8000,  base:650, desc:'Unleashes fire — devastating in ruins/ash.' },
  { id:'probe',           name:'Probing Attack',    glyph:'🔍', cost:800,   base:50,  desc:'Low-cost feint that tests the front.' },
];
// Defensive tactics flow through /war/defend -> recordDefenderAction.
export const DEFENSIVE_TACTICS = [
  { id:'fortify',   name:'Fortify',    glyph:'🧱', desc:'Harden a front for a window of time.' },
  { id:'ambush',    name:'Ambush',     glyph:'🕶️', desc:'Punish the next enemy strike on this front.' },
  { id:'reinforce', name:'Reinforce',  glyph:'🛡️', desc:'Shore up a weakening front with fresh kin.' },
  { id:'scout',     name:'Scout',      glyph:'🔭', desc:'Reveal terrain and enemy momentum early.' },
  { id:'rally_kin', name:'Rally Kin',  glyph:'🥁', desc:'Tribe-wide morale boost for the defence.' },
];
export const TACTICS = [...OFFENSIVE_TACTICS, ...DEFENSIVE_TACTICS];
export function listTactics(){
  return {
    terrain: TERRAIN,
    offensive: OFFENSIVE_TACTICS,
    defensive: DEFENSIVE_TACTICS,
    bonusPct: Number(CFG.war_terrain_bonus_pct) || 0,
    penaltyPct: Number(CFG.war_terrain_penalty_pct) || 0,
  };
}

// terrain multiplier for an offensive tactic on a given terrain
function terrainMult(terrainId, tacticId){
  const t = terrainById(terrainId);
  if (!t) return 1;
  if (Array.isArray(t.favors)  && t.favors.includes(tacticId))  return 1 + (Number(CFG.war_terrain_bonus_pct)  || 0) / 100;
  if (Array.isArray(t.resists) && t.resists.includes(tacticId)) return 1 - (Number(CFG.war_terrain_penalty_pct) || 0) / 100;
  return 1;
}

const rnd = (a,b) => a + Math.floor(Math.random() * (b - a + 1));
export function pickChallenge(){
  const c = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
  return { ...c, goal: rnd(c.min, c.max) };
}

export async function getTribeMetric(tribeId, metric){
  const safe = String(metric).replace(/[^a-z_]/gi, '');
  const r = await q(`SELECT ${safe} AS v FROM tribes WHERE id=$1`, [tribeId]);
  return r.rows[0] ? Number(r.rows[0].v) : 0;
}

/* ---------- fronts ---------- */
export async function createFronts(warId){
  const names = cfgJSON('war_front_names', ['North','Center','South']);
  const count = Number(CFG.war_front_count) || 3;
  const use = names.slice(0, count);
  // roll a distinct terrain per front (fall back to repeats if fronts > terrains)
  const bag = [...TERRAIN_IDS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < use.length; i++){
    const terrain = bag[i % bag.length];
    await q(
      `INSERT INTO war_fronts (war_id, idx, name, terrain) VALUES ($1,$2,$3,$4)
       ON CONFLICT (war_id, idx) DO UPDATE SET terrain = COALESCE(war_fronts.terrain, EXCLUDED.terrain)`,
      [warId, i, use[i], terrain]
    );
  }
  return use;
}

export async function getFronts(warId){
  return (await q(
    `SELECT idx, name, terrain, attacker_score, defender_score, fortify_until
       FROM war_fronts WHERE war_id=$1 ORDER BY idx`,
    [warId]
  )).rows;
}

function stanceMultFor(stance, warStartMs, warEndMs, nowMs){
  const stances = cfgJSON('war_stances', []);
  const s = stances.find(x => x.id === stance) || { first:1, last:1 };
  const total = Math.max(1, warEndMs - warStartMs);
  const at = Math.max(0, Math.min(1, (nowMs - warStartMs) / total));
  return Number(s.first) + (Number(s.last) - Number(s.first)) * at;
}

export async function tribeScore(warId, side){
  const col = side === 'attacker' ? 'attacker_score' : 'defender_score';
  const r = await q(`SELECT COALESCE(SUM(${col}),0)::bigint AS s FROM war_fronts WHERE war_id=$1`, [warId]);
  return Number(r.rows[0].s) || 0;
}

/* ---------- transactional action ---------- */
export async function recordAction(war, user, tribe, side, frontIdx, kind){
  const tactic = OFFENSIVE_TACTICS.find(t => t.id === kind);
  if (!tactic) throw new Error('unknown tactic');

  // legacy config still tunes the three original tactics
  let cost = Number(tactic.cost) || 0;
  let base = Number(tactic.base) || 0;
  if (kind === 'rally'){ cost = Number(CFG.war_action_rally_cost) || cost; base = Number(CFG.war_action_rally_points) || base; }
  if (kind === 'chant'){ cost = Number(CFG.war_action_chant_cost) || cost; base = Number(CFG.war_action_chant_points) || base; }
  if (kind === 'raid') { cost = Number(CFG.war_action_raid_cost)  || cost; base = Number(CFG.war_action_raid_points)  || base; }

  const chestCol = side === 'attacker' ? 'attacker_chest' : 'defender_chest';
  const scoreCol = side === 'attacker' ? 'attacker_score' : 'defender_score';

  const { pool } = await import('./db.js');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const warRow = (await client.query(
      `SELECT ${chestCol} AS chest FROM wars WHERE id=$1 FOR UPDATE`,
      [war.id]
    )).rows[0];
    if (!warRow) throw new Error('war gone');
    if (Number(warRow.chest) < cost) throw new Error('not enough Ember in the war chest');

    const front = (await client.query(
      `SELECT idx, name, terrain FROM war_fronts WHERE war_id=$1 AND idx=$2`,
      [war.id, frontIdx]
    )).rows[0];
    if (!front) throw new Error('no such front');

    // compute multiplier
    let mult = 1.0;
    const now = Date.now();
    mult *= stanceMultFor(
      war.stance,
      new Date(war.start_at).getTime(),
      new Date(war.end_at).getTime(),
      now
    );
    const legendary = (await client.query(
      `SELECT multiplier FROM war_legendary
        WHERE war_id=$1 AND now() >= fires_at
          AND now() < fires_at + (duration_min || ' min')::interval
        ORDER BY fires_at DESC LIMIT 1`,
      [war.id]
    )).rows[0];
    if (legendary) mult *= Number(legendary.multiplier);

    const momentum = (await client.query(
      `SELECT on_rout FROM war_momentum WHERE war_id=$1 AND tribe_id=$2`,
      [war.id, tribe.id]
    )).rows[0];
    if (momentum && momentum.on_rout) mult *= (1 + Number(CFG.war_rout_bonus_pct)/100);

    // BATCH A: terrain affinity for this tactic on this front
    mult *= terrainMult(front.terrain, kind);

    // BATCH A: vengeance — standing grudge bonus vs the old victor
    const foeId = side === 'attacker' ? war.defender_id : war.attacker_id;
    const grudge = (await client.query(
      `SELECT COALESCE(SUM(GREATEST(0, tokens - spent)),0)::int AS tok
         FROM war_vengeance
        WHERE tribe_id=$1 AND target_id=$2
          AND (expires_at IS NULL OR expires_at > now())`,
      [tribe.id, foeId]
    )).rows[0];
    const gTok = grudge ? Number(grudge.tok) : 0;
    if (gTok > 0) mult *= (1 + gTok * (Number(CFG.war_vengeance_bonus_pct) || 0) / 100);

    const points = Math.round(base * mult);

    await client.query(
      `UPDATE wars SET ${chestCol} = ${chestCol} - $1 WHERE id=$2`,
      [cost, war.id]
    );
    await client.query(
      `UPDATE war_fronts SET ${scoreCol} = ${scoreCol} + $1 WHERE war_id=$2 AND idx=$3`,
      [points, war.id, frontIdx]
    );
    await client.query(
      `INSERT INTO war_actions (war_id, user_id, tribe_id, side, front_idx, kind, cost_ember, points, multiplier, tactic)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [war.id, user.id, tribe.id, side, frontIdx, kind, cost, points, mult, kind]
    );

    await client.query('COMMIT');
    return { ok:true, points, multiplier:mult, front: front.name, terrain: front.terrain, side, kind };
  } catch (e){
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/* ---------- momentum wave ---------- */
export async function runMomentumWave(war){
  const intervalH = Number(CFG.war_momentum_interval_h) || 6;
  const windowStart = new Date(Date.now() - intervalH * 3600 * 1000);
  const rows = (await q(
    `SELECT tribe_id, COALESCE(SUM(points),0)::bigint AS p
       FROM war_actions
      WHERE war_id=$1 AND created_at >= $2
      GROUP BY tribe_id`,
    [war.id, windowStart]
  )).rows;
  if (rows.length < 2) return;
  rows.sort((a,b) => Number(b.p) - Number(a.p));
  const leader = Number(rows[0].tribe_id);

  await q(
    `INSERT INTO war_momentum (war_id, tribe_id, tokens, last_wave)
     VALUES ($1,$2,1,now())
     ON CONFLICT (war_id, tribe_id) DO UPDATE
       SET tokens = war_momentum.tokens + 1, last_wave = now()`,
    [war.id, leader]
  );
  await q(
    `INSERT INTO war_momentum (war_id, tribe_id, tokens, last_wave)
     VALUES ($1,$2,0,now())
     ON CONFLICT (war_id, tribe_id) DO UPDATE
       SET tokens = GREATEST(0, war_momentum.tokens - 1), last_wave = now()`,
    [war.id, Number(rows[1].tribe_id)]
  );

  const m = (await q(
    `SELECT tokens FROM war_momentum WHERE war_id=$1 AND tribe_id=$2`,
    [war.id, leader]
  )).rows[0];
  if (m && Number(m.tokens) >= Number(CFG.war_rout_threshold)){
    await q(`UPDATE war_momentum SET on_rout=true WHERE war_id=$1 AND tribe_id=$2`,
      [war.id, leader]);
  }
}

export async function momentumFor(warId){
  return (await q(
    `SELECT wm.tribe_id, wm.tokens, wm.on_rout, t.name
       FROM war_momentum wm JOIN tribes t ON t.id=wm.tribe_id
      WHERE wm.war_id=$1`,
    [warId]
  )).rows;
}

/* ---------- legendary ---------- */
export async function scheduleLegendary(war, forcedByUserId){
  const chance = forcedByUserId ? 1.0 : Number(CFG.war_legendary_chance);
  if (Math.random() > chance) return null;
  const firesAt = new Date(Date.now() + (30 + Math.random() * 360) * 60 * 1000);
  const durationMin = Number(CFG.war_legendary_duration_min) || 60;
  const r = await q(
    `INSERT INTO war_legendary (war_id, fires_at, duration_min, multiplier, triggered_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [war.id, firesAt, durationMin, Number(CFG.war_legendary_multiplier), forcedByUserId || null]
  );
  return r.rows[0];
}

export async function activeLegendary(warId){
  return (await q(
    `SELECT * FROM war_legendary
      WHERE war_id=$1 AND now() >= fires_at
        AND now() < fires_at + (duration_min || ' min')::interval
      ORDER BY fires_at DESC LIMIT 1`,
    [warId]
  )).rows[0] || null;
}

/* ---------- defender actions ---------- */
export async function recordDefenderAction(war, user, tribe, kind, frontIdx){
  const cfg = ({
    fortify:   { costKey:'war_defender_fortify_cost', maxKey:'war_defender_fortify_max', costDef:8000,  maxDef:3 },
    ambush:    { costKey:'war_defender_ambush_cost',  maxKey:'war_defender_ambush_max',  costDef:12000, maxDef:2 },
    reinforce: { costKey:'war_defender_fortify_cost', maxKey:'war_defender_fortify_max', costDef:6000,  maxDef:3 },
    scout:     { costKey:'',                          maxKey:'',                         costDef:1500,  maxDef:5 },
    rally_kin: { costKey:'war_defender_rally_cost',   maxKey:'war_defender_rally_max',   costDef:20000, maxDef:1 },
  })[kind];
  if (!cfg) throw new Error('unknown defender action');

  const maxUses = Number(CFG[cfg.maxKey]) || cfg.maxDef;
  const used = (await q(
    `SELECT count(*)::int AS n FROM war_defender_actions
      WHERE war_id=$1 AND tribe_id=$2 AND kind=$3`,
    [war.id, tribe.id, kind]
  )).rows[0].n;
  if (used >= maxUses) throw new Error('no uses left');

  const cost = Number(CFG[cfg.costKey]) || cfg.costDef;
  await q('UPDATE tribes SET treasury = treasury - $1 WHERE id=$2', [cost, tribe.id]);

  await q(
    `INSERT INTO war_defender_actions (war_id, tribe_id, user_id, kind, front_idx, cost_ember, tactic)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [war.id, tribe.id, user.id, kind, frontIdx || null, cost, kind]
  );

  let reveal = null;
  if (kind === 'fortify' && frontIdx != null){
    const until = new Date(Date.now() + Number(CFG.war_defender_fortify_h) * 3600 * 1000);
    await q(`UPDATE war_fronts SET fortify_until=$1 WHERE war_id=$2 AND idx=$3`,
      [until, war.id, frontIdx]);
  } else if (kind === 'reinforce' && frontIdx != null){
    // reinforce pours defensive points straight onto a weakening front
    const pts = Math.round((Number(CFG.war_action_chant_points) || 150) * 0.6);
    await q(`UPDATE war_fronts SET defender_score = defender_score + $1 WHERE war_id=$2 AND idx=$3`,
      [pts, war.id, frontIdx]);
  } else if (kind === 'scout'){
    // scout reveals terrain + current momentum so defenders can react
    reveal = {
      fronts: await getFronts(war.id),
      momentum: await momentumFor(war.id),
    };
  }
  return { ok:true, kind, reveal };
}

/* ---------- resolution ---------- */
export async function maybeResolve(war){
  if (war.status !== 'active') return war;

  const now = Date.now();
  const endsAt = new Date(war.end_at).getTime();

  const a = await tribeScore(war.id, 'attacker');
  const d = await tribeScore(war.id, 'defender');
  await q('UPDATE wars SET attacker_score=$1, defender_score=$2 WHERE id=$3 AND status=$4',
    [a, d, war.id, 'active']);

  if (now < endsAt) return war;

  const fronts = await getFronts(war.id);
  let aWins = 0, dWins = 0;
  for (const f of fronts){
    if (Number(f.attacker_score) > Number(f.defender_score)) aWins++;
    else if (Number(f.defender_score) > Number(f.attacker_score)) dWins++;
  }
  const defenderBonus = 1 + Number(CFG.war_defender_bonus_pct)/100;
  let winnerId = null;
  if (aWins > dWins) winnerId = war.attacker_id;
  else if (dWins > aWins) winnerId = war.defender_id;
  else {
    const adj = d * defenderBonus;
    if (a > adj) winnerId = war.attacker_id;
    else if (adj > a) winnerId = war.defender_id;
  }

  const flip = await q(
    `UPDATE wars SET status='resolved', winner_id=$1, resolved_at=now()
      WHERE id=$2 AND status='active' RETURNING id`,
    [winnerId, war.id]
  );
  if (!flip.rowCount) return { ...war, status:'resolved' };

  const pyrePct = Number(CFG.war_spoils_pyre_pct)/100;
  const contribPct = Number(CFG.war_spoils_contrib_pct)/100;
  const chestPct = Number(CFG.war_spoils_chest_pct)/100;
  let tribute = 0;

  if (winnerId){
    const loserId = winnerId === war.attacker_id ? war.defender_id : war.attacker_id;
    const lr = await q('SELECT treasury FROM tribes WHERE id=$1', [loserId]);
    const pool = Number(lr.rows[0]?.treasury || 0);
    tribute = Math.floor(pool * (war.stake_pct || 20) / 100);
    const riv = await q(
      `SELECT * FROM rivalries WHERE (tribe_a=$1 AND tribe_b=$2) OR (tribe_a=$2 AND tribe_b=$1)`,
      [war.attacker_id, war.defender_id]
    );
    if (riv.rowCount) tribute = Math.floor(tribute * Number(CFG.war_rivalry_tribute_mult));

    const toPyre = Math.floor(tribute * pyrePct) + Number(war.reward_ember);
    const toContrib = Math.floor(tribute * contribPct);
    const toChest = Math.floor(tribute * chestPct);

    await q('UPDATE tribes SET treasury = GREATEST(0, treasury - $1), losses = losses + 1 WHERE id=$2',
      [tribute, loserId]);
    await q('UPDATE tribes SET treasury = treasury + $1, wins = wins + 1 WHERE id=$2',
      [toPyre, winnerId]);
    await q('UPDATE wars SET defender_chest = defender_chest + $1 WHERE id=$2',
      [toChest, war.id]);

    const topCount = Number(CFG.war_spoils_top_count) || 5;
    const winners = (await q(
      `SELECT user_id, SUM(points)::bigint AS p FROM war_actions
        WHERE war_id=$1 AND tribe_id=$2 GROUP BY user_id ORDER BY p DESC LIMIT $3`,
      [war.id, winnerId, topCount]
    )).rows;
    const totalP = winners.reduce((s,x) => s + Number(x.p), 0) || 1;
    for (const w of winners){
      const share = Math.floor(toContrib * Number(w.p) / totalP);
      if (share > 0)
        await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [share, w.user_id]);
    }

    // ---- post-war spoils: warband ember + relic drops to the victors ----
    try { await distributeSpoils(war, winnerId); }
    catch (e){ console.error('[war] distributeSpoils', e.message); }

    // ---- BATCH A: the beaten tribe earns a grudge against the victor ----
    try {
      const tok  = Number(CFG.war_vengeance_tokens) || 0;
      const ttlH = Number(CFG.war_vengeance_ttl_h) || 168;
      if (tok > 0){
        // any grudge the loser was spending vs this foe is now satisfied
        await q(`UPDATE war_vengeance SET spent = tokens WHERE tribe_id=$1 AND target_id=$2`,
          [loserId, winnerId]);
        await q(
          `INSERT INTO war_vengeance (tribe_id, target_id, war_id, tokens, expires_at)
           VALUES ($1,$2,$3,$4, now() + ($5 || ' hours')::interval)`,
          [loserId, winnerId, war.id, tok, String(ttlH)]
        );
      }
    } catch(e){ console.error('[war] vengeance', e.message); }
  }

  const top_a = (await q(
    `SELECT user_id, SUM(points)::bigint AS p FROM war_actions
      WHERE war_id=$1 AND side='attacker' GROUP BY user_id ORDER BY p DESC LIMIT 5`,
    [war.id]
  )).rows;
  const top_d = (await q(
    `SELECT user_id, SUM(points)::bigint AS p FROM war_actions
      WHERE war_id=$1 AND side='defender' GROUP BY user_id ORDER BY p DESC LIMIT 5`,
    [war.id]
  )).rows;
  const legendaries = (await q(
    `SELECT fires_at, multiplier FROM war_legendary WHERE war_id=$1`, [war.id]
  )).rows;
  const att = (await q('SELECT name, crest FROM tribes WHERE id=$1', [war.attacker_id])).rows[0] || {};
  const def = (await q('SELECT name, crest FROM tribes WHERE id=$1', [war.defender_id])).rows[0] || {};

  await q(
    `INSERT INTO war_chronicles (war_id, attacker_id, defender_id, winner_id, attacker_name, defender_name,
      attacker_crest, defender_crest, score_a, score_d, front_results, tribute,
      top_attacker, top_defender, legendary_events, stance, cry_used, is_rivalry)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (war_id) DO NOTHING`,
    [war.id, war.attacker_id, war.defender_id, winnerId, att.name, def.name,
     att.crest, def.crest, a, d, JSON.stringify(fronts), tribute,
     JSON.stringify(top_a), JSON.stringify(top_d), JSON.stringify(legendaries),
     war.stance, war.cry_used, false]
  );

  const [t1,t2] = [Math.min(war.attacker_id, war.defender_id), Math.max(war.attacker_id, war.defender_id)];
  const r = await q(
    `INSERT INTO rivalries (tribe_a, tribe_b, wars_fought) VALUES ($1,$2,1)
     ON CONFLICT (tribe_a, tribe_b) DO UPDATE
       SET wars_fought = rivalries.wars_fought + 1, updated_at = now()
     RETURNING *`,
    [t1, t2]
  );
  const riv = r.rows[0];
  if (riv && Number(riv.wars_fought) >= Number(CFG.war_rivalry_threshold)){
    const winCol = winnerId === riv.tribe_a ? 'a_wins' : 'b_wins';
    await q(`UPDATE rivalries SET is_active=true, ${winCol} = ${winCol} + 1 WHERE id=$1`, [riv.id]);
  }

  return { ...war, status:'resolved', winner_id:winnerId, tribute };
}

/* ---------- WAR TICK (called from cron) ---------- */
export async function warTick(){
  const out = { resolved: 0, momentum: 0, legendary: 0 };
  try {
    const activeWars = (await q(`SELECT * FROM wars WHERE status='active'`)).rows;
    for (const war of activeWars){
      // resolve if time is up
      const now = Date.now();
      if (now >= new Date(war.end_at).getTime()){
        const r = await maybeResolve(war);
        if (r.status === 'resolved') out.resolved++;
        continue;
      }
      // momentum wave (per interval)
      const lastWave = (await q(
        `SELECT MAX(last_wave) AS t FROM war_momentum WHERE war_id=$1`, [war.id]
      )).rows[0]?.t;
      const intervalMs = (Number(CFG.war_momentum_interval_h) || 6) * 3600 * 1000;
      if (!lastWave || now - new Date(lastWave).getTime() >= intervalMs){
        await runMomentumWave(war);
        out.momentum++;
      }
      // refresh live scores
      const a = await tribeScore(war.id, 'attacker');
      const d = await tribeScore(war.id, 'defender');
      await q('UPDATE wars SET attacker_score=$1, defender_score=$2 WHERE id=$3',
        [a, d, war.id]);
    }
  } catch(e){
    console.warn('[warTick]', e.message);
  }
  return out;
}

/* ---------- seasons ---------- */
export async function currentSeason(){
  const r = await q(`SELECT * FROM seasons WHERE ended_at IS NULL ORDER BY n DESC LIMIT 1`);
  return r.rowCount ? r.rows[0] : null;
}

export async function startSeason(n){
  const weeks = Number(CFG.season_length_weeks) || 6;
  const endsAt = new Date(Date.now() + weeks * 7 * 24 * 3600 * 1000);
  const r = await q(
    `INSERT INTO seasons (n, ends_at) VALUES ($1,$2) RETURNING *`,
    [n, endsAt]
  );
  return r.rows[0];
}

export async function endSeason(){
  const s = await currentSeason();
  if (!s) return null;
  await q('UPDATE seasons SET ended_at = now() WHERE id=$1', [s.id]);

  const count = Number(CFG.season_titles_count) || 3;
  const tops = (await q(
    `SELECT id, name, wins FROM tribes ORDER BY wins DESC, loyalty_total DESC LIMIT $1`,
    [count]
  )).rows;
  const fmt = s.title_fmt || 'Conqueror of Season {n}';
  for (let i = 0; i < tops.length; i++){
    const title = fmt.replace('{n}', s.n);
    await q(
      `INSERT INTO season_titles (season_id, tribe_id, title, rank) VALUES ($1,$2,$3,$4)
       ON CONFLICT (season_id, tribe_id) DO NOTHING`,
      [s.id, tops[i].id, title, i + 1]
    );
  }
  return { season: s, titled: tops.length };
}
/* =====================================================================
   BATCH A — vengeance, blood alliances, matchmaking, hint
===================================================================== */

// how many live grudge tokens tribe holds against target (0 if none)
export async function getVengeance(tribeId, targetId){
  const r = await q(
    `SELECT COALESCE(SUM(GREATEST(0, tokens - spent)),0)::int AS tok
       FROM war_vengeance
      WHERE tribe_id=$1 AND target_id=$2
        AND (expires_at IS NULL OR expires_at > now())`,
    [tribeId, targetId]
  );
  return Number(r.rows[0]?.tok) || 0;
}

// list every active grudge a tribe currently holds (for the war UI)
export async function listVengeance(tribeId){
  return (await q(
    `SELECT v.target_id, t.name AS target_name,
            SUM(GREATEST(0, v.tokens - v.spent))::int AS tokens,
            MAX(v.expires_at) AS expires_at
       FROM war_vengeance v JOIN tribes t ON t.id = v.target_id
      WHERE v.tribe_id=$1 AND (v.expires_at IS NULL OR v.expires_at > now())
      GROUP BY v.target_id, t.name
     HAVING SUM(GREATEST(0, v.tokens - v.spent)) > 0
      ORDER BY tokens DESC`,
    [tribeId]
  )).rows;
}

const allyKey = (a, b) => [Math.min(a, b), Math.max(a, b)];

export async function areAllied(a, b){
  const [x, y] = allyKey(Number(a), Number(b));
  const r = await q(
    `SELECT 1 FROM blood_alliances WHERE tribe_a=$1 AND tribe_b=$2 AND active=true`,
    [x, y]
  );
  return r.rowCount > 0;
}

export async function formBloodAlliance(a, b, byUserId){
  if (!Number(CFG.war_blood_alliance_enabled)) throw new Error('blood alliances are sealed');
  if (Number(a) === Number(b)) throw new Error('a tribe cannot ally itself');
  const active = await q(
    `SELECT 1 FROM wars WHERE status='active'
       AND ((attacker_id=$1 AND defender_id=$2) OR (attacker_id=$2 AND defender_id=$1))`,
    [a, b]
  );
  if (active.rowCount) throw new Error('you cannot swear peace mid-war');
  const [x, y] = allyKey(Number(a), Number(b));
  const r = await q(
    `INSERT INTO blood_alliances (tribe_a, tribe_b, formed_by, active)
     VALUES ($1,$2,$3,true)
     ON CONFLICT (tribe_a, tribe_b) DO UPDATE
       SET active=true, formed_by=EXCLUDED.formed_by, formed_at=now(), broken_at=NULL
     RETURNING *`,
    [x, y, byUserId || null]
  );
  return r.rows[0];
}

export async function breakBloodAlliance(a, b){
  const [x, y] = allyKey(Number(a), Number(b));
  const r = await q(
    `UPDATE blood_alliances SET active=false, broken_at=now()
      WHERE tribe_a=$1 AND tribe_b=$2 AND active=true RETURNING *`,
    [x, y]
  );
  return r.rows[0] || null;
}

export async function listAlliances(tribeId){
  return (await q(
    `SELECT CASE WHEN tribe_a=$1 THEN tribe_b ELSE tribe_a END AS ally_id,
            t.name AS ally_name, ba.formed_at
       FROM blood_alliances ba
       JOIN tribes t
         ON t.id = CASE WHEN ba.tribe_a=$1 THEN ba.tribe_b ELSE ba.tribe_a END
      WHERE (ba.tribe_a=$1 OR ba.tribe_b=$1) AND ba.active=true
      ORDER BY ba.formed_at DESC`,
    [tribeId]
  )).rows;
}

// pick a fair rival: not at war, not an ally, within the level cap
export async function pickFoe(tribeId){
  const cap = Number(CFG.war_matchmaking_level_cap) || 2;
  const me = (await q('SELECT level FROM tribes WHERE id=$1', [tribeId])).rows[0];
  const myLevel = Number(me?.level) || 1;
  const foe = (await q(
    `SELECT t.id FROM tribes t
      WHERE t.id <> $1
        AND ABS(COALESCE(t.level,1) - $2) <= $3
        AND NOT EXISTS (SELECT 1 FROM wars w WHERE w.status='active' AND (w.attacker_id=t.id OR w.defender_id=t.id))
        AND NOT EXISTS (
          SELECT 1 FROM blood_alliances ba
           WHERE ba.active=true
             AND ((ba.tribe_a=$1 AND ba.tribe_b=t.id) OR (ba.tribe_a=t.id AND ba.tribe_b=$1)))
      ORDER BY random() LIMIT 1`,
    [tribeId, myLevel, cap]
  )).rows[0];
  return foe || null;
}

// contextual advice for the war screen ("Hint" button)
export async function warHint(war, side){
  if (!Number(CFG.war_hint_enabled)) return { hint: 'The elders keep their counsel.' };
  const fronts = await getFronts(war.id);
  const mineCol = side === 'attacker' ? 'attacker_score' : 'defender_score';
  const foeCol  = side === 'attacker' ? 'defender_score' : 'attacker_score';
  // find the front where we trail by the most
  let worst = null, gap = Infinity;
  for (const f of fronts){
    const g = Number(f[mineCol]) - Number(f[foeCol]);
    if (g < gap){ gap = g; worst = f; }
  }
  if (!worst) return { hint: 'Hold the line \u2014 all fronts are steady.' };
  const terr = terrainById(worst.terrain);
  const best = terr && terr.favors && terr.favors.length
    ? OFFENSIVE_TACTICS.find(t => t.id === terr.favors[0])
    : null;
  const where = worst.name + (terr ? ' (' + terr.glyph + ' ' + terr.name + ')' : '');
  if (gap < 0 && best){
    return { front: worst.idx, terrain: worst.terrain, tactic: best.id,
      hint: `You are losing ${where}. Its terrain favours ${best.glyph} ${best.name} \u2014 press there.` };
  }
  if (best){
    return { front: worst.idx, terrain: worst.terrain, tactic: best.id,
      hint: `Reinforce ${where} with ${best.glyph} ${best.name} to widen your lead.` };
  }
  return { front: worst.idx, terrain: worst.terrain, hint: `Focus ${where}.` };
}
