// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/arena.js
// PURPOSE: The PvP hub. Ranked duels, staked duels. Real player first,
//          Forgotten One fallback. Live match state.
// DEPENDS ON: db.js, config.js, games/index.js, rank.js, events.js,
//             economy.js, forgotten.js
// ═══════════════════════════════════════════════════════════════════
import { q } from './db.js';
import { CFG } from './config.js';
import { scoreGame, pickGameForArchetypeWeights, GAMES } from './games/index.js';
import { applyRankAfterMatch } from './rank.js';
import { emit } from './events.js';
import { addKinship } from './economy.js';
import * as Forgotten from './forgotten.js';

async function findRealOpponentWithTimeout(user, ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const r = await q(
      `SELECT id, first_name, username, rank_rating FROM users
        WHERE id <> $1 AND banned = false
          AND last_seen_at > now() - interval '2 minutes'
          AND ABS(rank_rating - $2) < 250
        ORDER BY random() LIMIT 1`,
      [user.id, user.rank_rating]
    );
    if (r.rows[0]) return r.rows[0];
    await new Promise((res) => setTimeout(res, 1500));
  }
  return null;
}

async function getRecentOpponentPlays(userId, n = 5) {
  const rows = (await q(
    `SELECT opponent_plays FROM forgotten_matches
      WHERE opponent_user_id=$1 AND archetype='choice'
      ORDER BY played_at DESC LIMIT $2`,
    [userId, n]
  )).rows;
  const plays = [];
  for (const r of rows) {
    if (Array.isArray(r.opponent_plays)) plays.push(...r.opponent_plays.slice(0, 3));
  }
  return plays.slice(0, n * 3);
}

export async function findRankedMatch(user, gameSlug = null) {
  if (!Number(CFG.duel_ranked_enabled)) throw new Error('ranked disabled');

  const game = gameSlug || pickGameForArchetypeWeights({
    reaction: Number(CFG.game_weight_reaction) || 30,
    memory: Number(CFG.game_weight_memory) || 25,
    choice: Number(CFG.game_weight_choice) || 20,
    sequence: Number(CFG.game_weight_sequence) || 15,
    deduction: Number(CFG.game_weight_deduction) || 10
  });

  const waitMs = Number(CFG.duel_real_player_wait_ms) || 15000;
  const realOpponent = await findRealOpponentWithTimeout(user, waitMs);

  if (realOpponent) {
    const duel = await q(
      `INSERT INTO duels (kind, opener_id, accepter_id, game_slug, status)
       VALUES ('ranked', $1, $2, $3, 'active') RETURNING id`,
      [user.id, realOpponent.id, game]
    );
    return {
      duel_id: duel.rows[0].id,
      game,
      opponent: {
        id: realOpponent.id,
        name: realOpponent.first_name || realOpponent.username,
        rank_rating: realOpponent.rank_rating,
        forgotten: false
      },
      opponent_type: 'player'
    };
  }

  if (!Number(CFG.forgotten_enabled)) throw new Error('no opponent available');

  const fo = await Forgotten.findOpponent(user.rank_rating, { spread: 200 });
  if (!fo) throw new Error('no opponent available');

  const signature = String(user.id);
  const opponentPlays = await getRecentOpponentPlays(user.id, 5);
  const decision = Forgotten.decidePlay(fo.style_profile, game, GAMES[game].archetype, signature);

  const duel = await q(
    `INSERT INTO duels (kind, opener_id, forgotten_opponent_id, game_slug, status, opponent_decision)
     VALUES ('ranked', $1, $2, $3, 'active', $4) RETURNING id`,
    [user.id, fo.id, game, JSON.stringify(decision)]
  );

  return {
    duel_id: duel.rows[0].id,
    game,
    opponent: {
      id: -fo.id,
      name: fo.name,
      rank_rating: fo.rank_rating,
      forgotten: true,
      personality_hint: hintFor(fo.personality)
    },
    opponent_type: 'forgotten',
    forgotten_id: fo.id,
    decision
  };
}

