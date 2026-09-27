// TRIBES-FILE: server/src/economy.js
// PHASE: 3 — Economy
// (Authored in Phase 2 for the renown helper used by routes.js)
// Check-in, ash, pyre, donate, renown helper.

import { q } from './db.js';
import { CFG } from './config.js';

const ROLE_TIERS = [
  [20000, 'Head'],
  [ 8000, 'Elder'],
  [ 2000, 'Hunter'],
  [  500, 'Kin'],
  [    0, 'Toddler'],
];

export function roleFor(renown) {
  for (const [t, r] of ROLE_TIERS) if (renown >= t) return r;
  return 'Toddler';
}

export async function refreshUserRole(u) {
  let role = roleFor(Number(u.renown) || 0);
  if (u.tribe_id) {
    const t = (await q('SELECT created_by FROM tribes WHERE id=$1', [u.tribe_id])).rows[0];
    if (t && Number(t.created_by) === Number(u.id)) role = 'Chief';
  }
  if (role !== u.role) {
    await q('UPDATE users SET role=$1 WHERE id=$2', [role, u.id]);
    u.role = role;
  }
  return role;
}

export async function addRenown(u, n) {
  if (!n) return;
  await q('UPDATE users SET renown = renown + $1 WHERE id=$2', [n, u.id]);
  if (u.tribe_id) {
    await q('UPDATE tribes SET renown_total = renown_total + $1 WHERE id=$2', [n, u.tribe_id]);
  }
  u.renown = Number(u.renown || 0) + n;
}

export function levelTable() {
  const parse = (v, fb) => {
    if (typeof v !== 'string') return v ?? fb;
    try { return JSON.parse(v); } catch { return fb; }
  };
  return {
    caps:  parse(CFG.tribe_level_caps,  [5,8,12,18,25,35,50,70,90,120]),
    costs: parse(CFG.tribe_level_costs, [0,25000,60000,140000,300000,600000,1200000,2400000,4800000,9600000]),
    names: parse(CFG.tribe_level_names, ['Band','Camp','Village','Settlement','Stronghold','Fortress','Domain','Realm','Empire','Kingdom']),
  };
}

/* ---------- active bonfire (Phase 3 table exists) ---------- */
export async function activeBonfire() {
  try {
    const r = await q(
      `SELECT id, title, metric, multiplier, start_at, end_at
         FROM bonfire_events
        WHERE start_at <= now() AND end_at > now()
        ORDER BY start_at DESC LIMIT 1`
    );
    return r.rows[0] || null;
  } catch { return null; }
}