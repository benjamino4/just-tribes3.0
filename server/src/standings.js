// TRIBES-FILE: server/src/standings.js
// PHASE: 8 — Payments + Polish
// Global leaderboards — tribes and users.

import { q } from './db.js';

export async function tribeStandings(limit = 50) {
  return (await q(
    `SELECT id, name, crest, banner, level, members, renown_total, treasury, wins, losses
       FROM tribes
      ORDER BY renown_total DESC, members DESC
      LIMIT $1`,
    [limit]
  )).rows;
}

export async function userStandings(limit = 50) {
  return (await q(
    `SELECT u.id, u.username, u.first_name, u.renown, u.ember, u.tribe_id,
            t.name AS tribe_name
       FROM users u
       LEFT JOIN tribes t ON t.id = u.tribe_id
      WHERE u.banned = false
      ORDER BY u.renown DESC, u.id ASC
      LIMIT $1`,
    [limit]
  )).rows;
}

export async function myRank(userId) {
  const r = (await q(
    `SELECT rank FROM (
       SELECT id, ROW_NUMBER() OVER (ORDER BY renown DESC) AS rank FROM users
        WHERE banned = false
     ) x WHERE id=$1`,
    [userId]
  )).rows[0];
  return r ? Number(r.rank) : null;
}

export async function myTribeRank(tribeId) {
  if (!tribeId) return null;
  const r = (await q(
    `SELECT rank FROM (
       SELECT id, ROW_NUMBER() OVER (ORDER BY renown_total DESC) AS rank FROM tribes
     ) x WHERE id=$1`,
    [tribeId]
  )).rows[0];
  return r ? Number(r.rank) : null;
}