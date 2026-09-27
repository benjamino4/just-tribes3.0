// TRIBES-FILE: server/src/spin.js
// PHASE: 3 — Economy
// Wheel of Ash. Free + paid spins. Weighted reward pick.

import { q } from './db.js';
import { CFG } from './config.js';

export async function spinState(user) {
  const day = new Date().toISOString().slice(0, 10);
  const cfg = (await q('SELECT * FROM spin_config WHERE id=1')).rows[0] || {
    free_spins_per_day: 1, max_paid_per_day: 3, stars_per_spin: 25,
  };
  const today = (await q(
    'SELECT count(*)::int AS n FROM spin_log WHERE user_id=$1 AND day_key=$2',
    [user.id, day]
  )).rows[0].n;

  const freeUsed = Math.min(today, cfg.free_spins_per_day);
  const paidUsed = Math.max(0, today - cfg.free_spins_per_day);

  const rewards = (await q(
    `SELECT id, slot_index, kind, amount, weight, icon, label
       FROM spin_rewards WHERE active=true ORDER BY slot_index`
  )).rows;

  return {
    freeAvailable: freeUsed < cfg.free_spins_per_day,
    paidLeft: Math.max(0, cfg.max_paid_per_day - paidUsed),
    starsPerSpin: Number(cfg.stars_per_spin) || 25,
    rewards,
  };
}

export async function spin(user) {
  const day = new Date().toISOString().slice(0, 10);
  const cfg = (await q('SELECT * FROM spin_config WHERE id=1')).rows[0];
  const today = (await q(
    'SELECT count(*)::int AS n FROM spin_log WHERE user_id=$1 AND day_key=$2',
    [user.id, day]
  )).rows[0].n;

  const freeUsed = Math.min(today, cfg.free_spins_per_day);
  const paidUsed = Math.max(0, today - cfg.free_spins_per_day);
  const free = freeUsed < cfg.free_spins_per_day;
  const paidLeft = cfg.max_paid_per_day - paidUsed;

  let cost = 0;
  if (!free) {
    if (paidLeft <= 0) throw new Error('No spins left today');
    if (Number(user.stars || 0) < cfg.stars_per_spin) {
      const e = new Error('Not enough Stars');
      e.need = cfg.stars_per_spin;
      throw e;
    }
    cost = cfg.stars_per_spin;
  }

  const rewards = (await q('SELECT * FROM spin_rewards WHERE active=true')).rows;
  if (!rewards.length) throw new Error('no rewards configured');

  const total = rewards.reduce((s, r) => s + (r.weight || 1), 0);
  let r = Math.random() * total;
  let picked = rewards[0];
  for (const rw of rewards) {
    r -= rw.weight || 1;
    if (r <= 0) { picked = rw; break; }
  }

  if (picked.kind === 'ember')
    await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [picked.amount, user.id]);
  if (picked.kind === 'renown') {
    await q('UPDATE users SET renown = renown + $1 WHERE id=$2', [picked.amount, user.id]);
    if (user.tribe_id)
      await q('UPDATE tribes SET renown_total = renown_total + $1 WHERE id=$2',
        [picked.amount, user.tribe_id]);
  }
  if (picked.kind === 'stars')
    await q('UPDATE users SET stars = stars + $1 WHERE id=$2', [picked.amount, user.id]);

  if (cost > 0)
    await q('UPDATE users SET stars = stars - $1 WHERE id=$2', [cost, user.id]);

  await q(
    `INSERT INTO spin_log (user_id, day_key, paid, stars_cost, reward_id, reward_kind, reward_amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [user.id, day, !free, cost, picked.id, picked.kind, picked.amount]
  );

  return {
    ok: true,
    free,
    cost,
    slotIndex: picked.slot_index,
    reward: { kind: picked.kind, amount: picked.amount },
    label: picked.label,
  };
}