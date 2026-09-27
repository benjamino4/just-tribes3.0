// TRIBES-FILE: server/src/routes.js
// PHASE: 3 — Economy
// Mounts everything from phases 2 and 3.

import express from 'express';
import { q } from './db.js';
import { CFG } from './config.js';
import { authMiddleware, rateLimit } from './middleware.js';
import { refreshUserRole, addRenown, activeBonfire } from './economy.js';
import {
  tribesList, tribeDetail, namesAvailable,
  createTribe, joinTribe, leaveTribe, donate, upgradeTribe,
} from './tribes.js';
import * as Trials from './trials.js';
import * as Quests from './quests.js';
import * as Spin from './spin.js';
import * as Refs from './referrals.js';
import * as FirstPack from './firstpack.js';
import * as Streaks from './streaks.js';

export const router = express.Router();
router.use(authMiddleware);

/* ============ STATE ============ */
router.get('/state', rateLimit('state', 120), async (req, res, next) => { try {
  const u = req.user;
  await refreshUserRole(u);

  const fresh = (await q('SELECT * FROM users WHERE id=$1', [u.id])).rows[0];
  const tribe = fresh.tribe_id
    ? (await q('SELECT * FROM tribes WHERE id=$1', [fresh.tribe_id])).rows[0]
    : null;

  // ash pending
  const now = Date.now();
  const intervalMs = (Number(CFG.ashMinutes) || 30) * 60000;
  const readyAt = fresh.ash_ready_at ? new Date(fresh.ash_ready_at).getTime() : 0;
  const elapsed = fresh.ash_ready_at ? Math.max(0, now - (readyAt - intervalMs)) : 0;
  const ashPending = fresh.ash_ready_at
    ? Math.min(Number(CFG.ashCap) || 3, Math.floor(elapsed / intervalMs))
    : 0;

  const leaderboard = (await q(
    `SELECT id,name,hue,banner,palette,renown_total,members,wins,losses,treasury,level
       FROM tribes ORDER BY renown_total DESC LIMIT 20`
  )).rows;

  const daily = await Quests.dailyViewFor(fresh.id);
  const trials = await Trials.listTrials(false);
  const trialState = fresh.trials_state || {};
  const nowMs = Date.now();
  const trialsView = trials.map((t) => {
    const av = Trials.trialAvailable(t, trialState, nowMs);
    return { ...t, available: av.ok, reason: av.reason || null, nextIn: av.nextIn || 0 };
  });

  const spin = await Spin.spinState(fresh);
  const referral = await Refs.summary(fresh.id);
  const firstPack = await FirstPack.status(fresh);
  const streakInsurance = await Streaks.config();

  let notifications = [];
  try {
    notifications = (await q(
      `SELECT id, type, icon, severity, title, body, action_kind, action_data, created_at
         FROM notifications
        WHERE user_id=$1 AND seen_at IS NULL
        ORDER BY created_at DESC LIMIT 20`,
      [u.id]
    )).rows;
  } catch {}

  const bonfire = await activeBonfire();

  res.json({
    demo: false,
    user: {
      id: fresh.id,
      username: fresh.username,
      first_name: fresh.first_name,
      role: fresh.role,
      ember: Number(fresh.ember),
      stars: Number(fresh.stars),
      renown: Number(fresh.renown),
      streak: Number(fresh.streak),
      ash_ready_at: fresh.ash_ready_at,
      ash_count: Number(fresh.ash_count),
      ton_address: fresh.ton_address || null,
      avatar_id: fresh.avatar_id || null,
      name_color: fresh.name_color || null,
      avatar_glow: fresh.avatar_glow || null,
      referral_code: fresh.referral_code || null,
      created_at: fresh.created_at,
    },
    tribe: tribe ? {
      id: tribe.id,
      name: tribe.name,
      role: fresh.role,
      level: Number(tribe.level),
      members: Number(tribe.members),
      treasury: Number(tribe.treasury),
      motto: tribe.motto,
      crest: tribe.crest,
      banner: tribe.banner,
      palette: tribe.palette,
      renown_total: Number(tribe.renown_total),
      wins: Number(tribe.wins),
      losses: Number(tribe.losses),
    } : null,
    ash: {
      ready: ashPending > 0,
      per_pool: Number(CFG.ashUnit) || 90,
      pools_stored: ashPending,
      next_ready_in_ms: Math.max(0, intervalMs - (now - (readyAt - intervalMs))),
      interval_min: Number(CFG.ashMinutes) || 30,
    },
    daily,
    trials: trialsView,
    spin,
    referral: { code: fresh.referral_code, ...referral },
    firstPack,
    streakInsurance: {
      enabled: streakInsurance.enabled,
      price: streakInsurance.price_stars,
    },
    war: null,
    bonfire: bonfire ? {
      active: true,
      title: bonfire.title,
      multiplier: Number(bonfire.multiplier),
      ends_in_ms: Math.max(0, new Date(bonfire.end_at).getTime() - Date.now()),
    } : null,
    notifications,
    leaderboard,
  });
} catch (e) { next(e); } });

