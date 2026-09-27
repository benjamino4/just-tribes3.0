// TRIBES-FILE: server/src/relics.js
// PHASE: 4 — Relics
// Catalog, ownership, wield, packs with pity, shards, shatter, pause.

import { q } from './db.js';
import { CFG } from './config.js';

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];
const rank = (r) => Math.max(0, RARITY_ORDER.indexOf(String(r || 'common')));

/* ---------- catalog ---------- */
export async function catalog() {
  return (await q(
    `SELECT id, slug, name, description, rarity, category, cursed,
            effect_key, shatter_rule, pause_in_war, pack_pool, earn_hint,
            buff_type, buff_value, price_stars, icon_file, svg, image_url, sort_order
       FROM relics WHERE active = true
      ORDER BY sort_order ASC, id ASC`
  )).rows;
}

export async function byId(id) {
  return (await q('SELECT * FROM relics WHERE id=$1', [id])).rows[0] || null;
}
export async function bySlug(slug) {
  return (await q('SELECT * FROM relics WHERE slug=$1', [slug])).rows[0] || null;
}

/* ---------- full state for one user ---------- */
export async function stateFor(userId) {
  const cat = await catalog();
  const owned = (await q(
    'SELECT relic_id, count, first_at FROM user_relics WHERE user_id=$1',
    [userId]
  )).rows;
  const ownedMap = {};
  for (const o of owned) ownedMap[o.relic_id] = o;
  const u = (await q(
    'SELECT equipped_relic_id, cursed_shards, relic_paused_json FROM users WHERE id=$1',
    [userId]
  )).rows[0] || {};

  const fusion = await fusionState(userId);

  return {
    catalog: cat.map((r) => ({
      ...r,
      buff_value: Number(r.buff_value) || 0,
      owned: !!ownedMap[r.id],
      count: ownedMap[r.id] ? Number(ownedMap[r.id].count) : 0,
      equipped: Number(u.equipped_relic_id) === Number(r.id),
    })),
    equipped_relic_id: u.equipped_relic_id || null,
    cursed_shards: Number(u.cursed_shards || 0),
    paused: u.relic_paused_json || null,
    fusion,
  };
}

/* ---------- grant / wield ---------- */
export async function grant(userId, relicRef, opts = {}) {
  const relic = typeof relicRef === 'number'
    ? await byId(relicRef)
    : (typeof relicRef === 'string' ? await bySlug(relicRef) : relicRef);
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

  await logEvent(userId, opts.tribeId, 'pull', relic, opts.detail || null);
  return { relic, isNew: !before };
}

export async function wield(userId, relicId) {
  const owns = await q(
    'SELECT 1 FROM user_relics WHERE user_id=$1 AND relic_id=$2',
    [userId, relicId]
  );
  if (!owns.rowCount) throw new Error('you do not own that relic');

  const relic = await byId(relicId);
  if (!relic || !relic.active) throw new Error('that relic is unavailable');

  await q('UPDATE users SET equipped_relic_id=$1 WHERE id=$2', [relicId, userId]);
  await logEvent(userId, null, 'equip', relic, relic.cursed ? 'cursed' : null);

  return {
    ok: true,
    equipped_relic_id: relicId,
    warning: relic.cursed
      ? 'Wielded. This cursed relic will shatter on first use.'
      : null,
  };
}

export async function unwield(userId) {
  await q('UPDATE users SET equipped_relic_id=NULL WHERE id=$1', [userId]);
  return { ok: true, equipped_relic_id: null };
}

