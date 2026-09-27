// TRIBES-FILE: server/src/routes.js
// PHASE: 5 — Council & Kiva
// Adds /kiva/* and /council/* routes on top of Phase 4.

import express from 'express';
import { q } from './db.js';
import { CFG, cfgJSON } from './config.js';
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
import * as Relics from './relics.js';
import * as Kiva from './kiva.js';
import * as Council from './council.js';

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

  // Kiva unread
  let kivaUnread = 0;
  let curfew = null;
  if (tribe) {
    try {
      kivaUnread = await Kiva.unreadCount(tribe.id, fresh.id);
      curfew = await Kiva.activeCurfew(tribe.id);
    } catch {}
  }

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
      blessed: !!fresh.blessed,
      cursed_shards: Number(fresh.cursed_shards || 0),
      equipped_relic_id: fresh.equipped_relic_id || null,
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
    kivaUnread,
    curfew: curfew ? { started_by: curfew.started_by, ends_at: curfew.ends_at } : null,
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

/* ============ ECONOMY ============ */
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
  await q('UPDATE users SET ember=ember+$1, streak=$2, last_checkin=now() WHERE id=$3',
    [reward, streak, u.id]);
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
  await q('UPDATE users SET ember=ember+$1, ash_ready_at=now(), ash_count=ash_count+$2 WHERE id=$3',
    [gain, units, u.id]);
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

/* ============ TRIALS / DAILY / SPIN ============ */
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

  if (t.minigame === 'sift') {
    const pick = Math.max(0, Math.min(4, Number(req.body?.pick)));
    const dayKey = new Date().toISOString().slice(0, 10);
    const correct = Trials.siftCorrectIndex(u.id, dayKey);
    if (pick !== correct) {
      await Trials.completeTrial(u, t, { miss: true });
      if (u.tribe_id) await q('UPDATE tribes SET quests_total=quests_total+1 WHERE id=$1', [u.tribe_id]);
      return res.json({ ok: true, hit: false, correct, reward_ember: 0, reward_renown: 0 });
    }
    const reward = await Trials.completeTrial(u, t);
    if (u.tribe_id) await q('UPDATE tribes SET quests_total=quests_total+1 WHERE id=$1', [u.tribe_id]);
    await Quests.bump(u.id, 'trials', 1);
    return res.json({ ok: true, hit: true, correct, reward_ember: reward.reward_ember, reward_renown: reward.reward_renown });
  }

  const reward = await Trials.completeTrial(u, t);
  if (u.tribe_id) await q('UPDATE tribes SET quests_total=quests_total+1 WHERE id=$1', [u.tribe_id]);
  await Quests.bump(u.id, 'trials', 1);
  res.json({ ok: true, reward_ember: reward.reward_ember, reward_renown: reward.reward_renown });
} catch (e) { next(e); } });

router.get('/daily', rateLimit('daily', 60), async (req, res, next) => { try {
  res.json({ daily: await Quests.dailyViewFor(req.user.id) });
} catch (e) { next(e); } });

router.post('/daily/:id/claim', rateLimit('daily', 60), async (req, res, next) => { try {
  res.json(await Quests.claim(req.user.id, Number(req.params.id)));
} catch (e) {
  res.status(400).json({ error: e.message, need: e.need, have: e.have });
} });

