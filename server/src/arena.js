import { q } from './db.js';
import { CFG } from './config.js';
import { scoreGame, pickGameForArchetypeWeights } from './games/index.js';
import { applyRankAfterMatch } from './rank.js';
import { emit } from './events.js';
import { addKinship } from './economy.js';
import { getOrCreateArenaBot, botScoreFor, recordHumanScore, isBot } from './botplayer.js';

export async function findRankedMatch(user, gameSlug = null) {
  const game = gameSlug || pickGameForArchetypeWeights({
    reaction: Number(CFG.game_weight_reaction) || 30,
    memory: Number(CFG.game_weight_memory) || 25,
    choice: Number(CFG.game_weight_choice) || 20,
    sequence: Number(CFG.game_weight_sequence) || 15,
    deduction: Number(CFG.game_weight_deduction) || 10
  });

  const opponent = (await q(
    `SELECT id, first_name, username, rank_rating FROM users
      WHERE id <> $1 AND banned = false
        AND COALESCE(is_bot, false) = false
        AND last_checkin > now() - interval '2 days'
      ORDER BY ABS(rank_rating - (SELECT rank_rating FROM users WHERE id=$1)) ASC
      LIMIT 1`, [user.id]
  )).rows[0];

  // No live human in range → drop in a learning ember-spirit bot so the player
  // always gets a ranked fight.
  if (!opponent) {
    const bot = await getOrCreateArenaBot(user.rank_rating || 1000);
    const duel = (await q(
      `INSERT INTO duels (kind, opener_id, accepter_id, game_slug, status)
       VALUES ('ranked', $1, $2, $3, 'active') RETURNING id`,
      [user.id, bot.id, game]
    )).rows[0];
    return {
      duel_id: duel.id,
      game,
      opponent: {
        id: bot.id,
        first_name: bot.first_name,
        username: bot.username,
        rank_rating: Number(bot.rank_rating || 1000),
        is_bot: true,
      },
      is_bot: true,
    };
  }

  const duel = (await q(
    `INSERT INTO duels (kind, opener_id, accepter_id, game_slug, status)
     VALUES ('ranked', $1, $2, $3, 'active') RETURNING id`,
    [user.id, opponent.id, game]
  )).rows[0];

  return { duel_id: duel.id, game, opponent };
}

export async function resolveRankedDuel(user, duelId, payload) {
  const duel = (await q('SELECT * FROM duels WHERE id=$1', [duelId])).rows[0];
  if (!duel) throw new Error('no such duel');
  if (Number(duel.opener_id) !== Number(user.id)) throw new Error('not your duel');
  if (duel.status !== 'active') return { ok: true, status: duel.status };

  const score = scoreGame(duel.game_slug, payload);

  // Every real human result teaches the bot skill model for this game.
  try { await recordHumanScore(duel.game_slug, score); } catch { /* non-fatal */ }

  // Against a bot the opponent actually "plays": its score is drawn from the
  // learned human distribution and the rating gap. Against a human we keep the
  // original random threshold so existing head-to-head behaviour is unchanged.
  let threshold;
  let botTurn = null;
  if (await isBot(duel.accepter_id)) {
    const human = (await q('SELECT rank_rating FROM users WHERE id=$1', [duel.opener_id])).rows[0];
    const bot = (await q('SELECT rank_rating FROM users WHERE id=$1', [duel.accepter_id])).rows[0];
    botTurn = await botScoreFor(
      duel.game_slug,
      bot?.rank_rating || 1000,
      human?.rank_rating || 1000
    );
    threshold = botTurn.score;
  } else {
    threshold = 50 + Math.floor(Math.random() * 20);
  }
  const won = score >= threshold;
  const winnerId = won ? duel.opener_id : duel.accepter_id;
  const loserId = won ? duel.accepter_id : duel.opener_id;

  await q(
    `UPDATE duels SET status='resolved', winner_id=$1, loser_id=$2, resolved_at=now() WHERE id=$3`,
    [winnerId, loserId, duelId]
  );
  await applyRankAfterMatch(winnerId, loserId, 'ranked');

  const kinshipWin = Number(CFG.rank_win_delta) || 25;
  const kinshipLoss = Math.floor(kinshipWin / 5);
  await addKinship({ id: winnerId }, kinshipWin);
  await addKinship({ id: loserId }, kinshipLoss);

  await emit({
    userId: winnerId, tier: 'toast', kind: 'duel_win',
    title: 'Victory', body: `+${kinshipWin} Kinship`,
    icon: 'check', severity: 'success'
  });
  await emit({
    userId: loserId, tier: 'toast', kind: 'duel_loss',
    title: 'Defeat', body: `+${kinshipLoss} Kinship`,
    icon: 'bolt', severity: 'warn'
  });

  return { ok: true, score, won, threshold, opponent_score: threshold, bot: botTurn };
}

