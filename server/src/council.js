/* =====================================================================
   WAR COUNCIL — roles, the Muster (vote), Tribe Idols, War Might,
   Charm loadouts and active relics.
   Mounted under /api/council by routes.js AFTER the auth middleware,
   so req.user is always set. Every handler is defensive: if the
   council migration has not run yet it returns {available:false}
   instead of throwing, so the app never breaks.
===================================================================== */
import express from 'express';
import { q } from './db.js';
import { momentumFor, tribeScore } from './war.js';

export const council = express.Router();

const POSITIONS = ['chieftain', 'warlord', 'warrior', 'shaman'];

/* eligibility to be mustered into the warband */
function eligible(u){
  return Number(u.streak) >= 3 || Number(u.loyalty) >= 300;
}
/* warband seats scale with tribe level (3..12) */
function slotsForLevel(level){
  return Math.max(3, Math.min(12, 3 + Math.floor((Number(level) || 1) / 2)));
}

async function tableExists(name){
  try {
    const r = await q(`SELECT to_regclass($1) AS t`, ['public.' + name]);
    return !!(r.rows[0] && r.rows[0].t);
  } catch { return false; }
}

async function tribeRow(id){
  return (await q('SELECT * FROM tribes WHERE id=$1', [id])).rows[0] || null;
}
async function currentWarRow(tribeId){
  const r = await q(
    `SELECT * FROM wars WHERE (attacker_id=$1 OR defender_id=$1)
      ORDER BY (status='active') DESC, start_at DESC LIMIT 1`, [tribeId]
  );
  return r.rows[0] || null;
}

/* ---- Tribe Idol: fetch or lazily create ---- */
async function getIdol(tribeId){
  let r = await q('SELECT * FROM tribe_idols WHERE tribe_id=$1', [tribeId]);
  if (!r.rowCount){
    await q('INSERT INTO tribe_idols (tribe_id) VALUES ($1) ON CONFLICT DO NOTHING', [tribeId]);
    r = await q('SELECT * FROM tribe_idols WHERE tribe_id=$1', [tribeId]);
  }
  return r.rows[0];
}

/* ---- live idol state from the current war ---- */
async function idolState(tribeId, idol){
  const war = await currentWarRow(tribeId);
  if (war && war.status === 'active'){
    try {
      const mine = await tribeScore(war.id, war.attacker_id === tribeId ? 'attacker' : 'defender');
      const foeSide = war.attacker_id === tribeId ? 'defender' : 'attacker';
      const foe = await tribeScore(war.id, foeSide);
      return (Number(mine) >= Number(foe)) ? 'blazing' : 'cracking';
    } catch { return 'blazing'; }
  }
  return idol.state === 'shattered' ? 'shattered' : 'dormant';
}