router.post('/spin', rateLimit('spin', 20), async (req, res, next) => { try {
  const r = await Spin.spin(req.user);
  await Quests.bump(req.user.id, 'spin', 1);
  res.json(r);
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });

/* ============ REFERRALS / FIRST PACK / INSURANCE ============ */
router.get('/referral', rateLimit('ref', 60), async (req, res, next) => { try {
  res.json({ code: req.user.referral_code, ...(await Refs.summary(req.user.id)) });
} catch (e) { next(e); } });

router.post('/referral/claim', rateLimit('ref', 5), async (req, res, next) => { try {
  res.json(await Refs.claim(req.user, req.body?.code));
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/first-pack/claim', rateLimit('first', 5), async (req, res, next) => { try {
  res.json(await FirstPack.claim(req.user));
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/streak-insurance', rateLimit('sins', 5), async (req, res, next) => { try {
  res.json(await Streaks.purchase(req.user));
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });

/* ============ RELICS ============ */
router.get('/relics/state', rateLimit('relics', 60), async (req, res, next) => { try {
  res.json(await Relics.stateFor(req.user.id));
} catch (e) { next(e); } });

router.post('/relics/wield', rateLimit('relic_wield', 40), async (req, res, next) => { try {
  const relicId = Number(req.body?.relicId || req.body?.relic_id || 0);
  if (!relicId) return res.status(400).json({ error: 'relicId required' });
  res.json(await Relics.wield(req.user.id, relicId));
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/relics/unwield', rateLimit('relic_wield', 40), async (req, res, next) => { try {
  res.json(await Relics.unwield(req.user.id));
} catch (e) { next(e); } });

router.get('/relics/packs', rateLimit('relics', 60), async (req, res, next) => { try {
  res.json({ packs: await Relics.packs() });
} catch (e) { next(e); } });

router.post('/relics/pack/open', rateLimit('relic_pack', 30), async (req, res, next) => { try {
  const slug = String(req.body?.slug || req.body?.pack || '');
  if (!slug) return res.status(400).json({ error: 'slug required' });
  res.json(await Relics.openPack(req.user, slug));
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });

router.post('/relics/shards/redeem', rateLimit('relic_shard', 30), async (req, res, next) => { try {
  res.json(await Relics.redeemShards(req.user, String(req.body?.tier || 'rare')));
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });

router.get('/relics/events', rateLimit('relics', 60), async (req, res, next) => { try {
  res.json({ events: await Relics.events(req.user.id, Number(req.query?.limit) || 30) });
} catch (e) { next(e); } });

router.get('/relics/fusion', rateLimit('relics', 60), async (req, res, next) => { try {
  res.json(await Relics.fusionState(req.user.id));
} catch (e) { next(e); } });

router.post('/relics/fuse', rateLimit('relic_fuse', 30), async (req, res, next) => { try {
  res.json(await Relics.fuse(req.user, String(req.body?.rarity || '').toLowerCase()));
} catch (e) { res.status(400).json({ error: e.message }); } });

/* ============ EMOJI SETS ============ */
router.get('/emoji/state', rateLimit('emoji', 60), async (req, res, next) => { try {
  res.json(await Relics.emojiState(req.user));
} catch (e) { next(e); } });

router.post('/emoji/unlock', rateLimit('emoji_unlock', 20), async (req, res, next) => { try {
  res.json(await Relics.unlockEmoji(req.user, String(req.body?.slug || '')));
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });

/* ============ KIVA ============ */
router.get('/kiva', rateLimit('kiva', 240), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  const since = Number(req.query.since) || 0;
  const rows = since
    ? await Kiva.listMessages(u.tribe_id, since, 50)
    : await Kiva.latestMessages(u.tribe_id, 50);
  const curfew = await Kiva.activeCurfew(u.tribe_id);
  res.json({ messages: rows, tribe_id: u.tribe_id, curfew });
} catch (e) { next(e); } });

router.post('/kiva', rateLimit('kiva', 40), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  const body = String(req.body?.body || '').slice(0, 280);
  if (!body.trim()) return res.status(400).json({ error: 'empty' });
  const msg = await Kiva.postMessage(u.tribe_id, u.id, body, 'chat');
  await Quests.bump(u.id, 'kiva_msg', 1);
  res.json({ ok: true, message: msg });
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/kiva/seal', rateLimit('kiva', 20), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  const id = Number(req.body?.id);
  const sealed = !!req.body?.sealed;

  // Sealing costs Stars unless the user is Chief (boon rule)
  const isChief = u.role === 'Chief';
  const cfg = cfgJSON('kiva_boons', []);
  const sealBoon = cfg.find((b) => b.id === 'seal') || { price: 60 };
  const cost = Number(CFG.kiva_seal_price) || sealBoon.price || 60;

  if (sealed && !isChief && !u.blessed) {
    if (Number(u.stars || 0) < cost) {
      const e = new Error(`Sealing costs ${cost} Stars`);
      e.need = cost;
      throw e;
    }
    await q('UPDATE users SET stars = stars - $1 WHERE id=$2', [cost, u.id]);
  }

  const row = await Kiva.setSeal(u.tribe_id, id, u.id, sealed);
  res.json({ ok: true, ...row, cost: (sealed && !isChief && !u.blessed) ? cost : 0 });
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });

router.post('/kiva/poll', rateLimit('kiva', 12), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  if (u.role !== 'Chief') return res.status(403).json({ error: 'only the Chief may post a poll' });
  const q_ = String(req.body?.q || '').slice(0, 120);
  const opts = Array.isArray(req.body?.opts) ? req.body.opts.slice(0, 4).map((s) => String(s).slice(0, 40)) : [];
  if (q_.length < 2 || opts.length < 2) return res.status(400).json({ error: 'need a question and 2+ options' });

  const poll = {
    q: q_,
    opts: opts.map((t) => ({ t, v: 0 })),
    ends_at: req.body?.hours ? new Date(Date.now() + Number(req.body.hours) * 3600 * 1000) : null,
    voters: {},
    by: u.id,
  };
  const msg = await Kiva.postMessage(u.tribe_id, u.id, null, 'poll', poll);

  if (req.body?.curfew) await Kiva.startCurfew(u.tribe_id, u.id, req.body.hours || 3);

  res.json({ ok: true, message: msg });
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/kiva/vote', rateLimit('kiva', 40), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  const poll = await Kiva.votePoll(u.tribe_id, Number(req.body?.id), u.id, Number(req.body?.option));
  res.json({ ok: true, poll });
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/kiva/curfew', rateLimit('kiva', 6), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  if (u.role !== 'Chief') return res.status(403).json({ error: 'only the Chief may call a Curfew' });
  if (req.body?.end) {
    res.json(await Kiva.endCurfew(u.tribe_id, u.id));
    return;
  }
  res.json(await Kiva.startCurfew(u.tribe_id, u.id, Number(req.body?.hours) || 3));
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/kiva/read', rateLimit('kiva', 240), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ ok: true });
  await Kiva.markRead(u.tribe_id, u.id, Number(req.body?.lastSeenId) || 0);
  res.json({ ok: true });
} catch (e) { next(e); } });

