/* =====================================================================
   TRIBES — War engine.
===================================================================== */
import { q } from './db.js';
import { CFG, cfgJSON } from './config.js';

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
  for (let i = 0; i < use.length; i++){
    await q(
      `INSERT INTO war_fronts (war_id, idx, name) VALUES ($1,$2,$3)
       ON CONFLICT (war_id, idx) DO NOTHING`,
      [warId, i, use[i]]
    );
  }
  return use;
}

export async function getFronts(warId){
  return (await q(
    `SELECT idx, name, attacker_score, defender_score, fortify_until
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
  const kindCfg = ({
    rally: { costKey:'war_action_rally_cost', pointsKey:'war_action_rally_points' },
    chant: { costKey:'war_action_chant_cost', pointsKey:'war_action_chant_points' },
    raid:  { costKey:'war_action_raid_cost',  pointsKey:'war_action_raid_points'  },
  })[kind];
  if (!kindCfg) throw new Error('unknown action');

  const cost = Number(CFG[kindCfg.costKey]) || 0;
  const base = Number(CFG[kindCfg.pointsKey]) || 0;

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
      `SELECT idx, name FROM war_fronts WHERE war_id=$1 AND idx=$2`,
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
      `INSERT INTO war_actions (war_id, user_id, tribe_id, side, front_idx, kind, cost_ember, points, multiplier)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [war.id, user.id, tribe.id, side, frontIdx, kind, cost, points, mult]
    );

    await client.query('COMMIT');
    return { ok:true, points, multiplier:mult, front: front.name, side, kind };
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
    fortify:   { costKey:'war_defender_fortify_cost', maxKey:'war_defender_fortify_max' },
    ambush:    { costKey:'war_defender_ambush_cost',  maxKey:'war_defender_ambush_max'  },
    rally_kin: { costKey:'war_defender_rally_cost',   maxKey:'war_defender_rally_max'   },
  })[kind];
  if (!cfg) throw new Error('unknown defender action');

  const used = (await q(
    `SELECT count(*)::int AS n FROM war_defender_actions
      WHERE war_id=$1 AND tribe_id=$2 AND kind=$3`,
    [war.id, tribe.id, kind]
  )).rows[0].n;
  if (used >= Number(CFG[cfg.maxKey])) throw new Error('no uses left');

  const cost = Number(CFG[cfg.costKey]);
  await q('UPDATE tribes SET treasury = treasury - $1 WHERE id=$2', [cost, tribe.id]);

  await q(
    `INSERT INTO war_defender_actions (war_id, tribe_id, user_id, kind, front_idx, cost_ember)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [war.id, tribe.id, user.id, kind, frontIdx || null, cost]
  );

  if (kind === 'fortify' && frontIdx != null){
    const until = new Date(Date.now() + Number(CFG.war_defender_fortify_h) * 3600 * 1000);
    await q(`UPDATE war_fronts SET fortify_until=$1 WHERE war_id=$2 AND idx=$3`,
      [until, war.id, frontIdx]);
  }
  return { ok:true, kind };
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