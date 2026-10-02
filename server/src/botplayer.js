import { q } from './db.js';

// ---------------------------------------------------------------------------
// Arena bot opponents
// ---------------------------------------------------------------------------
// When no live human is available for a ranked duel we drop in an "ember
// spirit" bot so the player always gets a fight. The bots are NOT dumb
// thresholds: every real human result is folded into a per-game skill model
// (bot_skill, Welford online mean/variance) and the bot draws its score from
// that learned distribution. As the human population improves, the bots
// improve with them — they mimic and learn from humans. Each bot also carries
// its own rank_rating that rises/falls through the normal rank system, so
// repeat opponents feel individual and consistent.
//
// Bots live in the users table with NEGATIVE ids and is_bot=true, no tribe_id,
// so they never surface on any human-facing roster, tribe list or seat recalc.
// ---------------------------------------------------------------------------

const PERSONAS = [
  'Emberwraith', 'Ashcaller', 'Cinderkin', 'Flamespeaker', 'Smolderghast',
  'Pyreborn', 'Scorchling', 'Hearthshade', 'Coalheart', 'Blazewraith',
  'Soottongue', 'Charwarden', 'Glowspite', 'Kindlespirit', 'Fumeshade',
];

function gaussian() {
  // Box–Muller standard normal
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Pick (or lazily create) a bot whose rating sits near the player's, so the
// match feels fair. We keep a small stable pool and only spawn a new persona
// when nothing in range exists yet.
export async function getOrCreateArenaBot(targetRating = 1000) {
  const rating = Math.max(0, Math.round(Number(targetRating) || 1000));
  const band = 180;

  const existing = (await q(
    `SELECT id, first_name, username, rank_rating, bot_persona
       FROM users
      WHERE is_bot = true AND banned = false
        AND rank_rating BETWEEN $1 AND $2
      ORDER BY random() LIMIT 1`,
    [rating - band, rating + band]
  )).rows[0];
  if (existing) return existing;

  const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
  // Negative id keeps bots clear of real Telegram ids (always positive).
  const id = -(100000 + Math.floor(Math.random() * 800000));
  const jitter = Math.round(gaussian() * 40);
  const row = (await q(
    `INSERT INTO users (id, first_name, username, role, is_bot, bot_persona,
                        rank_rating, last_checkin, sparks, kinship)
     VALUES ($1, $2, $3, 'Kin', true, $2, $4, now(), 0, 0)
     ON CONFLICT (id) DO UPDATE SET last_checkin = now()
     RETURNING id, first_name, username, rank_rating, bot_persona`,
    [id, persona, persona.toLowerCase(), Math.max(0, rating + jitter)]
  )).rows[0];
  return row;
}

export async function isBot(userId) {
  if (Number(userId) >= 0) return false;
  const r = (await q('SELECT is_bot FROM users WHERE id=$1', [userId])).rows[0];
  return !!(r && r.is_bot);
}

// Fold a real human score into the learned skill model for this game.
export async function recordHumanScore(gameSlug, score) {
  const x = clampScore(score);
  // Welford: new_mean = mean + (x-mean)/n ; m2 += (x-mean)*(x-new_mean)
  await q(
    `INSERT INTO bot_skill (game_slug, samples, mean, m2, updated_at)
     VALUES ($1, 1, $2, 0, now())
     ON CONFLICT (game_slug) DO UPDATE SET
       samples = bot_skill.samples + 1,
       mean = bot_skill.mean + ($2 - bot_skill.mean) / (bot_skill.samples + 1),
       m2 = bot_skill.m2 + ($2 - bot_skill.mean)
              * ($2 - (bot_skill.mean + ($2 - bot_skill.mean) / (bot_skill.samples + 1))),
       updated_at = now()`,
    [gameSlug, x]
  );
}

// Produce a human-like score for the bot on this game, drawn from the learned
// distribution and nudged by the rating gap, plus a human-like "thinking"
// delay the UI can use to animate the opponent taking its turn.
export async function botScoreFor(gameSlug, botRating = 1000, humanRating = 1000) {
  const row = (await q(
    'SELECT samples, mean, m2 FROM bot_skill WHERE game_slug=$1', [gameSlug]
  )).rows[0];

  const samples = row ? Number(row.samples) : 0;
  // Until we have enough live data, fall back to a reasonable human baseline.
  const mean = samples >= 8 ? Number(row.mean) : 55;
  const variance = samples >= 8 ? Number(row.m2) / Math.max(1, samples - 1) : 18 * 18;
  const std = Math.max(6, Math.min(28, Math.sqrt(Math.max(1, variance))));

  // Rating gap nudge: a higher-rated bot plays a little better, capped so it
  // never feels unfair in either direction.
  const gap = Math.max(-200, Math.min(200, Number(botRating) - Number(humanRating)));
  const nudge = gap / 20; // +/-10 points at the extremes

  const raw = mean + nudge + gaussian() * std;
  const score = clampScore(raw);

  // Human-like pacing (ms) so the client can animate the bot's turn.
  const delayMs = Math.round(1500 + Math.random() * 3500);

  return { score, delayMs, learned: samples >= 8, samples };
}
