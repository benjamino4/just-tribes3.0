import { q } from './db.js';

function todayKey() { return new Date().toISOString().slice(0, 10); }

export function pickThreeDaily(pool, userId, dayKey) {
  if (!pool.length) return [];
  let h = 5381;
  const seed = String(userId) + ':' + dayKey;
  for (let i = 0; i < seed.length; i++) h = ((h * 33) ^ seed.charCodeAt(i)) >>> 0;
  const start = h % pool.length;
  const picked = [];
  for (let i = 0; i < 3 && i < pool.length; i++) picked.push(pool[(start + i) % pool.length]);
  return picked;
}

export async function dailyPool() {
  return (await q(
    `SELECT * FROM daily_quests WHERE active=true ORDER BY weight DESC, id ASC LIMIT 6`
  )).rows;
}

export async function dailyViewFor(userId) {
  const pool = await dailyPool();
  const day = todayKey();
  const picks = pickThreeDaily(pool, userId, day);
  const log = (await q(
    `SELECT quest_id, progress, claimed_at FROM daily_quest_log
      WHERE user_id=$1 AND day_key=$2`, [userId, day]
  )).rows;
  const map = {};
  for (const row of log) map[row.quest_id] = row;
  return picks.map((d) => ({
    id: d.id, slug: d.slug, title: d.title, description: d.description,
    icon: d.icon, goal_kind: d.goal_kind, goal_amount: d.goal_amount,
    reward_sparks: d.reward_sparks, reward_kinship: d.reward_kinship,
    progress: map[d.id]?.progress || 0,
    claimed: !!map[d.id]?.claimed_at
  }));
}

export async function bump(userId, kind, amount = 1) {
  try {
    const day = todayKey();
    const rows = (await q(
      `SELECT id, goal_amount FROM daily_quests WHERE active=true AND goal_kind=$1`, [kind]
    )).rows;
    for (const r of rows) {
      await q(
        `INSERT INTO daily_quest_log (user_id, quest_id, day_key, progress)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id, quest_id, day_key) DO UPDATE
           SET progress = daily_quest_log.progress + $4`,
        [userId, r.id, day, amount]
      );
    }
  } catch {}
}

export async function claim(userId, questId) {
  const day = todayKey();
  const quest = (await q('SELECT * FROM daily_quests WHERE id=$1 AND active=true', [questId])).rows[0];
  if (!quest) throw new Error('no such quest');
  const row = (await q(
    'SELECT * FROM daily_quest_log WHERE user_id=$1 AND quest_id=$2 AND day_key=$3',
    [userId, questId, day]
  )).rows[0];
  if (!row) throw new Error('no progress');
  if (row.claimed_at) throw new Error('already claimed');
  if (row.progress < quest.goal_amount) {
    const e = new Error('not complete'); e.need = quest.goal_amount; e.have = row.progress; throw e;
  }
  await q(
    'UPDATE daily_quest_log SET claimed_at=now() WHERE user_id=$1 AND quest_id=$2 AND day_key=$3',
    [userId, questId, day]
  );
  await q(
    'UPDATE users SET sparks = sparks + $1, kinship = kinship + $2 WHERE id=$3',
    [quest.reward_sparks || 0, quest.reward_kinship || 0, userId]
  );
  if (quest.reward_kinship) {
    const t = (await q('SELECT tribe_id FROM users WHERE id=$1', [userId])).rows[0];
    if (t?.tribe_id) {
      await q('UPDATE tribes SET kinship_total = kinship_total + $1 WHERE id=$2',
        [quest.reward_kinship, t.tribe_id]);
    }
  }
  return { ok: true, reward_sparks: quest.reward_sparks || 0, reward_kinship: quest.reward_kinship || 0 };
}