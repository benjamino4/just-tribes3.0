import { q, pool } from './db.js';
import { CFG } from './config.js';
import { adjustSelf } from './rank.js';
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

function displayName(u) {
  return u.first_name || u.username || 'Kin';
}

/* =============================================================== Ranked queue
 * Real-time matchmaking. A player who taps "Find a fight" is enqueued and then
 * polls. On every find/poll we try to pair two humans who are BOTH searching
 * (closest rating first). If nobody shows up within mm_bot_fallback_sec we fall
 * back to a Forgotten One bot so the player is never left hanging. */

async function cleanupQueue() {
  const staleSec = Number(CFG.mm_stale_sec) || 120;
  try {
    await q(
      `DELETE FROM matchmaking_queue
       WHERE (status='searching' AND updated_at < now() - ($1 || ' seconds')::interval)
          OR (status='matched'  AND updated_at < now() - interval '5 minutes')`,
      [String(staleSec)]
    );
  } catch { /* best-effort */ }
}

// Build the two mirror-duels for a human-vs-human pairing and mark both queue
// rows matched, atomically. Returns the match payload for `me`, or null if no
// other searcher was available.
async function tryPairRanked(me) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mine = (await client.query(
      `SELECT * FROM matchmaking_queue WHERE user_id=$1 AND status='searching' FOR UPDATE`,
      [me.id]
    )).rows[0];
    if (!mine) { await client.query('ROLLBACK'); return null; }
    const window = Number(CFG.mm_rating_window) || 250;
    const other = (await client.query(
      `SELECT * FROM matchmaking_queue
       WHERE mode='ranked' AND status='searching' AND user_id <> $1
       ORDER BY ABS(rank_rating - $2) ASC, enqueued_at ASC
       FOR UPDATE SKIP LOCKED LIMIT 1`,
      [me.id, mine.rank_rating]
    )).rows[0];
    if (!other) { await client.query('COMMIT'); return null; }

    const game = await pickRandomGame();
    const targetForMe = computeAiTarget(mine.rank_rating, other.rank_rating, false);
    const targetForOther = computeAiTarget(other.rank_rating, mine.rank_rating, false);

    const myDuel = (await client.query(
      `INSERT INTO duels (kind, mode, opener_id, accepter_id, game_slug, status,
         opponent_score, opponent_rating, opponent_name)
       VALUES ('ranked','ranked',$1,$2,$3,'active',$4,$5,$6) RETURNING id`,
      [me.id, other.user_id, game, targetForMe, other.rank_rating, other.display_name]
    )).rows[0];
    const otherDuel = (await client.query(
      `INSERT INTO duels (kind, mode, opener_id, accepter_id, game_slug, status,
         opponent_score, opponent_rating, opponent_name)
       VALUES ('ranked','ranked',$1,$2,$3,'active',$4,$5,$6) RETURNING id`,
      [other.user_id, me.id, game, targetForOther, mine.rank_rating, mine.display_name]
    )).rows[0];

    const myOpp = { id: other.user_id, name: other.display_name, rank_rating: other.rank_rating, target_score: targetForMe, forgotten: false };
    const otherOpp = { id: me.id, name: mine.display_name, rank_rating: mine.rank_rating, target_score: targetForOther, forgotten: false };

    await client.query(
      `UPDATE matchmaking_queue SET status='matched', matched_duel_id=$2, opponent_json=$3, game_slug=$4, updated_at=now() WHERE user_id=$1`,
      [me.id, myDuel.id, JSON.stringify(myOpp), game]
    );
    await client.query(
      `UPDATE matchmaking_queue SET status='matched', matched_duel_id=$2, opponent_json=$3, game_slug=$4, updated_at=now() WHERE user_id=$1`,
      [other.user_id, otherDuel.id, JSON.stringify(otherOpp), game]
    );
    await client.query('COMMIT');

    // Nudge the other player's client so their poll resolves promptly.
    emit({
      userId: other.user_id, tier: 'toast', kind: 'match_found',
      title: 'Opponent found', body: `Facing ${mine.display_name}`,
      icon: 'bolt', severity: 'info'
    }).catch(() => {});

    return { duel_id: myDuel.id, game, opponent: myOpp, opponent_type: 'player' };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function createBotDuel(user, kind = 'ranked') {
  const game = await pickRandomGame();
  const fo = await Forgotten.findOpponent(user.rank_rating, 200);
  if (!fo) throw new Error('No opponent available');
  const target = computeAiTarget(user.rank_rating, fo.rank_rating, true);
  const duel = (await q(
    `INSERT INTO duels (kind, mode, opener_id, accepter_id, game_slug, status,
       opponent_score, opponent_rating, opponent_name)
     VALUES ($1,'ranked',$2,$3,$4,'active',$5,$6,$7) RETURNING id`,
    [kind, user.id, -fo.id, game, target, fo.rank_rating, fo.name]
  )).rows[0];
  return {
    duel_id: duel.id, game,
    opponent: {
      id: -fo.id, name: fo.name, rank_rating: fo.rank_rating,
      target_score: target, forgotten: true, personality: fo.personality
    },
    opponent_type: 'forgotten', forgotten_id: fo.id
  };
}

