// TRIBES-FILE: server/src/council.js
// PHASE: 5 — Council & Kiva
// Warband roles, Moot tallies, Tribe Idol, Charm loadouts.

import { q } from './db.js';
import { CFG } from './config.js';

export const POSITIONS = ['chieftain', 'warlord', 'shaman', 'warrior'];

/* ---------- eligibility ---------- */
export function eligible(u) {
  return Number(u.streak) >= 3 || Number(u.renown) >= 300;
}

/* ---------- warband seats ---------- */
export function slotsForLevel(level) {
  return Math.max(3, Math.min(12, 3 + Math.floor((Number(level) || 1) / 2)));
}

/* ---------- current Moot ---------- */
export async function openMoot(tribe, byUser) {
  const open = await q(
    'SELECT 1 FROM musters WHERE tribe_id=$1 AND status=$2',
    [tribe.id, 'open']
  );
  if (open.rowCount) throw new Error('a Moot is already open');

  const slots = Math.min(slotsForLevel(tribe.level), Number(tribe.level) * 4);
  const r = await q(
    `INSERT INTO musters (tribe_id, slots, opened_by, closes_at)
     VALUES ($1,$2,$3, now() + interval '24 hours') RETURNING *`,
    [tribe.id, slots, byUser.id]
  );
  return r.rows[0];
}

export async function voteMoot(tribe, user, candidateId, position) {
  if (!eligible(user)) throw new Error('You must prove your loyalty (3-day streak or 300 renown) to vote.');
  const m = (await q(
    "SELECT * FROM musters WHERE tribe_id=$1 AND status='open' ORDER BY opened_at DESC LIMIT 1",
    [tribe.id]
  )).rows[0];
  if (!m) throw new Error('no Moot is open');

  const cand = (await q(
    'SELECT id, tribe_id, streak, renown FROM users WHERE id=$1',
    [candidateId]
  )).rows[0];
  if (!cand || Number(cand.tribe_id) !== Number(tribe.id)) {
    throw new Error('candidate is not in your tribe');
  }
  if (!eligible(cand)) throw new Error('candidate is not battle-ready yet');

  const pos = POSITIONS.includes(position) ? position : 'warrior';

  const mine = (await q(
    'SELECT COUNT(*)::int AS n FROM muster_votes WHERE muster_id=$1 AND voter_id=$2',
    [m.id, user.id]
  )).rows[0].n;
  const already = await q(
    'SELECT 1 FROM muster_votes WHERE muster_id=$1 AND voter_id=$2 AND candidate_id=$3',
    [m.id, user.id, candidateId]
  );
  if (!already.rowCount && mine >= m.slots) {
    throw new Error(`you may back up to ${m.slots} kin`);
  }

  await q(
    `INSERT INTO muster_votes (muster_id, voter_id, candidate_id, position)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (muster_id, voter_id, candidate_id) DO UPDATE
       SET position=EXCLUDED.position`,
    [m.id, user.id, candidateId, pos]
  );
  return { ok: true };
}

export async function closeMoot(tribe, byUser) {
  const m = (await q(
    "SELECT * FROM musters WHERE tribe_id=$1 AND status='open' ORDER BY opened_at DESC LIMIT 1",
    [tribe.id]
  )).rows[0];
  if (!m) throw new Error('no Moot is open');

  const tally = (await q(
    `SELECT candidate_id,
            COUNT(*)::int AS votes,
            MODE() WITHIN GROUP (ORDER BY position) AS position
       FROM muster_votes WHERE muster_id=$1
      GROUP BY candidate_id ORDER BY votes DESC`,
    [m.id]
  )).rows;

  await q('DELETE FROM war_roles WHERE tribe_id=$1', [tribe.id]);

  if (tribe.created_by) {
    await q(
      `INSERT INTO war_roles (tribe_id, user_id, position)
       VALUES ($1,$2,'chieftain')
       ON CONFLICT (tribe_id, user_id) DO UPDATE SET position='chieftain'`,
      [tribe.id, tribe.created_by]
    );
  }

  let seated = 0;
  for (const t of tally) {
    if (Number(t.candidate_id) === Number(tribe.created_by)) continue;
    if (seated >= m.slots) break;
    const pos = (POSITIONS.includes(t.position) && t.position !== 'chieftain')
      ? t.position
      : 'warrior';
    await q(
      `INSERT INTO war_roles (tribe_id, user_id, position)
       VALUES ($1,$2,$3)
       ON CONFLICT (tribe_id, user_id) DO UPDATE SET position=EXCLUDED.position`,
      [tribe.id, t.candidate_id, pos]
    );
    seated++;
  }

  await q("UPDATE musters SET status='closed', closed_at=now() WHERE id=$1", [m.id]);
  return { seated: seated + (tribe.created_by ? 1 : 0) };
}

