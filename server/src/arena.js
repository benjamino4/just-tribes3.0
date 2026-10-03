import { q } from './db.js';
import { CFG } from './config.js';
import { applyRankAfterMatch } from './rank.js';
import { emit } from './events.js';
import * as Forgotten from './forgotten.js';

// Games the live web client can actually host, by slug.
const PLAYABLE_SLUGS = [
  'rune_match', 'stone_stack', 'fireflies',
  'ember_reflex', 'rite_of_hands', 'three_masks'
];

// The SERVER decides which game is played — never the client. Returns a random
// active, playable game slug (falls back to the built-in pool if the DB is thin).
export async function pickRandomGame() {
  try {
    const r = await q(
      `SELECT slug FROM game_defs
       WHERE active = true AND slug = ANY($1::text[])
       ORDER BY random() LIMIT 1`,
      [PLAYABLE_SLUGS]
    );
    if (r.rows[0]) return r.rows[0].slug;
  } catch { /* fall through to constant pool */ }
  return PLAYABLE_SLUGS[Math.floor(Math.random() * PLAYABLE_SLUGS.length)];
}

// Authoritative AI target score (0–100) the opponent will reach this match.
// Scales with the rating gap; Forgotten Ones are ~70% strength per the spec so
// humans win the majority of their Forgotten matches (<45% Forgotten win-rate).
export function computeAiTarget(playerRating, oppRating, forgotten) {
  const diff = (Number(oppRating) || 1000) - (Number(playerRating) || 1000);
  let base = 52 + diff / 25;
  base += Math.random() * 16 - 8;
  if (forgotten) base *= 0.7;
  return Math.max(8, Math.min(92, Math.round(base)));
}

export async function findRankedMatch(user) {
  // Server picks the game at random — the client no longer chooses.
  const game = await pickRandomGame();
  // Wait up to 15s for a real player
  const realOpponent = await findRealOpponentWithTimeout(user, 15000);
  if (realOpponent) {
    const target = computeAiTarget(user.rank_rating, realOpponent.rank_rating, false);
    const duel = (await q(
      `INSERT INTO duels (kind, opener_id, accepter_id, game_slug, status,
         opponent_score, opponent_rating, opponent_name)
       VALUES ('ranked', $1, $2, $3, 'active', $4, $5, $6) RETURNING id`,
      [user.id, realOpponent.id, game, target, realOpponent.rank_rating,
       realOpponent.first_name || realOpponent.username || 'Rival']
    )).rows[0];
    return {
      duel_id: duel.id, game,
      opponent: {
        id: realOpponent.id,
        name: realOpponent.first_name || realOpponent.username,
        rank_rating: realOpponent.rank_rating,
        target_score: target,
        forgotten: false
      },
      opponent_type: 'player'
    };
  }
  // Fall back to a Forgotten One
  const fo = await Forgotten.findOpponent(user.rank_rating, 200);
  if (!fo) throw new Error('No opponent available');
  const target = computeAiTarget(user.rank_rating, fo.rank_rating, true);
  const duel = (await q(
    `INSERT INTO duels (kind, opener_id, accepter_id, game_slug, status,
       opponent_score, opponent_rating, opponent_name)
     VALUES ('ranked', $1, $2, $3, 'active', $4, $5, $6) RETURNING id`,
    [user.id, -fo.id, game, target, fo.rank_rating, fo.name]
  )).rows[0];
  return {
    duel_id: duel.id, game,
    opponent: {
      id: -fo.id,
      name: fo.name,
      rank_rating: fo.rank_rating,
      target_score: target,
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
  // The opponent score is authoritative on the server (set at matchmaking from
  // rank). We never trust a client-sent opponent score. Legacy duels without a
  // stored value fall back to the client echo for backward compatibility.
  const opponentScore = duel.opponent_score != null
    ? Number(duel.opponent_score)
    : (Number(payload.opponent_score) || 0);
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
    body: `You ${score} — ${opponentScore} ${duel.opponent_name || 'Opponent'}`,
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