// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/war.js
// PURPOSE: 5-minute wars. Three 90s rounds + breaks. Forgotten
//          substitution when real players go offline.
// DEPENDS ON: db.js, config.js, games/index.js, events.js, rank.js,
//             economy.js, forgotten.js
// ═══════════════════════════════════════════════════════════════════
import { q } from './db.js';
import { CFG, cfgJSON } from './config.js';
import { scoreGame, pickGameForTerrain, GAMES } from './games/index.js';
import { emit, emitTribe } from './events.js';
import { addKinship } from './economy.js';
import * as Forgotten from './forgotten.js';

const TERRAINS = ['plains', 'forest', 'ruins', 'ashlands', 'hills', 'swamp'];
const FRONT_NAMES = ['North', 'Center', 'South'];
const WAR_DURATION_MIN = 5; // total minutes including all rounds and breaks

function pickTerrain() {
  return TERRAINS[Math.floor(Math.random() * TERRAINS.length)];
}

function weightsForTerrain(terrain) {
  return cfgJSON(`terrain_${terrain}`, { reaction: 30, memory: 25, choice: 20, sequence: 15, deduction: 10 });
}

async function getOrCreateForgottenTribe() {
  const existing = (await q(
    'SELECT * FROM tribes WHERE forgotten=true ORDER BY random() LIMIT 1'
  )).rows[0];
  if (existing) return existing;
  const name = 'Forgotten Warband';
  return (await q(
    `INSERT INTO tribes (name, palette, banner, crest, forgotten, members, level)
     VALUES ($1, 'void', 'moon', 'skull', true, 8, 1) RETURNING *`, [name]
  )).rows[0];
}

