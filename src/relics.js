/* =====================================================================
   TRIBES — Relics engine (BATCH B1: RELICS FOUNDATION)
     Single-equip relic model from the brief, layered on the existing
     relics / user_relics tables. Handles: catalog, ownership, equip,
     grants, chance-based packs with pity, cursed shards, war-contribution
     triggers, cursed shatter, and the personal-cursed PAUSE rule.

     This module intentionally does NOT import war.js to avoid a cycle
     (war.js imports helpers from here). All war context is passed in.
===================================================================== */
import { q } from './db.js';
import { CFG } from './config.js';
import * as Kiva from './kiva.js';

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];
const rarityRank = r => Math.max(0, RARITY_ORDER.indexOf(String(r || 'common')));

/* ---------------------------------------------------------------------
   CATALOG + STATE
--------------------------------------------------------------------- */
export async function getCatalog(){
  return (await q(
    `SELECT id, slug, name, description, rarity, category, cursed,
            effect_key, shatter_rule, pause_in_war, pack_pool, earn_hint,
            buff_type, buff_value, price_stars, image_url, svg, sort_order
       FROM relics
      WHERE active = true
      ORDER BY sort_order ASC, id ASC`
  )).rows;
}

export async function getRelicById(id){
  return (await q('SELECT * FROM relics WHERE id=$1', [id])).rows[0] || null;
}
export async function getRelicBySlug(slug){
  return (await q('SELECT * FROM relics WHERE slug=$1', [slug])).rows[0] || null;
}

// Everything the relics section needs for one user, in one call.
export async function getRelicState(userId){
  const catalog = await getCatalog();
  const owned = (await q(
    `SELECT ur.relic_id, ur.count, ur.first_at
       FROM user_relics ur WHERE ur.user_id=$1`, [userId]
  )).rows;
  const ownedMap = {};
  for (const o of owned) ownedMap[o.relic_id] = o;
  const u = (await q(
    'SELECT equipped_relic_id, cursed_shards, relic_paused_json FROM users WHERE id=$1',
    [userId]
  )).rows[0] || {};
  return {
    catalog: catalog.map(r => ({
      ...r,
      owned: !!ownedMap[r.id],
      count: ownedMap[r.id] ? Number(ownedMap[r.id].count) : 0,
      equipped: Number(u.equipped_relic_id) === Number(r.id),
    })),
    equipped_relic_id: u.equipped_relic_id || null,
    cursed_shards: Number(u.cursed_shards || 0),
    paused: u.relic_paused_json || null,
  };
}

/* ---------------------------------------------------------------------
   OWNERSHIP
--------------------------------------------------------------------- */
// Grant a relic to a user (pack pull, war drop, spin, admin). Idempotent-ish:
// bumps count if already owned. Returns { relic, isNew }.
export async function grantRelic(userId, relicRef, opts = {}){
  const relic = typeof relicRef === 'number'
    ? await getRelicById(relicRef)
    : (typeof relicRef === 'string' ? await getRelicBySlug(relicRef) : relicRef);
  if (!relic) throw new Error('no such relic');
  const before = (await q(
    'SELECT count FROM user_relics WHERE user_id=$1 AND relic_id=$2',
    [userId, relic.id]
  )).rows[0];
  await q(
    `INSERT INTO user_relics (user_id, relic_id, count)
     VALUES ($1,$2,1)
     ON CONFLICT (user_id, relic_id) DO UPDATE SET count = user_relics.count + 1`,
    [userId, relic.id]
  );
  const isNew = !before;
  await logEvent(userId, opts.tribeId, 'pull', relic, opts.detail || null);
  return { relic, isNew };
}

export async function equipRelic(userId, relicId){
  const owns = (await q(
    'SELECT 1 FROM user_relics WHERE user_id=$1 AND relic_id=$2',
    [userId, relicId]
  )).rowCount;
  if (!owns) throw new Error('you do not own that relic');
  const relic = await getRelicById(relicId);
  if (!relic || !relic.active) throw new Error('that relic is unavailable');
  await q('UPDATE users SET equipped_relic_id=$1 WHERE id=$2', [relicId, userId]);
  await logEvent(userId, null, 'equip', relic, relic.cursed ? 'cursed: will shatter on use' : null);
  return {
    ok: true,
    equipped_relic_id: relicId,
    warning: relic.cursed ? 'Equipped. This cursed relic will shatter on first use.' : null,
  };
}

export async function unequipRelic(userId){
  await q('UPDATE users SET equipped_relic_id=NULL WHERE id=$1', [userId]);
  return { ok: true, equipped_relic_id: null };
}

