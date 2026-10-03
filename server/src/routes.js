// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/routes.js
// PURPOSE: The entire player API surface. Every endpoint returns
//          { ok, data } or { ok: false, error }.
// DEPENDS ON: all modules
// ═══════════════════════════════════════════════════════════════════
import express from 'express';
import { q } from './db.js';
import { CFG } from './config.js';
import { authMiddleware, rateLimit } from './middleware.js';
import { refreshUserRole } from './economy.js';
import * as Tribes from './tribes.js';
import * as Kiva from './kiva.js';
import * as Trials from './trials.js';
import * as Quests from './quests.js';
import * as Spin from './spin.js';
import * as Refs from './referrals.js';
import * as FirstPack from './firstpack.js';
import * as Streaks from './streaks.js';
import * as Relics from './relics.js';
import * as Arena from './arena.js';
import * as War from './war.js';
import * as Gift from './giftcodes.js';
import * as Notif from './notifications.js';
import * as Rank from './rank.js';
import * as Forgotten from './forgotten.js';

export const router = express.Router();
router.use(authMiddleware);

const wrap = (fn) => async (req, res, next) => {
  try { res.json({ ok: true, data: await fn(req) }); }
  catch (e) { res.status(400).json({ ok: false, error: e.message, need: e.need }); }
};

router.get('/state', rateLimit('state', 240), wrap(async (req) => {
  const u = req.user;
  await refreshUserRole(u);
  const fresh = (await q('SELECT * FROM users WHERE id=$1', [u.id])).rows[0];
  const tribe = fresh.tribe_id ? (await q('SELECT * FROM tribes WHERE id=$1', [fresh.tribe_id])).rows[0] : null;
  const daily = await Quests.dailyViewFor(fresh.id);
  const trials = await Trials.listTrials();
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

  let kivaUnread = 0, curfew = null;
  if (tribe) {
    try {
      kivaUnread = await Kiva.unreadCount(tribe.id, fresh.id);
      curfew = await Kiva.activeCurfew(tribe.id);
    } catch {}
  }

  const notifications = (await q(
    `SELECT id, type, icon, severity, title, body, action_kind, action_data, created_at
       FROM notifications WHERE user_id=$1 AND seen_at IS NULL
      ORDER BY created_at DESC LIMIT 20`, [fresh.id]
  )).rows;

  const war = tribe ? await War.getActiveWar(tribe.id) : null;
  const seats = tribe ? await Rank.seatsForTribe(tribe.id) : [];
  const tier = await Rank.tierFor(Number(fresh.rank_rating || 1000));

  return {
    user: {
      id: fresh.id, username: fresh.username, first_name: fresh.first_name,
      role: fresh.role,
      sparks: Number(fresh.sparks), kinship: Number(fresh.kinship), stars: Number(fresh.stars),
      streak: Number(fresh.streak),
      ash_ready_at: fresh.ash_ready_at, ash_count: Number(fresh.ash_count),
      ton_address: fresh.ton_address || null, avatar_id: fresh.avatar_id || null,
      name_color: fresh.name_color || null, avatar_glow: fresh.avatar_glow || null,
      referral_code: fresh.referral_code || null,
      blessed: !!fresh.blessed,
      rank_rating: Number(fresh.rank_rating || 1000),
      rank_tier: tier,
      perf_tier: fresh.perf_tier || 'balanced',
      created_at: fresh.created_at
    },
    tribe: tribe ? {
      id: tribe.id, name: tribe.name, role: fresh.role,
      level: Number(tribe.level), members: Number(tribe.members), treasury: Number(tribe.treasury),
      motto: tribe.motto, crest: tribe.crest, banner: tribe.banner, palette: tribe.palette,
      icon_url: tribe.icon_url || null,
      name_font: tribe.name_font || 'default',
      name_style: tribe.name_style || 'plain',
      banner_style: tribe.banner_style || 'plain',
      kinship_total: Number(tribe.kinship_total),
      wins: Number(tribe.wins), losses: Number(tribe.losses)
    } : null,
    seats,
    daily, trials: trialsView, spin,
    referral: { code: fresh.referral_code, ...referral },
    firstPack,
    streakInsurance: { enabled: streakInsurance.enabled, price: streakInsurance.price_stars },
    kivaUnread,
    curfew: curfew ? { started_by: curfew.started_by, ends_at: curfew.ends_at } : null,
    war,
    notifications
  };
}));

