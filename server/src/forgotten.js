// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/forgotten.js
// PURPOSE: The Forgotten Ones. Learning AI opponents. Never cheat.
//          Fill empty seats at war. Substitute offline players.
//          Learn at 5% per match. Marked by a subtle crest rune.
// DEPENDS ON: db.js, config.js, rank.js
// ═══════════════════════════════════════════════════════════════════
import { q } from './db.js';
import { CFG } from './config.js';

const NAME_POOL = [
  'Kharuk', 'Vorak', 'Tumek', 'Arnok', 'Selun', 'Brakar', 'Keldis', 'Orruk',
  'Vashkan', 'Dreyul', 'Noktar', 'Selvok', 'Karnak', 'Tuvak', 'Mehru', 'Aktur',
  'Balor', 'Vuren', 'Kaskal', 'Ondrek', 'Thalun', 'Urmek', 'Sartok', 'Belkar',
  'Vhora', 'Yntar', 'Moluk', 'Grendar', 'Ashur', 'Paltok', 'Zarrek', 'Rulgar',
  'Ordun', 'Vhalm', 'Sarn', 'Kaldur', 'Erukk', 'Narak', 'Tolum', 'Skarn',
  'Agra', 'Molvar', 'Durnak', 'Wrakk', 'Eldur', 'Sorren', 'Harnok', 'Veyl',
  'Tarnak', 'Urkan', 'Drogath', 'Huruk', 'Sarnok', 'Bekka', 'Varek', 'Thonar',
  'Kresh', 'Kaldra', 'Urahn', 'Sethra'
];

const SURNAMES = ['the Elder', 'of the North', 'the Wanderer', 'the Silent', 'the Bold', 'of the Ash'];
const PERSONALITIES = ['aggressive', 'cautious', 'erratic', 'methodical', 'mimic'];
const ARCHETYPES = ['reaction', 'memory', 'choice', 'sequence', 'deduction'];

function pickName(used) {
  const set = new Set(used);
  const free = NAME_POOL.filter((n) => !set.has(n));
  if (free.length) return free[Math.floor(Math.random() * free.length)];
  const base = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)];
  const sur = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
  return `${base} ${sur}`;
}

function defaultProfile(personality) {
  const base = {
    reaction_avg_ms: 280 + Math.random() * 80,
    reaction_stddev_ms: 30 + Math.random() * 30,
    preferred_games: { reaction: 1, memory: 1, choice: 1, sequence: 1, deduction: 1 },
    familiarity: {},
    known_patterns: {},
    counter_to: {},
    rps_history: [],
    session_stats: { streak: 0, streak_loss: 0, fatigue: 0 }
  };
  switch (personality) {
    case 'aggressive':
      base.reaction_avg_ms -= 40;
      base.preferred_games.reaction = 1.4;
      base.preferred_games.choice = 1.3;
      base.preferred_games.memory = 0.7;
      break;
    case 'cautious':
      base.reaction_avg_ms += 30;
      base.preferred_games.memory = 1.3;
      base.preferred_games.sequence = 1.2;
      base.preferred_games.reaction = 0.7;
      break;
    case 'erratic':
      base.reaction_stddev_ms = 80;
      base.preferred_games.deduction = 1.4;
      break;
    case 'methodical':
      base.reaction_stddev_ms = 15;
      base.preferred_games.sequence = 1.4;
      base.preferred_games.memory = 1.3;
      break;
    case 'mimic':
      base.reaction_avg_ms = 260;
      base.preferred_games.choice = 1.4;
      break;
  }
  return base;
}

async function allNames() {
  const r = await q('SELECT name FROM forgotten_ones UNION SELECT name FROM tribes');
  return r.rows.map((x) => x.name);
}