async function logEvent(userId, tribeId, kind, relic, detail){
  try {
    await q(
      `INSERT INTO relic_events (user_id, tribe_id, kind, relic_id, relic_slug, rarity, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, tribeId || null, kind, relic?.id || null, relic?.slug || null, relic?.rarity || null, detail || null]
    );
  } catch(e){ /* logging is best-effort */ }
}

export async function relicEvents(userId, limit = 30){
  return (await q(
    `SELECT kind, relic_slug, rarity, detail, created_at
       FROM relic_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [userId, Math.min(Number(limit) || 30, 100)]
  )).rows;
}

/* ---------------------------------------------------------------------
   PACKS (chance-based, pity)
--------------------------------------------------------------------- */
export async function getPacks(){
  return (await q(
    `SELECT slug, name, description, price_stars, pool, odds_json, pity_epic_in, active
       FROM relic_packs WHERE active = true ORDER BY price_stars ASC`
  )).rows;
}
export async function getPack(slug){
  return (await q('SELECT * FROM relic_packs WHERE slug=$1 AND active=true', [slug])).rows[0] || null;
}

// Roll a rarity tier from odds, honouring the pity guarantee.
function rollRarity(odds, pullsSinceEpic, pityEpicIn){
  // pity: if we are on the guaranteed pull and no epic+ in the window, force epic
  if (pityEpicIn > 0 && pullsSinceEpic >= (pityEpicIn - 1)){
    return odds.legendary && Math.random() < (odds.legendary || 0) ? 'legendary' : 'epic';
  }
  const roll = Math.random();
  let acc = 0;
  for (const tier of RARITY_ORDER){
    acc += Number(odds[tier] || 0);
    if (roll <= acc) return tier;
  }
  return 'common';
}

// Open one pack for a user. Debits the user's Stars balance (same balance the
// spin/store use). Rolls a rarity, then picks a not-yet-owned relic from the
// pack's pool at that rarity (falling back to nearby rarities), grants it,
// advances the pity counter, logs the pull, and posts a Rare+ Kiva pull feed.
export async function openPack(user, packSlug){
  const pack = await getPack(packSlug);
  if (!pack) throw new Error('no such pack');
  const price = Number(pack.price_stars) || 0;
  if (Number(user.stars || 0) < price) {
    const err = new Error('Not enough Stars');
    err.need = price;
    throw err;
  }

  // pity state
  const st = (await q(
    'SELECT total_pulls, pulls_since_epic FROM user_pack_state WHERE user_id=$1 AND pack_slug=$2',
    [user.id, packSlug]
  )).rows[0] || { total_pulls: 0, pulls_since_epic: 0 };

  const odds = pack.odds_json || { common: 0.55, rare: 0.30, epic: 0.12, legendary: 0.03 };
  let rarity = rollRarity(odds, Number(st.pulls_since_epic), Number(pack.pity_epic_in) || 0);

  // candidate relics in this pool the user does NOT already own
  const relic = await pickPackRelic(user.id, pack.pool, rarity);
  if (!relic) throw new Error('This pack has no relics left to give you.');
  rarity = relic.rarity; // reflect what was actually granted

  // debit + grant in one shot
  await q('UPDATE users SET stars = stars - $1 WHERE id=$2', [price, user.id]);
  await grantRelic(user.id, relic, { tribeId: user.tribe_id, detail: `from ${pack.name}` });

  // advance pity
  const gotEpicPlus = rarityRank(rarity) >= rarityRank('epic');
  await q(
    `INSERT INTO user_pack_state (user_id, pack_slug, total_pulls, pulls_since_epic)
     VALUES ($1,$2,1,$3)
     ON CONFLICT (user_id, pack_slug) DO UPDATE SET
       total_pulls = user_pack_state.total_pulls + 1,
       pulls_since_epic = $3`,
    [user.id, packSlug, gotEpicPlus ? 0 : Number(st.pulls_since_epic) + 1]
  );

  // Rare+ pull feed in the tribe Kiva (the biggest driver of pack sales)
  if (user.tribe_id && rarityRank(rarity) >= rarityRank('rare')){
    try {
      await Kiva.postMessage(
        user.tribe_id, user.id,
        `${user.username || 'A tribesperson'} pulled ${relic.name} (${rarity}) from the ${pack.name}.`,
        'relic'
      );
    } catch(e){ /* pull feed is best-effort */ }
  }

  const balance = (await q('SELECT stars FROM users WHERE id=$1', [user.id])).rows[0]?.stars;
  return { ok: true, relic, rarity, cost: price, stars: Number(balance || 0) };
}