router.get('/tribes', rateLimit('tribes', 60), wrap(async () => ({ tribes: await Tribes.tribesList(60) })));
router.get('/tribe/names', rateLimit('names', 60), wrap(async () => ({ names: await Tribes.namesAvailable() })));
router.get('/tribe/:id', rateLimit('tribes', 60), wrap(async (req) => {
  const t = await Tribes.tribeDetail(Number(req.params.id));
  if (!t) throw new Error('no such tribe');
  return { tribe: t };
}));
router.post('/tribe/create', rateLimit('create', 5), wrap(async (req) => ({ tribe: await Tribes.createTribe(req.user, req.body || {}) })));
router.post('/tribe/join', rateLimit('join', 20), wrap(async (req) => ({ tribe: await Tribes.joinTribe(req.user, Number(req.body?.tribeId)) })));
router.post('/tribe/leave', rateLimit('leave', 10), wrap(async (req) => { await Tribes.leaveTribe(req.user); return { ok: true }; }));
router.post('/tribe/donate', rateLimit('donate', 30), wrap(async (req) => {
  const r = await Tribes.donate(req.user, req.body?.amount);
  await Quests.bump(req.user.id, 'donate', r.donated);
  return r;
}));

router.post('/checkin', rateLimit('checkin', 10), wrap(async (req) => {
  const u = req.user;
  const last = u.last_checkin ? new Date(u.last_checkin).getTime() : 0;
  const since = Date.now() - last;
  if (since < 20 * 3600 * 1000) return { ok: false, reason: 'already', nextIn: 20 * 3600 * 1000 - since };
  const streak = since < 44 * 3600 * 1000 ? Number(u.streak) + 1 : 1;
  const reward = Number(CFG.checkin_base) + Math.min(Number(CFG.checkin_streak_max), streak * Number(CFG.checkin_streak_step));
  await q('UPDATE users SET sparks=sparks+$1, streak=$2, last_checkin=now() WHERE id=$3', [reward, streak, u.id]);
  if (u.tribe_id) await q('UPDATE tribes SET checkins_total = checkins_total + 1 WHERE id=$1', [u.tribe_id]);
  await Quests.bump(u.id, 'checkin', 1);
  return { ok: true, reward, streak };
}));

router.post('/ash/collect', rateLimit('ash', 30), wrap(async (req) => {
  const u = req.user;
  const now = Date.now();
  const intervalMs = (Number(CFG.ash_minutes) || 30) * 60000;
  const readyAt = u.ash_ready_at ? new Date(u.ash_ready_at).getTime() : 0;
  const elapsed = u.ash_ready_at ? Math.max(0, now - (readyAt - intervalMs)) : 0;
  const units = u.ash_ready_at ? Math.min(Number(CFG.ash_cap) || 3, Math.floor(elapsed / intervalMs)) : 0;
  if (units < 1) return { ok: false, reason: 'not_ready' };
  const gain = units * (Number(CFG.ash_unit) || 90);
  await q('UPDATE users SET sparks=sparks+$1, ash_ready_at=now(), ash_count=ash_count+$2 WHERE id=$3', [gain, units, u.id]);
  if (u.tribe_id) await q('UPDATE tribes SET ash_total = ash_total + $1 WHERE id=$2', [units, u.tribe_id]);
  return { ok: true, gain, units };
}));

router.post('/share', rateLimit('share', 10), wrap(async (req) => {
  if (req.user.tribe_id) await q('UPDATE tribes SET shares_total = shares_total + 1 WHERE id=$1', [req.user.tribe_id]);
  await Quests.bump(req.user.id, 'share', 1);
  return { ok: true };
}));

router.get('/trials', rateLimit('trials', 60), wrap(async () => ({ trials: await Trials.listTrials() })));
router.post('/trials/:slug', rateLimit('trial', 30), wrap(async (req) => {
  const slug = String(req.params.slug || '').slice(0, 32);
  const t = (await q('SELECT * FROM trial_defs WHERE slug=$1 AND active=true', [slug])).rows[0];
  if (!t) throw new Error('no such trial');
  const u = req.user;
  const av = Trials.trialAvailable(t, u.trials_state || {});
  if (!av.ok) return { ok: false, reason: av.reason, nextIn: av.nextIn || 0 };
  const game = Trials.pickGameForTrial(t);
  const reward = await Trials.completeTrial(u, t);
  if (u.tribe_id) await q('UPDATE tribes SET quests_total = quests_total + 1 WHERE id=$1', [u.tribe_id]);
  await Quests.bump(u.id, 'trial', 1);
  return { ok: true, game, reward_sparks: reward.reward_sparks, reward_kinship: reward.reward_kinship };
}));

router.get('/daily', rateLimit('daily', 60), wrap(async (req) => ({ daily: await Quests.dailyViewFor(req.user.id) })));
router.post('/daily/:id/claim', rateLimit('daily', 60), wrap(async (req) => await Quests.claim(req.user.id, Number(req.params.id))));
router.post('/spin', rateLimit('spin', 20), wrap(async (req) => {
  const r = await Spin.spin(req.user);
  await Quests.bump(req.user.id, 'spin', 1);
  return r;
}));

