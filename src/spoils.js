/* =====================================================================
   Post-war spoils — warband ember + relic drops.
   Called from war.js maybeResolve() AFTER the winner is decided and the
   top-contributor ember split has run. All grants here are additive and
   non-conserving (ember is minted), so this never unbalances treasuries.
   Every payout is written to war_spoils_log for the chronicle / admin.
===================================================================== */
import { q } from './db.js';
import { CFG } from './config.js';

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];
const RARITY_WEIGHT = { common: 50, rare: 30, epic: 15, legendary: 5 };

function rarityAllowed(rarity, cap){
  const ri = RARITY_ORDER.indexOf(String(rarity || 'common').toLowerCase());
  const ci = RARITY_ORDER.indexOf(String(cap || 'legendary').toLowerCase());
  if (ri < 0) return false;
  return ri <= (ci < 0 ? RARITY_ORDER.length - 1 : ci);
}

function pickWeighted(pool){
  const total = pool.reduce((s, r) => s + (RARITY_WEIGHT[String(r.rarity || 'common').toLowerCase()] || 1), 0);
  if (total <= 0) return pool[0];
  let roll = Math.random() * total;
  for (const r of pool){
    roll -= (RARITY_WEIGHT[String(r.rarity || 'common').toLowerCase()] || 1);
    if (roll <= 0) return r;
  }
  return pool[pool.length - 1];
}

async function logSpoil(warId, userId, tribeId, kind, amount, relic){
  try {
    await q(
      `INSERT INTO war_spoils_log (war_id, user_id, tribe_id, kind, relic_id, relic_slug, amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [warId, userId, tribeId || null, kind, relic ? relic.id : null, relic ? relic.slug : null, amount || 0]
    );
  } catch (e){ /* log table optional */ }
}

/* Grant a relic to a user (stacking count on user_relics). */
async function grantRelic(warId, userId, tribeId, relic){
  await q(
    `INSERT INTO user_relics (user_id, relic_id, count)
     VALUES ($1,$2,1)
     ON CONFLICT (user_id, relic_id) DO UPDATE SET count = user_relics.count + 1`,
    [userId, relic.id]
  );
  await logSpoil(warId, userId, tribeId, 'relic', 0, relic);
}

/**
 * Distribute post-war spoils for the winning tribe.
 * @returns { warbandCount, warbandEmber, drops:[{userId, slug, name, rarity}] }
 */
export async function distributeSpoils(war, winnerId){
  const result = { warbandCount: 0, warbandEmber: 0, drops: [] };
  if (!winnerId) return result;

  // -------- who fought for the winning tribe (distinct kin) --------
  const fighters = (await q(
    `SELECT user_id, SUM(points)::bigint AS p
       FROM war_actions
      WHERE war_id=$1 AND tribe_id=$2
      GROUP BY user_id
      ORDER BY p DESC`,
    [war.id, winnerId]
  )).rows;
  if (!fighters.length) return result;

  // -------- flat warband ember for everyone who showed up --------
  const warbandEmber = Math.max(0, Number(CFG.war_spoils_warband_ember) || 0);
  if (warbandEmber > 0){
    for (const f of fighters){
      await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [warbandEmber, f.user_id]);
      await logSpoil(war.id, f.user_id, winnerId, 'warband_ember', warbandEmber, null);
    }
    result.warbandCount = fighters.length;
    result.warbandEmber = warbandEmber;
  }

  // -------- relic drops for the top contributors --------
  if (Number(CFG.war_relic_drop_enabled) === 1){
    const cap = CFG.war_relic_drop_rarity_max || 'legendary';
    const pool = (await q(
      `SELECT id, slug, name, rarity FROM relics WHERE active=true`
    )).rows.filter(r => rarityAllowed(r.rarity, cap));
    if (pool.length){
      const n = Math.max(0, Math.min(fighters.length, Number(CFG.war_relic_drop_count) || 0));
      for (let i = 0; i < n; i++){
        const relic = pickWeighted(pool);
        if (!relic) continue;
        await grantRelic(war.id, fighters[i].user_id, winnerId, relic);
        result.drops.push({ userId: fighters[i].user_id, slug: relic.slug, name: relic.name, rarity: relic.rarity });
      }
    }
  }

  return result;
}

/* Read the spoils ledger for one war (chronicle / admin view). */
export async function spoilsForWar(warId){
  return (await q(
    `SELECT s.*, u.first_name, u.username
       FROM war_spoils_log s
       LEFT JOIN users u ON u.id = s.user_id
      WHERE s.war_id=$1
      ORDER BY s.kind, s.amount DESC, s.id`,
    [warId]
  )).rows;
}