/* ---- War Might ---- */
async function computeMight(tribe){
  const tribeId = tribe.id;
  // warband = role holders; fall back to all members at reduced weight
  let holders = [];
  if (await tableExists('war_roles')){
    holders = (await q(
      `SELECT u.id, u.first_name, u.username, u.loyalty, u.streak, r.position
         FROM war_roles r JOIN users u ON u.id=r.user_id
        WHERE r.tribe_id=$1`, [tribeId]
    )).rows;
  }
  const mustered = holders.length > 0;
  let roster = holders;
  let weight = 1;
  if (!mustered){
    roster = (await q(
      `SELECT id, first_name, username, loyalty, streak FROM users WHERE tribe_id=$1`, [tribeId]
    )).rows;
    weight = 0.5; // un-mustered kin fight at half strength
  }
  let warband = 0;
  for (const m of roster){
    warband += weight * (1 + Number(m.loyalty) / 1000 + Number(m.streak) * 0.02);
  }
  warband = Math.round(warband * 100) / 100;

  // relic bonus = equipped passive charms of the roster
  let relicBonus = 0;
  if (roster.length && await tableExists('relic_loadouts')){
    const ids = roster.map(m => Number(m.id));
    const rb = await q(
      `SELECT COALESCE(SUM(r.buff_value),0) AS b
         FROM relic_loadouts l JOIN relics r ON r.id=l.relic_id
        WHERE l.user_id = ANY($1) AND r.kind='passive'`, [ids]
    );
    relicBonus = Math.round(Number(rb.rows[0].b) * 1000) / 1000;
  }

  // idol buff
  let idolBuff = 0, idol = null;
  if (await tableExists('tribe_idols')){
    idol = await getIdol(tribeId);
    const st = await idolState(tribeId, idol);
    idolBuff = st === 'shattered' ? 0 : Number(idol.buff_value);
    idol._state = st;
  }

  // morale from live momentum
  let morale = 1;
  const war = await currentWarRow(tribeId);
  if (war && war.status === 'active'){
    try {
      const m = await momentumFor(war.id);
      const mine = m.find(x => Number(x.tribe_id) === Number(tribeId));
      const foe  = m.find(x => Number(x.tribe_id) !== Number(tribeId));
      const mt = mine ? Number(mine.tokens) : 0;
      const ft = foe ? Number(foe.tokens) : 0;
      const tot = Math.max(1, mt + ft);
      morale = 0.9 + 0.3 * (mt / tot); // 0.9 .. 1.2
    } catch {}
  }
  morale = Math.round(morale * 1000) / 1000;

  const total = Math.round(warband * (1 + relicBonus + idolBuff) * morale);
  return {
    total, warband, relicBonus, idolBuff, morale,
    mustered, roster_size: roster.length,
    idol: idol ? {
      name: idol.name, tier: idol.tier, state: idol._state,
      forge_progress: Number(idol.forge_progress), forge_goal: Number(idol.forge_goal),
      buff_value: Number(idol.buff_value),
    } : null,
  };
}

/* ================= STATE ================= */
council.get('/state', async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ available:true, in_tribe:false });
  if (!(await tableExists('war_roles')))
    return res.json({ available:false, hint:'council migration pending' });

  const tribe = await tribeRow(u.tribe_id);
  const isLeader = ['Chief','Head','Elder'].includes(u.role) || Number(tribe.created_by) === Number(u.id);

  const roles = (await q(
    `SELECT r.user_id, r.position, u.first_name, u.username, u.loyalty, u.streak
       FROM war_roles r JOIN users u ON u.id=r.user_id
      WHERE r.tribe_id=$1 ORDER BY
        CASE r.position WHEN 'chieftain' THEN 0 WHEN 'warlord' THEN 1 WHEN 'shaman' THEN 2 ELSE 3 END,
        u.loyalty DESC`, [u.tribe_id]
  )).rows;
  const myRole = roles.find(r => Number(r.user_id) === Number(u.id));

  // open muster (if any)
  const mrow = (await q(
    `SELECT * FROM musters WHERE tribe_id=$1 AND status='open' ORDER BY opened_at DESC LIMIT 1`,
    [u.tribe_id]
  )).rows[0] || null;

  let muster = null;
  if (mrow){
    const members = (await q(
      `SELECT id, first_name, username, loyalty, streak FROM users WHERE tribe_id=$1`, [u.tribe_id]
    )).rows;
    const tally = (await q(
      `SELECT candidate_id, position, COUNT(*)::int AS votes
         FROM muster_votes WHERE muster_id=$1 GROUP BY candidate_id, position`, [mrow.id]
    )).rows;
    const myVotes = (await q(
      `SELECT candidate_id, position FROM muster_votes WHERE muster_id=$1 AND voter_id=$2`,
      [mrow.id, u.id]
    )).rows;
    const candidates = members.map(m => {
      const v = tally.filter(t => Number(t.candidate_id) === Number(m.id));
      return {
        id: m.id, name: m.first_name || m.username || 'Kin',
        loyalty: Number(m.loyalty), streak: Number(m.streak),
        eligible: eligible(m),
        votes: v.reduce((s,x) => s + x.votes, 0),
      };
    }).sort((a,b) => b.votes - a.votes || b.loyalty - a.loyalty);
    muster = {
      id: mrow.id, slots: mrow.slots, closes_at: mrow.closes_at,
      candidates, my_votes: myVotes,
    };
  }

  const might = await computeMight(tribe);

  // my charms + loadout
  let myCharms = [], myLoadout = [];
  if (await tableExists('relic_loadouts')){
    myCharms = (await q(
      `SELECT r.id, r.slug, r.name, r.rarity, r.domain, r.kind, r.buff_type, r.buff_value,
              r.war_effect, r.cooldown_min, r.icon_file, ur.count
         FROM user_relics ur JOIN relics r ON r.id=ur.relic_id
        WHERE ur.user_id=$1 ORDER BY r.kind DESC, r.rarity`, [u.id]
    )).rows;
    myLoadout = (await q(
      `SELECT slot_index, relic_id FROM relic_loadouts WHERE user_id=$1 ORDER BY slot_index`, [u.id]
    )).rows;
  }

  res.json({
    available:true, in_tribe:true, is_leader:isLeader,
    my_eligible: eligible(u), my_position: myRole ? myRole.position : null,
    slots_cap: slotsForLevel(tribe.level),
    roles: roles.map(r => ({
      user_id:r.user_id, position:r.position,
      name:r.first_name || r.username || 'Kin', loyalty:Number(r.loyalty), streak:Number(r.streak),
    })),
    muster, might,
    my_charms: myCharms, my_loadout: myLoadout,
  });
} catch(e){ next(e); } });

