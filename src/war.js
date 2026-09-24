// ---------------------------------------------------------------------------
// Tribe War engine. Added in Phase 1: guarded status flip so concurrent
// resolves can't double-pay, and a `refreshWar` name kept for compat.
// ---------------------------------------------------------------------------
import { q } from './db.js';

export const CHALLENGES = [
  { id:'loyalty_surge', name:'Loyalty Surge',   glyph:'🔥', metric:'loyalty_total',  min:800,  max:2500, days:7, stake:20, reward:6000,
    desc:'Accumulate the most Loyalty for your tribe before the fire dies.' },
  { id:'great_hoard',   name:'The Great Hoard',  glyph:'🪨', metric:'donated_total',  min:15000,max:60000,days:7, stake:25, reward:8000,
    desc:'Stoke the Great Pyre — donate the most Ember of the two tribes.' },
  { id:'call_to_arms',  name:'Call to Arms',     glyph:'📯', metric:'members_total',  min:3,    max:12,   days:7, stake:18, reward:5000,
    desc:'Recruit new kin. The tribe that grows fastest wins.' },
  { id:'ash_harvest',   name:'Ash Harvest',      glyph:'☄️', metric:'ash_total',      min:20,   max:80,   days:5, stake:15, reward:4500,
    desc:'Gather idle Ash relentlessly. Most harvests takes the spoils.' },
  { id:'quest_frenzy',  name:'Trial Frenzy',     glyph:'⚔️', metric:'quests_total',   min:25,   max:90,   days:5, stake:20, reward:5500,
    desc:'Complete the most trials across the whole tribe.' },
  { id:'firekeepers',   name:'Firekeepers',      glyph:'🕯️', metric:'checkins_total', min:20,   max:70,   days:7, stake:15, reward:4000,
    desc:'Keep the fire fed — most daily check-ins wins.' },
  { id:'relic_hunt',    name:'Relic Hunt',       glyph:'🏺', metric:'relics_total',   min:4,    max:16,   days:7, stake:22, reward:6500,
    desc:'Unearth ancient relics. The richer collection triumphs.' },
  { id:'war_chant',     name:'War Chant',        glyph:'📣', metric:'shares_total',   min:10,   max:40,   days:5, stake:18, reward:5000,
    desc:'Spread the War Chant — most invite shares carries the day.' },
  { id:'blitz_raid',    name:'Blitz Raid',       glyph:'⚡', metric:'loyalty_total',  min:400,  max:1200, days:2, stake:30, reward:7000,
    desc:'A lightning raid — first to the Loyalty goal wins instantly.' },
  { id:'endurance',     name:'The Long Winter',  glyph:'🌬️', metric:'donated_total', min:20000, max:70000, days:10, stake:28, reward:9000,
    desc:'Outlast the cold — hoard the deepest Pyre over ten long days.' },
];

const rnd = (a,b)=> a + Math.floor(Math.random()*(b-a+1));
export function pickChallenge(){
  const c = CHALLENGES[Math.floor(Math.random()*CHALLENGES.length)];
  return { ...c, goal: rnd(c.min, c.max) };
}

export async function getTribeMetric(tribeId, metric){
  const r = await q(`SELECT ${metric} AS v FROM tribes WHERE id=$1`, [tribeId]);
  return r.rows[0] ? Number(r.rows[0].v) : 0;
}

export async function refreshWar(war){
  const a = await getTribeMetric(war.attacker_id, war.metric);
  const d = await getTribeMetric(war.defender_id, war.metric);
  war.attacker_score = Math.max(0, a - Number(war.attacker_start));
  war.defender_score = Math.max(0, d - Number(war.defender_start));
  return war;
}

export async function maybeResolve(war){
  await refreshWar(war);
  const now = Date.now();
  const ended = new Date(war.end_at).getTime() <= now;
  const goal = Number(war.goal);
  const as = Number(war.attacker_score), ds = Number(war.defender_score);
  const hit = as >= goal || ds >= goal;

  // Persist live scores so the UI sees them between ticks.
  await q('UPDATE wars SET attacker_score=$1, defender_score=$2 WHERE id=$3 AND status=$4',
    [as, ds, war.id, 'active']);

  if (!ended && !hit) return war;

  const winnerId = as === ds ? null : (as > ds ? war.attacker_id : war.defender_id);

  let tribute = 0;
  if (winnerId){
    const loserId = winnerId === war.attacker_id ? war.defender_id : war.attacker_id;
    const lr = await q('SELECT treasury FROM tribes WHERE id=$1', [loserId]);
    const pool = Number(lr.rows[0]?.treasury || 0);
    tribute = Math.floor(pool * war.stake_pct / 100);

    // ATOMIC guard — only the first caller flips status and applies effects.
    const flip = await q(
      `UPDATE wars SET status='resolved', winner_id=$1, tribute=$2, resolved_at=now()
        WHERE id=$3 AND status='active' RETURNING id`,
      [winnerId, tribute, war.id]
    );
    if (!flip.rowCount) return { ...war, status:'resolved' };

    await q('UPDATE tribes SET treasury = GREATEST(0, treasury - $1), losses = losses + 1 WHERE id=$2', [tribute, loserId]);
    await q('UPDATE tribes SET treasury = treasury + $1 + $2, wins = wins + 1 WHERE id=$3',
      [tribute, war.reward_ember, winnerId]);
    await q(
      `INSERT INTO ledger(tribe_id,kind,detail,ember) VALUES
        ($1,'war_tribute',$2,$3),
        ($4,'war_reward',$5,$6)`,
      [loserId, 'Paid tribute after defeat', -tribute,
       winnerId, 'Spoils of war + tribute', tribute + Number(war.reward_ember)]
    );
    war.status='resolved'; war.winner_id=winnerId; war.tribute=tribute;
    return war;
  }

  const flip = await q(
    `UPDATE wars SET status='resolved', winner_id=NULL, tribute=0, resolved_at=now()
      WHERE id=$1 AND status='active' RETURNING id`,
    [war.id]
  );
  if (!flip.rowCount) return { ...war, status:'resolved' };
  war.status='resolved'; war.winner_id=null; war.tribute=0;
  return war;
}