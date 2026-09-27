// TRIBES-FILE: server/src/spies.js
// PHASE: 6 — War
// Recon / sabotage missions + counter-spy shield.

import { q } from './db.js';
import { CFG } from './config.js';

function cfgNum(key, dflt) {
  const v = Number(CFG[key]);
  return isFinite(v) ? v : dflt;
}

function tuning() {
  return {
    cost:        cfgNum('spy_cost_ember', 2000),
    durationMin: cfgNum('spy_duration_min', 30),
    baseCatch:   cfgNum('spy_base_catch', 0.20),
    counterStep: cfgNum('spy_counter_step', 0.20),
    counterCost: cfgNum('spy_counter_cost', 1500),
    counterHrs:  cfgNum('spy_counter_hours', 12),
  };
}

async function tribeOf(userId) {
  return (await q('SELECT tribe_id FROM users WHERE id=$1', [userId])).rows[0]?.tribe_id || null;
}

export async function counterLevel(tribeId) {
  const r = (await q(
    'SELECT level, expires_at FROM tribe_counterspy WHERE tribe_id=$1',
    [tribeId]
  )).rows[0];
  if (!r) return 0;
  if (r.expires_at && new Date(r.expires_at).getTime() < Date.now()) return 0;
  return Number(r.level) || 0;
}

export async function launchSpy(user, targetTribeId, kind = 'recon') {
  const t = tuning();
  const mine = user.tribe_id || (await tribeOf(user.id));
  if (!mine) throw new Error('you must be in a tribe to send a spy');
  targetTribeId = Number(targetTribeId);
  if (!targetTribeId || targetTribeId === mine) throw new Error('pick a rival tribe');

  const tgt = (await q('SELECT id, name FROM tribes WHERE id=$1', [targetTribeId])).rows[0];
  if (!tgt) throw new Error('no such tribe');
  if (!['recon', 'sabotage'].includes(kind)) kind = 'recon';

  const busy = await q(
    "SELECT 1 FROM spy_missions WHERE spy_user=$1 AND status='active'",
    [user.id]
  );
  if (busy.rowCount) throw new Error('your spy is already in the field');

  const cost = t.cost * (kind === 'sabotage' ? 2 : 1);
  if (Number(user.ember || 0) < cost) {
    const e = new Error('not enough Ember');
    e.need = cost;
    throw e;
  }

  await q('UPDATE users SET ember = ember - $1 WHERE id=$2', [cost, user.id]);
  const resolvesAt = new Date(Date.now() + t.durationMin * 60000);
  const r = await q(
    `INSERT INTO spy_missions (attacker_tribe, target_tribe, spy_user, kind, status, resolves_at)
     VALUES ($1,$2,$3,$4,'active',$5) RETURNING id, resolves_at`,
    [mine, targetTribeId, user.id, kind, resolvesAt]
  );
  return {
    ok: true, mission_id: r.rows[0].id, resolves_at: r.rows[0].resolves_at,
    cost, kind, target: tgt.name,
  };
}

export async function raiseCounterSpy(user) {
  const t = tuning();
  const mine = user.tribe_id || (await tribeOf(user.id));
  if (!mine) throw new Error('you must be in a tribe');
  if (Number(user.ember || 0) < t.counterCost) {
    const e = new Error('not enough Ember');
    e.need = t.counterCost;
    throw e;
  }
  await q('UPDATE users SET ember = ember - $1 WHERE id=$2', [t.counterCost, user.id]);
  const expires = new Date(Date.now() + t.counterHrs * 3600000);
  const r = await q(
    `INSERT INTO tribe_counterspy (tribe_id, level, expires_at)
     VALUES ($1,1,$2)
     ON CONFLICT (tribe_id) DO UPDATE SET
       level = CASE WHEN tribe_counterspy.expires_at > now()
                    THEN LEAST(tribe_counterspy.level + 1, 3) ELSE 1 END,
       expires_at = $2
     RETURNING level, expires_at`,
    [mine, expires]
  );
  return { ok: true, level: r.rows[0].level, expires_at: r.rows[0].expires_at };
}

async function resolveOne(m) {
  const t = tuning();
  const lvl = await counterLevel(m.target_tribe);
  const catchChance = Math.min(0.95, t.baseCatch + lvl * t.counterStep);
  const caught = Math.random() < catchChance;

  if (caught) {
    await q("UPDATE spy_missions SET status='caught', resolved_at=now() WHERE id=$1", [m.id]);
    return { status: 'caught' };
  }

  const tribe = (await q(
    `SELECT t.name, t.treasury,
            (SELECT count(*)::int FROM users u WHERE u.tribe_id=t.id) AS members,
            (SELECT count(*)::int FROM wars w
              WHERE (w.attacker_id=t.id OR w.defender_id=t.id) AND w.status='active') AS in_war
       FROM tribes t WHERE t.id=$1`,
    [m.target_tribe]
  )).rows[0] || {};

  const intel = {
    tribe: tribe.name,
    treasury: Number(tribe.treasury || 0),
    members: Number(tribe.members || 0),
    at_war: Number(tribe.in_war || 0) > 0,
  };

  if (m.kind === 'sabotage') {
    const skim = Math.floor(Number(tribe.treasury || 0) * 0.05);
    if (skim > 0) {
      await q(
        'UPDATE tribes SET treasury = GREATEST(treasury - $1, 0) WHERE id=$2',
        [skim, m.target_tribe]
      );
    }
    intel.sabotaged = skim;
  }

  await q(
    "UPDATE spy_missions SET status='success', intel=$2::jsonb, resolved_at=now() WHERE id=$1",
    [m.id, JSON.stringify(intel)]
  );
  return { status: 'success', intel };
}

export async function resolveDueSpyMissions() {
  const due = (await q(
    "SELECT * FROM spy_missions WHERE status='active' AND resolves_at <= now() LIMIT 100"
  )).rows;
  for (const m of due) { try { await resolveOne(m); } catch {} }
  return due.length;
}

export async function spyState(user) {
  const mine = user.tribe_id || (await tribeOf(user.id));
  if (!mine) return { tribe: null, missions: [], incoming: [], counter: 0 };
  await resolveDueSpyMissions();
  const missions = (await q(
    `SELECT id, target_tribe, kind, status, intel, resolves_at, resolved_at,
            (SELECT name FROM tribes WHERE id=target_tribe) AS target_name
       FROM spy_missions WHERE attacker_tribe=$1
      ORDER BY created_at DESC LIMIT 20`,
    [mine]
  )).rows;
  const incoming = (await q(
    `SELECT id, kind, status, resolved_at,
            (SELECT name FROM tribes WHERE id=attacker_tribe) AS from_name
       FROM spy_missions WHERE target_tribe=$1 AND status='caught'
      ORDER BY resolved_at DESC LIMIT 10`,
    [mine]
  )).rows;
  return {
    tribe: mine,
    missions,
    incoming,
    counter: await counterLevel(mine),
    tuning: tuning(),
  };
}