/* ============ CHIEF'S BOONS ============ */
router.get('/kiva/boons', rateLimit('kiva', 60), async (req, res, next) => { try {
  const u = req.user;
  const catalog = cfgJSON('kiva_boons', []);
  const active = u.tribe_id ? await Kiva.listBoons(u, u.tribe_id) : {};
  res.json({ catalog, active });
} catch (e) { next(e); } });

router.post('/kiva/boons/buy', rateLimit('kiva', 12), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  const slug = String(req.body?.slug || '');
  const catalog = cfgJSON('kiva_boons', []);
  const item = catalog.find((b) => b.id === slug);
  if (!item) return res.status(404).json({ error: 'no such boon' });

  const isChief = u.role === 'Chief';
  const free = isChief && item.chiefFree;

  if (!free && !u.blessed) {
    if (Number(u.stars || 0) < item.price) {
      const e = new Error(`Need ${item.price} Stars`);
      e.need = item.price;
      throw e;
    }
    await q('UPDATE users SET stars = stars - $1 WHERE id=$2', [item.price, u.id]);
  }

  const scope = item.id === 'echo_stone' ? 'tribe' : 'user';
  await Kiva.grantBoon(u, u.tribe_id, slug, scope);
  res.json({ ok: true, slug, scope, free });
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });

/* ============ COUNCIL / MOOT ============ */
router.get('/council/state', rateLimit('council', 60), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ available: true, in_tribe: false });
  const tribe = (await q('SELECT * FROM tribes WHERE id=$1', [u.tribe_id])).rows[0];

  const isLeader = ['Chief', 'Head', 'Elder'].includes(u.role) ||
    Number(tribe.created_by) === Number(u.id);

  const roles = await Council.rolesFor(tribe.id);
  const moot = await Council.mootState(tribe);
  const idol = await Council.getOrCreateIdol(tribe.id);
  const loadout = await Council.getLoadout(u.id);
  const myRole = roles.find((r) => Number(r.user_id) === Number(u.id));

  res.json({
    available: true,
    in_tribe: true,
    is_leader: isLeader,
    my_role: myRole ? myRole.position : null,
    my_eligible: Council.eligible(u),
    slots_cap: Council.slotsForLevel(tribe.level),
    positions: Council.POSITIONS,
    roles: roles.map((r) => ({
      user_id: r.user_id, position: r.position,
      name: r.first_name || r.username || 'Kin',
      renown: Number(r.renown), streak: Number(r.streak),
    })),
    moot,
    idol: {
      name: idol.name,
      tier: Number(idol.tier),
      state: idol.state,
      forge_progress: Number(idol.forge_progress),
      forge_goal: Number(idol.forge_goal),
      buff_value: Number(idol.buff_value),
    },
    loadout: loadout.map((l) => ({
      slot_index: l.slot_index, relic_id: l.relic_id,
      slug: l.slug, name: l.name, rarity: l.rarity, cursed: l.cursed,
    })),
  });
} catch (e) { next(e); } });

