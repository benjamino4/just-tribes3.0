/* =====================================================================
   REST API for TRIBES.
===================================================================== */
import express from 'express';
import { q } from './db.js';
import { resolveUser } from './auth.js';
import {
  CHALLENGES, pickChallenge, maybeResolve, getTribeMetric,
  createFronts, getFronts, recordAction, momentumFor, activeLegendary,
  scheduleLegendary, recordDefenderAction, currentSeason, tribeScore,
  listTactics, warHint, pickFoe, getVengeance, listVengeance,
  areAllied, formBloodAlliance, breakBloodAlliance, listAlliances,
} from './war.js';
import { STAR_ITEMS, createStarInvoice, handleWebhook } from './stars.js';
import { TON_ITEMS, makeIntent, verifyPayment, linkWallet, tonConfigured, receiveAddress } from './ton.js';
import { CFG, PALETTES, BANNERS, parseJSON, cfgJSON } from './config.js';
import { isAdmin } from './admin.js';
import { listTrials, trialAvailable, completeTrial } from './trials.js';
import { feedWrite } from './feed.js';
import * as Kiva from './kiva.js';
import crypto from 'crypto';
import { council } from './council.js';
import {
  getRelicState, equipRelic, unequipRelic, getPacks, openPack,
  redeemShards, relicEvents, pauseForWar,
} from './relics.js';

export const router = express.Router();

/* ---------- rate limit ---------- */
const buckets = new Map();
function rateLimit(key, perMin){
  return (req, res, next) => {
    const id = `${key}:${req.user?.id || req.ip}`;
    const now = Date.now();
    const b = buckets.get(id) || { n:0, resetAt: now + 60000 };
    if (now > b.resetAt){ b.n = 0; b.resetAt = now + 60000; }
    b.n++;
    buckets.set(id, b);
    if (b.n > perMin) return res.status(429).json({ error:'slow down' });
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
}, 60000).unref();

/* ---------- roles ---------- */
const ROLE_TIERS = [[20000,'Head'],[8000,'Elder'],[2000,'Hunter'],[500,'Kin'],[0,'Toddler']];
function roleFor(l){ for (const [t, r] of ROLE_TIERS) if (l >= t) return r; return 'Toddler'; }

/* ---------- auth middleware ---------- */
router.use(async (req, res, next) => {
  try {
    const r = await resolveUser(req);
    if (!r) return res.status(401).json({ error:'unauthorized', hint:'Open inside Telegram.' });
    if (r.error === 'no_username') return res.status(401).json({
      error:'no_username', hint:'Set a Telegram username to enter the tribes.', deepLink:'tg://settings',
    });
    const u = r.user;
    if (u.banned) return res.status(403).json({ error:'banned', reason: u.ban_reason || 'You were banished.' });
    if (Number(CFG.maintenance) && req.method === 'POST')
      return res.status(503).json({ error:'maintenance' });
    req.user = u;
    next();
  } catch(e){ next(e); }
});

/* ---------- War Council (roles, muster, idols, relics) ---------- */
router.use('/council', council);

/* ---------- helpers ---------- */
async function tribeOf(u){
  if (!u.tribe_id) return null;
  return (await q('SELECT * FROM tribes WHERE id=$1', [u.tribe_id])).rows[0] || null;
}
async function refreshUserRole(u){
  const t = await tribeOf(u);
  let role = roleFor(Number(u.loyalty));
  if (t && Number(t.created_by) === Number(u.id)) role = 'Chief';
  if (role !== u.role){
    await q('UPDATE users SET role=$1 WHERE id=$2', [role, u.id]);
    u.role = role;
  }
  return role;
}
async function addLoyalty(u, n){
  await q('UPDATE users SET loyalty = loyalty + $1 WHERE id=$2', [n, u.id]);
  if (u.tribe_id)
    await q('UPDATE tribes SET loyalty_total = loyalty_total + $1 WHERE id=$2', [n, u.tribe_id]);
  u.loyalty = Number(u.loyalty) + n;
}
function levelTable(){
  return {
    caps:  parseJSON(CFG.tribe_level_caps,  [5,8,12,18,25,35,50,70,90,120]),
    costs: parseJSON(CFG.tribe_level_costs, [0,25000,60000,140000,300000,600000,1200000,2400000,4800000,9600000]),
    names: parseJSON(CFG.tribe_level_names, ['Band','Camp','Village','Settlement','Stronghold','Fortress','Domain','Realm','Empire','Kingdom']),
  };
}
async function activeBonfire(){
  const r = await q(
    `SELECT id, title, metric, multiplier, start_at, end_at
       FROM bonfire_events WHERE start_at <= now() AND end_at > now()
       ORDER BY start_at DESC LIMIT 1`
  );
  return r.rows[0] || null;
}
async function activeRaids(){
  const r = await q(
    `SELECT id, kind, title, description, icon, effect_json, target_tribe, starts_at, ends_at
       FROM raids WHERE starts_at <= now() AND ends_at > now()
       ORDER BY starts_at DESC LIMIT 10`
  );
  return r.rows;
}

/* ================= STATE ================= */
router.get('/state', rateLimit('state', 120), async (req, res, next) => { try {
  const u = req.user;
  await refreshUserRole(u);
  const fresh = (await q('SELECT * FROM users WHERE id=$1', [u.id])).rows[0];
  const tribe = await tribeOf(fresh);

  const now = Date.now();
  const readyAt = fresh.ash_ready_at ? new Date(fresh.ash_ready_at).getTime() : now;
  const elapsed = Math.max(0, now - (readyAt - CFG.ashMinutes*60000));
  let ashPending = fresh.ash_ready_at
    ? Math.min(CFG.ashCap, Math.floor(elapsed / (CFG.ashMinutes*60000)))
    : 0;

  const lb = (await q(
    `SELECT id,name,hue,banner,palette,loyalty_total,members,wins,losses,treasury,level
       FROM tribes ORDER BY loyalty_total DESC LIMIT 20`
  )).rows;

  // Currently selected avatar (if any + still active)
  const avatar = fresh.avatar_id
    ? (await q('SELECT id,slug,name,svg FROM avatars WHERE id=$1 AND active=true', [fresh.avatar_id])).rows[0] || null
    : null;

  const trials = await listTrials(false);
  const state = fresh.trials_state || {};
  const nowMs = Date.now();
  const trialsView = trials.map(t => {
    const av = trialAvailable(t, state, nowMs);
    return { ...t, available: av.ok, reason: av.reason || null, nextIn: av.nextIn || 0 };
  });

  // Daily quests
  const todayKey = new Date().toISOString().slice(0, 10);
  const dqPool = (await q(`SELECT * FROM daily_quests WHERE active=true ORDER BY weight DESC LIMIT 6`)).rows;
  const dqPick = pickThreeDaily(dqPool, fresh.id, todayKey);
  const dqLog = (await q(
    `SELECT quest_id, progress, claimed_at FROM daily_quest_log
      WHERE user_id=$1 AND day_key=$2`,
    [fresh.id, todayKey]
  )).rows;
  const dqMap = {};
  for (const row of dqLog) dqMap[row.quest_id] = row;
  const dailyQuests = dqPick.map(qdef => ({
    ...qdef,
    progress: dqMap[qdef.id]?.progress || 0,
    claimed: !!dqMap[qdef.id]?.claimed_at,
  }));

  // Spin status
  const spinCfg = (await q(`SELECT * FROM spin_config WHERE id=1`)).rows[0];
  const spinToday = (await q(
    `SELECT count(*)::int AS n FROM spin_log WHERE user_id=$1 AND day_key=$2`,
    [fresh.id, todayKey]
  )).rows[0].n;
  const spinRewards = (await q(
    `SELECT id, slot_index, kind, amount, weight, icon, label
       FROM spin_rewards WHERE active=true ORDER BY slot_index`
  )).rows;
  const freeAvailable = spinToday < (spinCfg?.free_spins_per_day || 1);
  const paidLeft = Math.max(0, (spinCfg?.max_paid_per_day || 3) - Math.max(0, spinToday - (spinCfg?.free_spins_per_day || 1)));

  const bonfire = await activeBonfire();
  const season = await currentSeason();
  const raids = await activeRaids();

  // Referral
  const refCode = fresh.referral_code;
  const refStats = (await q(
    `SELECT count(*)::int AS n, coalesce(sum(reward_ember),0)::bigint AS e
       FROM referral_events WHERE referrer_id=$1`,
    [fresh.id]
  )).rows[0];

  res.json({
    user: fresh,
    tribe,
    ashPending, ashUnit: CFG.ashUnit,
    isAdmin: isAdmin(fresh.id),
    config: {
      ashMinutes: CFG.ashMinutes, ashCap: CFG.ashCap, foundEmber: CFG.foundEmber,
      maintenance: Number(CFG.maintenance) ? 1 : 0,
      allowWar: Number(CFG.allowWar) ? 1 : 0,
      allowStore: Number(CFG.allowStore) ? 1 : 0,
      palette: PALETTES, banners: BANNERS,
      levelTable: levelTable(),
      starterBundlePrice: Number(CFG.starter_bundle_price_stars) || 150,
      war_front_count: Number(CFG.war_front_count) || 3,
      war_front_names: cfgJSON('war_front_names', ['North','Center','South']),
      war_stances: cfgJSON('war_stances', []),
      war_cries: cfgJSON('war_cries', []),
      season_length_weeks: Number(CFG.season_length_weeks) || 6,
    },
    leaderboard: lb,
    challenges: CHALLENGES.map(c => ({
      id:c.id, name:c.name, glyph:c.glyph, desc:c.desc, days:c.days, stake:c.stake,
    })),
    payments: {
      starItems: STAR_ITEMS,
      tonItems: TON_ITEMS,
      tonEnabled: tonConfigured(),
      tonAddress: receiveAddress(),
    },
    trials: trialsView,
    dailyQuests,
    spin: {
      freeAvailable,
      paidLeft,
      starsPerSpin: spinCfg?.stars_per_spin || 25,
      rewards: spinRewards,
    },
    referral: {
      code: refCode,
      invited: refStats.n,
      earned: Number(refStats.e),
    },
    bonfire,
    season: season ? { n: season.n, ends_at: season.ends_at } : null,
    raids,
    avatar,
  });
} catch(e){ next(e); } });