// ARENA
router.post('/arena/ranked/find', rateLimit('arena_r', 30), wrap(async (req) => {
  return await Arena.findRankedMatch(req.user, req.body?.game || null);
}));
router.post('/arena/ranked/resolve', rateLimit('arena_r', 60), wrap(async (req) => {
  return await Arena.resolveRankedDuel(req.user, Number(req.body?.duel_id), req.body || {});
}));
router.post('/arena/staked/open', rateLimit('arena_s', 20), wrap(async (req) => {
  return await Arena.findStakedMatch(req.user, Number(req.body?.stake), req.body?.game || null);
}));
router.post('/arena/staked/resolve', rateLimit('arena_s', 60), wrap(async (req) => {
  return await Arena.resolveStakedMatch(req.user, Number(req.body?.duel_id), req.body || {});
}));
router.get('/arena/recent', rateLimit('arena_r', 60), wrap(async (req) => ({
  matches: await Arena.recentMatches(req.user.id, 20)
})));

// WAR
router.get('/war', rateLimit('war', 240), wrap(async (req) => {
  if (!req.user.tribe_id) return { war: null };
  return { war: await War.getActiveWar(req.user.tribe_id) };
}));
router.post('/war/declare', rateLimit('war_declare', 6), wrap(async (req) => {
  if (!req.user.tribe_id) throw new Error('no tribe');
  const tribe = (await q('SELECT * FROM tribes WHERE id=$1', [req.user.tribe_id])).rows[0];
  return await War.declareWar(req.user, tribe);
}));
router.post('/war/match', rateLimit('war_match', 120), wrap(async (req) => {
  if (!req.user.tribe_id) throw new Error('no tribe');
  const warState = await War.getActiveWar(req.user.tribe_id);
  if (!warState) throw new Error('no active war');
  const frontIdx = Number(req.body?.front) || 0;
  const payload = req.body?.payload || {};
  const game = req.body?.game || null;
  const r = await War.resolveWarMatch(req.user, warState.war, frontIdx, game, payload);
  await Quests.bump(req.user.id, 'war_action', 1);
  return r;
}));

// KIVA
router.get('/kiva', rateLimit('kiva', 240), wrap(async (req) => {
  const u = req.user;
  if (!u.tribe_id) throw new Error('no tribe');
  const since = Number(req.query.since) || 0;
  const rows = since ? await Kiva.listMessages(u.tribe_id, since, 50) : await Kiva.latestMessages(u.tribe_id, 50);
  const curfew = await Kiva.activeCurfew(u.tribe_id);
  return { messages: rows, tribe_id: u.tribe_id, curfew };
}));
router.post('/kiva', rateLimit('kiva', 40), wrap(async (req) => {
  const u = req.user;
  if (!u.tribe_id) throw new Error('no tribe');
  const body = String(req.body?.body || '').slice(0, 280);
  if (!body.trim()) throw new Error('empty');
  const msg = await Kiva.postMessage(u.tribe_id, u.id, body, 'chat');
  await Quests.bump(u.id, 'kiva_msg', 1);
  return { message: msg };
}));
router.post('/kiva/seal', rateLimit('kiva', 20), wrap(async (req) => {
  const u = req.user;
  if (!u.tribe_id) throw new Error('no tribe');
  const id = Number(req.body?.id);
  const sealed = !!req.body?.sealed;
  return await Kiva.setSeal(u.tribe_id, id, u.id, sealed);
}));
router.post('/kiva/curfew', rateLimit('kiva', 6), wrap(async (req) => {
  const u = req.user;
  if (!u.tribe_id) throw new Error('no tribe');
  if (u.role !== 'Chief') throw new Error('only the Chief may call a Curfew');
  if (req.body?.end) return await Kiva.endCurfew(u.tribe_id, u.id);
  return await Kiva.startCurfew(u.tribe_id, u.id, Number(req.body?.hours) || 3);
}));
router.post('/kiva/read', rateLimit('kiva', 240), wrap(async (req) => {
  if (!req.user.tribe_id) return { ok: true };
  await Kiva.markRead(req.user.tribe_id, req.user.id, Number(req.body?.lastSeenId) || 0);
  return { ok: true };
}));

// RELICS
router.get('/relics/state', rateLimit('relics', 60), wrap(async (req) => await Relics.stateFor(req.user.id)));
router.get('/relics/packs', rateLimit('relics', 60), wrap(async () => ({ packs: await Relics.packs() })));
router.post('/relics/pack/open', rateLimit('relic_pack', 30), wrap(async (req) => {
  const slug = String(req.body?.slug || '');
  if (!slug) throw new Error('slug required');
  return await Relics.openPack(req.user, slug);
}));
router.post('/relics/equip', rateLimit('relic_equip', 40), wrap(async (req) => {
  const relicId = Number(req.body?.relicId || 0);
  if (!relicId) throw new Error('relicId required');
  return await Relics.equip(req.user.id, relicId);
}));
router.post('/relics/unequip', rateLimit('relic_equip', 40), wrap(async (req) => {
  return await Relics.unequip(req.user.id, String(req.body?.category || 'flame'));
}));

