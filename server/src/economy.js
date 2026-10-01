import { q } from './db.js';
import { CFG } from './config.js';

const ROLE_TIERS = [
  [20000, 'Head'], [8000, 'Elder'], [2000, 'Hunter'], [500, 'Kin'], [0, 'Toddler']
];

export function roleFor(kinship) {
  for (const [t, r] of ROLE_TIERS) if (kinship >= t) return r;
  return 'Toddler';
}

export async function refreshUserRole(u) {
  let role = roleFor(Number(u.kinship) || 0);
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

export async function addKinship(u, n) {
  if (!n) return;
  await q('UPDATE users SET kinship = kinship + $1 WHERE id=$2', [n, u.id]);
  if (u.tribe_id) {
    await q('UPDATE tribes SET kinship_total = kinship_total + $1 WHERE id=$2', [n, u.tribe_id]);
  }
  u.kinship = Number(u.kinship || 0) + n;
}

export function levelTable() {
  const parse = (v, fb) => {
    if (typeof v !== 'string') return v ?? fb;
    try { return JSON.parse(v); } catch { return fb; }
  };
  return {
    caps:  parse(CFG.tribe_level_caps,  [5,8,12,18,25,35,50,70,90,120]),
    costs: parse(CFG.tribe_level_costs, [0,25000,60000,140000,300000,600000,1200000,2400000,4800000,9600000]),
    names: parse(CFG.tribe_level_names, ['Band','Camp','Village','Settlement','Stronghold','Fortress','Domain','Realm','Empire','Kingdom'])
  };
}