function pickThreeDaily(pool, userId, dayKey){
  if (!pool.length) return [];
  // deterministic daily pick from pool
  let h = 5381;
  const seed = String(userId) + ':' + dayKey;
  for (let i = 0; i < seed.length; i++) h = ((h * 33) ^ seed.charCodeAt(i)) >>> 0;
  const start = h % pool.length;
  const picked = [];
  for (let i = 0; i < 3 && i < pool.length; i++){
    picked.push(pool[(start + i) % pool.length]);
  }
  return picked;
}

/* ================= TRIALS ================= */
router.get('/trials', rateLimit('trials', 60), async (req, res, next) => { try {
  res.json({ trials: await listTrials(true) });
} catch(e){ next(e); } });

router.post('/trials/:slug', rateLimit('trial', 30), async (req, res, next) => { try {
  const slug = String(req.params.slug || '').slice(0, 32);
  const t = (await q('SELECT * FROM trial_defs WHERE slug=$1 AND active=true', [slug])).rows[0];
  if (!t) return res.status(404).json({ error:'no such trial' });
  if (t.kind === 'rewarded_ad') return res.json({ ok:false, reason:'ad_not_configured' });

  const u = req.user;
  const av = trialAvailable(t, u.trials_state || {});
  if (!av.ok) return res.json({ ok:false, reason: av.reason, nextIn: av.nextIn || 0 });

  // Sift: verify pick server-side
  if (t.minigame === 'sift'){
    const pick = Math.max(0, Math.min(4, Number(req.body?.pick)));
    const seedStr = `${u.id}:${new Date().toISOString().slice(0, 10)}`;
    let h = 5381;
    for (let i = 0; i < seedStr.length; i++) h = ((h * 33) ^ seedStr.charCodeAt(i)) >>> 0;
    const correct = h % 5;

    if (pick !== correct){
      // consume cooldown, no reward
      await completeTrial(u, t, { miss:true });
      if (u.tribe_id)
        await q('UPDATE tribes SET quests_total = quests_total + 1 WHERE id=$1', [u.tribe_id]);
      return res.json({ ok:true, hit:false, correct, reward_ember:0, reward_loyalty:0 });
    }
    const reward = await completeTrial(u, t);
    if (u.tribe_id)
      await q('UPDATE tribes SET quests_total = quests_total + 1 WHERE id=$1', [u.tribe_id]);
    // bump daily quest progress
    await bumpDailyQuest(u.id, 'trials', 1);
    await bumpTribeQuest(u.tribe_id, 'trials', 1);
    return res.json({
      ok:true, hit:true, correct,
      reward_ember: reward.reward_ember,
      reward_loyalty: reward.reward_loyalty,
    });
  }

  const reward = await completeTrial(u, t);
  if (u.tribe_id)
    await q('UPDATE tribes SET quests_total = quests_total + 1 WHERE id=$1', [u.tribe_id]);
  await bumpDailyQuest(u.id, 'trials', 1);
  await bumpTribeQuest(u.tribe_id, 'trials', 1);
  res.json({ ok:true, reward_ember: reward.reward_ember, reward_loyalty: reward.reward_loyalty });
} catch(e){ next(e); } });

/* ================= DAILY QUESTS ================= */
async function bumpDailyQuest(userId, kind, amount){
  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    const rows = (await q(
      `SELECT dq.id, dq.goal_kind, dq.goal_amount FROM daily_quests dq
       WHERE dq.active=true AND dq.goal_kind=$1`,
      [kind]
    )).rows;
    for (const r of rows){
      await q(
        `INSERT INTO daily_quest_log (user_id, quest_id, day_key, progress)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id, quest_id, day_key) DO UPDATE
           SET progress = daily_quest_log.progress + $4`,
        [userId, r.id, todayKey, amount]
      );
    }
  } catch(e){ /* ignore */ }
}

// Advance active tribe quests of a given goal_kind; pay members once on completion.
async function bumpTribeQuest(tribeId, kind, amount){
  if (!tribeId) return;
  try {
    const quests = (await q(
      `SELECT * FROM tribe_quests
        WHERE active=true AND goal_kind=$1
          AND (starts_at IS NULL OR starts_at <= now())
          AND (ends_at   IS NULL OR ends_at   >  now())`,
      [kind]
    )).rows;
    for (const tq of quests){
      const row = (await q(
        `INSERT INTO tribe_quest_progress (quest_id, tribe_id, progress)
         VALUES ($1,$2,$3)
         ON CONFLICT (quest_id, tribe_id) DO UPDATE
           SET progress = tribe_quest_progress.progress + $3
         RETURNING progress, completed_at, paid_at`,
        [tq.id, tribeId, amount]
      )).rows[0];
      if (row && !row.paid_at && Number(row.progress) >= Number(tq.goal_amount)){
        // mark complete + pay every current member once
        await q(
          `UPDATE tribe_quest_progress SET completed_at=COALESCE(completed_at, now()), paid_at=now()
            WHERE quest_id=$1 AND tribe_id=$2 AND paid_at IS NULL`,
          [tq.id, tribeId]
        );
        if (Number(tq.reward_ember) > 0 || Number(tq.reward_loyalty) > 0){
          await q(
            `UPDATE users SET ember = ember + $1, loyalty = loyalty + $2 WHERE tribe_id=$3`,
            [Number(tq.reward_ember) || 0, Number(tq.reward_loyalty) || 0, tribeId]
          );
        }
        feedWrite({
          type: 'tribe', icon: tq.icon || 'trials-scroll', severity: 'success',
          text: `Tribe quest complete: ${tq.title}`,
          detail: { questId: tq.id, tribeId }, actor: 0,
        });
      }
    }
  } catch(e){ /* ignore */ }
}