export async function findStakedMatch(user, stakeSparks, gameSlug = null) {
  if (!Number(CFG.duel_staked_enabled)) throw new Error('staked duels disabled');
  const stake = Math.floor(Number(stakeSparks) || 0);
  const min = Number(CFG.duel_stake_min) || 50;
  const max = Number(CFG.duel_stake_max) || 5000;
  if (stake < min || stake > max) throw new Error(`stake must be ${min}-${max}`);
  if (Number(user.sparks) < stake) { const e = new Error('not enough Sparks'); e.need = stake; throw e; }

  const game = gameSlug || pickGameForArchetypeWeights({
    reaction: Number(CFG.game_weight_reaction) || 30,
    memory: Number(CFG.game_weight_memory) || 25,
    choice: Number(CFG.game_weight_choice) || 20,
    sequence: Number(CFG.game_weight_sequence) || 15,
    deduction: Number(CFG.game_weight_deduction) || 10
  });

  await q('UPDATE users SET sparks = sparks - $1 WHERE id=$2', [stake, user.id]);
  const duel = (await q(
    `INSERT INTO duels (kind, opener_id, game_slug, stake_sparks, status)
     VALUES ('staked', $1, $2, $3, 'open') RETURNING id`,
    [user.id, game, stake]
  )).rows[0];

  return { duel_id: duel.id, game, stake };
}

export async function acceptStakedMatch(user, duelId) {
  const duel = (await q('SELECT * FROM duels WHERE id=$1 AND status=$2', [duelId, 'open'])).rows[0];
  if (!duel) throw new Error('duel unavailable');
  if (Number(duel.opener_id) === Number(user.id)) throw new Error('cannot accept your own duel');
  if (Number(user.sparks) < Number(duel.stake_sparks)) {
    const e = new Error('not enough Sparks'); e.need = duel.stake_sparks; throw e;
  }
  await q('UPDATE users SET sparks = sparks - $1 WHERE id=$2', [duel.stake_sparks, user.id]);
  await q('UPDATE duels SET accepter_id=$1, status=$2 WHERE id=$3',
    [user.id, 'active', duelId]);
  return { ok: true, duel: { ...duel, accepter_id: user.id, status: 'active' } };
}

export async function resolveStakedMatch(user, duelId, payload) {
  const duel = (await q('SELECT * FROM duels WHERE id=$1', [duelId])).rows[0];
  if (!duel) throw new Error('no such duel');
  if (Number(duel.opener_id) !== Number(user.id) && Number(duel.accepter_id) !== Number(user.id)) {
    throw new Error('not your duel');
  }
  if (duel.status !== 'active') return { ok: true, status: duel.status };

  const score = scoreGame(duel.game_slug, payload);
  const threshold = 50 + Math.floor(Math.random() * 20);
  const openerWon = score >= threshold;
  const winnerId = openerWon ? duel.opener_id : duel.accepter_id;
  const loserId = openerWon ? duel.accepter_id : duel.opener_id;
  const stake = Number(duel.stake_sparks) || 0;
  const burn = Math.floor(stake * (Number(CFG.duel_burn_pct) || 5) / 100);
  const payout = stake * 2 - burn;

  await q('UPDATE users SET sparks = sparks + $1 WHERE id=$2', [payout, winnerId]);
  await q(
    `UPDATE duels SET status='resolved', winner_id=$1, loser_id=$2, resolved_at=now() WHERE id=$3`,
    [winnerId, loserId, duelId]
  );
  await applyRankAfterMatch(winnerId, loserId, 'staked');

  await emit({
    userId: winnerId, tier: 'toast', kind: 'duel_win',
    title: 'Victory', body: `+${payout} Sparks`,
    icon: 'check', severity: 'success'
  });
  await emit({
    userId: loserId, tier: 'toast', kind: 'duel_loss',
    title: 'Defeat', body: `-${stake} Sparks`,
    icon: 'bolt', severity: 'danger'
  });

  return { ok: true, score, won: openerWon, payout, burn };
}

export async function recentMatches(userId, limit = 10) {
  return (await q(
    `SELECT id, game_slug, winner_id, loser_id, stake_sparks, kind, resolved_at
       FROM duels
      WHERE (opener_id=$1 OR accepter_id=$1) AND status='resolved'
      ORDER BY resolved_at DESC LIMIT $2`, [userId, limit]
  )).rows;
}