// GIFTS
router.post('/gift/preview', rateLimit('gift', 60), wrap(async (req) => await Gift.preview(req.user.id, String(req.body?.code || ''))));
router.post('/gift/redeem', rateLimit('gift', 30), wrap(async (req) => await Gift.redeem(req.user, String(req.body?.code || ''))));

// NOTIFICATIONS
router.get('/notifications', rateLimit('notif', 120), wrap(async (req) => ({
  notifications: await Notif.list(req.user.id, {
    sinceId: Number(req.query.since) || 0,
    limit: Number(req.query.limit) || 40,
    unreadOnly: req.query.unread === '1'
  }),
  unread: await Notif.unreadCount(req.user.id)
})));
router.post('/notifications/seen', rateLimit('notif', 120), wrap(async (req) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  return await Notif.markSeen(req.user.id, ids);
}));
router.post('/notifications/seen/:id', rateLimit('notif', 120), wrap(async (req) => {
  return await Notif.markOneSeen(req.user.id, Number(req.params.id));
}));

// REFERRALS / FIRST PACK / STREAK
router.get('/referral', rateLimit('ref', 60), wrap(async (req) => {
  const summary = await Refs.summary(req.user.id);
  return { code: req.user.referral_code, ...summary };
}));
router.post('/referral/claim', rateLimit('ref', 5), wrap(async (req) => await Refs.claim(req.user, req.body?.code)));
router.post('/first-pack/claim', rateLimit('first', 5), wrap(async (req) => await FirstPack.claim(req.user)));
router.post('/streak-insurance', rateLimit('sins', 5), wrap(async (req) => await Streaks.purchase(req.user)));

// STARS / TON
router.post('/stars/invoice', rateLimit('invoice', 20), wrap(async (req) => {
  if (!Number(CFG.allow_store)) throw new Error('the trading post is closed');
  const Stars = await import('./stars.js');
  const link = await Stars.createStarInvoice(req.user.id, String(req.body?.itemId || ''));
  return { link };
}));
router.get('/store/catalog', rateLimit('store', 60), wrap(async () => {
  const Stars = await import('./stars.js');
  const Ton = await import('./ton.js');
  return {
    stars: Object.entries(Stars.STAR_ITEMS).map(([id, it]) => ({ id, ...it })),
    ton: Object.entries(Ton.TON_ITEMS).map(([id, it]) => ({ id, ...it })),
    tonEnabled: Ton.tonConfigured(),
    tonAddress: Ton.receiveAddress()
  };
}));
router.post('/ton/intent', rateLimit('intent', 20), wrap(async (req) => {
  if (!Number(CFG.allow_store)) throw new Error('the trading post is closed');
  const Ton = await import('./ton.js');
  return await Ton.makeIntent(req.user.id, String(req.body?.itemId || ''));
}));
router.post('/ton/verify', rateLimit('verify', 40), wrap(async (req) => {
  const Ton = await import('./ton.js');
  return await Ton.verifyPayment(req.user.id, String(req.body?.nonce || ''));
}));
router.post('/ton/link', rateLimit('link', 20), wrap(async (req) => {
  const addr = String(req.body?.address || '').slice(0, 80);
  if (!addr) throw new Error('no address');
  const Ton = await import('./ton.js');
  await Ton.linkWallet(req.user.id, addr);
  return { ok: true };
}));

// HELP
router.get('/help', rateLimit('help', 60), wrap(async () => {
  const Help = await import('./help.js');
  return Help.list();
}));
router.get('/help/:slug', rateLimit('help', 120), wrap(async (req) => {
  const Help = await import('./help.js');
  const a = Help.get(String(req.params.slug));
  if (!a) throw new Error('no such article');
  return a;
}));

// RANK
router.get('/rank/tiers', rateLimit('rank', 120), wrap(async () => ({ tiers: await Rank.listTiers() })));
router.get('/rank/leaderboard', rateLimit('rank', 60), wrap(async () => ({
  top: (await q(
    `SELECT id, first_name, username, rank_rating FROM users
      WHERE banned = false ORDER BY rank_rating DESC LIMIT 100`
  )).rows
})));

// FORGOTTEN
router.get('/forgotten/list', rateLimit('forgotten', 60), wrap(async () => ({
  ones: await Forgotten.listAll()
})));