export async function mootState(tribe) {
  const m = (await q(
    "SELECT * FROM musters WHERE tribe_id=$1 AND status='open' ORDER BY opened_at DESC LIMIT 1",
    [tribe.id]
  )).rows[0];
  if (!m) return null;

  const members = (await q(
    'SELECT id, first_name, username, renown, streak FROM users WHERE tribe_id=$1',
    [tribe.id]
  )).rows;
  const tally = (await q(
    `SELECT candidate_id, position, COUNT(*)::int AS votes
       FROM muster_votes WHERE muster_id=$1
      GROUP BY candidate_id, position`,
    [m.id]
  )).rows;

  const candidates = members.map((mm) => {
    const v = tally.filter((t) => Number(t.candidate_id) === Number(mm.id));
    return {
      id: mm.id,
      name: mm.first_name || mm.username || 'Kin',
      renown: Number(mm.renown),
      streak: Number(mm.streak),
      eligible: eligible(mm),
      votes: v.reduce((s, x) => s + x.votes, 0),
    };
  }).sort((a, b) => b.votes - a.votes || b.renown - a.renown);

  return { id: m.id, slots: m.slots, closes_at: m.closes_at, candidates };
}

export async function rolesFor(tribeId) {
  return (await q(
    `SELECT r.user_id, r.position, u.first_name, u.username, u.renown, u.streak
       FROM war_roles r
       JOIN users u ON u.id=r.user_id
      WHERE r.tribe_id=$1
      ORDER BY CASE r.position
        WHEN 'chieftain' THEN 0
        WHEN 'warlord'   THEN 1
        WHEN 'shaman'    THEN 2
        ELSE 3 END, u.renown DESC`,
    [tribeId]
  )).rows;
}

/* ---------- Tribe Idol ---------- */
export async function getOrCreateIdol(tribeId) {
  let r = await q('SELECT * FROM tribe_idols WHERE tribe_id=$1', [tribeId]);
  if (!r.rowCount) {
    await q(
      'INSERT INTO tribe_idols (tribe_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [tribeId]
    );
    r = await q('SELECT * FROM tribe_idols WHERE tribe_id=$1', [tribeId]);
  }
  return r.rows[0];
}

export async function forgeIdol(tribeId, userId, amount) {
  const amt = Math.max(1, Math.floor(Number(amount) || 0));
  if (!amt) throw new Error('offer some Ember');

  const fresh = (await q('SELECT ember FROM users WHERE id=$1', [userId])).rows[0];
  if (Number(fresh.ember) < amt) throw new Error('not enough Ember');

  const idol = await getOrCreateIdol(tribeId);

  await q('UPDATE users SET ember = ember - $1 WHERE id=$2', [amt, userId]);
  await q(
    `INSERT INTO idol_contributions (tribe_id, user_id, amount)
     VALUES ($1,$2,$3)
     ON CONFLICT (tribe_id, user_id) DO UPDATE
       SET amount = idol_contributions.amount + $3`,
    [tribeId, userId, amt]
  );

  let progress = Number(idol.forge_progress) + amt;
  let tier = idol.tier, goal = Number(idol.forge_goal), buff = Number(idol.buff_value), state = idol.state;

  while (progress >= goal) {
    progress -= goal;
    tier += 1;
    buff = Math.round((buff + 0.05) * 1000) / 1000;
    goal = Math.round(goal * 1.6);
    state = 'blazing';
  }

  await q(
    `UPDATE tribe_idols
        SET forge_progress=$1, forge_goal=$2, tier=$3, buff_value=$4,
            state=$5, updated_at=now()
      WHERE tribe_id=$6`,
    [progress, goal, tier, buff, state, tribeId]
  );

  return { tier, forge_progress: progress, forge_goal: goal, buff_value: buff };
}

/* ---------- Charm loadout (3 slots) ---------- */
export async function setLoadout(userId, slots) {
  const list = Array.isArray(slots) ? slots.slice(0, 3) : [];
  await q('DELETE FROM relic_loadouts WHERE user_id=$1', [userId]);

  let i = 0;
  for (const rid of list) {
    const id = Number(rid);
    if (!id) { i++; continue; }
    const owns = await q(
      'SELECT 1 FROM user_relics WHERE user_id=$1 AND relic_id=$2',
      [userId, id]
    );
    if (!owns.rowCount) throw new Error('you do not hold that charm');
    await q(
      `INSERT INTO relic_loadouts (user_id, slot_index, relic_id)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id, slot_index) DO UPDATE SET relic_id=EXCLUDED.relic_id`,
      [userId, i, id]
    );
    i++;
  }
  return { slots: i };
}

export async function getLoadout(userId) {
  return (await q(
    `SELECT l.slot_index, l.relic_id, r.slug, r.name, r.rarity, r.category, r.cursed
       FROM relic_loadouts l
       JOIN relics r ON r.id = l.relic_id
      WHERE l.user_id=$1
      ORDER BY l.slot_index`,
    [userId]
  )).rows;
}