// TRIBES-FILE: server/src/spoils.js
// PHASE: 4 — Relics
// Post-war relic drops + warband ember.

import { q } from './db.js';
import { CFG } from './config.js';
import { grant } from './relics.js';

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];
const WEIGHT = { common: 50, rare: 30, epic: 15, legendary: 5 };

function allowed(rarity, cap) {
  const ri = RARITY_ORDER.indexOf(String(rarity || 'common').toLowerCase());
  const ci = RARITY_ORDER.indexOf(String(cap || 'legendary').toLowerCase());
  if (ri < 0) return false;
  return ri <= (ci < 0 ? RARITY_ORDER.length - 1 : ci);
}

function pickWeighted(pool) {
  const total = pool.reduce(
    (s, r) => s + (WEIGHT[String(r.rarity || 'common').toLowerCase()] || 1),
    0
  );
  if (total <= 0) return pool[0];
  let roll = Math.random() * total;
  for (const r of pool) {
    roll -= WEIGHT[String(r.rarity || 'common').toLowerCase()] || 1;
    if (roll <= 0) return r;
  }
  return pool[pool.length - 1];
}

export async function distributeSpoils(war, winnerId) {
  const out = { warbandCount: 0, warbandEmber: 0, drops: [] };
  if (!winnerId) return out;

  const fighters = (await q(
    `SELECT user_id, SUM(points)::bigint AS p
       FROM war_actions
      WHERE war_id=$1 AND tribe_id=$2
      GROUP BY user_id
      ORDER BY p DESC`,
    [war.id, winnerId]
  )).rows;
  if (!fighters.length) return out;

  const warbandEmber = Math.max(0, Number(CFG.war_spoils_warband_ember) || 0);
  if (warbandEmber > 0) {
    for (const f of fighters) {
      await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [warbandEmber, f.user_id]);
    }
    out.warbandCount = fighters.length;
    out.warbandEmber = warbandEmber;
  }

  if (Number(CFG.war_relic_drop_enabled) === 1) {
    const cap = CFG.war_relic_drop_rarity_max || 'legendary';
    const pool = (await q(
      'SELECT id, slug, name, rarity FROM relics WHERE active=true'
    )).rows.filter((r) => allowed(r.rarity, cap));

    if (pool.length) {
      const n = Math.max(0, Math.min(fighters.length, Number(CFG.war_relic_drop_count) || 0));
      for (let i = 0; i < n; i++) {
        const relic = pickWeighted(pool);
        if (!relic) continue;
        await grant(fighters[i].user_id, relic, { tribeId: winnerId, detail: 'war spoil' });
        out.drops.push({
          userId: fighters[i].user_id,
          slug: relic.slug,
          name: relic.name,
          rarity: relic.rarity,
        });
      }
    }
  }

  return out;
}