// Pick a relic the user doesn't own from a pool at (or near) a rarity.
async function pickPackRelic(userId, pool, rarity){
  const tiers = [rarity,
    ...RARITY_ORDER.filter(r => r !== rarity)]; // prefer the rolled tier, then any
  for (const tier of tiers){
    const rows = (await q(
      `SELECT r.* FROM relics r
        WHERE r.active = true AND r.pack_pool = $1 AND r.rarity = $2
          AND NOT EXISTS (SELECT 1 FROM user_relics ur WHERE ur.user_id=$3 AND ur.relic_id=r.id)
        ORDER BY random() LIMIT 1`,
      [pool, tier, userId]
    )).rows;
    if (rows.length) return rows[0];
  }
  return null;
}

/* ---------------------------------------------------------------------
   CURSED SHARDS (the bad-luck safety net)
--------------------------------------------------------------------- */
export async function grantShard(userId, n = 1){
  await q('UPDATE users SET cursed_shards = COALESCE(cursed_shards,0) + $1 WHERE id=$2', [n, userId]);
}

// 5 shards -> a guaranteed Rare cursed relic; 20 -> a guaranteed Legendary.
export async function redeemShards(user, tier){
  const cost = tier === 'legendary' ? 20 : 5;
  const wantRarity = tier === 'legendary' ? 'legendary' : 'rare';
  const have = Number((await q('SELECT cursed_shards FROM users WHERE id=$1', [user.id])).rows[0]?.cursed_shards || 0);
  if (have < cost) { const e = new Error('Not enough shards'); e.need = cost; throw e; }
  const relic = await pickPackRelic(user.id, 'cursed', wantRarity);
  if (!relic) throw new Error('No cursed relics of that tier left to give you.');
  await q('UPDATE users SET cursed_shards = cursed_shards - $1 WHERE id=$2', [cost, user.id]);
  await grantRelic(user.id, relic, { tribeId: user.tribe_id, detail: `${cost} shards redeemed` });
  await logEvent(user.id, user.tribe_id, 'shard_redeem', relic, `${cost} shards`);
  const left = Number((await q('SELECT cursed_shards FROM users WHERE id=$1', [user.id])).rows[0]?.cursed_shards || 0);
  return { ok: true, relic, shards: left };
}

/* ---------------------------------------------------------------------
   WAR TRIGGERS  (called from war.js recordAction, inside its transaction)
     Returns a MULTIPLIER (>=1) to apply to a war contribution based on the
     user's equipped relic. Uses the passed pg client so it joins the same
     transaction. Never throws — relics are optional flavour on the hot path.
--------------------------------------------------------------------- */
export async function warRelicMult(client, userId, ctx){
  try {
    const u = (await client.query(
      'SELECT equipped_relic_id, relic_paused_json FROM users WHERE id=$1', [userId]
    )).rows[0];
    if (!u || !u.equipped_relic_id) return { mult: 1 };
    const r = (await client.query('SELECT * FROM relics WHERE id=$1', [u.equipped_relic_id])).rows[0];
    if (!r) return { mult: 1 };
    // PAUSE RULE: personal cursed relics do nothing during a war
    if (r.pause_in_war) return { mult: 1 };

    const val = Number(r.buff_value) || 0;
    const key = r.effect_key || r.buff_type;
    const { side, war, front, tribe } = ctx;
    const mineCol = side === 'attacker' ? 'attacker_score' : 'defender_score';
    const foeCol  = side === 'attacker' ? 'defender_score' : 'attacker_score';

    switch (key){
      case 'flat_war':
      case 'war_boost':
      case 'blood_iron':
      case 'warchief_banner':
        return { mult: 1 + val, relic: r };

      case 'warpaint_first5': {
        const n = Number((await client.query(
          'SELECT count(*)::int c FROM war_actions WHERE war_id=$1 AND user_id=$2',
          [war.id, userId]
        )).rows[0]?.c || 0);
        return { mult: n < 5 ? 1 + val : 1, relic: r };
      }
      case 'behind_boost': {
        const f = (await client.query(
          `SELECT ${mineCol} m, ${foeCol} o FROM war_fronts WHERE war_id=$1 AND idx=$2`,
          [war.id, front.idx]
        )).rows[0];
        const behind = f && Number(f.m) < Number(f.o);
        return { mult: behind ? 1 + val : 1, relic: r };
      }
      case 'vengeance_boost':
      case 'serpent_fang': {
        const foeId = side === 'attacker' ? war.defender_id : war.attacker_id;
        const tok = Number((await client.query(
          `SELECT COALESCE(SUM(GREATEST(0, tokens - spent)),0)::int t
             FROM war_vengeance WHERE tribe_id=$1 AND target_id=$2
               AND (expires_at IS NULL OR expires_at > now())`,
          [tribe.id, foeId]
        )).rows[0]?.t || 0);
        return { mult: tok > 0 ? 1 + val : 1, relic: r };
      }
      case 'day3_boost': {
        const start = new Date(war.start_at || war.started_at || war.created_at || Date.now());
        const day = Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
        return { mult: day >= 3 ? 1 + val : 1, relic: r };
      }
      case 'night_boost': {
        const nightTerrain = front.terrain === 'swamp' || front.terrain === 'ashlands';
        return { mult: nightTerrain ? 1 + val : 1, relic: r };
      }
      default:
        return { mult: 1, relic: r };
    }
  } catch(e){
    return { mult: 1 };
  }
}