export async function createOne({ tribeId = null, personality = null, rankStart = null } = {}) {
  const names = await allNames();
  const name = pickName(names);
  const pers = personality || PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const rating = rankStart ?? (900 + Math.floor(Math.random() * 200));
  const profile = defaultProfile(pers);
  const archetype = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];

  const r = await q(
    `INSERT INTO forgotten_ones
       (name, tribe_id, rank_rating, personality, style_profile, preferred_archetype)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, tribeId, rating, pers, JSON.stringify(profile), archetype]
  );
  return r.rows[0];
}

export async function getById(id) {
  return (await q('SELECT * FROM forgotten_ones WHERE id=$1', [id])).rows[0] || null;
}

export async function findOpponent(userRank, opts = {}) {
  const spread = opts.spread || 150;
  const excludeId = opts.exclude || 0;
  const r = await q(
    `SELECT * FROM forgotten_ones
      WHERE active = true
        AND id <> $1
        AND ABS(rank_rating - $2) <= $3
      ORDER BY ABS(rank_rating - $2) ASC, random()
      LIMIT 1`,
    [excludeId, userRank, spread]
  );
  if (r.rows[0]) return r.rows[0];
  return (await q(
    'SELECT * FROM forgotten_ones WHERE active=true AND id<>$1 ORDER BY random() LIMIT 1',
    [excludeId]
  )).rows[0] || null;
}

export async function findForSubstitution(realPlayerRank) {
  const cap = Math.round(realPlayerRank * Number(CFG.forgotten_substitute_ratio || 0.7));
  const fo = await findOpponent(cap, { spread: 100 });
  if (fo) return fo;
  return await createOne({ rankStart: cap });
}

export async function membersOfTribe(tribeId) {
  return (await q(
    `SELECT id, name, rank_rating, rank_games, rank_wins, personality
       FROM forgotten_ones WHERE tribe_id=$1 AND active=true
      ORDER BY rank_rating DESC`,
    [tribeId]
  )).rows;
}

export function decidePlay(profile, gameSlug, archetype, opponentSignature) {
  const p = profile || {};
  const decided = {};

  switch (archetype) {
    case 'reaction': {
      const avg = Number(p.reaction_avg_ms) || 300;
      const std = Number(p.reaction_stddev_ms) || 40;
      decided.times = Array.from({ length: 5 }, () => {
        const g = Math.random() + Math.random() + Math.random() + Math.random() - 2;
        return Math.max(150, Math.min(800, avg + g * std));
      });
      break;
    }
    case 'memory': {
      const fam = (p.familiarity && p.familiarity[opponentSignature]) || 0;
      const boost = Math.min(0.25, fam * 0.05);
      const baseAcc = 0.55 + Math.random() * 0.25 + boost;
      decided.correct = Math.round(baseAcc * 10);
      decided.total = 10;
      decided.max_len = 5 + Math.round(baseAcc * 6);
      break;
    }
    case 'choice': {
      const hist = (p.rps_history || []).slice(-5);
      const counter = (p.counter_to && p.counter_to[opponentSignature]) || null;
      let pick = Math.floor(Math.random() * 3);
      if (counter && Math.random() < 0.6) {
        pick = counter.rps_bias === 'rock' ? 1 : counter.rps_bias === 'paper' ? 2 : 0;
      } else if (hist.length >= 3) {
        const counts = [0, 0, 0];
        for (const h of hist) if (h >= 0 && h < 3) counts[h]++;
        const predicted = counts.indexOf(Math.max(...counts));
        pick = predicted === 0 ? 1 : predicted === 1 ? 2 : 0;
      }
      decided.pick = pick;
      decided.wins = Math.round(Math.random() * 4);
      decided.losses = 5 - decided.wins;
      break;
    }
    case 'sequence': {
      const skill = 0.5 + Math.random() * 0.4;
      decided.chain_len = Math.round(4 + skill * 10);
      decided.won = Math.random() < skill;
      break;
    }
    case 'deduction': {
      const fam = (p.familiarity && p.familiarity[opponentSignature]) || 0;
      const readBoost = Math.min(0.3, fam * 0.06);
      const winRate = 0.4 + Math.random() * 0.3 + readBoost;
      const rounds = 3;
      const won = Math.round(winRate * rounds);
      decided.rounds_won = won;
      decided.rounds_lost = rounds - won;
      break;
    }
  }
  return decided;
}

export async function recordMatch({
  forgottenId, opponentUserId = null, opponentForgottenId = null,
  gameSlug, archetype, won, opponentPlays = null, matchData = null
}) {
  const fo = await getById(forgottenId);
  if (!fo) return;

  const learningRate = Number(CFG.forgotten_learning_rate) || 0.05;
  const profile = fo.style_profile || {};

  const rankDelta = won ? 25 : -20;
  await q(
    `UPDATE forgotten_ones
        SET rank_rating = GREATEST(0, rank_rating + $1),
            rank_games = rank_games + 1,
            rank_wins = rank_wins + $2,
            last_active_at = now()
      WHERE id = $3`,
    [rankDelta, won ? 1 : 0, forgottenId]
  );

  if (archetype === 'reaction' && matchData?.times?.length) {
    const avg = matchData.times.reduce((a, b) => a + b, 0) / matchData.times.length;
    const oldAvg = Number(profile.reaction_avg_ms) || 300;
    profile.reaction_avg_ms = oldAvg * (1 - learningRate) + avg * learningRate;
    if (won) profile.reaction_avg_ms = Math.max(180, profile.reaction_avg_ms - 3);
  }

  if (archetype === 'choice' && Array.isArray(opponentPlays)) {
    profile.rps_history = [...(profile.rps_history || []), ...opponentPlays].slice(-30);
    if (opponentUserId) {
      const counts = [0, 0, 0];
      for (const play of opponentPlays) if (play >= 0 && play < 3) counts[play]++;
      const dominant = counts.indexOf(Math.max(...counts));
      const counter = dominant === 0 ? 'paper' : dominant === 1 ? 'scissors' : 'rock';
      profile.counter_to = profile.counter_to || {};
      profile.counter_to[String(opponentUserId)] = { rps_bias: counter };
    }
  }

  if (opponentUserId) {
    profile.familiarity = profile.familiarity || {};
    profile.familiarity[String(opponentUserId)] =
      (profile.familiarity[String(opponentUserId)] || 0) + 1;
  }

  await q('UPDATE forgotten_ones SET style_profile=$1::jsonb WHERE id=$2',
    [JSON.stringify(profile), forgottenId]);

  await q(
    `INSERT INTO forgotten_matches
       (forgotten_id, opponent_user_id, opponent_forgotten_id, game_slug, archetype, won, opponent_plays, match_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [forgottenId, opponentUserId, opponentForgottenId, gameSlug, archetype, won,
     opponentPlays ? JSON.stringify(opponentPlays) : null,
     matchData ? JSON.stringify(matchData) : null]
  );
}

export async function ensureWorldPopulation(minCount = 40) {
  const r = await q('SELECT count(*)::int AS n FROM forgotten_ones WHERE active=true');
  const n = r.rows[0].n;
  if (n >= minCount) return 0;
  const toCreate = minCount - n;
  for (let i = 0; i < toCreate; i++) await createOne();
  return toCreate;
}

export async function listAll() {
  return (await q(
    `SELECT id, name, rank_rating, rank_games, rank_wins, personality,
            preferred_archetype, displacements, last_active_at
       FROM forgotten_ones WHERE active=true
      ORDER BY rank_rating DESC LIMIT 200`
  )).rows;
}

export const ALL_PERSONALITIES = PERSONALITIES;
export const ALL_NAMES = NAME_POOL;