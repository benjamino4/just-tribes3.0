/* =====================================================================
   TRIBES v4 — Warband seats, Trial-by-Fire seat challenges, and the
   daily bot-practice mini-game. Server-authoritative scoring.
   Tables: warband_seats, seat_challenges, bot_practice_claims, war_games.
   Config: warband_seats, seat_gate_*, seat_activity_weights,
           bot_practice_reward_ember, bot_practice_game.
===================================================================== */
import { q } from './db.js';
import { CFG, cfgJSON } from './config.js';
import { reflexScore } from './lib/pyscore.js';

const DAY = 24 * 3600 * 1000;
const GAMES = ['reflex', 'memory', 'rps'];

function num(v, fb = 0) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function todayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function nextUtcMidnight(d = new Date()) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}
function pickGame(slug) {
  return GAMES.includes(slug) ? slug : (CFG.bot_practice_game || 'reflex');
}

export function seatCount() { return num(CFG.warband_seats, 20); }

/* ---------------- challenge eligibility gate ---------------- */
// Eligible if a >=N-day check-in streak OR >=P weighted activity points in the
// rolling window. Weights come from config (war/trial/donate/checkin).
export async function activityFor(userId) {
  const win = num(CFG.seat_gate_window_days, 7);
  const w = cfgJSON('seat_activity_weights', { war: 3, trial: 2, donate: 1, checkin: 1 });
  const since = new Date(Date.now() - win * DAY).toISOString();
  const trials = num((await q(
    `SELECT COUNT(*)::int c FROM trial_log WHERE user_id=$1 AND at >= $2`,
    [userId, since]
  )).rows[0]?.c);
  let wars = 0;
  try {
    wars = num((await q(
      `SELECT COUNT(*)::int c FROM war_actions WHERE user_id=$1 AND created_at >= $2`,
      [userId, since]
    )).rows[0]?.c);
  } catch { /* war_actions may not exist on very old DBs */ }
  const u = (await q(`SELECT streak FROM users WHERE id=$1`, [userId])).rows[0] || {};
  const checkins = Math.min(num(u.streak), win);
  const points = trials * num(w.trial, 2) + wars * num(w.war, 3) + checkins * num(w.checkin, 1);
  return { points, trials, wars, checkins, streak: num(u.streak) };
}

export async function gateFor(userId) {
  const need_streak = num(CFG.seat_gate_streak_days, 5);
  const need_points = num(CFG.seat_gate_activity_points, 12);
  const a = await activityFor(userId);
  const eligible = a.streak >= need_streak || a.points >= need_points;
  return { eligible, need_streak, need_points, ...a };
}

/* ---------------- seats ---------------- */
export async function seatsFor(tribeId) {
  const n = seatCount();
  const rows = (await q(
    `SELECT s.seat_no, s.user_id, s.held_since, s.last_active,
            u.first_name, u.username
       FROM warband_seats s
       LEFT JOIN users u ON u.id = s.user_id
      WHERE s.tribe_id=$1 AND s.seat_no BETWEEN 1 AND $2`,
    [tribeId, n]
  )).rows;
  const map = new Map(rows.map((r) => [r.seat_no, r]));
  const seats = [];
  for (let i = 1; i <= n; i++) {
    const r = map.get(i);
    seats.push({
      seat_no: i,
      user_id: r?.user_id ? Number(r.user_id) : null,
      holder: r?.user_id ? (r.first_name || r.username || 'Warrior') : null,
      held_since: r?.held_since || null,
      last_active: r?.last_active || null,
    });
  }
  return seats;
}

async function claimSeat(user, seatNo) {
  const now = new Date().toISOString();
  // vacate any seat the user currently holds in this tribe, then take the target
  await q(`UPDATE warband_seats SET user_id=NULL, held_since=NULL WHERE tribe_id=$1 AND user_id=$2`,
    [user.tribe_id, user.id]);
  await q(
    `INSERT INTO warband_seats (tribe_id, seat_no, user_id, held_since, last_active)
     VALUES ($1,$2,$3,$4,$4)
     ON CONFLICT (tribe_id, seat_no)
     DO UPDATE SET user_id=EXCLUDED.user_id, held_since=EXCLUDED.held_since,
                   last_active=EXCLUDED.last_active`,
    [user.tribe_id, seatNo, user.id, now]
  );
}

export async function warbandState(user) {
  if (!user.tribe_id) return { in_tribe: false, seat_count: seatCount(), seats: [], my_seat: null, gate: null, pending: [] };
  const seats = await seatsFor(user.tribe_id);
  const mine = seats.find((s) => s.user_id === Number(user.id)) || null;
  const gate = await gateFor(user.id);
  const pending = (await q(
    `SELECT id, seat_no, challenger_id, defender_id, status, game_slug, created_at
       FROM seat_challenges
      WHERE tribe_id=$1 AND status='pending' AND (challenger_id=$2 OR defender_id=$2)
      ORDER BY created_at DESC LIMIT 5`,
    [user.tribe_id, user.id]
  )).rows;
  return { in_tribe: true, seat_count: seatCount(), seats, my_seat: mine ? mine.seat_no : null, gate, pending };
}