// Enqueue the player and attempt an immediate pairing. Returns either a match
// (status 'matched') or a 'searching' ticket the client then polls.
export async function findRankedMatch(user) {
  await cleanupQueue();
  await q(
    `INSERT INTO matchmaking_queue (user_id, mode, rank_rating, display_name, status, enqueued_at, updated_at)
     VALUES ($1,'ranked',$2,$3,'searching',now(),now())
     ON CONFLICT (user_id) DO UPDATE SET
       mode='ranked', rank_rating=$2, display_name=$3, status='searching',
       matched_duel_id=NULL, opponent_json=NULL, game_slug=NULL,
       enqueued_at=now(), updated_at=now()`,
    [user.id, user.rank_rating, displayName(user)]
  );
  const paired = await tryPairRanked(user);
  if (paired) {
    await q(`DELETE FROM matchmaking_queue WHERE user_id=$1`, [user.id]);
    return { status: 'matched', ...paired };
  }
  return { status: 'searching', wait_sec: 0, bot_fallback_sec: Number(CFG.mm_bot_fallback_sec) || 45 };
}

// Called repeatedly by the searching client (~every 2s).
export async function pollRankedMatch(user) {
  await cleanupQueue();
  let mine = (await q(`SELECT * FROM matchmaking_queue WHERE user_id=$1`, [user.id])).rows[0];
  // If our row was swept (e.g. stale) but the client is still polling, re-enqueue
  // so the player keeps searching instead of silently dropping out.
  if (!mine) {
    await q(
      `INSERT INTO matchmaking_queue (user_id, mode, rank_rating, display_name, status, enqueued_at, updated_at)
       VALUES ($1,'ranked',$2,$3,'searching',now(),now())
       ON CONFLICT (user_id) DO UPDATE SET status='searching', updated_at=now()`,
      [user.id, user.rank_rating, displayName(user)]
    );
    mine = (await q(`SELECT * FROM matchmaking_queue WHERE user_id=$1`, [user.id])).rows[0];
  } else {
    await q(`UPDATE matchmaking_queue SET updated_at=now() WHERE user_id=$1`, [user.id]);
  }

  if (mine.status === 'matched' && mine.matched_duel_id) {
    const opp = mine.opponent_json || {};
    await q(`DELETE FROM matchmaking_queue WHERE user_id=$1`, [user.id]);
    return {
      status: 'matched', duel_id: Number(mine.matched_duel_id),
      game: mine.game_slug, opponent: opp,
      opponent_type: opp.forgotten ? 'forgotten' : 'player'
    };
  }

  const paired = await tryPairRanked(user);
  if (paired) {
    await q(`DELETE FROM matchmaking_queue WHERE user_id=$1`, [user.id]);
    return { status: 'matched', ...paired };
  }

  const elapsedMs = Date.now() - new Date(mine.enqueued_at).getTime();
  const fallbackMs = (Number(CFG.mm_bot_fallback_sec) || 45) * 1000;
  if (elapsedMs >= fallbackMs) {
    const bot = await createBotDuel(user, 'ranked');
    await q(`DELETE FROM matchmaking_queue WHERE user_id=$1`, [user.id]);
    return { status: 'matched', ...bot };
  }
  return { status: 'searching', wait_sec: Math.round(elapsedMs / 1000), bot_fallback_sec: Math.round(fallbackMs / 1000) };
}

export async function cancelRankedSearch(user) {
  await q(`DELETE FROM matchmaking_queue WHERE user_id=$1`, [user.id]);
  return { ok: true };
}

/* =========================================================== Friendly invites
 * A player creates a private challenge with a short code and shares it. A friend
 * accepts with the code; both get mirror duels (casual — no rank change). */

function makeCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

async function expireFriendly() {
  const ttl = Number(CFG.friendly_challenge_ttl_min) || 30;
  try {
    await q(
      `UPDATE friendly_challenges SET status='expired'
       WHERE status='open' AND created_at < now() - ($1 || ' minutes')::interval`,
      [String(ttl)]
    );
  } catch { /* best-effort */ }
}

export async function createFriendly(user) {
  await expireFriendly();
  // One open challenge per host: cancel any previous open ones.
  await q(`UPDATE friendly_challenges SET status='cancelled' WHERE host_id=$1 AND status='open'`, [user.id]);
  let code, tries = 0;
  // Ensure uniqueness among live challenges.
  while (tries++ < 8) {
    code = makeCode();
    const dup = (await q(`SELECT 1 FROM friendly_challenges WHERE code=$1 AND status='open'`, [code])).rows[0];
    if (!dup) break;
  }
  await q(
    `INSERT INTO friendly_challenges (code, host_id, host_name, host_rating, status)
     VALUES ($1,$2,$3,$4,'open')`,
    [code, user.id, displayName(user), user.rank_rating]
  );
  return { code, status: 'open', ttl_min: Number(CFG.friendly_challenge_ttl_min) || 30 };
}