router.post('/council/moot/open', rateLimit('moot', 6), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  const tribe = (await q('SELECT * FROM tribes WHERE id=$1', [u.tribe_id])).rows[0];
  const isLeader = ['Chief', 'Head', 'Elder'].includes(u.role) ||
    Number(tribe.created_by) === Number(u.id);
  if (!isLeader) return res.status(403).json({ error: 'only the Chieftain or Elders can call a Moot' });
  const m = await Council.openMoot(tribe, u);
  res.json({ ok: true, muster_id: m.id, slots: m.slots, closes_at: m.closes_at });
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/council/moot/vote', rateLimit('moot', 40), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  const tribe = (await q('SELECT * FROM tribes WHERE id=$1', [u.tribe_id])).rows[0];
  res.json(await Council.voteMoot(tribe, u, Number(req.body?.candidateId), String(req.body?.position || 'warrior')));
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/council/moot/close', rateLimit('moot', 6), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  const tribe = (await q('SELECT * FROM tribes WHERE id=$1', [u.tribe_id])).rows[0];
  const isLeader = ['Chief', 'Head', 'Elder'].includes(u.role) ||
    Number(tribe.created_by) === Number(u.id);
  if (!isLeader) return res.status(403).json({ error: 'only the Chieftain or Elders can seal a Moot' });
  res.json(await Council.closeMoot(tribe, u));
} catch (e) { res.status(400).json({ error: e.message }); } });

/* ============ IDOL ============ */
router.post('/council/idol/forge', rateLimit('idol', 30), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  const r = await Council.forgeIdol(u.tribe_id, u.id, req.body?.amount);
  res.json({ ok: true, ...r });
} catch (e) { res.status(400).json({ error: e.message }); } });

/* ============ LOADOUT ============ */
router.post('/council/loadout', rateLimit('loadout', 40), async (req, res, next) => { try {
  const u = req.user;
  const r = await Council.setLoadout(u.id, req.body?.slots || []);
  res.json({ ok: true, ...r });
} catch (e) { res.status(400).json({ error: e.message }); } });

// ============ WAR ============ (append to routes.js after /council/loadout)
import * as War from './war.js';
import * as Spies from './spies.js';

async function currentWar(tribeId) {
  const r = await q(
    `SELECT * FROM wars WHERE (attacker_id=$1 OR defender_id=$1)
      ORDER BY (status='active') DESC, start_at DESC LIMIT 1`,
    [tribeId]
  );
  return r.rows[0] || null;
}

async function decorateWar(war, myTribe) {
  const ta = (await q(
    'SELECT id,name,hue,crest,banner,palette,level FROM tribes WHERE id=$1',
    [war.attacker_id]
  )).rows[0];
  const td = (await q(
    'SELECT id,name,hue,crest,banner,palette,level FROM tribes WHERE id=$1',
    [war.defender_id]
  )).rows[0];
  const ch = War.CHALLENGES.find((c) => c.id === war.challenge_id) || {};
  const fronts = await War.getFronts(war.id);
  const momentum = await War.momentumFor(war.id);
  const legendary = await War.activeLegendary(war.id);
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
  if (!u.tribe_id) return res.json({ war: null, reason: 'no_tribe' });
  let war = await currentWar(u.tribe_id);
  if (war && war.status === 'active') war = await War.maybeResolve(war);
  res.json({ war: war ? await decorateWar(war, u.tribe_id) : null });
} catch (e) { next(e); } });