/* ============ TRIBE ============ */
router.get('/tribes', rateLimit('tribes', 60), async (req, res, next) => { try {
  res.json({ tribes: await tribesList(60) });
} catch (e) { next(e); } });

router.get('/tribe/names', rateLimit('names', 60), async (req, res, next) => { try {
  res.json({ names: await namesAvailable() });
} catch (e) { next(e); } });

router.get('/tribe/:id', rateLimit('tribes', 60), async (req, res, next) => { try {
  const t = await tribeDetail(Number(req.params.id));
  if (!t) return res.status(404).json({ error: 'no such tribe' });
  res.json({ tribe: t });
} catch (e) { next(e); } });

router.post('/tribe/create', rateLimit('create', 5), async (req, res, next) => { try {
  const t = await createTribe(req.user, req.body || {});
  res.json({ ok: true, tribe: t });
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });

router.post('/tribe/join', rateLimit('join', 20), async (req, res, next) => { try {
  const t = await joinTribe(req.user, Number(req.body?.tribeId));
  res.json({ ok: true, tribe: t });
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/tribe/leave', rateLimit('leave', 10), async (req, res, next) => { try {
  await leaveTribe(req.user);
  res.json({ ok: true });
} catch (e) { next(e); } });

router.post('/tribe/donate', rateLimit('donate', 30), async (req, res, next) => { try {
  const r = await donate(req.user, req.body?.amount);
  await Quests.bump(req.user.id, 'donate', r.donated);
  res.json({ ok: true, ...r });
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/tribe/upgrade', rateLimit('upgrade', 6), async (req, res, next) => { try {
  const r = await upgradeTribe(req.user);
  res.json({ ok: true, ...r });
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });

/* ============ ECONOMY: CHECKIN / ASH / SHARE ============ */
router.post('/checkin', rateLimit('checkin', 10), async (req, res, next) => { try {
  const u = req.user;
  const last = u.last_checkin ? new Date(u.last_checkin).getTime() : 0;
  const since = Date.now() - last;
  if (since < 20 * 3600 * 1000) {
    return res.json({ ok: false, reason: 'already', nextIn: 20 * 3600 * 1000 - since });
  }

  const streak = since < 44 * 3600 * 1000 ? Number(u.streak) + 1 : 1;
  let reward = Number(CFG.checkin_base) +
    Math.min(Number(CFG.checkin_streakMax), streak * Number(CFG.checkin_streakStep));

  const bf = await activeBonfire();
  if (bf && bf.metric === 'checkin') reward = Math.floor(reward * Number(bf.multiplier));

  await q(
    'UPDATE users SET ember=ember+$1, streak=$2, last_checkin=now() WHERE id=$3',
    [reward, streak, u.id]
  );
  if (u.tribe_id) {
    await q('UPDATE tribes SET checkins_total = checkins_total + 1 WHERE id=$1', [u.tribe_id]);
  }
  await addRenown(u, Number(CFG.renown_checkin) || 15);
  await Quests.bump(u.id, 'checkin', 1);

  res.json({ ok: true, reward, streak });
} catch (e) { next(e); } });

router.post('/ash/collect', rateLimit('ash', 30), async (req, res, next) => { try {
  const u = req.user;
  const now = Date.now();
  const intervalMs = (Number(CFG.ashMinutes) || 30) * 60000;
  const readyAt = u.ash_ready_at ? new Date(u.ash_ready_at).getTime() : 0;
  const elapsed = u.ash_ready_at ? Math.max(0, now - (readyAt - intervalMs)) : 0;
  let units = u.ash_ready_at ? Math.min(Number(CFG.ashCap) || 3, Math.floor(elapsed / intervalMs)) : 0;

  const bf = await activeBonfire();
  if (bf && bf.metric === 'ash') units = Math.floor(units * Number(bf.multiplier));

  if (units < 1) return res.json({ ok: false, reason: 'not_ready' });

  const gain = units * (Number(CFG.ashUnit) || 90);
  await q(
    `UPDATE users SET ember=ember+$1, ash_ready_at=now(), ash_count=ash_count+$2 WHERE id=$3`,
    [gain, units, u.id]
  );
  if (u.tribe_id) {
    await q('UPDATE tribes SET ash_total = ash_total + $1 WHERE id=$2', [units, u.tribe_id]);
  }
  await addRenown(u, Number(CFG.renown_ash) || 8);
  await Quests.bump(u.id, 'ash', 1);

  res.json({ ok: true, gain, units });
} catch (e) { next(e); } });

router.post('/share', rateLimit('share', 10), async (req, res, next) => { try {
  const u = req.user;
  if (u.tribe_id) {
    await q('UPDATE tribes SET shares_total = shares_total + 1 WHERE id=$1', [u.tribe_id]);
  }
  await addRenown(u, Number(CFG.renown_share) || 12);
  await Quests.bump(u.id, 'share', 1);
  res.json({ ok: true });
} catch (e) { next(e); } });

/* ============ TRIALS ============ */
router.get('/trials', rateLimit('trials', 60), async (req, res, next) => { try {
  res.json({ trials: await Trials.listTrials(false) });
} catch (e) { next(e); } });

router.post('/trials/:slug', rateLimit('trial', 30), async (req, res, next) => { try {
  const slug = String(req.params.slug || '').slice(0, 32);
  const t = (await q('SELECT * FROM trial_defs WHERE slug=$1 AND active=true', [slug])).rows[0];
  if (!t) return res.status(404).json({ error: 'no such trial' });
  if (t.kind === 'rewarded_ad') return res.json({ ok: false, reason: 'ad_not_configured' });

  const u = req.user;
  const av = Trials.trialAvailable(t, u.trials_state || {});
  if (!av.ok) return res.json({ ok: false, reason: av.reason, nextIn: av.nextIn || 0 });

  // Sift: verify pick server-side
  if (t.minigame === 'sift') {
    const pick = Math.max(0, Math.min(4, Number(req.body?.pick)));
    const dayKey = new Date().toISOString().slice(0, 10);
    const correct = Trials.siftCorrectIndex(u.id, dayKey);

    if (pick !== correct) {
      await Trials.completeTrial(u, t, { miss: true });
      if (u.tribe_id) {
        await q('UPDATE tribes SET quests_total = quests_total + 1 WHERE id=$1', [u.tribe_id]);
      }
      return res.json({ ok: true, hit: false, correct, reward_ember: 0, reward_renown: 0 });
    }

    const reward = await Trials.completeTrial(u, t);
    if (u.tribe_id) {
      await q('UPDATE tribes SET quests_total = quests_total + 1 WHERE id=$1', [u.tribe_id]);
    }
    await Quests.bump(u.id, 'trials', 1);
    return res.json({
      ok: true, hit: true, correct,
      reward_ember: reward.reward_ember,
      reward_renown: reward.reward_renown,
    });
  }

  const reward = await Trials.completeTrial(u, t);
  if (u.tribe_id) {
    await q('UPDATE tribes SET quests_total = quests_total + 1 WHERE id=$1', [u.tribe_id]);
  }
  await Quests.bump(u.id, 'trials', 1);
  res.json({ ok: true, reward_ember: reward.reward_ember, reward_renown: reward.reward_renown });
} catch (e) { next(e); } });

/* ============ DAILY QUESTS ============ */
router.get('/daily', rateLimit('daily', 60), async (req, res, next) => { try {
  res.json({ daily: await Quests.dailyViewFor(req.user.id) });
} catch (e) { next(e); } });

router.post('/daily/:id/claim', rateLimit('daily', 60), async (req, res, next) => { try {
  const r = await Quests.claim(req.user.id, Number(req.params.id));
  res.json(r);
} catch (e) {
  res.status(400).json({ error: e.message, need: e.need, have: e.have });
} });

/* ============ SPIN ============ */
router.post('/spin', rateLimit('spin', 20), async (req, res, next) => { try {
  const r = await Spin.spin(req.user);
  await Quests.bump(req.user.id, 'spin', 1);
  res.json(r);
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });

/* ============ REFERRALS ============ */
router.get('/referral', rateLimit('ref', 60), async (req, res, next) => { try {
  res.json({ code: req.user.referral_code, ...(await Refs.summary(req.user.id)) });
} catch (e) { next(e); } });

router.post('/referral/claim', rateLimit('ref', 5), async (req, res, next) => { try {
  res.json(await Refs.claim(req.user, req.body?.code));
} catch (e) { res.status(400).json({ error: e.message }); } });

/* ============ FIRST PACK ============ */
router.post('/first-pack/claim', rateLimit('first', 5), async (req, res, next) => { try {
  res.json(await FirstPack.claim(req.user));
} catch (e) { res.status(400).json({ error: e.message }); } });

/* ============ STREAK INSURANCE ============ */
router.post('/streak-insurance', rateLimit('sins', 5), async (req, res, next) => { try {
  res.json(await Streaks.purchase(req.user));
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });