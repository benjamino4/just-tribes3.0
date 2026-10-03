import { q } from './db.js';

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

const PERSONALITIES = ['aggressive', 'cautious', 'erratic', 'methodical', 'mimic'];

function defaultProfile(personality) {
  const base = {
    reaction_avg_ms: 280 + Math.random() * 80,
    reaction_stddev_ms: 30 + Math.random() * 30,
    preferred_games: { reaction: 1, memory: 1, choice: 1, sequence: 1, deduction: 1 },
    familiarity: {}, counter_to: {}, rps_history: []
  };
  if (personality === 'aggressive') { base.reaction_avg_ms -= 40; }
  if (personality === 'cautious') { base.reaction_avg_ms += 30; }
  if (personality === 'erratic') { base.reaction_stddev_ms = 80; }
  if (personality === 'methodical') { base.reaction_stddev_ms = 15; }
  return base;
}

export async function createOne({ personality = null, rank_rating = 1000 } = {}) {
  const used = (await q('SELECT name FROM forgotten_ones')).rows.map(r => r.name);
  const free = NAME_POOL.filter(n => !used.includes(n));
  const name = free.length
    ? free[Math.floor(Math.random() * free.length)]
    : NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)] + ' the Elder';
  const pers = personality || PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const r = await q(
    `INSERT INTO forgotten_ones (name, rank_rating, personality, style_profile)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, rank_rating, pers, JSON.stringify(defaultProfile(pers))]
  );
  return r.rows[0];
}

export async function getById(id) {
  return (await q('SELECT * FROM forgotten_ones WHERE id=$1', [id])).rows[0] || null;
}

export async function findForSubstitution(realPlayerRank) {
  const rankCap = Math.round(realPlayerRank * 0.7);
  const r = await q(
    `SELECT * FROM forgotten_ones WHERE active=true AND ABS(rank_rating - $1) <= 150
     ORDER BY ABS(rank_rating - $1) ASC, random() LIMIT 1`,
    [rankCap]
  );
  if (r.rows[0]) return r.rows[0];
  return await createOne({ rank_rating: rankCap });
}

export async function findOpponent(userRank, spread = 200) {
  const r = await q(
    `SELECT * FROM forgotten_ones WHERE active=true AND ABS(rank_rating - $1) <= $2
     ORDER BY ABS(rank_rating - $1) ASC, random() LIMIT 1`,
    [userRank, spread]
  );
  if (r.rows[0]) return r.rows[0];
  return (await q('SELECT * FROM forgotten_ones WHERE active=true ORDER BY random() LIMIT 1')).rows[0];
}

export function decidePlay(profile, archetype, opponentSignature) {
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
        for (const h of hist) counts[h]++;
        const predicted = counts.indexOf(Math.max(...counts));
        pick = predicted === 0 ? 1 : predicted === 1 ? 2 : 0;
      }
      decided.pick = pick;
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
      decided.rounds_won = Math.round(winRate * rounds);
      decided.rounds_lost = rounds - decided.rounds_won;
      break;
    }
    case 'match3': {
      const skill = 0.5 + Math.random() * 0.4;
      decided.score = Math.round(500 + skill * 1500);
      decided.combos = Math.round(skill * 10);
      break;
    }
    case 'stacker': {
      const skill = 0.5 + Math.random() * 0.4;
      decided.height = Math.round(5 + skill * 15);
      decided.perfects = Math.round(skill * 5);
      break;
    }
    case 'catch': {
      const skill = 0.5 + Math.random() * 0.4;
      decided.caught = Math.round(20 + skill * 40);
      decided.missed = Math.round((1 - skill) * 10);
      break;
    }
  }
  return decided;
}

export async function recordMatch({
  forgottenId, opponentUserId = null,
  gameSlug, archetype, won, opponentPlays = null, matchData = null
}) {
  const fo = await getById(forgottenId);
  if (!fo) return;
  const learningRate = 0.05;
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
     (forgotten_id, opponent_user_id, game_slug, archetype, won, opponent_plays, match_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [forgottenId, opponentUserId, gameSlug, archetype, won,
     opponentPlays ? JSON.stringify(opponentPlays) : null,
     matchData ? JSON.stringify(matchData) : null]
  );
}

export async function ensurePopulation(minCount = 40) {
  const r = await q('SELECT count(*)::int AS n FROM forgotten_ones WHERE active=true');
  const n = r.rows[0].n;
  if (n >= minCount) return 0;
  for (let i = 0; i < minCount - n; i++) await createOne();
  return minCount - n;
}

export const ALL_NAMES = NAME_POOL;
export const ALL_PERSONALITIES = PERSONALITIES;