router.post('/war/declare', rateLimit('war', 6), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'join a tribe first' });
  if (!Number(CFG.allowWar)) return res.status(400).json({ error: 'war has been sealed' });
  if (!['Chief','Head','Elder'].includes(u.role)) return res.status(403).json({ error: 'only Elders+' });

  const active = await q(
    "SELECT 1 FROM wars WHERE status='active' AND (attacker_id=$1 OR defender_id=$1)",
    [u.tribe_id]
  );
  if (active.rowCount) return res.status(400).json({ error: 'your tribe is already at war' });

  const stanceId = String(req.body?.stance || 'skirmish').slice(0, 32);
  const stances = cfgJSON('war_stances', []);
  const stance = stances.find((s) => s.id === stanceId) || stances[0] || { durMult: 1 };

  const foe = await War.pickFoe(u.tribe_id);
  if (!foe) return res.status(400).json({ error: 'no fair rival available' });

  const c = War.pickChallenge();
  const capHours = Number(CFG.war_cap_hours) || 72;
  const durHours = Math.round(capHours * Number(stance.durMult || 1));
  const stake = Math.max(Number(CFG.war_stake_min), Math.min(Number(CFG.war_stake_max), c.stake));
  const reward = Math.max(0, Math.round(c.reward * (Number(CFG.warRewardMult) || 1)));
  const aStart = await War.getTribeMetric(u.tribe_id, c.metric);
  const dStart = await War.getTribeMetric(foe.id, c.metric);

  const war = (await q(
    `INSERT INTO wars (attacker_id,defender_id,challenge_id,goal,metric,stake_pct,reward_ember,
                       attacker_start,defender_start,end_at,stance,front_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + ($10 || ' hours')::interval, $11, $12)
     RETURNING *`,
    [u.tribe_id, foe.id, c.id, c.goal, c.metric, stake, reward, aStart, dStart,
     String(durHours), stanceId, Number(CFG.war_front_count) || 3]
  )).rows[0];

  await War.createFronts(war.id);
  await War.scheduleLegendary(war, null);
  pauseForWar(u.tribe_id).catch(() => {});
  pauseForWar(foe.id).catch(() => {});

  res.json({ ok: true, war: await decorateWar(war, u.tribe_id) });
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/war/action', rateLimit('war_action', 60), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  const war = await currentWar(u.tribe_id);
  if (!war || war.status !== 'active') return res.status(400).json({ error: 'no active war' });
  const side = Number(war.attacker_id) === Number(u.tribe_id) ? 'attacker' : 'defender';
  const frontIdx = Math.max(0, Math.min((Number(war.front_count) || 3) - 1, Number(req.body?.front) || 0));
  const kind = String(req.body?.kind || 'rally').slice(0, 16);
  const tribe = (await q('SELECT * FROM tribes WHERE id=$1', [u.tribe_id])).rows[0];
  const result = await War.recordAction(war, u, tribe, side, frontIdx, kind);
  await Quests.bump(u.id, 'war_action', 1);
  res.json(result);
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/war/defend', rateLimit('war_def', 20), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  const war = await currentWar(u.tribe_id);
  if (!war || war.status !== 'active') return res.status(400).json({ error: 'no active war' });
  if (Number(war.defender_id) !== Number(u.tribe_id)) return res.status(403).json({ error: 'only defenders' });
  const kind = String(req.body?.kind || '').slice(0, 16);
  const frontIdx = req.body?.front != null ? Number(req.body.front) : null;
  const tribe = (await q('SELECT * FROM tribes WHERE id=$1', [u.tribe_id])).rows[0];
  res.json(await War.recordDefenderAction(war, u, tribe, kind, frontIdx));
} catch (e) { res.status(400).json({ error: e.message }); } });

router.get('/war/tactics', rateLimit('war', 120), async (req, res, next) => { try {
  res.json(War.listTactics());
} catch (e) { next(e); } });

router.get('/war/hint', rateLimit('war', 60), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ hint: 'Join a tribe to hear the elders.' });
  const war = await currentWar(u.tribe_id);
  if (!war || war.status !== 'active') return res.json({ hint: 'No war rages right now.' });
  const side = Number(war.attacker_id) === Number(u.tribe_id) ? 'attacker' : 'defender';
  res.json(await War.warHint(war, side));
} catch (e) { next(e); } });

