// TRIBES-FILE: server/src/settlement.js
// PHASE: 8 — Payments + Polish
// Settlement buildings — upgrade to raise tribe's passive production.

import { q } from './db.js';

const BUILDINGS = [
  {
    id: 'hearth',
    name: 'Hearth',
    desc: 'Ash pools faster and holds more.',
    icon: 'fire',
    baseCost: 5000,
    costMult: 1.6,
    maxLevel: 10,
    effect: 'ashMinutes -3% per level',
  },
  {
    id: 'well',
    name: 'Well',
    desc: 'Bigger Ember cap per pool.',
    icon: 'ash',
    baseCost: 8000,
    costMult: 1.7,
    maxLevel: 10,
    effect: '+8% ashUnit per level',
  },
  {
    id: 'watch',
    name: 'Watchtower',
    desc: 'Faster spy missions and better counter-spy.',
    icon: 'ranks',
    baseCost: 12000,
    costMult: 1.8,
    maxLevel: 8,
    effect: '-10% spy duration per level',
  },
  {
    id: 'forge',
    name: 'Forge',
    desc: 'Cheaper reforging.',
    icon: 'bolt',
    baseCost: 18000,
    costMult: 1.9,
    maxLevel: 8,
    effect: '-1 duplicate for reforge (min 2)',
  },
  {
    id: 'altar',
    name: 'Altar',
    desc: 'Stronger Idol buff.',
    icon: 'crown',
    baseCost: 25000,
    costMult: 2.0,
    maxLevel: 6,
    effect: '+5% idol buff per level',
  },
];

export function list() {
  return BUILDINGS;
}

export async function tribeBuildings(tribeId) {
  const rows = (await q(
    'SELECT building_id, level, upgraded_at FROM tribe_buildings WHERE tribe_id=$1',
    [tribeId]
  )).rows;
  const map = {};
  for (const r of rows) map[r.building_id] = r;
  return BUILDINGS.map((b) => ({
    ...b,
    level: Number(map[b.id]?.level) || 1,
    upgraded_at: map[b.id]?.upgraded_at || null,
    cost: costFor(b, Number(map[b.id]?.level) || 1),
  }));
}

function costFor(b, currentLevel) {
  if (currentLevel >= b.maxLevel) return null;
  return Math.round(b.baseCost * Math.pow(b.costMult, currentLevel - 1));
}

export async function upgrade(tribe, user, buildingId) {
  const b = BUILDINGS.find((x) => x.id === buildingId);
  if (!b) throw new Error('no such building');

  const cur = (await q(
    'SELECT level FROM tribe_buildings WHERE tribe_id=$1 AND building_id=$2',
    [tribe.id, buildingId]
  )).rows[0];
  const currentLevel = Number(cur?.level) || 1;
  if (currentLevel >= b.maxLevel) throw new Error('already at max level');

  const cost = costFor(b, currentLevel);
  if (Number(tribe.treasury) < cost) {
    const e = new Error('the Great Pyre is too shallow');
    e.need = cost;
    throw e;
  }

  if (!['Chief', 'Head', 'Elder'].includes(user.role) && Number(tribe.created_by) !== Number(user.id)) {
    throw new Error('only Elders+ may upgrade buildings');
  }

  await q('UPDATE tribes SET treasury = treasury - $1 WHERE id=$2', [cost, tribe.id]);
  await q(
    `INSERT INTO tribe_buildings (tribe_id, building_id, level, upgraded_at)
     VALUES ($1,$2,$3,now())
     ON CONFLICT (tribe_id, building_id) DO UPDATE
       SET level=tribe_buildings.level + 1, upgraded_at=now()`,
    [tribe.id, buildingId, 2]
  );
  return { ok: true, building: buildingId, level: currentLevel + 1 };
}

/* ---------- effect lookup ---------- */
export async function effectMult(tribeId, kind) {
  const rows = (await q(
    'SELECT building_id, level FROM tribe_buildings WHERE tribe_id=$1',
    [tribeId]
  )).rows;
  const lvl = {};
  for (const r of rows) lvl[r.building_id] = Number(r.level) || 1;

  switch (kind) {
    case 'ashMinutes':
      return 1 - (Math.min(lvl.hearth || 1, 10) - 1) * 0.03;
    case 'ashUnit':
      return 1 + (Math.min(lvl.well || 1, 10) - 1) * 0.08;
    case 'spyDuration':
      return 1 - (Math.min(lvl.watch || 1, 8) - 1) * 0.10;
    case 'reforgeCost':
      return Math.max(2, 3 - (Math.min(lvl.forge || 1, 8) - 1));
    case 'idolBuff':
      return 1 + (Math.min(lvl.altar || 1, 6) - 1) * 0.05;
    default:
      return 1;
  }
}