/* ================= MUSTER: open ================= */
council.post('/muster/open', async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'join a tribe first' });
  const tribe = await tribeRow(u.tribe_id);
  const isLeader = ['Chief','Head','Elder'].includes(u.role) || Number(tribe.created_by) === Number(u.id);
  if (!isLeader) return res.status(403).json({ error:'only the Chieftain or Elders can call a Muster' });

  const open = (await q(
    `SELECT 1 FROM musters WHERE tribe_id=$1 AND status='open'`, [u.tribe_id]
  ));
  if (open.rowCount) return res.status(400).json({ error:'a Muster is already open' });

  const slots = Math.min(slotsForLevel(tribe.level), Math.max(1, Number(req.body?.slots) || slotsForLevel(tribe.level)));
  const m = (await q(
    `INSERT INTO musters (tribe_id, slots, opened_by, closes_at)
     VALUES ($1,$2,$3, now() + interval '24 hours') RETURNING *`,
    [u.tribe_id, slots, u.id]
  )).rows[0];
  res.json({ ok:true, muster_id:m.id, slots:m.slots, closes_at:m.closes_at });
} catch(e){ next(e); } });

/* ================= MUSTER: vote ================= */
council.post('/muster/vote', async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'join a tribe first' });
  if (!eligible(u)) return res.status(403).json({ error:'You must prove your loyalty (3-day streak or 300 loyalty) to vote.' });

  const mrow = (await q(
    `SELECT * FROM musters WHERE tribe_id=$1 AND status='open' ORDER BY opened_at DESC LIMIT 1`,
    [u.tribe_id]
  )).rows[0];
  if (!mrow) return res.status(400).json({ error:'no Muster is open' });

  const candidateId = Number(req.body?.candidateId);
  const position = POSITIONS.includes(req.body?.position) ? req.body.position : 'warrior';
  if (!candidateId) return res.status(400).json({ error:'pick a candidate' });
  const cand = (await q('SELECT id, tribe_id, streak, loyalty FROM users WHERE id=$1', [candidateId])).rows[0];
  if (!cand || Number(cand.tribe_id) !== Number(u.tribe_id))
    return res.status(400).json({ error:'candidate is not in your tribe' });
  if (!eligible(cand)) return res.status(400).json({ error:'candidate is not battle-ready yet' });

  // one vote per position slot: cap votes per voter to the muster slots
  const mine = (await q('SELECT COUNT(*)::int AS n FROM muster_votes WHERE muster_id=$1 AND voter_id=$2', [mrow.id, u.id])).rows[0].n;
  const already = (await q('SELECT 1 FROM muster_votes WHERE muster_id=$1 AND voter_id=$2 AND candidate_id=$3', [mrow.id, u.id, candidateId])).rowCount;
  if (!already && mine >= mrow.slots)
    return res.status(400).json({ error:`you may back up to ${mrow.slots} kin` });

  await q(
    `INSERT INTO muster_votes (muster_id, voter_id, candidate_id, position)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (muster_id, voter_id, candidate_id) DO UPDATE SET position=EXCLUDED.position`,
    [mrow.id, u.id, candidateId, position]
  );
  res.json({ ok:true });
} catch(e){ next(e); } });

/* ================= MUSTER: close (tally -> assign roles) ================= */
council.post('/muster/close', async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'join a tribe first' });
  const tribe = await tribeRow(u.tribe_id);
  const isLeader = ['Chief','Head','Elder'].includes(u.role) || Number(tribe.created_by) === Number(u.id);
  if (!isLeader) return res.status(403).json({ error:'only the Chieftain or Elders can seal a Muster' });

  const mrow = (await q(
    `SELECT * FROM musters WHERE tribe_id=$1 AND status='open' ORDER BY opened_at DESC LIMIT 1`,
    [u.tribe_id]
  )).rows[0];
  if (!mrow) return res.status(400).json({ error:'no Muster is open' });

  // tally: total votes per candidate + their most-backed position
  const tally = (await q(
    `SELECT candidate_id,
            COUNT(*)::int AS votes,
            MODE() WITHIN GROUP (ORDER BY position) AS position
       FROM muster_votes WHERE muster_id=$1
      GROUP BY candidate_id ORDER BY votes DESC`, [mrow.id]
  )).rows;

  // wipe old warband, then seat the winners
  await q('DELETE FROM war_roles WHERE tribe_id=$1', [u.tribe_id]);
  // chieftain is always the founder
  if (tribe.created_by){
    await q(
      `INSERT INTO war_roles (tribe_id, user_id, position) VALUES ($1,$2,'chieftain')
       ON CONFLICT (tribe_id, user_id) DO UPDATE SET position='chieftain'`,
      [u.tribe_id, tribe.created_by]
    );
  }
  let seated = 0; const cap = mrow.slots;
  for (const t of tally){
    if (Number(t.candidate_id) === Number(tribe.created_by)) continue;
    if (seated >= cap) break;
    const pos = POSITIONS.includes(t.position) && t.position !== 'chieftain' ? t.position : 'warrior';
    await q(
      `INSERT INTO war_roles (tribe_id, user_id, position) VALUES ($1,$2,$3)
       ON CONFLICT (tribe_id, user_id) DO UPDATE SET position=EXCLUDED.position`,
      [u.tribe_id, t.candidate_id, pos]
    );
    seated++;
  }
  await q(`UPDATE musters SET status='closed', closed_at=now() WHERE id=$1`, [mrow.id]);
  res.json({ ok:true, seated: seated + (tribe.created_by ? 1 : 0) });
} catch(e){ next(e); } });

/* ================= CHARM loadout ================= */
council.post('/loadout', async (req, res, next) => { try {
  const u = req.user;
  const slots = Array.isArray(req.body?.slots) ? req.body.slots.slice(0, 3) : [];
  await q('DELETE FROM relic_loadouts WHERE user_id=$1', [u.id]);
  let i = 0;
  for (const rid of slots){
    const id = Number(rid);
    if (!id) { i++; continue; }
    const owns = (await q('SELECT 1 FROM user_relics WHERE user_id=$1 AND relic_id=$2', [u.id, id])).rowCount;
    if (!owns) return res.status(400).json({ error:'you do not hold that charm' });
    await q(
      `INSERT INTO relic_loadouts (user_id, slot_index, relic_id) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, slot_index) DO UPDATE SET relic_id=EXCLUDED.relic_id`,
      [u.id, i, id]
    );
    i++;
  }
  res.json({ ok:true, slots: i });
} catch(e){ next(e); } });