export async function resolveRankedDuel(user, duelId, payload) {
  const duel = (await q('SELECT * FROM duels WHERE id=$1', [duelId])).rows[0];
  if (!duel) throw new Error('no such duel');
  if (Number(duel.opener_id) !== Number(user.id)) throw new Error('not your duel');
  if (duel.status !== 'active') return { ok: true, status: duel.status, already: true };

  const playerScore = scoreGame(duel.game_slug, payload);

  let opponentScore, opponentId = null, forgottenId = null;
  if (duel.forgotten_opponent_id) {
    forgottenId = duel.forgotten_opponent_id;
    const fo = await Forgotten.getById(forgottenId);
    const dec = duel.opponent_decision || {};
    // Score the Forgotten One's decision through the same scorer
    switch (GAMES[duel.game_slug].archetype) {
      case 'reaction':   opponentScore = scoreGame(duel.game_slug, { times: dec.times || [] }); break;
      case 'memory':     opponentScore = scoreGame(duel.game_slug, dec); break;
      case 'choice':     opponentScore = scoreGame(duel.game_slug, { wins: dec.wins || 0, losses: dec.losses || 0 }); break;
      case 'sequence':   opponentScore = scoreGame(duel.game_slug, { chain_len: dec.chain_len || 0, won: !!dec.won }); break;
      case 'deduction':  opponentScore = scoreGame(duel.game_slug, { rounds_won: dec.rounds_won || 0, rounds_lost: dec.rounds_lost || 0 }); break;
      default:           opponentScore = Math.round(40 + Math.random() * 40);
    }
  } else {
    // Real player: server already had their score submitted separately. Here the opener's request wins if score above threshold.
    // Simplified: use threshold comparison.
    opponentScore = Math.round(45 + Math.random() * 30);
    opponentId = duel.accepter_id;
  }

  const playerWon = playerScore >= opponentScore;
  const winnerId = playerWon ? user.id : (opponentId || -forgottenId);
  const loserId = playerWon ? (opponentId || -forgottenId) : user.id;

  await q(
    `UPDATE duels SET status='resolved', winner_id=$1, loser_id=$2, resolved_at=now() WHERE id=$3`,
    [winnerId, loserId, duelId]
  );

  // Rank adjustment — Forgotten Ones use negative IDs so applyRankAfterMatch needs real IDs only
  const realWinner = playerWon ? user.id : null;
  const realLoser = playerWon ? null : user.id;

  if (realWinner) {
    await applyRankAfterMatch(realWinner, opponentId || user.id, 'ranked');
  } else if (realLoser) {
    await applyRankAfterMatch(opponentId || user.id, realLoser, 'ranked');
  }

  const kinshipWin = Number(CFG.rank_win_delta) || 25;
  const kinshipLoss = Math.floor(kinshipWin / 5);

  await q(
    `UPDATE users SET kinship = kinship + $1 WHERE id = $2`,
    [playerWon ? kinshipWin : kinshipLoss, user.id]
  );

  // Learn for Forgotten Ones
  if (forgottenId) {
    try {
      await Forgotten.recordMatch({
        forgottenId,
        opponentUserId: user.id,
        gameSlug: duel.game_slug,
        archetype: GAMES[duel.game_slug].archetype,
        won: !playerWon,
        matchData: { times: payload?.times || [] }
      });
    } catch (e) { console.warn('[arena] learn fail', e.message); }
  }

  await emit({
    userId: user.id,
    tier: 'toast',
    kind: playerWon ? 'duel_win' : 'duel_loss',
    title: playerWon ? 'Victory' : 'Defeat',
    body: `${playerScore} — ${opponentScore}`,
    icon: playerWon ? 'check' : 'bolt',
    severity: playerWon ? 'success' : 'warn'
  });

  return { ok: true, playerScore, opponentScore, won: playerWon };
}

export async function findStakedMatch(user, stakeSparks, gameSlug = null) {
  if (!Number(CFG.duel_staked_enabled)) throw new Error('staked disabled');
  const stake = Math.floor(Number(stakeSparks) || 0);
  const min = Number(CFG.duel_stake_min) || 50;
  const max = Number(CFG.duel_stake_max) || 5000;
  if (stake < min || stake > max) throw new Error(`stake must be ${min}-${max}`);
  if (Number(user.sparks) < stake) { const e = new Error('not enough Sparks'); e.need = stake; throw e; }

  const game = gameSlug || pickGameForArchetypeWeights({
    reaction: 30, memory: 25, choice: 20, sequence: 15, deduction: 10
  });

  await q('UPDATE users SET sparks = sparks - $1 WHERE id=$2', [stake, user.id]);
  const duel = (await q(
    `INSERT INTO duels (kind, opener_id, game_slug, stake_sparks, status)
     VALUES ('staked', $1, $2, $3, 'open') RETURNING id`,
    [user.id, game, stake]
  )).rows[0];
  return { duel_id: duel.id, game, stake };
}

export async function resolveStakedMatch(user, duelId, payload) {
  const duel = (await q('SELECT * FROM duels WHERE id=$1', [duelId])).rows[0];
  if (!duel) throw new Error('no such duel');
  if (duel.status !== 'active' && duel.status !== 'open') return { ok: true, status: duel.status };

  const playerScore = scoreGame(duel.game_slug, payload);
  const opponentScore = Math.round(45 + Math.random() * 30);
  const playerWon = playerScore >= opponentScore;

  const stake = Number(duel.stake_sparks) || 0;
  const burn = Math.floor(stake * (Number(CFG.duel_burn_pct) || 5) / 100);
  const payout = stake * 2 - burn;

  if (playerWon) {
    await q('UPDATE users SET sparks = sparks + $1 WHERE id=$2', [payout, user.id]);
  }

  await q(
    `UPDATE duels SET status='resolved', winner_id=$1, loser_id=$2, resolved_at=now() WHERE id=$3`,
    [playerWon ? user.id : 0, playerWon ? 0 : user.id, duelId]
  );

  await emit({
    userId: user.id,
    tier: 'toast',
    kind: playerWon ? 'duel_win' : 'duel_loss',
    title: playerWon ? 'Victory' : 'Defeat',
    body: playerWon ? `+${payout} Sparks` : `-${stake} Sparks`,
    icon: playerWon ? 'check' : 'bolt',
    severity: playerWon ? 'success' : 'danger'
  });

  return { ok: true, playerScore, opponentScore, won: playerWon, payout, burn };
}

export async function recentMatches(userId, limit = 10) {
  return (await q(
    `SELECT id, game_slug, winner_id, loser_id, stake_sparks, kind, resolved_at
       FROM duels
      WHERE (opener_id=$1 OR accepter_id=$1) AND status='resolved'
      ORDER BY resolved_at DESC LIMIT $2`,
    [userId, limit]
  )).rows;
}

function hintFor(personality) {
  switch (personality) {
    case 'aggressive': return 'plays fast';
    case 'cautious':   return 'waits';
    case 'erratic':    return 'unpredictable';
    case 'methodical': return 'studies you';
    case 'mimic':      return 'mirrors';
  }
  return null;
}