router.get('/war/wiki', rateLimit('war', 120), async (req, res, next) => { try {
  const t = War.listTactics();
  res.json({
    rules: [
      `A war is fought across ${Number(CFG.war_front_count) || 3} fronts. Each front has its own terrain.`,
      'Whoever wins the most fronts wins the war.',
      `Terrain favours some tactics (+${t.bonusPct}%) and resists others (-${t.penaltyPct}%).`,
      'Beaten tribes earn Vengeance against the victor.',
      'Blood Allies cannot be matched against each other.',
      `Rivals are matched within ${Number(CFG.war_matchmaking_level_cap) || 2} levels.`,
    ],
    terrain: t.terrain,
    offensive: t.offensive,
    defensive: t.defensive,
  });
} catch (e) { next(e); } });

router.get('/war/vengeance', rateLimit('war', 60), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ grudges: [] });
  res.json({ grudges: await War.listVengeance(u.tribe_id) });
} catch (e) { next(e); } });

router.get('/war/alliances', rateLimit('war', 60), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ alliances: [] });
  res.json({ alliances: await War.listAlliances(u.tribe_id) });
} catch (e) { next(e); } });

router.post('/war/alliance', rateLimit('war', 6), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'join a tribe first' });
  if (!['Chief','Head','Elder'].includes(u.role)) return res.status(403).json({ error: 'only Elders+' });
  const target = Number(req.body?.tribe);
  if (!target || target === Number(u.tribe_id)) return res.status(400).json({ error: 'pick another tribe' });
  const exists = await q('SELECT 1 FROM tribes WHERE id=$1', [target]);
  if (!exists.rowCount) return res.status(404).json({ error: 'no such tribe' });
  const pact = await War.formBloodAlliance(u.tribe_id, target, u.id);
  res.json({ ok: true, alliance: pact });
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/war/alliance/break', rateLimit('war', 6), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'join a tribe first' });
  if (!['Chief','Head','Elder'].includes(u.role)) return res.status(403).json({ error: 'only Elders+' });
  const target = Number(req.body?.tribe);
  const broken = await War.breakBloodAlliance(u.tribe_id, target);
  if (!broken) return res.status(400).json({ error: 'no active pact' });
  res.json({ ok: true });
} catch (e) { res.status(400).json({ error: e.message }); } });

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
} catch (e) { next(e); } });

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
} catch (e) { next(e); } });

/* ============ SPIES ============ */
router.get('/spies', rateLimit('spies', 60), async (req, res, next) => { try {
  res.json(await Spies.spyState(req.user));
} catch (e) { next(e); } });