/* ---------------------------------------------------------------------
   CURSED SHATTER
     Called (best-effort, own connection) after a qualifying war event.
     If the equipped relic is cursed and its shatter_rule matches, it is
     unequipped, removed from inventory, and the player gains 1 Cursed Shard.
--------------------------------------------------------------------- */
export async function maybeShatter(userId, trigger, opts = {}){
  try {
    const u = (await q(
      'SELECT equipped_relic_id, tribe_id, username FROM users WHERE id=$1', [userId]
    )).rows[0];
    if (!u || !u.equipped_relic_id) return null;
    const r = (await q('SELECT * FROM relics WHERE id=$1', [u.equipped_relic_id])).rows[0];
    if (!r || !r.cursed || !r.shatter_rule) return null;
    if (r.shatter_rule !== trigger) return null;

    // shatter: unequip, consume one copy, grant a shard
    await q('UPDATE users SET equipped_relic_id=NULL WHERE id=$1', [userId]);
    await q(
      `UPDATE user_relics SET count = GREATEST(0, count - 1)
        WHERE user_id=$1 AND relic_id=$2`,
      [userId, r.id]
    );
    await q('DELETE FROM user_relics WHERE user_id=$1 AND relic_id=$2 AND count <= 0', [userId, r.id]);
    await grantShard(userId, 1);
    await logEvent(userId, u.tribe_id, 'shatter', r, `shattered on ${trigger}`);
    if (u.tribe_id){
      try {
        await Kiva.postMessage(
          u.tribe_id, userId,
          `${u.username || 'A tribesperson'}'s ${r.name} shattered — a Cursed Shard remains.`,
          'relic'
        );
      } catch(e){ /* best-effort */ }
    }
    return { shattered: r.slug, shard: 1 };
  } catch(e){
    return null;
  }
}

/* ---------------------------------------------------------------------
   PERSONAL PAUSE RULE
     When a tribe enters a war, personal cursed relics pause (their effect
     stops; their progress is preserved). When the war ends, they resume.
     For the foundation we snapshot the equipped personal-cursed relic id so
     the UI can show a "paused" chip; warRelicMult already returns mult 1 for
     pause_in_war relics, so no war benefit leaks through.
--------------------------------------------------------------------- */
export async function pauseForWar(tribeId){
  try {
    await q(
      `UPDATE users u SET relic_paused_json = jsonb_build_object('relic_id', u.equipped_relic_id, 'paused_at', now())
         FROM relics r
        WHERE u.tribe_id=$1 AND u.equipped_relic_id = r.id
          AND r.cursed = true AND r.pause_in_war = true`,
      [tribeId]
    );
  } catch(e){ /* best-effort */ }
}
export async function resumeAfterWar(tribeId){
  try {
    await q('UPDATE users SET relic_paused_json = NULL WHERE tribe_id=$1 AND relic_paused_json IS NOT NULL', [tribeId]);
  } catch(e){ /* best-effort */ }
}

// On war end, shatter every equipped cursed relic whose rule fires at war end
// (e.g. 'first_war', 'after_next_war') for all members of a tribe.
export async function shatterTribeOnWarEnd(tribeId){
  try {
    const rows = (await q(
      `SELECT u.id AS user_id, r.shatter_rule
         FROM users u JOIN relics r ON r.id = u.equipped_relic_id
        WHERE u.tribe_id=$1 AND r.cursed = true
          AND r.shatter_rule IN ('first_war','after_next_war')`,
      [tribeId]
    )).rows;
    for (const row of rows){
      await maybeShatter(row.user_id, row.shatter_rule);
    }
  } catch(e){ /* best-effort */ }
}
