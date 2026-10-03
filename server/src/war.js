import { q } from './db.js';
import { CFG, cfgJSON } from './config.js';
import { emit, emitTribe } from './events.js';
import * as Forgotten from './forgotten.js';

const TERRAINS = ['plains', 'forest', 'ruins', 'ashlands', 'hills', 'swamp'];

function pickTerrain() {
  return TERRAINS[Math.floor(Math.random() * TERRAINS.length)];
}

export async function declareWar(user, tribe) {
  if (!Number(CFG.allow_war)) throw new Error('war has been sealed');
  if (!['Chief', 'Head', 'Elder', 'Warlord', 'Keeper'].includes(user.role)) {
    throw new Error('only leaders may declare');
  }
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
  let opponent;
  if (foe) opponent = foe;
  else {
    opponent = (await q(
      `INSERT INTO tribes (name, palette, banner, crest, forgotten, members, level)
       VALUES ($1, 'void', 'moon', 'skull', true, 8, 1) RETURNING *`,
      ['Forgotten ' + ['Kharuk','Vorak','Tumek','Arnok'][Math.floor(Math.random()*4)]]
    )).rows[0];
  }
  const duration = Number(CFG.war_duration_minutes) || 5;
  const war = (await q(
    `INSERT INTO wars (attacker_id, defender_id, status, end_at, is_forgotten_opponent)
     VALUES ($1,$2,'active', now() + ($3 || ' minutes')::interval, $4) RETURNING *`,
    [tribe.id, opponent.id, String(duration), isForgotten]
  )).rows[0];
  const count = Number(CFG.war_front_count) || 3;
  const names = ['North', 'Center', 'South'];
  for (let i = 0; i < count; i++) {
    await q(
      `INSERT INTO war_fronts (war_id, idx, name, terrain)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [war.id, i, names[i] || `Front ${i + 1}`, pickTerrain()]
    );
  }
  await emitTribe(tribe.id, {
    tier: 'island', kind: 'war_declared',
    title: isForgotten ? `The Forgotten have risen` : `War with ${opponent.name}`,
    body: `${duration} minutes · ${count} fronts`,
    icon: 'swords', severity: 'war', sticky: true,
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
  const attacker = (await q('SELECT id, name, level FROM tribes WHERE id=$1', [war.attacker_id])).rows[0];
  const defender = (await q('SELECT id, name, level FROM tribes WHERE id=$1', [war.defender_id])).rows[0];
  const endsIn = new Date(war.end_at).getTime() - Date.now();
  const durationMs = Number(CFG.war_duration_minutes) * 60 * 1000;
  const elapsed = durationMs - Math.max(0, endsIn);
  let phase = 'opening';
  if (endsIn <= 30000) phase = 'tiebreaker';
  else if (endsIn <= Number(CFG.war_final_5_seconds || 30) * 1000) phase = 'final_5';
  else if (elapsed > durationMs / 3) phase = 'mid';
  if (war.intensity_phase !== phase) {
    await q('UPDATE wars SET intensity_phase=$1 WHERE id=$2', [phase, war.id]);
    war.intensity_phase = phase;
  }
  const subs = (await q(
    `SELECT ws.user_id, ws.forgotten_id, ws.front_idx, fo.name AS forgotten_name
     FROM war_substitutions ws
     JOIN forgotten_ones fo ON fo.id = ws.forgotten_id
     WHERE ws.war_id=$1 AND ws.ended_at IS NULL`, [war.id]
  )).rows;
  return {
    war, fronts, attacker, defender, endsIn, phase,
    mine: Number(war.attacker_id) === Number(tribeId) ? 'attacker' : 'defender',
    substitutions: subs
  };
}

export async function handleOfflineSubstitution(warId, userId, frontIdx) {
  const user = (await q('SELECT * FROM users WHERE id=$1', [userId])).rows[0];
  if (!user || !user.tribe_id) return;
  const existing = (await q(
    'SELECT 1 FROM war_substitutions WHERE war_id=$1 AND user_id=$2 AND ended_at IS NULL',
    [warId, userId]
  )).rows[0];
  if (existing) return;
  const fo = await Forgotten.findForSubstitution(user.rank_rating);
  await q(
    `INSERT INTO war_substitutions (war_id, user_id, forgotten_id, front_idx)
     VALUES ($1,$2,$3,$4)`,
    [warId, userId, fo.id, frontIdx]
  );
  const war = (await q('SELECT attacker_id, defender_id FROM wars WHERE id=$1', [warId])).rows[0];
  const enemyTribeId = Number(war.attacker_id) === Number(user.tribe_id) ? war.defender_id : war.attacker_id;
  await emitTribe(user.tribe_id, {
    tier: 'ticker', kind: 'substitution',
    title: `${user.first_name || user.username} went offline`,
    body: `A Forgotten One steps in`,
    icon: 'bolt', severity: 'warn'
  });
  await emitTribe(enemyTribeId, {
    tier: 'ticker', kind: 'substitution',
    title: `Enemy fighter offline`,
    body: `A substitute now fights`,
    icon: 'eye', severity: 'info'
  });
}

export async function handleReturn(warId, userId) {
  const sub = (await q(
    'SELECT * FROM war_substitutions WHERE war_id=$1 AND user_id=$2 AND ended_at IS NULL',
    [warId, userId]
  )).rows[0];
  if (!sub) return;
  await q('UPDATE war_substitutions SET ended_at=now() WHERE id=$1', [sub.id]);
  const user = (await q('SELECT first_name, username, tribe_id FROM users WHERE id=$1', [userId])).rows[0];
  if (user?.tribe_id) {
    await emitTribe(user.tribe_id, {
      tier: 'ticker', kind: 'return',
      title: `${user.first_name || user.username} is back`,
      body: `Resumes their post`,
      icon: 'check', severity: 'success'
    });
  }
}

export async function resolveWarMatch(user, war, frontIdx, gameSlug, payload) {
  const front = (await q(
    'SELECT * FROM war_fronts WHERE war_id=$1 AND idx=$2', [war.id, frontIdx]
  )).rows[0];
  if (!front) throw new Error('no such front');
  const side = Number(war.attacker_id) === Number(user.tribe_id) ? 'attacker' : 'defender';
  const score = payload.score || 0;
  const opponentScore = payload.opponent_score || 0;
  const won = score > opponentScore;
  const scoreCol = side === 'attacker' ? 'attacker_score' : 'defender_score';
  const points = won ? (Number(CFG.war_score_per_win) || 1) : 0;
  if (points > 0) {
    await q(`UPDATE war_fronts SET ${scoreCol} = ${scoreCol} + $1 WHERE war_id=$2 AND idx=$3`,
      [points, war.id, frontIdx]);
  }
  await q(
    `INSERT INTO war_matches (war_id, front_idx, game_slug, attacker_id, defender_id, winner_id, duration_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [war.id, frontIdx, gameSlug, user.id, payload.opponent_id || null, won ? user.id : null, payload.duration_ms || 0]
  );
  if (won) {
    await emit({
      tribeId: user.tribe_id, userId: user.id, tier: 'ticker', kind: 'war_win',
      title: `${user.first_name || user.username} won`,
      body: `${front.name} +${points}`,
      icon: 'check', severity: 'success',
      action_data: { target_id: user.id, front: front.name }
    });
  }
  return { ok: true, won, score, points, front: front.name };
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
    let winnerId = null;
    if (aWins > dWins) winnerId = war.attacker_id;
    else if (dWins > aWins) winnerId = war.defender_id;
    else winnerId = aTotal >= dTotal ? war.attacker_id : war.defender_id;
    await q(
      `UPDATE wars SET status='resolved', winner_id=$1, resolved_at=now(),
       attacker_score=$2, defender_score=$3 WHERE id=$4`,
      [winnerId, aTotal, dTotal, war.id]
    );
    const cooldownMin = Number(CFG.war_cooldown_minutes) || 10;
    await q(
      `UPDATE tribes SET war_cooldown_until = now() + ($1 || ' minutes')::interval,
       wins = wins + CASE WHEN id=$2 THEN 1 ELSE 0 END,
       losses = losses + CASE WHEN id=$2 THEN 0 ELSE 1 END
       WHERE id IN ($3, $4)`,
      [String(cooldownMin), winnerId, war.attacker_id, war.defender_id]
    );
    await emitTribe(war.attacker_id, {
      tier: 'island', kind: 'war_ended',
      title: winnerId === war.attacker_id ? 'Victory' : 'Defeat',
      body: `${aTotal} — ${dTotal}`,
      icon: winnerId === war.attacker_id ? 'check' : 'bolt',
      severity: winnerId === war.attacker_id ? 'success' : 'danger',
      sticky: true, action_kind: 'war'
    });
    await emitTribe(war.defender_id, {
      tier: 'island', kind: 'war_ended',
      title: winnerId === war.defender_id ? 'Victory' : 'Defeat',
      body: `${dTotal} — ${aTotal}`,
      icon: winnerId === war.defender_id ? 'check' : 'bolt',
      severity: winnerId === war.defender_id ? 'success' : 'danger',
      sticky: true, action_kind: 'war'
    });
  }
  return due.length;
}

export async function warTick() {
  const out = { resolved: 0 };
  try { out.resolved = await resolveWarIfDue(); }
  catch (e) { console.warn('[warTick]', e.message); }
  return out;
}