router.post('/daily/:id/claim', rateLimit('daily', 60), async (req, res, next) => { try {
  const u = req.user;
  const questId = Number(req.params.id);
  const todayKey = new Date().toISOString().slice(0, 10);

  const quest = (await q('SELECT * FROM daily_quests WHERE id=$1 AND active=true', [questId])).rows[0];
  if (!quest) return res.status(404).json({ error:'no such quest' });

  const row = (await q(
    `SELECT * FROM daily_quest_log WHERE user_id=$1 AND quest_id=$2 AND day_key=$3`,
    [u.id, questId, todayKey]
  )).rows[0];
  if (!row) return res.status(400).json({ error:'no progress' });
  if (row.claimed_at) return res.status(409).json({ error:'already claimed' });
  if (row.progress < quest.goal_amount)
    return res.status(400).json({ error:'not complete', need: quest.goal_amount, have: row.progress });

  await q(
    `UPDATE daily_quest_log SET claimed_at=now() WHERE user_id=$1 AND quest_id=$2 AND day_key=$3`,
    [u.id, questId, todayKey]
  );
  await q('UPDATE users SET ember = ember + $1, loyalty = loyalty + $2 WHERE id=$3',
    [quest.reward_ember || 0, quest.reward_loyalty || 0, u.id]);
  if (u.tribe_id && quest.reward_loyalty)
    await q('UPDATE tribes SET loyalty_total = loyalty_total + $1 WHERE id=$2',
      [quest.reward_loyalty, u.tribe_id]);

  res.json({
    ok:true,
    reward_ember: quest.reward_ember || 0,
    reward_loyalty: quest.reward_loyalty || 0,
  });
} catch(e){ next(e); } });

/* ================= CHECKIN / ASH / SHARE ================= */
router.post('/checkin', rateLimit('checkin', 10), async (req, res, next) => { try {
  const u = req.user;
  const last = u.last_checkin ? new Date(u.last_checkin).getTime() : 0;
  const since = Date.now() - last;
  if (since < 20*3600*1000)
    return res.json({ ok:false, reason:'already', nextIn: 20*3600*1000 - since });

  const streak = since < 44*3600*1000 ? Number(u.streak)+1 : 1;
  let reward = CFG.checkin_base + Math.min(CFG.checkin_streakMax, streak * CFG.checkin_streakStep);

  const bf = await activeBonfire();
  if (bf && bf.metric === 'checkin') reward = Math.floor(reward * Number(bf.multiplier));

  await q('UPDATE users SET ember=ember+$1, streak=$2, last_checkin=now() WHERE id=$3',
    [reward, streak, u.id]);
  if (u.tribe_id)
    await q('UPDATE tribes SET checkins_total=checkins_total+1 WHERE id=$1', [u.tribe_id]);
  await addLoyalty(u, CFG.loy_checkin);
  await bumpDailyQuest(u.id, 'checkin', 1);
  await bumpTribeQuest(u.tribe_id, 'checkin', 1);

  res.json({ ok:true, reward, streak });
} catch(e){ next(e); } });

router.post('/ash/collect', rateLimit('ash', 30), async (req, res, next) => { try {
  const u = req.user;
  const now = Date.now();
  const readyAt = u.ash_ready_at ? new Date(u.ash_ready_at).getTime() : now;
  const elapsed = u.ash_ready_at ? Math.max(0, now - (readyAt - CFG.ashMinutes*60000)) : 0;
  let units = u.ash_ready_at ? Math.min(CFG.ashCap, Math.floor(elapsed / (CFG.ashMinutes*60000))) : 0;

  const bf = await activeBonfire();
  if (bf && bf.metric === 'ash') units = Math.floor(units * Number(bf.multiplier));

  if (units < 1) return res.json({ ok:false, reason:'not_ready' });

  const gain = units * CFG.ashUnit;
  await q(
    `UPDATE users SET ember=ember+$1, ash_ready_at=now(), ash_count=ash_count+$2 WHERE id=$3`,
    [gain, units, u.id]
  );
  if (u.tribe_id)
    await q('UPDATE tribes SET ash_total=ash_total+$1 WHERE id=$2', [units, u.tribe_id]);
  await addLoyalty(u, CFG.loy_ash);
  await bumpDailyQuest(u.id, 'ash', 1);

  res.json({ ok:true, gain, units });
} catch(e){ next(e); } });

router.post('/share', rateLimit('share', 10), async (req, res, next) => { try {
  const u = req.user;
  if (u.tribe_id)
    await q('UPDATE tribes SET shares_total=shares_total+1 WHERE id=$1', [u.tribe_id]);
  await addLoyalty(u, CFG.loy_share);
  await bumpDailyQuest(u.id, 'share', 1);
  res.json({ ok:true });
} catch(e){ next(e); } });

/* ================= REFERRALS ================= */
router.get('/referral', rateLimit('ref', 60), async (req, res, next) => { try {
  const u = req.user;
  const rows = (await q(
    `SELECT r.rewarded_at, u.first_name, u.username
       FROM referral_events r JOIN users u ON u.id = r.referee_id
       WHERE r.referrer_id=$1 ORDER BY r.rewarded_at DESC LIMIT 20`,
    [u.id]
  )).rows;
  res.json({ code: u.referral_code, invited: rows.length, list: rows });
} catch(e){ next(e); } });

router.post('/referral/claim', rateLimit('ref', 5), async (req, res, next) => { try {
  const u = req.user;
  if (u.referred_by) return res.status(409).json({ error:'already claimed' });

  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code || code === u.referral_code) return res.status(400).json({ error:'bad code' });

  const ref = (await q('SELECT id FROM users WHERE referral_code=$1', [code])).rows[0];
  if (!ref) return res.status(404).json({ error:'no such code' });

  // Both users get a bonus. Only the referee's first claim counts.
  const REWARD = 500;
  await q('UPDATE users SET referred_by=$1 WHERE id=$2', [ref.id, u.id]);
  await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [REWARD, u.id]);
  await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [REWARD, ref.id]);
  await q(
    `INSERT INTO referral_events (referrer_id, referee_id, reward_ember, note)
     VALUES ($1,$2,$3,'welcome bonus') ON CONFLICT DO NOTHING`,
    [ref.id, u.id, REWARD]
  );

  feedWrite({
    type: 'user',
    icon: 'user-plus',
    severity: 'success',
    text: `Referral: ${u.username || u.id} joined via ${code}`,
    actor: u.id,
  });

  res.json({ ok:true, reward: REWARD });
} catch(e){ next(e); } });

/* ================= GIFT CODES ================= */
router.post('/redeem', rateLimit('redeem', 10), async (req, res, next) => { try {
  const u = req.user;
  const code = String(req.body?.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!code) return res.status(400).json({ error:'Enter a code.' });

  const c = (await q('SELECT * FROM codes WHERE code=$1', [code])).rows[0];
  if (!c) return res.status(404).json({ error:'That code is not real.' });
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now())
    return res.status(410).json({ error:'That code has burned out.' });
  if (c.max_uses && Number(c.uses) >= Number(c.max_uses))
    return res.status(410).json({ error:'That code has been fully claimed.' });

  const dup = await q('SELECT 1 FROM code_redemptions WHERE code=$1 AND user_id=$2', [code, u.id]);
  if (dup.rowCount) return res.status(409).json({ error:'You already claimed this code.' });

  const col = ({ ember:'ember', loyalty:'loyalty' })[c.kind];
  if (!col) return res.status(400).json({ error:'That code is malformed.' });
  const amt = Math.floor(Number(c.amount));

  await q('INSERT INTO code_redemptions(code,user_id) VALUES ($1,$2)', [code, u.id]);
  await q('UPDATE codes SET uses = uses + 1 WHERE code=$1', [code]);
  await q(`UPDATE users SET ${col}=${col}+$1 WHERE id=$2`, [amt, u.id]);
  if (c.kind === 'loyalty' && u.tribe_id)
    await q('UPDATE tribes SET loyalty_total=loyalty_total+$1 WHERE id=$2', [amt, u.tribe_id]);

  const fresh = (await q('SELECT id,ember,loyalty FROM users WHERE id=$1', [u.id])).rows[0];
  res.json({ ok:true, kind:c.kind, amount:amt, user:fresh });
} catch(e){ next(e); } });