export async function acceptFriendly(user, codeRaw) {
  await expireFriendly();
  const code = String(codeRaw || '').trim().toUpperCase();
  if (!code) throw new Error('Enter a challenge code');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ch = (await client.query(
      `SELECT * FROM friendly_challenges WHERE code=$1 AND status='open' FOR UPDATE`, [code]
    )).rows[0];
    if (!ch) { await client.query('ROLLBACK'); throw new Error('That challenge is no longer available'); }
    if (Number(ch.host_id) === Number(user.id)) { await client.query('ROLLBACK'); throw new Error('You cannot accept your own invite'); }

    const game = await pickRandomGame();
    const targetForGuest = computeAiTarget(user.rank_rating, ch.host_rating, false);
    const targetForHost = computeAiTarget(ch.host_rating, user.rank_rating, false);

    const guestDuel = (await client.query(
      `INSERT INTO duels (kind, mode, opener_id, accepter_id, game_slug, status,
         opponent_score, opponent_rating, opponent_name)
       VALUES ('friendly','friendly',$1,$2,$3,'active',$4,$5,$6) RETURNING id`,
      [user.id, ch.host_id, game, targetForGuest, ch.host_rating, ch.host_name]
    )).rows[0];
    const hostDuel = (await client.query(
      `INSERT INTO duels (kind, mode, opener_id, accepter_id, game_slug, status,
         opponent_score, opponent_rating, opponent_name)
       VALUES ('friendly','friendly',$1,$2,$3,'active',$4,$5,$6) RETURNING id`,
      [ch.host_id, user.id, game, targetForHost, user.rank_rating, displayName(user)]
    )).rows[0];

    await client.query(
      `UPDATE friendly_challenges SET status='matched', guest_id=$2, guest_name=$3,
         guest_rating=$4, game_slug=$5, host_duel_id=$6, guest_duel_id=$7, matched_at=now()
       WHERE id=$1`,
      [ch.id, user.id, displayName(user), user.rank_rating, game, hostDuel.id, guestDuel.id]
    );
    await client.query('COMMIT');

    emit({
      userId: ch.host_id, tier: 'toast', kind: 'friendly_joined',
      title: 'Challenge accepted', body: `${displayName(user)} joined your match`,
      icon: 'bolt', severity: 'info'
    }).catch(() => {});

    return {
      status: 'matched', duel_id: guestDuel.id, game,
      opponent: { id: ch.host_id, name: ch.host_name, rank_rating: ch.host_rating, target_score: targetForGuest, forgotten: false },
      opponent_type: 'friend'
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Host polls their own code to learn when a friend has joined.
export async function pollFriendly(user, codeRaw) {
  await expireFriendly();
  const code = String(codeRaw || '').trim().toUpperCase();
  const ch = (await q(`SELECT * FROM friendly_challenges WHERE code=$1 AND host_id=$2`, [code, user.id])).rows[0];
  if (!ch) return { status: 'gone' };
  if (ch.status === 'matched' && ch.host_duel_id) {
    const target = computeAiTarget(ch.host_rating, ch.guest_rating, false);
    return {
      status: 'matched', duel_id: Number(ch.host_duel_id), game: ch.game_slug,
      opponent: { id: ch.guest_id, name: ch.guest_name, rank_rating: ch.guest_rating, target_score: target, forgotten: false },
      opponent_type: 'friend'
    };
  }
  if (ch.status !== 'open') return { status: ch.status };
  return { status: 'open', code };
}

export async function cancelFriendly(user, codeRaw) {
  const code = String(codeRaw || '').trim().toUpperCase();
  await q(`UPDATE friendly_challenges SET status='cancelled' WHERE code=$1 AND host_id=$2 AND status='open'`, [code, user.id]);
  return { ok: true };
}

/* ================================================================= Resolution */

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

  // Friendly matches are casual — no rank movement.
  const casual = (duel.kind === 'friendly' || duel.mode === 'friendly');
  let change = null;
  if (!casual) {
    // Self-only adjustment: each human resolves their own duel, so applying both
    // sides here would double-count a human-vs-human pairing.
    change = await adjustSelf(user.id, won, duel.kind || 'ranked');
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

  return {
    ok: true, score, opponent_score: opponentScore, won, casual,
    opponent_name: duel.opponent_name || null,
    rank: change ? {
      before: change.before, after: change.after, delta: change.delta,
      tier: change.newTier, old_tier: change.oldTier, tier_changed: change.tierChanged
    } : null
  };
}

export async function recentMatches(userId, limit = 10) {
  return (await q(
    `SELECT id, game_slug, winner_id, loser_id, stake_sparks, kind, resolved_at
     FROM duels
     WHERE (opener_id=$1 OR accepter_id=$1) AND status='resolved'
     ORDER BY resolved_at DESC LIMIT $2`, [userId, limit]
  )).rows;
}