router.post('/spies/launch', rateLimit('spy_launch', 20), async (req, res, next) => { try {
  res.json(await Spies.launchSpy(req.user, Number(req.body?.target), String(req.body?.kind || 'recon')));
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });

router.post('/spies/counter', rateLimit('spy_counter', 20), async (req, res, next) => { try {
  res.json(await Spies.raiseCounterSpy(req.user));
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });

// ============ NOTIFICATIONS ============ (append to routes.js)
import * as Notif from './notifications.js';

router.get('/notifications', rateLimit('notif', 120), async (req, res, next) => { try {
  const u = req.user;
  const list = await Notif.list(u.id, {
    sinceId: Number(req.query.since) || 0,
    limit: Number(req.query.limit) || 40,
    unreadOnly: req.query.unread === '1',
  });
  res.json({ notifications: list, unread: await Notif.unreadCount(u.id) });
} catch (e) { next(e); } });

router.post('/notifications/seen', rateLimit('notif', 120), async (req, res, next) => { try {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  res.json(await Notif.markSeen(req.user.id, ids));
} catch (e) { next(e); } });

router.post('/notifications/seen/:id', rateLimit('notif', 120), async (req, res, next) => { try {
  res.json(await Notif.markOneSeen(req.user.id, Number(req.params.id)));
} catch (e) { next(e); } });

/* Bonfire active */
router.get('/bonfire', rateLimit('bf', 60), async (req, res, next) => { try {
  const { active } = await import('./bonfires.js');
  res.json({ bonfire: await active() });
} catch (e) { next(e); } });

/* X quests user-side */
router.get('/x/quests', rateLimit('xq', 60), async (req, res, next) => { try {
  const X = await import('./xquests.js');
  res.json(await X.userList(req.user.id));
} catch (e) { next(e); } });

router.post('/x/claim', rateLimit('xclaim', 12), async (req, res, next) => { try {
  const X = await import('./xquests.js');
  res.json(await X.userClaim(req.user, req.body || {}));
} catch (e) { res.status(400).json({ error: e.message }); } });

// ============ PAYMENTS ============ (append to routes.js)
import * as Stars from './stars.js';
import * as Ton from './ton.js';
import * as Settlement from './settlement.js';
import * as Standings from './standings.js';

router.post('/stars/invoice', rateLimit('invoice', 20), async (req, res, next) => { try {
  if (!Number(CFG.allowStore)) return res.status(400).json({ error: 'the trading post is closed' });
  const link = await Stars.createStarInvoice(req.user.id, String(req.body?.itemId || ''));
  res.json({ ok: true, link });
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/ton/intent', rateLimit('intent', 20), async (req, res, next) => { try {
  if (!Number(CFG.allowStore)) return res.status(400).json({ error: 'the trading post is closed' });
  res.json({ ok: true, intent: await Ton.makeIntent(req.user.id, String(req.body?.itemId || '')) });
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/ton/verify', rateLimit('verify', 40), async (req, res, next) => { try {
  res.json(await Ton.verifyPayment(req.user.id, String(req.body?.nonce || '')));
} catch (e) { res.status(400).json({ error: e.message }); } });

router.post('/ton/link', rateLimit('link', 20), async (req, res, next) => { try {
  const addr = String(req.body?.address || '').slice(0, 80);
  if (!addr) return res.status(400).json({ error: 'no address' });
  await Ton.linkWallet(req.user.id, addr);
  res.json({ ok: true });
} catch (e) { next(e); } });

/* catalog for the Trading Post */
router.get('/store/catalog', rateLimit('store', 60), async (req, res, next) => { try {
  res.json({
    stars: Object.entries(Stars.STAR_ITEMS).map(([id, it]) => ({ id, ...it })),
    ton:   Object.entries(Ton.TON_ITEMS).map(([id, it]) => ({ id, ...it })),
    tonEnabled: Ton.tonConfigured(),
    tonAddress: Ton.receiveAddress(),
  });
} catch (e) { next(e); } });

/* ============ SETTLEMENT ============ */
router.get('/settlement', rateLimit('settle', 60), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.json({ buildings: Settlement.list(), in_tribe: false });
  const buildings = await Settlement.tribeBuildings(u.tribe_id);
  const { caps, names } = (await import('./economy.js')).levelTable();
  res.json({
    in_tribe: true,
    buildings,
    tribe_level: u.tribe_id ? (await q('SELECT level FROM tribes WHERE id=$1', [u.tribe_id])).rows[0]?.level || 1 : 1,
    stage: names[Math.min((await q('SELECT level FROM tribes WHERE id=$1', [u.tribe_id])).rows[0]?.level || 1, names.length) - 1],
    cap: caps[Math.min((await q('SELECT level FROM tribes WHERE id=$1', [u.tribe_id])).rows[0]?.level || 1, caps.length) - 1],
  });
} catch (e) { next(e); } });

router.post('/settlement/upgrade', rateLimit('settle_up', 12), async (req, res, next) => { try {
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error: 'no tribe' });
  const tribe = (await q('SELECT * FROM tribes WHERE id=$1', [u.tribe_id])).rows[0];
  const r = await Settlement.upgrade(tribe, u, String(req.body?.buildingId || ''));
  res.json(r);
} catch (e) { res.status(400).json({ error: e.message, need: e.need }); } });

/* ============ STANDINGS ============ */
router.get('/standings', rateLimit('stand', 60), async (req, res, next) => { try {
  const u = req.user;
  const [tribes, users, myRank, myTribeRank] = await Promise.all([
    Standings.tribeStandings(50),
    Standings.userStandings(50),
    Standings.myRank(u.id),
    Standings.myTribeRank(u.tribe_id),
  ]);
  res.json({ tribes, users, myRank, myTribeRank });
} catch (e) { next(e); } });