export async function declareWar(user, tribe) {
  if (!Number(CFG.allow_war)) throw new Error('war has been sealed');
  if (!['Chief', 'Head', 'Elder'].includes(user.role)) throw new Error('only Elders+ may declare');

  const active = await q(
    `SELECT 1 FROM wars WHERE status='active' AND (attacker_id=$1 OR defender_id=$1)`,
    [tribe.id]
  );
  if (active.rowCount) throw new Error('your tribe is already at war');

  const cooldown = await q('SELECT war_cooldown_until FROM tribes WHERE id=$1', [tribe.id]);
  const cd = cooldown.rows[0]?.war_cooldown_until;
  if (cd && new Date(cd).getTime() > Date.now()) {
    const msLeft = new Date(cd).getTime() - Date.now();
    throw new Error(`war cooldown: ${Math.ceil(msLeft / 60000)} min left`);
  }

  const foe = (await q(
    `SELECT * FROM tribes
      WHERE id <> $1 AND forgotten = false
        AND (war_cooldown_until IS NULL OR war_cooldown_until < now())
        AND NOT EXISTS (SELECT 1 FROM wars WHERE status='active' AND (attacker_id=tribes.id OR defender_id=tribes.id))
      ORDER BY ABS(level - $2) ASC LIMIT 1`, [tribe.id, tribe.level]
  )).rows[0];

  const isForgotten = !foe;
  const opponent = foe || await getOrCreateForgottenTribe();

  const war = (await q(
    `INSERT INTO wars (attacker_id, defender_id, status, end_at, is_forgotten_opponent)
     VALUES ($1,$2,'active', now() + ($3 || ' minutes')::interval, $4) RETURNING *`,
    [tribe.id, opponent.id, String(WAR_DURATION_MIN), isForgotten]
  )).rows[0];

  const count = Number(CFG.war_front_count) || 3;
  for (let i = 0; i < count; i++) {
    await q(
      `INSERT INTO war_fronts (war_id, idx, name, terrain)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [war.id, i, FRONT_NAMES[i] || `Front ${i + 1}`, pickTerrain()]
    );
  }

  await emit({
    tribeId: tribe.id, tier: 'island', kind: 'war_declared',
    title: isForgotten ? 'The Forgotten have risen' : `War with ${opponent.name}`,
    body: `${WAR_DURATION_MIN} minutes · ${count} fronts`,
    icon: 'war-swords', severity: 'war', sticky: true,
    action_kind: 'war', action_data: { war_id: war.id }
  });

  return { war, opponent, isForgotten };
}

export async function getActiveWar(tribeId) {
  const war = (await q(
    `SELECT * FROM wars WHERE status='active' AND (attacker_id=$1 OR defender_id=$1)
      ORDER BY start_at DESC LIMIT 1`, [tribeId]
  )).rows[0];
  if (!war) return null;

  const fronts = (await q(
    'SELECT idx, name, terrain, attacker_score, defender_score FROM war_fronts WHERE war_id=$1 ORDER BY idx',
    [war.id]
  )).rows;

  const attacker = (await q('SELECT id, name, crest, level FROM tribes WHERE id=$1', [war.attacker_id])).rows[0];
  const defender = (await q('SELECT id, name, crest, level FROM tribes WHERE id=$1', [war.defender_id])).rows[0];

  const endsIn = new Date(war.end_at).getTime() - Date.now();
  const durationMs = Number(CFG.war_duration_minutes) * 60 * 1000;
  const elapsed = durationMs - Math.max(0, endsIn);

  let phase = 'opening';
  if (endsIn <= Number(CFG.war_tiebreaker_seconds) * 1000) phase = 'tiebreaker';
  else if (endsIn <= Number(CFG.war_final_5_seconds) * 1000) phase = 'final_5';
  else if (elapsed > durationMs / 3) phase = 'mid';

  if (war.intensity_phase !== phase) {
    await q('UPDATE wars SET intensity_phase=$1 WHERE id=$2', [phase, war.id]);
    war.intensity_phase = phase;
  }

  // Attach substitutions
  const subs = (await q(
    `SELECT user_id, forgotten_id, front_idx FROM war_substitutions
      WHERE war_id=$1 AND ended_at IS NULL`, [war.id]
  )).rows;

  return {
    war, fronts, attacker, defender, endsIn, phase,
    mine: Number(war.attacker_id) === Number(tribeId) ? 'attacker' : 'defender',
    substitutions: subs
  };
}

export async function resolveWarMatch(user, war, frontIdx, gameSlug, payload) {
  const front = (await q(
    'SELECT * FROM war_fronts WHERE war_id=$1 AND idx=$2', [war.id, frontIdx]
  )).rows[0];
  if (!front) throw new Error('no such front');

  const side = Number(war.attacker_id) === Number(user.tribe_id) ? 'attacker' : 'defender';
  const game = gameSlug || pickGameForTerrain(front.terrain, weightsForTerrain(front.terrain));

  const playerScore = scoreGame(game, payload);
  const opponentScore = Math.round(45 + Math.random() * 30);
  const won = playerScore >= opponentScore;

  const scoreCol = side === 'attacker' ? 'attacker_score' : 'defender_score';
  const points = won ? (Number(CFG.war_score_per_win) || 1) : 0;
  if (points > 0) {
    await q(`UPDATE war_fronts SET ${scoreCol} = ${scoreCol} + $1 WHERE war_id=$2 AND idx=$3`,
      [points, war.id, frontIdx]);
    await q(`UPDATE wars SET ${scoreCol} = ${scoreCol} + $1 WHERE id=$2`,
      [points, war.id]);
  }

  await q(
    `INSERT INTO war_matches (war_id, front_idx, game_slug, attacker_id, defender_id, winner_id, attacker_score, defender_score)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [war.id, frontIdx, game, user.id, null,
     won ? user.id : null, playerScore, opponentScore]
  );

  const kinship = won ? 25 : 5;
  await addKinship(user, kinship);

  await emit({
    tribeId: user.tribe_id, userId: user.id, tier: 'ticker',
    kind: won ? 'war_win' : 'war_loss',
    title: `${user.first_name || user.username} ${won ? 'won' : 'lost'}`,
    body: `${front.name} · ${playerScore} — ${opponentScore}`,
    icon: won ? 'check' : 'bolt',
    severity: won ? 'success' : 'warn',
    action_data: { target_id: user.id, front: front.name }
  });

  return { ok: true, won, playerScore, opponentScore, points, game, front: front.name, terrain: front.terrain };
}

export async function handleOfflineSubstitution(warId, userId, frontIdx) {
  const user = (await q('SELECT * FROM users WHERE id=$1', [userId])).rows[0];
  if (!user || !user.tribe_id) return null;

  const existing = (await q(
    `SELECT id FROM war_substitutions WHERE war_id=$1 AND user_id=$2 AND ended_at IS NULL`,
    [warId, userId]
  )).rows[0];
  if (existing) return null;

  const fo = await Forgotten.findForSubstitution(user.rank_rating || 1000);

  await q(
    `INSERT INTO war_substitutions (war_id, user_id, forgotten_id, front_idx)
     VALUES ($1,$2,$3,$4)`,
    [warId, userId, fo.id, frontIdx]
  );

  await q(
    'UPDATE forgotten_ones SET last_substituted_at=now() WHERE id=$1',
    [fo.id]
  );

  await emit({
    tribeId: user.tribe_id, tier: 'ticker', kind: 'substitution',
    title: `${user.first_name} went offline`,
    body: `A Forgotten One steps in on ${FRONT_NAMES[frontIdx] || 'a front'}`,
    icon: 'bolt', severity: 'warn',
    action_data: { target_id: userId, front_idx: frontIdx }
  });

  return fo;
}

export async function handleReturn(warId, userId) {
  const sub = (await q(
    `SELECT id FROM war_substitutions
      WHERE war_id=$1 AND user_id=$2 AND ended_at IS NULL`,
    [warId, userId]
  )).rows[0];
  if (!sub) return;
  await q('UPDATE war_substitutions SET ended_at=now() WHERE id=$1', [sub.id]);
  const user = (await q('SELECT tribe_id, first_name FROM users WHERE id=$1', [userId])).rows[0];
  if (user?.tribe_id) {
    await emit({
      tribeId: user.tribe_id, tier: 'ticker', kind: 'return',
      title: `${user.first_name} is back`,
      body: 'Resumes their post',
      icon: 'check', severity: 'success'
    });
  }
}

export async function resolveWarIfDue() {
  const now = new Date();
  const due = (await q(
    `SELECT * FROM wars WHERE status='active' AND end_at <= $1`, [now]
  )).rows;

  for (const war of due) {
    const fronts = (await q(
      'SELECT * FROM war_fronts WHERE war_id=$1 ORDER BY idx', [war.id]
    )).rows;

    let aWins = 0, dWins = 0, aTotal = 0, dTotal = 0;
    for (const f of fronts) {
      aTotal += Number(f.attacker_score);
      dTotal += Number(f.defender_score);
      if (f.attacker_score > f.defender_score) aWins++;
      else if (f.defender_score > f.attacker_score) dWins++;
    }
    let winnerId;
    if (aWins > dWins) winnerId = war.attacker_id;
    else if (dWins > aWins) winnerId = war.defender_id;
    else winnerId = aTotal >= dTotal ? war.attacker_id : war.defender_id;

    await q(
      `UPDATE wars SET status='resolved', winner_id=$1, resolved_at=now(),
              attacker_score=$2, defender_score=$3 WHERE id=$4`,
      [winnerId, aTotal, dTotal, war.id]
    );

    const cooldownMin = Number(CFG.war_cooldown_minutes) || 60;
    await q(
      `UPDATE tribes SET war_cooldown_until = now() + ($1 || ' minutes')::interval,
              wins = wins + CASE WHEN id=$2 THEN 1 ELSE 0 END,
              losses = losses + CASE WHEN id=$2 THEN 0 ELSE 1 END
        WHERE id IN ($3, $4)`,
      [String(cooldownMin), winnerId, war.attacker_id, war.defender_id]
    );

    await emit({
      tribeId: war.attacker_id, tier: 'island', kind: 'war_ended',
      title: winnerId === war.attacker_id ? 'Victory' : 'Defeat',
      body: `${aTotal} — ${dTotal}`,
      icon: winnerId === war.attacker_id ? 'check' : 'bolt',
      severity: winnerId === war.attacker_id ? 'success' : 'danger',
      sticky: true, action_kind: 'war'
    });
    await emit({
      tribeId: war.defender_id, tier: 'island', kind: 'war_ended',
      title: winnerId === war.defender_id ? 'Victory' : 'Defeat',
      body: `${dTotal} — ${aTotal}`,
      icon: winnerId === war.defender_id ? 'check' : 'bolt',
      severity: winnerId === war.defender_id ? 'success' : 'danger',
      sticky: true, action_kind: 'war'
    });
  }

  return due.length;
}

export async function detectOfflineSubstitutes() {
  const offlineSec = Number(CFG.forgotten_offline_seconds) || 120;
  const activeWars = (await q(
    `SELECT id, attacker_id, defender_id FROM wars WHERE status='active'`
  )).rows;

  for (const war of activeWars) {
    // Find real players on either tribe who have not been seen recently
    const players = (await q(
      `SELECT u.id, u.rank_rating FROM users u
        WHERE u.tribe_id IN ($1, $2)
          AND u.banned = false
          AND u.last_seen_at < now() - ($3 || ' seconds')::interval
          AND NOT EXISTS (
            SELECT 1 FROM war_substitutions ws
             WHERE ws.war_id=$4 AND ws.user_id=u.id AND ws.ended_at IS NULL
          )`,
      [war.attacker_id, war.defender_id, String(offlineSec), war.id]
    )).rows;

    for (const p of players) {
      try { await handleOfflineSubstitution(war.id, p.id, 0); }
      catch (e) { console.warn('[war] sub fail', e.message); }
    }
  }
}

export async function warTick() {
  const out = { resolved: 0, substituted: 0 };
  try {
    out.substituted = await detectOfflineSubstitutes();
    out.resolved = await resolveWarIfDue();
  } catch (e) { console.warn('[warTick]', e.message); }
  return out;
}