/* ---------------- seat challenges (Trial-by-Fire) ---------------- */
export async function openChallenge(user, seatNo, gameSlug) {
  if (!user.tribe_id) throw new Error('join a tribe first');
  const n = seatCount();
  seatNo = Math.floor(num(seatNo));
  if (!(seatNo >= 1 && seatNo <= n)) throw new Error('invalid seat');

  const gate = await gateFor(user.id);
  if (!gate.eligible) { const e = new Error('not eligible to challenge yet'); e.gate = gate; throw e; }

  const held = (await q(`SELECT seat_no FROM warband_seats WHERE tribe_id=$1 AND user_id=$2`,
    [user.tribe_id, user.id])).rows[0];
  if (held && held.seat_no === seatNo) throw new Error('you already hold this seat');

  const dupe = (await q(
    `SELECT id FROM seat_challenges WHERE tribe_id=$1 AND challenger_id=$2 AND status='pending'`,
    [user.tribe_id, user.id]
  )).rows[0];
  if (dupe) { const e = new Error('you already have a pending challenge'); e.challenge_id = dupe.id; throw e; }

  const cur = (await q(`SELECT user_id FROM warband_seats WHERE tribe_id=$1 AND seat_no=$2`,
    [user.tribe_id, seatNo])).rows[0];
  const defenderId = cur?.user_id ? Number(cur.user_id) : null;

  // empty seat — claim immediately, no duel needed
  if (!defenderId) {
    await claimSeat(user, seatNo);
    await q(
      `INSERT INTO seat_challenges (tribe_id, seat_no, challenger_id, defender_id, status, winner_id, resolved_at)
       VALUES ($1,$2,$3,NULL,'won',$3, now())`,
      [user.tribe_id, seatNo, user.id]
    );
    return { ok: true, claimed: true, seat_no: seatNo, game: null };
  }

  const game = pickGame(String(gameSlug || ''));
  const row = (await q(
    `INSERT INTO seat_challenges (tribe_id, seat_no, challenger_id, defender_id, status, game_slug)
     VALUES ($1,$2,$3,$4,'pending',$5) RETURNING id`,
    [user.tribe_id, seatNo, user.id, defenderId, game]
  )).rows[0];
  return { ok: true, claimed: false, challenge_id: Number(row.id), seat_no: seatNo, game, defender_id: defenderId };
}

// Deterministic per-challenge defense difficulty so a client score cannot be
// replayed against a different challenge for a guaranteed win.
function defenseThreshold(id, defenderId) {
  const seed = `${id}:${defenderId}`;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return 55 + (h % 26); // 55..80
}

function scoreChallenge(challenge, payload) {
  const kind = challenge.game_slug || 'reflex';
  if (kind === 'rps') {
    const total = Math.max(1, Math.min(9, Math.floor(num(payload.rounds_total, 5))));
    const need = Math.floor(total / 2) + 1;
    const won = Math.max(0, Math.min(total, Math.floor(num(payload.rounds_won))));
    return won >= need;
  }
  const score = Math.max(0, Math.min(100, num(payload.score)));
  return score >= defenseThreshold(challenge.id, challenge.defender_id);
}

export async function resolveChallenge(user, challengeId, payload = {}) {
  const c = (await q(`SELECT * FROM seat_challenges WHERE id=$1`, [challengeId])).rows[0];
  if (!c) throw new Error('no such challenge');
  if (Number(c.challenger_id) !== Number(user.id)) throw new Error('not your challenge');
  if (c.status !== 'pending') return { ok: true, status: c.status, winner_id: c.winner_id ? Number(c.winner_id) : null };

  // Reflex duels send the raw reaction times; the (Python/Node) scorer turns
  // them into an authoritative 0..100 score. Legacy clients that still send a
  // precomputed { score } keep working via the scoreChallenge fallback below.
  if ((c.game_slug || 'reflex') !== 'rps' && Array.isArray(payload.times) && payload.times.length) {
    payload = { ...payload, score: await reflexScore(payload.times) };
  }

  const win = scoreChallenge(c, payload);
  const winnerId = win ? Number(user.id) : Number(c.defender_id);
  await q(`UPDATE seat_challenges SET status='resolved', winner_id=$1, resolved_at=now() WHERE id=$2`,
    [winnerId, challengeId]);
  if (win) await claimSeat(user, c.seat_no);
  return { ok: true, status: 'resolved', win, seat_no: c.seat_no, winner_id: winnerId };
}

/* ---------------- daily bot practice ---------------- */
export async function botPracticeState(user) {
  const reward = num(CFG.bot_practice_reward_ember, 100);
  const game = CFG.bot_practice_game || 'reflex';
  const day = todayKey();
  const row = (await q(
    `SELECT id FROM bot_practice_claims WHERE user_id=$1 AND claim_date=$2`,
    [user.id, day]
  )).rows[0];
  return {
    available: !row,
    claimed_today: !!row,
    reward_ember: reward,
    game,
    next_reset: nextUtcMidnight(),
  };
}

export async function claimBotPractice(user, payload = {}) {
  const day = todayKey();
  const reward = num(CFG.bot_practice_reward_ember, 100);
  const game = CFG.bot_practice_game || 'reflex';
  // Prefer server-side scoring of the raw reaction times (Python sidecar when
  // PYSCORE_URL is set, else the identical Node fallback); accept a legacy
  // precomputed score only when no raw times are provided.
  const score = (Array.isArray(payload.times) && payload.times.length)
    ? await reflexScore(payload.times)
    : Math.max(0, Math.min(100, num(payload.score)));
  // Insert first: the UNIQUE(user_id, claim_date) makes the daily limit atomic.
  const ins = await q(
    `INSERT INTO bot_practice_claims (user_id, claim_date, game_slug, reward_ember, score)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, claim_date) DO NOTHING RETURNING id`,
    [user.id, day, game, reward, score]
  );
  if (ins.rowCount === 0) { const e = new Error('already practiced today'); e.reason = 'daily_limit'; throw e; }
  await q(`UPDATE users SET ember = ember + $1 WHERE id=$2`, [reward, user.id]);
  user.ember = num(user.ember) + reward;
  return { ok: true, reward_ember: reward, game, next_reset: nextUtcMidnight() };
}