/* ================= Forge / repair the Tribe Idol ================= */
council.post('/idol/forge', async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'join a tribe first' });
  const amount = Math.max(1, Math.floor(Number(req.body?.amount) || 0));
  if (!amount) return res.status(400).json({ error:'offer some Ember to the Idol' });

  const fresh = (await q('SELECT ember FROM users WHERE id=$1', [u.id])).rows[0];
  if (Number(fresh.ember) < amount) return res.status(400).json({ error:'not enough Ember' });

  const idol = await getIdol(u.tribe_id);
  await q('UPDATE users SET ember = ember - $1 WHERE id=$2', [amount, u.id]);
  await q(
    `INSERT INTO idol_contributions (tribe_id, user_id, amount) VALUES ($1,$2,$3)
     ON CONFLICT (tribe_id, user_id) DO UPDATE SET amount = idol_contributions.amount + $3`,
    [u.tribe_id, u.id, amount]
  );

  let progress = Number(idol.forge_progress) + amount;
  let tier = idol.tier, goal = Number(idol.forge_goal), buff = Number(idol.buff_value), state = idol.state;
  while (progress >= goal){
    progress -= goal;
    tier += 1;
    buff = Math.round((buff + 0.05) * 1000) / 1000;
    goal = Math.round(goal * 1.6);
    state = 'blazing';
  }
  await q(
    `UPDATE tribe_idols SET forge_progress=$1, forge_goal=$2, tier=$3, buff_value=$4,
            state=$5, updated_at=now() WHERE tribe_id=$6`,
    [progress, goal, tier, buff, state, u.tribe_id]
  );
  res.json({ ok:true, tier, forge_progress:progress, forge_goal:goal, buff_value:buff });
} catch(e){ next(e); } });

/* ================= Fire an ACTIVE relic during war ================= */
council.post('/relic/fire', async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'join a tribe first' });
  const relicId = Number(req.body?.relicId);
  const relic = (await q(`SELECT * FROM relics WHERE id=$1 AND kind='active'`, [relicId])).rows[0];
  if (!relic) return res.status(400).json({ error:'not an active relic' });
  const owns = (await q('SELECT 1 FROM user_relics WHERE user_id=$1 AND relic_id=$2', [u.id, relicId])).rowCount;
  if (!owns) return res.status(400).json({ error:'you do not hold that relic' });

  const war = await currentWarRow(u.tribe_id);
  if (!war || war.status !== 'active') return res.status(400).json({ error:'no active war' });

  // cooldown
  const cd = Number(relic.cooldown_min) || 0;
  if (cd){
    const last = (await q(
      `SELECT used_at FROM relic_uses WHERE user_id=$1 AND relic_id=$2 ORDER BY used_at DESC LIMIT 1`,
      [u.id, relicId]
    )).rows[0];
    if (last){
      const elapsedMin = (Date.now() - new Date(last.used_at).getTime()) / 60000;
      if (elapsedMin < cd)
        return res.status(400).json({ error:`still recharging \u2014 ${Math.ceil(cd - elapsedMin)}m left` });
    }
  }
  await q('INSERT INTO relic_uses (user_id, relic_id, war_id) VALUES ($1,$2,$3)', [u.id, relicId, war.id]);
  res.json({
    ok:true, effect: relic.war_effect, name: relic.name, domain: relic.domain,
    value: Number(relic.buff_value), by: u.first_name || u.username || 'A kin',
  });
} catch(e){ next(e); } });