/* ================= SPIN ================= */
router.post('/spin', rateLimit('spin', 20), async (req, res, next) => { try {
  const u = req.user;
  const todayKey = new Date().toISOString().slice(0, 10);

  const cfg = (await q('SELECT * FROM spin_config WHERE id=1')).rows[0] || {
    free_spins_per_day:1, max_paid_per_day:3, stars_per_spin:25,
  };
  const today = (await q(
    `SELECT count(*)::int AS n FROM spin_log WHERE user_id=$1 AND day_key=$2`,
    [u.id, todayKey]
  )).rows[0].n;

  const freeUsed = Math.min(today, cfg.free_spins_per_day);
  const paidUsed = Math.max(0, today - cfg.free_spins_per_day);
  const free = freeUsed < cfg.free_spins_per_day;
  const paidLeft = cfg.max_paid_per_day - paidUsed;

  let cost = 0;
  if (!free){
    if (paidLeft <= 0) return res.status(400).json({ error:'No spins left today' });
    if (Number(u.stars || 0) < cfg.stars_per_spin)
      return res.status(400).json({ error:'Not enough Stars', need: cfg.stars_per_spin });
    cost = cfg.stars_per_spin;
  }

  // pick reward by weight
  const rewards = (await q('SELECT * FROM spin_rewards WHERE active=true')).rows;
  if (!rewards.length) return res.status(500).json({ error:'no rewards configured' });
  const total = rewards.reduce((s, r) => s + (r.weight || 1), 0);
  let r = Math.random() * total;
  let picked = rewards[0];
  for (const reward of rewards){
    r -= reward.weight || 1;
    if (r <= 0){ picked = reward; break; }
  }

  // grant
  let granted = { kind: picked.kind, amount: picked.amount };
  if (picked.kind === 'ember')   await q('UPDATE users SET ember=ember+$1 WHERE id=$2', [picked.amount, u.id]);
  if (picked.kind === 'loyalty') await q('UPDATE users SET loyalty=loyalty+$1 WHERE id=$2', [picked.amount, u.id]);
  if (picked.kind === 'stars')   await q('UPDATE users SET stars=stars+$1 WHERE id=$2', [picked.amount, u.id]);

  if (cost > 0)
    await q('UPDATE users SET stars=stars-$1 WHERE id=$2', [cost, u.id]);

  await q(
    `INSERT INTO spin_log (user_id, day_key, paid, stars_cost, reward_id, reward_kind, reward_amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [u.id, todayKey, !free, cost, picked.id, picked.kind, picked.amount]
  );

  await bumpDailyQuest(u.id, 'spin', 1);

  feedWrite({
    type: 'spin',
    icon: 'spin-stone',
    severity: picked.kind === 'relic' || picked.kind === 'stars' ? 'success' : 'info',
    text: `${u.username || u.id} spun: ${picked.label || picked.kind} ${picked.amount || ''}`,
    detail: { picked: picked.label, kind: picked.kind, amount: picked.amount, paid: !free },
    actor: u.id,
  });

  res.json({
    ok:true,
    free,
    cost,
    slotIndex: picked.slot_index,
    reward: granted,
    label: picked.label,
  });
} catch(e){ next(e); } });

/* ================= FIRST-TIME PACK ================= */
router.post('/first-pack/claim', rateLimit('first', 5), async (req, res, next) => { try {
  const u = req.user;
  const cfg = (await q('SELECT * FROM first_pack_config WHERE id=1')).rows[0];
  if (!cfg || !cfg.enabled) return res.status(400).json({ error:'not available' });

  const already = await q('SELECT 1 FROM first_pack_claims WHERE user_id=$1', [u.id]);
  if (already.rowCount) return res.status(409).json({ error:'already claimed' });

  // must be within window of signup
  const created = new Date(u.created_at).getTime();
  if (Date.now() - created > cfg.duration_hours * 3600 * 1000)
    return res.status(410).json({ error:'offer expired' });

  await q('UPDATE users SET ember=ember+$1, loyalty=loyalty+$2 WHERE id=$3',
    [cfg.reward_ember, cfg.reward_loyalty, u.id]);
  await q(
    `INSERT INTO first_pack_claims (user_id, reward_paid) VALUES ($1, $2)`,
    [u.id, JSON.stringify({ ember: cfg.reward_ember, loyalty: cfg.reward_loyalty, relic: cfg.free_relic_slug })]
  );
  res.json({ ok:true, ember: cfg.reward_ember, loyalty: cfg.reward_loyalty });
} catch(e){ next(e); } });

/* ================= STREAK INSURANCE ================= */
router.post('/streak-insurance', rateLimit('sins', 5), async (req, res, next) => { try {
  const u = req.user;
  const cfg = (await q('SELECT * FROM streak_insurance_config WHERE id=1')).rows[0];
  if (!cfg || !cfg.enabled) return res.status(400).json({ error:'not available' });
  if (Number(u.stars || 0) < cfg.price_stars)
    return res.status(400).json({ error:'Not enough Stars', need: cfg.price_stars });

  await q('UPDATE users SET stars=stars-$1 WHERE id=$2', [cfg.price_stars, u.id]);
  await q(
    `INSERT INTO streak_insurance (user_id, stars_spent, covers_until, active)
     VALUES ($1, $2, (CURRENT_DATE + INTERVAL '1 day')::date, true)
     ON CONFLICT (user_id) DO UPDATE
       SET stars_spent = streak_insurance.stars_spent + EXCLUDED.stars_spent,
           covers_until = EXCLUDED.covers_until,
           active = true,
           purchased_at = now()`,
    [u.id, cfg.price_stars]
  );
  res.json({ ok:true, price: cfg.price_stars });
} catch(e){ next(e); } });

/* ================= TRIBES ================= */
router.get('/tribes', rateLimit('tribes', 60), async (req, res, next) => { try {
  const r = await q(
    `SELECT id,name,hue,motto,crest,banner,palette,members,loyalty_total,treasury,wins,losses,level
       FROM tribes ORDER BY loyalty_total DESC, members DESC LIMIT 60`
  );
  res.json({ tribes: r.rows });
} catch(e){ next(e); } });

router.get('/tribe/names', rateLimit('names', 60), async (req, res, next) => { try {
  const r = await q(
    `SELECT id, name FROM tribe_names WHERE claimed_by_tribe_id IS NULL ORDER BY name`
  );
  res.json({ names: r.rows });
} catch(e){ next(e); } });

router.post('/tribe/create', rateLimit('create', 5), async (req, res, next) => { try {
  const u = req.user;
  if (u.tribe_id) return res.status(400).json({ error:'already in a tribe' });
  const nameId = Number(req.body?.nameId);
  if (!nameId) return res.status(400).json({ error:'pick a name' });

  const palette = String(req.body?.palette || 'ember').slice(0, 16);
  const banner  = String(req.body?.banner  || 'sun').slice(0, 16);
  const motto   = String(req.body?.motto   || '').slice(0, 80);
  if (!PALETTES[palette]) return res.status(400).json({ error:'bad palette' });
  if (!BANNERS.includes(banner)) return res.status(400).json({ error:'bad banner' });
  if (Number(u.ember) < CFG.foundEmber)
    return res.status(400).json({ error:'not enough Ember', need: CFG.foundEmber });

  const nameRow = (await q(
    `SELECT id, name FROM tribe_names WHERE id=$1 AND claimed_by_tribe_id IS NULL FOR UPDATE`,
    [nameId]
  )).rows[0];
  if (!nameRow) return res.status(409).json({ error:'that name has been claimed' });

  const created = (await q(
    `INSERT INTO tribes (name, name_id, hue, motto, crest, banner, palette, level, created_by, members, members_total, treasury)
     VALUES ($1,$2,0,$3,'totem',$4,$5,1,$6,1,1,0) RETURNING *`,
    [nameRow.name, nameRow.id, motto, banner, palette, u.id]
  )).rows[0];

  await q('UPDATE tribe_names SET claimed_by_tribe_id=$1 WHERE id=$2', [created.id, nameRow.id]);
  await q('UPDATE users SET tribe_id=$1, ember=ember-$2, role=$3 WHERE id=$4',
    [created.id, CFG.foundEmber, 'Chief', u.id]);
  await Kiva.postMessage(created.id, u.id, `The fire is lit. ${nameRow.name} rises.`, 'system');

  feedWrite({
    type: 'tribe',
    icon: 'tribe-shield',
    severity: 'success',
    text: `${nameRow.name} founded by ${u.username || u.id}`,
    detail: { tribeId: created.id, founder: u.id, name: nameRow.name },
    actor: u.id,
  });

  res.json({ ok:true, tribe: created });
} catch(e){ next(e); } });

router.post('/tribe/join', rateLimit('join', 20), async (req, res, next) => { try {
  const u = req.user;
  if (u.tribe_id) return res.status(400).json({ error:'already in a tribe' });
  const id = Number(req.body?.tribeId);
  const t = (await q('SELECT * FROM tribes WHERE id=$1', [id])).rows[0];
  if (!t) return res.status(404).json({ error:'no such tribe' });

  const { caps } = levelTable();
  const cap = caps[Math.max(0, Math.min(caps.length-1, (t.level||1)-1))];
  if (t.members >= cap) return res.status(400).json({ error:'this tribe is full' });

  await q('UPDATE tribes SET members=members+1, members_total=members_total+1 WHERE id=$1', [id]);
  await q('UPDATE users SET tribe_id=$1 WHERE id=$2', [id, u.id]);
  await Kiva.postMessage(id, u.id, `${u.first_name || u.username} joined the tribe.`, 'system');

  await bumpTribeQuest(id, 'members', 1);
  res.json({ ok:true, tribe: t });
} catch(e){ next(e); } });

router.post('/tribe/leave', rateLimit('leave', 10), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ ok:true });
  await q('UPDATE tribes SET members=GREATEST(0,members-1) WHERE id=$1', [u.tribe_id]);
  await q('UPDATE users SET tribe_id=NULL WHERE id=$1', [u.id]);
  res.json({ ok:true });
} catch(e){ next(e); } });

router.post('/tribe/donate', rateLimit('donate', 30), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'join a tribe first' });
  const amt = Math.floor(Number(req.body?.amount) || 0);
  if (amt < 1) return res.status(400).json({ error:'bad amount' });
  if (Number(u.ember) < amt) return res.status(400).json({ error:'not enough Ember' });

  await q('UPDATE users SET ember=ember-$1 WHERE id=$2', [amt, u.id]);
  await q('UPDATE tribes SET treasury=treasury+$1, donated_total=donated_total+$1 WHERE id=$2',
    [amt, u.tribe_id]);
  await addLoyalty(u, Math.floor(amt / CFG.loy_donateDiv));
  await bumpDailyQuest(u.id, 'donate', amt);
  await bumpTribeQuest(u.tribe_id, 'donate', amt);
  await bumpTribeQuest(u.tribe_id, 'loyalty', amt);

  res.json({ ok:true, donated: amt });
} catch(e){ next(e); } });

router.post('/tribe/upgrade', rateLimit('upgrade', 6), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  if (!['Chief','Head','Elder'].includes(u.role))
    return res.status(403).json({ error:'only Elders+' });

  const t = (await q('SELECT * FROM tribes WHERE id=$1', [u.tribe_id])).rows[0];
  if (!t) return res.status(404).json({ error:'no tribe' });

  const { caps, costs, names } = levelTable();
  const cur = Number(t.level) || 1;
  if (cur >= costs.length) return res.status(400).json({ error:'already at the highest level' });
  const nextCost = Number(costs[cur]);
  if (Number(t.treasury) < nextCost)
    return res.status(400).json({ error:'the Great Pyre is too shallow', need: nextCost });

  await q('UPDATE tribes SET treasury=treasury-$1, level=level+1 WHERE id=$2', [nextCost, t.id]);
  const newLevel = cur + 1;
  const newName = names[newLevel-1] || ('Level ' + newLevel);
  await Kiva.postMessage(t.id, u.id, `${t.name} rises to ${newName}!`, 'level');

  feedWrite({
    type: 'tribe',
    icon: 'crown',
    severity: 'success',
    text: `${t.name} rose to ${newName}`,
    detail: { tribeId: t.id, level: newLevel },
    actor: u.id,
  });

  res.json({ ok:true, level: newLevel, name: newName, cap: caps[newLevel-1] });
} catch(e){ next(e); } });

/* ================= KIVA ================= */
router.get('/kiva', rateLimit('kiva', 240), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  const since = Number(req.query.since) || 0;
  const rows = since
    ? await Kiva.listMessages(u.tribe_id, since, 50)
    : await Kiva.latestMessages(u.tribe_id, 50);
  res.json({ messages: rows, tribe_id: u.tribe_id });
} catch(e){ next(e); } });

router.post('/kiva', rateLimit('kiva', 40), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  const body = String(req.body?.body || '').slice(0, 280);
  if (!body.trim()) return res.status(400).json({ error:'empty' });
  const msg = await Kiva.postMessage(u.tribe_id, u.id, body, 'chat');
  await bumpDailyQuest(u.id, 'kiva_msg', 1);
  res.json({ ok:true, message: msg });
} catch(e){ next(e); } });

router.post('/kiva/pin', rateLimit('kiva', 20), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  if (!['Chief','Head','Elder'].includes(u.role))
    return res.status(403).json({ error:'only Elders+ can pin' });
  const id = Number(req.body?.id);
  const pinned = !!req.body?.pinned;
  const row = await Kiva.setPin(u.tribe_id, id, pinned);
  res.json({ ok:true, pinned: row.pinned });
} catch(e){ next(e); } });

router.post('/kiva/read', rateLimit('kiva', 240), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ ok:true });
  await Kiva.markRead(u.tribe_id, u.id, Number(req.body?.lastSeenId) || 0);
  res.json({ ok:true });
} catch(e){ next(e); } });

export function kivaSse(req, res){ Kiva.kivaSse(req, res); }

/* ================= WAR ================= */
async function currentWar(tribeId){
  const r = await q(
    `SELECT * FROM wars WHERE (attacker_id=$1 OR defender_id=$1)
      ORDER BY (status='active') DESC, start_at DESC LIMIT 1`, [tribeId]
  );
  return r.rows[0] || null;
}
async function decorate(war, myTribe){
  const ta = (await q('SELECT id,name,hue,crest,banner,palette,level FROM tribes WHERE id=$1', [war.attacker_id])).rows[0];
  const td = (await q('SELECT id,name,hue,crest,banner,palette,level FROM tribes WHERE id=$1', [war.defender_id])).rows[0];
  const ch = CHALLENGES.find(c => c.id === war.challenge_id) || {};
  const fronts = await getFronts(war.id);
  const momentum = await momentumFor(war.id);
  const legendary = await activeLegendary(war.id);
  return {
    ...war,
    attacker: ta, defender: td,
    challenge: { id: ch.id, name: ch.name, glyph: ch.glyph, desc: ch.desc },
    fronts, momentum, legendary,
    mine: Number(myTribe) === Number(war.attacker_id) ? 'attacker' : 'defender',
  };
}

router.get('/war', rateLimit('war', 60), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ war:null, reason:'no_tribe' });
  let war = await currentWar(u.tribe_id);
  if (war && war.status === 'active') war = await maybeResolve(war);
  res.json({ war: war ? await decorate(war, u.tribe_id) : null });
} catch(e){ next(e); } });

router.post('/war/declare', rateLimit('war', 6), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'join a tribe first' });
  if (!Number(CFG.allowWar)) return res.status(400).json({ error:'war has been sealed' });
  if (!['Chief','Head','Elder'].includes(u.role))
    return res.status(403).json({ error:'only Elders+' });

  const active = await q(
    `SELECT 1 FROM wars WHERE status='active' AND (attacker_id=$1 OR defender_id=$1)`,
    [u.tribe_id]
  );
  if (active.rowCount) return res.status(400).json({ error:'your tribe is already at war' });

  const stanceId = String(req.body?.stance || 'skirmish').slice(0, 32);
  const stances = cfgJSON('war_stances', []);
  const stance = stances.find(s => s.id === stanceId) || stances[0] || { durMult: 1 };

  const foe = await pickFoe(u.tribe_id);
  if (!foe) return res.status(400).json({ error:'no fair rival is available (matched by level; allies are excluded)' });

  const c = pickChallenge();
  const capHours = Number(CFG.war_cap_hours) || 72;
  const durHours = Math.round(capHours * Number(stance.durMult || 1));
  const stake = Math.max(Number(CFG.war_stake_min), Math.min(Number(CFG.war_stake_max), c.stake));
  const reward = Math.max(0, Math.round(c.reward * (Number(CFG.warRewardMult) || 1)));
  const aStart = await getTribeMetric(u.tribe_id, c.metric);
  const dStart = await getTribeMetric(foe.id, c.metric);

  const war = (await q(
    `INSERT INTO wars (attacker_id,defender_id,challenge_id,goal,metric,stake_pct,reward_ember,
                       attacker_start,defender_start,end_at,stance,front_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + ($10 || ' hours')::interval, $11, $12)
     RETURNING *`,
    [u.tribe_id, foe.id, c.id, c.goal, c.metric, stake, reward, aStart, dStart,
     String(durHours), stanceId, Number(CFG.war_front_count) || 3]
  )).rows[0];

  await createFronts(war.id);
  await scheduleLegendary(war, null);
  // BATCH B1: pause personal (non-war) relics for both tribes during the war
  pauseForWar(u.tribe_id).catch(() => {});
  pauseForWar(foe.id).catch(() => {});

  const foeName = (await q('SELECT name FROM tribes WHERE id=$1', [foe.id])).rows[0]?.name || 'a rival';
  await Kiva.postMessage(u.tribe_id, u.id, `War declared against ${foeName} · stance: ${stance.name || stanceId}.`, 'war');
  await Kiva.postMessage(foe.id, u.id, `${(await q('SELECT name FROM tribes WHERE id=$1', [u.tribe_id])).rows[0]?.name || 'A tribe'} declared war. Stance: ${stance.name || stanceId}.`, 'war');

  feedWrite({
    type: 'war',
    icon: 'war-swords',
    severity: 'warn',
    text: `${(await q('SELECT name FROM tribes WHERE id=$1', [u.tribe_id])).rows[0]?.name} declared war on ${foeName}`,
    detail: { warId: war.id, stance: stanceId, challenge: c.id },
    actor: u.id,
  });

  res.json({ ok:true, war: await decorate(war, u.tribe_id) });
} catch(e){ next(e); } });

router.post('/war/action', rateLimit('war_action', 60), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  const war = await currentWar(u.tribe_id);
  if (!war || war.status !== 'active') return res.status(400).json({ error:'no active war' });

  const side = Number(war.attacker_id) === Number(u.tribe_id) ? 'attacker' : 'defender';
  const frontIdx = Math.max(0, Math.min((Number(war.front_count) || 3) - 1, Number(req.body?.front) || 0));
  const kind = String(req.body?.kind || 'rally').slice(0, 16);
  const tribe = await tribeOf(u);

  const result = await recordAction(war, u, tribe, side, frontIdx, kind);
  await bumpDailyQuest(u.id, 'war_action', 1);
  await bumpTribeQuest(u.tribe_id, 'war_action', 1);
  res.json(result);
} catch(e){ res.status(400).json({ error: e.message }); } });

router.post('/war/cry', rateLimit('war_cry', 6), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  if (!['Chief','Head','Elder'].includes(u.role))
    return res.status(403).json({ error:'only Elders+' });
  const war = await currentWar(u.tribe_id);
  if (!war || war.status !== 'active') return res.status(400).json({ error:'no active war' });
  if (war.cry_used) return res.status(400).json({ error:'a cry has already been raised this war' });

  const cryId = String(req.body?.cry || '').slice(0, 32);
  const cries = cfgJSON('war_cries', []);
  const cry = cries.find(c => c.id === cryId);
  if (!cry) return res.status(400).json({ error:'unknown cry' });

  const tribe = await tribeOf(u);
  if (Number(tribe.treasury) < Number(cry.cost))
    return res.status(400).json({ error:'the Great Pyre is too shallow' });

  await q('UPDATE tribes SET treasury = treasury - $1 WHERE id=$2', [Number(cry.cost), tribe.id]);
  await q('UPDATE wars SET cry_used=$1 WHERE id=$2', [cryId, war.id]);

  if (cry.effect === 'instant_score'){
    const col = Number(war.attacker_id) === Number(tribe.id) ? 'attacker_score' : 'defender_score';
    await q(`UPDATE war_fronts SET ${col} = ${col} + $1 WHERE war_id=$2 AND idx=0`,
      [Number(cry.magnitude) || 0, war.id]);
  }

  await Kiva.postMessage(tribe.id, u.id, `${tribe.name} raised ${cry.name}!`, 'war');
  await Kiva.postMessage(Number(war.attacker_id) === Number(tribe.id) ? war.defender_id : war.attacker_id,
    u.id, `${tribe.name} raised ${cry.name}!`, 'war');

  res.json({ ok:true, cry });
} catch(e){ res.status(400).json({ error: e.message }); } });

router.post('/war/legendary/force', rateLimit('war_leg', 3), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  const war = await currentWar(u.tribe_id);
  if (!war || war.status !== 'active') return res.status(400).json({ error:'no active war' });
  const existing = await activeLegendary(war.id);
  if (existing) return res.status(400).json({ error:'a legendary is already active' });
  const created = await scheduleLegendary(war, u.id);
  if (!created) return res.status(400).json({ error:'could not schedule' });
  res.json({ ok:true, legendary: created });
} catch(e){ res.status(400).json({ error: e.message }); } });

router.post('/war/defend', rateLimit('war_def', 20), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  const war = await currentWar(u.tribe_id);
  if (!war || war.status !== 'active') return res.status(400).json({ error:'no active war' });
  if (Number(war.defender_id) !== Number(u.tribe_id))
    return res.status(403).json({ error:'only defenders may use this' });
  const kind = String(req.body?.kind || '').slice(0, 16);
  const frontIdx = req.body?.front != null ? Number(req.body.front) : null;
  const tribe = await tribeOf(u);
  const result = await recordDefenderAction(war, u, tribe, kind, frontIdx);
  res.json(result);
} catch(e){ res.status(400).json({ error: e.message }); } });

router.get('/war/chronicle', rateLimit('war_chr', 60), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ chronicles: [] });
  const other = req.query.vs ? Number(req.query.vs) : null;
  const limit = Math.min(Number(CFG.chronicle_retention) || 50, 100);
  const rows = other
    ? (await q(
        `SELECT * FROM war_chronicles
          WHERE (attacker_id=$1 AND defender_id=$2) OR (attacker_id=$2 AND defender_id=$1)
          ORDER BY created_at DESC LIMIT $3`,
        [u.tribe_id, other, limit]
      )).rows
    : (await q(
        `SELECT * FROM war_chronicles WHERE attacker_id=$1 OR defender_id=$1
          ORDER BY created_at DESC LIMIT $2`,
        [u.tribe_id, limit]
      )).rows;
  res.json({ chronicles: rows });
} catch(e){ next(e); } });

/* ---------- BATCH A: tactics, hint, wiki, vengeance, alliances ---------- */
router.get('/war/tactics', rateLimit('war', 120), async (req, res, next) => { try {
  res.json(listTactics());
} catch(e){ next(e); } });

router.get('/war/hint', rateLimit('war', 60), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ hint: 'Join a tribe to hear the elders.' });
  const war = await currentWar(u.tribe_id);
  if (!war || war.status !== 'active') return res.json({ hint: 'No war rages right now.' });
  const side = Number(war.attacker_id) === Number(u.tribe_id) ? 'attacker' : 'defender';
  res.json(await warHint(war, side));
} catch(e){ next(e); } });

router.get('/war/wiki', rateLimit('war', 120), async (req, res, next) => { try {
  const t = listTactics();
  res.json({
    rules: [
      'A war is fought across ' + (Number(CFG.war_front_count) || 3) + ' fronts. Each front has its own terrain.',
      'Whoever wins the most fronts wins the war (best-of-fronts). Ties fall to total score, with a defender edge.',
      'Terrain favours some tactics (+' + t.bonusPct + '%) and resists others (-' + t.penaltyPct + '%).',
      'Beaten tribes earn Vengeance against the victor — a bonus in the rematch that fades over time.',
      'Blood Allies cannot be matched against each other while the pact holds.',
      'Rivals are matched within ' + (Number(CFG.war_matchmaking_level_cap) || 2) + ' levels of your tribe.',
    ],
    terrain: t.terrain,
    offensive: t.offensive,
    defensive: t.defensive,
  });
} catch(e){ next(e); } });

router.get('/war/vengeance', rateLimit('war', 60), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ grudges: [] });
  res.json({ grudges: await listVengeance(u.tribe_id) });
} catch(e){ next(e); } });

router.get('/war/alliances', rateLimit('war', 60), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ alliances: [] });
  res.json({ alliances: await listAlliances(u.tribe_id) });
} catch(e){ next(e); } });

router.post('/war/alliance', rateLimit('war', 6), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'join a tribe first' });
  if (!['Chief','Head','Elder'].includes(u.role))
    return res.status(403).json({ error:'only Elders+' });
  const target = Number(req.body?.tribe);
  if (!target || target === Number(u.tribe_id)) return res.status(400).json({ error:'pick another tribe' });
  const exists = (await q('SELECT 1 FROM tribes WHERE id=$1', [target])).rowCount;
  if (!exists) return res.status(404).json({ error:'no such tribe' });
  const pact = await formBloodAlliance(u.tribe_id, target, u.id);
  const tname = (await q('SELECT name FROM tribes WHERE id=$1', [target])).rows[0]?.name || 'a tribe';
  await Kiva.postMessage(u.tribe_id, u.id, `A Blood Alliance is sworn with ${tname}.`, 'war');
  await Kiva.postMessage(target, u.id, `A Blood Alliance is sworn with your tribe.`, 'war');
  res.json({ ok:true, alliance: pact });
} catch(e){ res.status(400).json({ error: e.message }); } });

router.post('/war/alliance/break', rateLimit('war', 6), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'join a tribe first' });
  if (!['Chief','Head','Elder'].includes(u.role))
    return res.status(403).json({ error:'only Elders+' });
  const target = Number(req.body?.tribe);
  if (!target) return res.status(400).json({ error:'pick a tribe' });
  const broken = await breakBloodAlliance(u.tribe_id, target);
  if (!broken) return res.status(400).json({ error:'no active pact with that tribe' });
  res.json({ ok:true });
} catch(e){ res.status(400).json({ error: e.message }); } });

router.get('/war/leaderboard', rateLimit('war_lb', 60), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ rows: [] });
  const war = await currentWar(u.tribe_id);
  if (!war) return res.json({ rows: [] });
  const rows = (await q(
    `SELECT wa.user_id, u.first_name, u.username, wa.side,
            SUM(wa.points)::bigint AS points
       FROM war_actions wa JOIN users u ON u.id = wa.user_id
      WHERE wa.war_id=$1
      GROUP BY wa.user_id, u.first_name, u.username, wa.side
      ORDER BY points DESC LIMIT 20`,
    [war.id]
  )).rows;
  res.json({ rows });
} catch(e){ next(e); } });

/* ================= BONFIRE / RAIDS ================= */
router.get('/bonfire', rateLimit('bf', 60), async (req, res, next) => { try {
  res.json({ bonfire: await activeBonfire() });
} catch(e){ next(e); } });

/* ================= COSMETICS ================= */
router.get('/cosmetics', rateLimit('cos', 60), async (req, res, next) => { try {
  const rows = (await q(
    'SELECT cosmetic_id, kind, value FROM cosmetic_purchases WHERE user_id=$1', [req.user.id]
  )).rows;
  res.json({ owned: rows });
} catch(e){ next(e); } });

/* ================= PAYMENTS ================= */
router.post('/stars/invoice', rateLimit('invoice', 20), async (req, res, next) => { try {
  if (!Number(CFG.allowStore))
    return res.status(400).json({ error:'the trading post is closed' });
  const link = await createStarInvoice(req.user.id, String(req.body?.itemId || ''));
  res.json({ ok:true, link });
} catch(e){ res.status(400).json({ error: e.message }); } });

router.post('/ton/intent', rateLimit('intent', 20), async (req, res, next) => { try {
  if (!Number(CFG.allowStore))
    return res.status(400).json({ error:'the trading post is closed' });
  res.json({ ok:true, intent: await makeIntent(req.user.id, String(req.body?.itemId || '')) });
} catch(e){ res.status(400).json({ error: e.message }); } });

router.post('/ton/verify', rateLimit('verify', 40), async (req, res, next) => { try {
  res.json(await verifyPayment(req.user.id, String(req.body?.nonce || '')));
} catch(e){ res.status(400).json({ error: e.message }); } });

router.post('/ton/link', rateLimit('link', 20), async (req, res, next) => { try {
  const addr = String(req.body?.address || '').slice(0, 80);
  if (!addr) return res.status(400).json({ error:'no address' });
  await linkWallet(req.user.id, addr);
  res.json({ ok:true });
} catch(e){ next(e); } });

/* ================= X (TWITTER) QUESTS — user side ================= */
router.get('/x/quests', rateLimit('xq', 60), async (req, res, next) => { try {
  const u = req.user;
  const rows = (await q(
    `SELECT xq.id, xq.slug, xq.title, xq.description, xq.icon, xq.kind,
            xq.target, xq.target_label, xq.reward_ember, xq.per_user_limit,
            xq.max_completions, xq.ends_at,
            (SELECT count(*)::int FROM x_claims c
               WHERE c.quest_id=xq.id AND c.user_id=$1 AND c.status='approved') AS my_approved,
            (SELECT count(*)::int FROM x_claims c
               WHERE c.quest_id=xq.id AND c.user_id=$1 AND c.status='pending') AS my_pending,
            (SELECT reject_reason FROM x_claims c
               WHERE c.quest_id=xq.id AND c.user_id=$1 AND c.status='rejected'
               ORDER BY c.created_at DESC LIMIT 1) AS last_reject,
            (SELECT count(*)::int FROM x_claims c
               WHERE c.quest_id=xq.id AND c.status='approved') AS total_approved
       FROM x_quests xq
      WHERE xq.active=true
        AND (xq.starts_at IS NULL OR xq.starts_at <= now())
        AND (xq.ends_at   IS NULL OR xq.ends_at   >  now())
      ORDER BY xq.sort_order, xq.id`,
    [u.id]
  )).rows;
  const quests = rows.map(r => {
    const full = r.max_completions > 0 && r.total_approved >= r.max_completions;
    const doneByUser = r.my_approved >= r.per_user_limit;
    let status = 'open';
    if (r.my_pending > 0) status = 'pending';
    else if (doneByUser) status = 'done';
    else if (full) status = 'full';
    return {
      id: r.id, slug: r.slug, title: r.title, description: r.description,
      icon: r.icon, kind: r.kind, target: r.target, target_label: r.target_label,
      reward_ember: Number(r.reward_ember) || 0, ends_at: r.ends_at,
      status, last_reject: status === 'open' ? (r.last_reject || null) : null,
    };
  });
  const handle = (await q(
    `SELECT x_handle FROM x_handle_owners WHERE user_id=$1 LIMIT 1`, [u.id]
  )).rows[0];
  res.json({ quests, myHandle: handle ? handle.x_handle : null });
} catch(e){ next(e); } });

router.post('/x/claim', rateLimit('xclaim', 12), async (req, res, next) => { try {
  const u = req.user;
  const questId = Number(req.body?.quest_id || 0);
  let handle = String(req.body?.x_handle || '').trim().replace(/^@/, '').toLowerCase();
  const note = String(req.body?.note || '').slice(0, 200);
  if (!/^[a-z0-9_]{1,15}$/.test(handle))
    return res.status(400).json({ error:'Enter a valid X handle (letters, numbers, underscore).' });

  const quest = (await q('SELECT * FROM x_quests WHERE id=$1', [questId])).rows[0];
  if (!quest || !quest.active) return res.status(404).json({ error:'quest not found' });
  if (quest.starts_at && new Date(quest.starts_at).getTime() > Date.now())
    return res.status(400).json({ error:'quest not started yet' });
  if (quest.ends_at && new Date(quest.ends_at).getTime() < Date.now())
    return res.status(410).json({ error:'quest has ended' });

  // handle must not belong to a different account
  const owner = (await q('SELECT user_id FROM x_handle_owners WHERE x_handle=$1', [handle])).rows[0];
  if (owner && Number(owner.user_id) !== Number(u.id))
    return res.status(409).json({ error:'That X handle is already linked to another account.' });

  const approved = (await q(
    `SELECT count(*)::int AS n FROM x_claims WHERE quest_id=$1 AND user_id=$2 AND status='approved'`,
    [questId, u.id]
  )).rows[0].n;
  if (approved >= quest.per_user_limit)
    return res.status(409).json({ error:'You already completed this quest.' });

  if (quest.max_completions > 0){
    const total = (await q(
      `SELECT count(*)::int AS n FROM x_claims WHERE quest_id=$1 AND status='approved'`, [questId]
    )).rows[0].n;
    if (total >= quest.max_completions)
      return res.status(410).json({ error:'This quest is fully claimed.' });
  }

  try {
    await q(
      `INSERT INTO x_claims (user_id, quest_id, x_handle, note, status)
       VALUES ($1,$2,$3,$4,'pending')`,
      [u.id, questId, handle, note]
    );
  } catch(err){
    if (String(err.code) === '23505')
      return res.status(409).json({ error:'You already have a pending claim for this quest.' });
    throw err;
  }

  feedWrite({
    type: 'x', icon: 'brand-x', severity: 'info',
    text: `@${handle} submitted "${quest.title}" for review`,
    detail: { questId, userId: u.id, handle },
    actor: u.id,
  });
  res.json({ ok:true, status:'pending' });
} catch(e){ next(e); } });

/* ================= RELICS & BADGES — user side ================= */
router.get('/relics', rateLimit('relics', 60), async (req, res, next) => { try {
  const u = req.user;
  const relics = (await q(
    `SELECT r.id, r.slug, r.name, r.description, r.icon_file, r.rarity,
            r.domain, r.kind, r.war_effect, r.cooldown_min, r.counters,
            r.buff_type, r.buff_value, r.price_stars, r.svg, r.image_url,
            r.sort_order,
            COALESCE(ur.count, 0) AS owned
       FROM relics r
       LEFT JOIN user_relics ur ON ur.relic_id=r.id AND ur.user_id=$1
      WHERE r.active=true
      ORDER BY CASE r.rarity WHEN 'legendary' THEN 0 WHEN 'epic' THEN 1
                             WHEN 'rare' THEN 2 ELSE 3 END, r.sort_order, r.name`,
    [u.id]
  )).rows;
  res.json({ relics });
} catch(e){ next(e); } });

router.get('/badges', rateLimit('badges', 60), async (req, res, next) => { try {
  const u = req.user;
  const badges = (await q(
    `SELECT b.id, b.slug, b.name, b.description, b.icon_file, b.tier,
            (ub.user_id IS NOT NULL) AS earned, ub.awarded_at
       FROM badges b
       LEFT JOIN user_badges ub ON ub.badge_id=b.id AND ub.user_id=$1
      WHERE b.active=true
      ORDER BY CASE b.tier WHEN 'legendary' THEN 0 WHEN 'gold' THEN 1
                           WHEN 'silver' THEN 2 ELSE 3 END, b.name`,
    [u.id]
  )).rows;
  // mark freshly-seen
  await q(`UPDATE user_badges SET seen=true WHERE user_id=$1 AND seen=false`, [u.id]);
  res.json({ badges });
} catch(e){ next(e); } });

/* ================= TRIBE QUESTS — user side ================= */
router.get('/tribe/quests', rateLimit('tq', 60), async (req, res, next) => { try {
  const u = req.user;
  const quests = (await q(
    `SELECT tq.id, tq.title, tq.description, tq.icon, tq.goal_kind, tq.goal_amount,
            tq.reward_ember, tq.reward_loyalty, tq.ends_at,
            COALESCE(p.progress, 0) AS progress,
            p.completed_at, p.paid_at
       FROM tribe_quests tq
       LEFT JOIN tribe_quest_progress p
              ON p.quest_id=tq.id AND p.tribe_id=$1
      WHERE tq.active=true
        AND (tq.starts_at IS NULL OR tq.starts_at <= now())
        AND (tq.ends_at   IS NULL OR tq.ends_at   >  now())
      ORDER BY tq.starts_at DESC`,
    [u.tribe_id || 0]
  )).rows;
  res.json({ quests, hasTribe: !!u.tribe_id });
} catch(e){ next(e); } });

/* ================= AVATARS ================= */
// List avatars available to players (active only), lightest ordering.
router.get('/avatars', rateLimit('avatars', 60), async (req, res, next) => { try {
  const rows = (await q(
    `SELECT id, slug, name, svg FROM avatars
      WHERE active=true ORDER BY sort_order ASC, id ASC`
  )).rows;
  res.json({ avatars: rows, selected: req.user.avatar_id || null });
} catch(e){ next(e); } });

// Select an avatar for the current user.
router.post('/avatar/select', rateLimit('avatarpick', 40), async (req, res, next) => { try {
  const id = Number(req.body?.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error:'bad avatar id' });
  const a = (await q('SELECT id, slug, name, svg FROM avatars WHERE id=$1 AND active=true', [id])).rows[0];
  if (!a) return res.status(404).json({ error:'avatar not found' });
  await q('UPDATE users SET avatar_id=$1 WHERE id=$2', [id, req.user.id]);
  res.json({ ok:true, avatar:a });
} catch(e){ next(e); } });

/* ---------- RELICS FOUNDATION (Batch B1) ---------- */
// Full relic state: catalog + owned + equipped + shards + pause snapshot.
router.get('/relics/state', rateLimit('relics', 60), async (req, res, next) => { try {
  res.json(await getRelicState(req.user.id));
} catch(e){ next(e); } });

router.post('/relics/equip', rateLimit('relic_equip', 40), async (req, res, next) => { try {
  const relicId = Number(req.body?.relicId || req.body?.relic_id || 0);
  if (!relicId) return res.status(400).json({ error:'relicId required' });
  res.json(await equipRelic(req.user.id, relicId));
} catch(e){ res.status(400).json({ error: e.message }); } });

router.post('/relics/unequip', rateLimit('relic_equip', 40), async (req, res, next) => { try {
  res.json(await unequipRelic(req.user.id));
} catch(e){ next(e); } });

router.get('/relics/packs', rateLimit('relics', 60), async (req, res, next) => { try {
  res.json({ packs: await getPacks() });
} catch(e){ next(e); } });

// Open a pack. NOTE: debits the user's Stars BALANCE (same as spin), not a
// fresh Telegram invoice.
router.post('/relics/pack/open', rateLimit('relic_pack', 30), async (req, res, next) => { try {
  const slug = String(req.body?.slug || req.body?.pack || '');
  if (!slug) return res.status(400).json({ error:'slug required' });
  res.json(await openPack(req.user, slug));
} catch(e){ res.status(400).json({ error: e.message, need: e.need }); } });

router.post('/relics/shards/redeem', rateLimit('relic_shard', 30), async (req, res, next) => { try {
  const tier = String(req.body?.tier || 'rare');
  res.json(await redeemShards(req.user, tier));
} catch(e){ res.status(400).json({ error: e.message, need: e.need }); } });

router.get('/relics/events', rateLimit('relics', 60), async (req, res, next) => { try {
  res.json({ events: await relicEvents(req.user.id, Number(req.query?.limit) || 30) });
} catch(e){ next(e); } });

export { handleWebhook };