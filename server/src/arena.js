import { q } from './db.js';
import { CFG } from './config.js';
import { applyRankAfterMatch } from './rank.js';
import { emit } from './events.js';
import * as Forgotten from './forgotten.js';

export async function findRankedMatch(user, gameSlug = null) {
  const game = gameSlug || 'rune_match';
  // Wait up to 15s for a real player
  const realOpponent = await findRealOpponentWithTimeout(user, 15000);
  if (realOpponent) {
    const duel = (await q(
      `INSERT INTO duels (kind, opener_id, accepter_id, game_slug, status)
       VALUES ('ranked', $1, $2, $3, 'active') RETURNING id`,
      [user.id, realOpponent.id, game]
    )).rows[0];
    return {
      duel_id: duel.id, game,
      opponent: {
        id: realOpponent.id,
        name: realOpponent.first_name || realOpponent.username,
        rank_rating: realOpponent.rank_rating,
        forgotten: false
      },
      opponent_type: 'player'
    };
  }
  // Fall back to a Forgotten One
  const fo = await Forgotten.findOpponent(user.rank_rating, 200);
  if (!fo) throw new Error('No opponent available');
  const duel = (await q(
    `INSERT INTO duels (kind, opener_id, game_slug, status)
     VALUES ('ranked', $1, $2, 'active') RETURNING id`,
    [user.id, game]
  )).rows[0];
  return {
    duel_id: duel.id, game,
    opponent: {
      id: -fo.id,
      name: fo.name,
      rank_rating: fo.rank_rating,
      forgotten: true,
      personality: fo.personality
    },
    opponent_type: 'forgotten',
    forgotten_id: fo.id
  };
}

async function findRealOpponentWithTimeout(user, ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const r = await q(
      `SELECT id, first_name, username, rank_rating FROM users
       WHERE id <> $1 AND banned = false
       AND last_checkin > now() - interval '2 days'
       AND ABS(rank_rating - $2) < 200
       ORDER BY random() LIMIT 1`,
      [user.id, user.rank_rating]
    );
    if (r.rows[0]) return r.rows[0];
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

export async function resolveRankedDuel(user, duelId, payload) {
  const duel = (await q('SELECT * FROM duels WHERE id=$1', [duelId])).rows[0];
  if (!duel) throw new Error('no such duel');
  if (Number(duel.opener_id) !== Number(user.id)) throw new Error('not your duel');
  if (duel.status !== 'active') return { ok: true, status: duel.status };
  const score = Number(payload.score) || 0;
  const opponentScore = Number(payload.opponent_score) || 0;
  const won = score > opponentScore;
  const winnerId = won ? duel.opener_id : duel.accepter_id;
  const loserId = won ? (duel.accepter_id || null) : duel.opener_id;
  await q(
    `UPDATE duels SET status='resolved', winner_id=$1, loser_id=$2, resolved_at=now() WHERE id=$3`,
    [winnerId, loserId, duelId]
  );
  if (winnerId && loserId) {
    await applyRankAfterMatch(winnerId, loserId, 'ranked');
  }
  await emit({
    userId: user.id, tier: 'toast', kind: won ? 'duel_win' : 'duel_loss',
    title: won ? 'Victory' : 'Defeat',
    body: `Score: ${score}`,
    icon: won ? 'check' : 'bolt', severity: won ? 'success' : 'warn'
  });
  // Record for Forgotten learning if applicable
  if (duel.accepter_id && duel.accepter_id < 0) {
    const foId = -duel.accepter_id;
    await Forgotten.recordMatch({
      forgottenId: foId, opponentUserId: user.id,
      gameSlug: duel.game_slug, archetype: payload.archetype || 'reaction',
      won: !won, opponentPlays: payload.opponent_plays || null,
      matchData: payload.match_data || null
    });
  }
  return { ok: true, score, won };
}

export async function recentMatches(userId, limit = 10) {
  return (await q(
    `SELECT id, game_slug, winner_id, loser_id, stake_sparks, kind, resolved_at
     FROM duels
     WHERE (opener_id=$1 OR accepter_id=$1) AND status='resolved'
     ORDER BY resolved_at DESC LIMIT $2`, [userId, limit]
  )).rows;
}