async function logEvent(userId, tribeId, kind, relic, detail) {
  try {
    await q(
      `INSERT INTO relic_events (user_id, tribe_id, kind, relic_id, relic_slug, rarity, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, tribeId || null, kind, relic?.id || null, relic?.slug || null,
       relic?.rarity || null, detail || null]
    );
  } catch {}
}

export async function events(userId, limit = 30) {
  return (await q(
    `SELECT kind, relic_slug, rarity, detail, created_at
       FROM relic_events WHERE user_id=$1
      ORDER BY created_at DESC LIMIT $2`,
    [userId, Math.min(Number(limit) || 30, 100)]
  )).rows;
}

/* ---------- fusion ---------- */
export const FUSE_COST = 3;

function nextRarity(rarity) {
  const i = RARITY_ORDER.indexOf(rarity);
  return (i < 0 || i >= RARITY_ORDER.length - 1) ? null : RARITY_ORDER[i + 1];
}

export async function fusionState(userId) {
  const rows = (await q(
    `SELECT r.rarity, COALESCE(SUM(GREATEST(ur.count - 1, 0)),0)::int AS spare
       FROM user_relics ur JOIN relics r ON r.id = ur.relic_id
      WHERE ur.user_id=$1 GROUP BY r.rarity`,
    [userId]
  )).rows;
  const spare = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (const r of rows) spare[r.rarity] = Number(r.spare) || 0;
  const can = {};
  for (const rr of RARITY_ORDER) {
    can[rr] = !!nextRarity(rr) && spare[rr] >= FUSE_COST;
  }
  return { spare, cost: FUSE_COST, can };
}

export async function fuse(user, rarity) {
  const to = nextRarity(rarity);
  if (!to) throw new Error('that rarity cannot be reforged');

  const dups = (await q(
    `SELECT ur.relic_id, ur.count, r.slug
       FROM user_relics ur JOIN relics r ON r.id = ur.relic_id
      WHERE ur.user_id=$1 AND r.rarity=$2 AND ur.count > 1
      ORDER BY ur.count DESC`,
    [user.id, rarity]
  )).rows;

  const total = dups.reduce((a, d) => a + (d.count - 1), 0);
  if (total < FUSE_COST) throw new Error(`need ${FUSE_COST} duplicate ${rarity} relics to reforge`);

  let need = FUSE_COST;
  for (const d of dups) {
    if (need <= 0) break;
    const take = Math.min(need, d.count - 1);
    await q(
      'UPDATE user_relics SET count = count - $1 WHERE user_id=$2 AND relic_id=$3',
      [take, user.id, d.relic_id]
    );
    need -= take;
  }

  let reward = (await q(
    `SELECT r.* FROM relics r
      WHERE r.active=true AND r.rarity=$1
        AND NOT EXISTS (SELECT 1 FROM user_relics ur WHERE ur.user_id=$2 AND ur.relic_id=r.id)
      ORDER BY random() LIMIT 1`,
    [to, user.id]
  )).rows[0];

  if (!reward) {
    reward = (await q(
      'SELECT * FROM relics WHERE active=true AND rarity=$1 ORDER BY random() LIMIT 1',
      [to]
    )).rows[0];
  }
  if (!reward) throw new Error(`no ${to} relics exist to reforge into`);

  await grant(user.id, reward, { tribeId: user.tribe_id, detail: `reforged from ${FUSE_COST}x ${rarity}` });
  await q(
    `INSERT INTO relic_fusions (user_id, from_rarity, to_rarity, consumed, result_id, result_slug)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [user.id, rarity, to, FUSE_COST, reward.id, reward.slug]
  );
  await logEvent(user.id, user.tribe_id, 'reforge', reward, `${FUSE_COST}x ${rarity} → ${to}`);

  return { ok: true, reward, from: rarity, to, consumed: FUSE_COST };
}

/* ---------- packs ---------- */
export async function packs() {
  return (await q(
    `SELECT slug, name, description, price_stars, pool, odds_json, pity_epic_in,
            anim_preset, anim_json, active
       FROM relic_packs WHERE active = true
      ORDER BY price_stars ASC`
  )).rows;
}

export async function pack(slug) {
  return (await q(
    'SELECT * FROM relic_packs WHERE slug=$1 AND active=true',
    [slug]
  )).rows[0] || null;
}

function rollRarity(odds, pullsSinceEpic, pityEpicIn) {
  if (pityEpicIn > 0 && pullsSinceEpic >= (pityEpicIn - 1)) {
    return (odds.legendary && Math.random() < (odds.legendary || 0)) ? 'legendary' : 'epic';
  }
  const roll = Math.random();
  let acc = 0;
  for (const tier of RARITY_ORDER) {
    acc += Number(odds[tier] || 0);
    if (roll <= acc) return tier;
  }
  return 'common';
}

async function pickPackRelic(userId, pool, rarity) {
  const tiers = [rarity, ...RARITY_ORDER.filter((r) => r !== rarity)];
  for (const tier of tiers) {
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

export async function openPack(user, slug) {
  const pk = await pack(slug);
  if (!pk) throw new Error('no such pack');

  const price = Number(pk.price_stars) || 0;
  const blessed = !!user.blessed;
  if (!blessed && Number(user.stars || 0) < price) {
    const e = new Error('Not enough Stars');
    e.need = price;
    throw e;
  }

  // Serialize pity state per user via a row lock in a transaction
  const { pool } = await import('./db.js');
  const client = await pool.connect();
  let result;
  try {
    await client.query('BEGIN');

    // ensure a row exists, lock it
    await client.query(
      `INSERT INTO user_pack_state (user_id, pack_slug, total_pulls, pulls_since_epic)
       VALUES ($1,$2,0,0) ON CONFLICT (user_id, pack_slug) DO NOTHING`,
      [user.id, slug]
    );
    const st = (await client.query(
      `SELECT total_pulls, pulls_since_epic FROM user_pack_state
        WHERE user_id=$1 AND pack_slug=$2 FOR UPDATE`,
      [user.id, slug]
    )).rows[0];

    const odds = pk.odds_json || { common: 0.55, rare: 0.30, epic: 0.12, legendary: 0.03 };
    let rarity = rollRarity(odds, Number(st.pulls_since_epic), Number(pk.pity_epic_in) || 0);

    const relic = await pickPackRelic(user.id, pk.pool, rarity);
    if (!relic) throw new Error('This pack has no relics left to give you.');
    rarity = relic.rarity;

    if (!blessed) {
      await client.query('UPDATE users SET stars = stars - $1 WHERE id=$2', [price, user.id]);
    }
    await client.query(
      `INSERT INTO user_relics (user_id, relic_id, count)
       VALUES ($1,$2,1)
       ON CONFLICT (user_id, relic_id) DO UPDATE SET count = user_relics.count + 1`,
      [user.id, relic.id]
    );

    const gotEpicPlus = rank(rarity) >= rank('epic');
    await client.query(
      `UPDATE user_pack_state
          SET total_pulls = total_pulls + 1,
              pulls_since_epic = $3
        WHERE user_id=$1 AND pack_slug=$2`,
      [user.id, slug, gotEpicPlus ? 0 : Number(st.pulls_since_epic) + 1]
    );

    await client.query('COMMIT');

    await logEvent(user.id, user.tribe_id, 'pull', relic, `from ${pk.name}`);

    result = {
      ok: true,
      relic,
      rarity,
      cost: blessed ? 0 : price,
      blessed,
      anim_preset: pk.anim_preset || 'ember',
      anim_json: pk.anim_json || {},
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  // refresh balance for the client
  const balance = (await q('SELECT stars FROM users WHERE id=$1', [user.id])).rows[0];
  result.stars = Number(balance?.stars || 0);

  // Rare+ pull shows in Kiva
  if (user.tribe_id && rank(result.rarity) >= rank('rare')) {
    try {
      const Kiva = await import('./kiva.js');
      await Kiva.postMessage(
        user.tribe_id, user.id,
        `${user.username || 'A tribesperson'} drew ${result.relic.name} (${result.rarity}) from the ${pk.name}.`,
        'relic'
      );
    } catch {}
  }

  return result;
}

/* ---------- shards ---------- */
export async function grantShard(userId, n = 1) {
  await q(
    'UPDATE users SET cursed_shards = COALESCE(cursed_shards,0) + $1 WHERE id=$2',
    [n, userId]
  );
}

export async function redeemShards(user, tier) {
  const cost = tier === 'legendary' ? 20 : 5;
  const want = tier === 'legendary' ? 'legendary' : 'rare';

  const have = Number((await q(
    'SELECT cursed_shards FROM users WHERE id=$1', [user.id]
  )).rows[0]?.cursed_shards || 0);
  if (have < cost) {
    const e = new Error('Not enough shards');
    e.need = cost;
    throw e;
  }

  const relic = await pickPackRelic(user.id, 'cursed', want);
  if (!relic) throw new Error('No cursed relics of that tier left to give you.');

  await q(
    'UPDATE users SET cursed_shards = cursed_shards - $1 WHERE id=$2',
    [cost, user.id]
  );
  await grant(user.id, relic, { tribeId: user.tribe_id, detail: `${cost} shards redeemed` });
  await logEvent(user.id, user.tribe_id, 'shard_redeem', relic, `${cost} shards`);

  const left = Number((await q(
    'SELECT cursed_shards FROM users WHERE id=$1', [user.id]
  )).rows[0]?.cursed_shards || 0);

  return { ok: true, relic, shards: left };
}

/* ---------- cursed shatter ---------- */
export async function maybeShatter(userId, trigger) {
  try {
    const u = (await q(
      'SELECT equipped_relic_id, tribe_id, username FROM users WHERE id=$1',
      [userId]
    )).rows[0];
    if (!u || !u.equipped_relic_id) return null;

    const r = (await q(
      'SELECT * FROM relics WHERE id=$1', [u.equipped_relic_id]
    )).rows[0];
    if (!r || !r.cursed || !r.shatter_rule) return null;
    if (r.shatter_rule !== trigger) return null;

    await q('UPDATE users SET equipped_relic_id=NULL WHERE id=$1', [userId]);
    await q(
      `UPDATE user_relics SET count = GREATEST(0, count - 1)
        WHERE user_id=$1 AND relic_id=$2`,
      [userId, r.id]
    );
    await q(
      'DELETE FROM user_relics WHERE user_id=$1 AND relic_id=$2 AND count <= 0',
      [userId, r.id]
    );
    await grantShard(userId, 1);
    await logEvent(userId, u.tribe_id, 'shatter', r, `shattered on ${trigger}`);

    if (u.tribe_id) {
      try {
        const Kiva = await import('./kiva.js');
        await Kiva.postMessage(
          u.tribe_id, userId,
          `${u.username || 'A tribesperson'}'s ${r.name} shattered — an Ashen Shard remains.`,
          'relic'
        );
      } catch {}
    }

    return { shattered: r.slug, shard: 1 };
  } catch {
    return null;
  }
}

/* ---------- pause rule ---------- */
export async function pauseForWar(tribeId) {
  try {
    await q(
      `UPDATE users u
          SET relic_paused_json = jsonb_build_object('relic_id', u.equipped_relic_id, 'paused_at', now())
         FROM relics r
        WHERE u.tribe_id=$1
          AND u.equipped_relic_id = r.id
          AND r.cursed = true
          AND r.pause_in_war = true`,
      [tribeId]
    );
  } catch {}
}

export async function resumeAfterWar(tribeId) {
  try {
    await q(
      'UPDATE users SET relic_paused_json=NULL WHERE tribe_id=$1 AND relic_paused_json IS NOT NULL',
      [tribeId]
    );
  } catch {}
}

/* ---------- emoji sets (spec point 6) ---------- */
export async function emojiState(user) {
  const sets = (await q(
    `SELECT slug, name, description, price_stars, emoji_keys, sort_order
       FROM emoji_sets WHERE active=true
      ORDER BY sort_order, id`
  )).rows;
  const owned = (await q(
    'SELECT set_slug FROM user_emoji_sets WHERE user_id=$1',
    [user.id]
  )).rows.map((r) => r.set_slug);
  const ownedSet = new Set(owned);
  ownedSet.add('free');

  return {
    sets: sets.map((s) => ({
      slug: s.slug,
      name: s.name,
      description: s.description,
      price: Number(s.price_stars),
      emojis: s.emoji_keys || [],
      unlocked: ownedSet.has(s.slug) || Number(s.price_stars) === 0,
    })),
  };
}

export async function unlockEmoji(user, slug) {
  const s = (await q(
    'SELECT * FROM emoji_sets WHERE slug=$1 AND active=true', [slug]
  )).rows[0];
  if (!s) throw new Error('no such set');
  if (Number(s.price_stars) === 0) return { ok: true, already: true };

  const owned = await q(
    'SELECT 1 FROM user_emoji_sets WHERE user_id=$1 AND set_slug=$2',
    [user.id, slug]
  );
  if (owned.rowCount) return { ok: true, already: true };

  const blessed = !!user.blessed;
  const price = Number(s.price_stars);
  if (!blessed && Number(user.stars || 0) < price) {
    const e = new Error('Not enough Stars');
    e.need = price;
    throw e;
  }

  if (!blessed) {
    await q('UPDATE users SET stars = stars - $1 WHERE id=$2', [price, user.id]);
  }
  await q(
    'INSERT INTO user_emoji_sets (user_id, set_slug) VALUES ($1,$2)',
    [user.id, slug]
  );

  const balance = Number((await q(
    'SELECT stars FROM users WHERE id=$1', [user.id]
  )).rows[0]?.stars || 0);

  return { ok: true, stars: balance, blessed };
}

/* =====================================================================
   WAR HOOKS — added to complete Phase 6/7 (war.js depends on these).
   warRelicMult: a wielded, non-paused war relic amplifies a member's
   war contribution. shatterTribeOnWarEnd: cursed relics ruled to break
   at war's end are shattered tribe-wide.
   ===================================================================== */

// Buff types / effect keys that count as war amplifiers.
const WAR_BUFF_TYPES = new Set(['war', 'war_mult', 'war_might', 'war_attack', 'warband']);

export async function warRelicMult(client, userId, ctx = {}) {
  const query = client && typeof client.query === 'function'
    ? (text, params) => client.query(text, params)
    : (text, params) => q(text, params);
  try {
    const u = (await query(
      'SELECT equipped_relic_id, relic_paused_json FROM users WHERE id=$1',
      [userId]
    )).rows[0];
    if (!u || !u.equipped_relic_id) return { mult: 1 };
    // A relic paused for the duration of the war grants nothing.
    if (u.relic_paused_json) return { mult: 1 };

    const r = (await query('SELECT * FROM relics WHERE id=$1', [u.equipped_relic_id])).rows[0];
    if (!r || !r.active) return { mult: 1 };

    const key = String(r.effect_key || '').toLowerCase();
    const type = String(r.buff_type || '').toLowerCase();
    const isWar = WAR_BUFF_TYPES.has(type) || key.includes('war');
    if (!isWar) return { mult: 1 };

    const bv = Number(r.buff_value) || 0;
    if (bv <= 0) return { mult: 1 };
    // buff_value stored as a percentage (e.g. 12 -> +12%) or a fraction.
    const frac = bv > 1 ? bv / 100 : bv;
    return { mult: 1 + frac, relic: r.slug };
  } catch {
    return { mult: 1 };
  }
}

export async function shatterTribeOnWarEnd(tribeId) {
  try {
    if (!tribeId) return { shattered: 0 };
    const rows = (await q(
      `SELECT u.id
         FROM users u
         JOIN relics r ON r.id = u.equipped_relic_id
        WHERE u.tribe_id=$1
          AND r.cursed = true
          AND r.shatter_rule = 'war_end'`,
      [tribeId]
    )).rows;
    let n = 0;
    for (const row of rows) {
      const res = await maybeShatter(row.id, 'war_end');
      if (res) n += 1;
    }
    return { shattered: n };
  } catch {
    return { shattered: 0 };
  }
}

// Alias: some callers (stars.js) import grant() as grantRelic.
export const grantRelic = grant;
