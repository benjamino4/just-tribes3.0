import express from 'express';
import { q } from './db.js';
import { CFG } from './config.js';
import { authMiddleware, rateLimit } from './middleware.js';
import * as Tribes from './tribes.js';
import * as Kiva from './kiva.js';
import * as Arena from './arena.js';
import * as War from './war.js';
import * as Relics from './relics.js';
import * as Emoji from './emoji.js';
import * as Gift from './giftcodes.js';
import * as Notif from './notifications.js';
import * as Live from './live.js';
import { readLive, listLive, listVersions, revertLive } from './live.js';
import { getTierFor } from './rank.js';

export const router = express.Router();
router.use(authMiddleware);

const wrap = (fn) => async (req, res, next) => {
  try { res.json({ ok: true, data: await fn(req) }); }
  catch (e) { res.status(400).json({ ok: false, error: e.message, need: e.need }); }
};

router.get('/state', rateLimit('state', 240), wrap(async (req) => {
  const u = req.user;
  const fresh = (await q('SELECT * FROM users WHERE id=$1', [u.id])).rows[0];
  const tribe = fresh.tribe_id ? (await q('SELECT * FROM tribes WHERE id=$1', [fresh.tribe_id])).rows[0] : null;
  const tier = await getTierFor(fresh.rank_rating);
  const war = tribe ? await War.getActiveWar(tribe.id) : null;
  const notifications = (await q(
    `SELECT id, type, icon, severity, title, body, action_kind, action_data, created_at
     FROM notifications WHERE user_id=$1 AND seen_at IS NULL
     ORDER BY created_at DESC LIMIT 20`, [fresh.id]
  )).rows;
  return {
    user: {
      id: fresh.id, username: fresh.username, first_name: fresh.first_name,
      role: fresh.role,
      sparks: Number(fresh.sparks), kinship: Number(fresh.kinship), stars: Number(fresh.stars),
      streak: Number(fresh.streak),
      tribe_id: fresh.tribe_id,
      rank_rating: Number(fresh.rank_rating || 1000),
      rank_tier: tier,
      referral_code: fresh.referral_code,
      referral_count: Number(fresh.referral_count || 0),
      perf_tier: fresh.perf_tier || 'balanced',
      blessed: !!fresh.blessed,
    },
    tribe: tribe ? {
      id: tribe.id, name: tribe.name,
      level: Number(tribe.level), members: Number(tribe.members),
      treasury: Number(tribe.treasury),
      motto: tribe.motto, crest: tribe.crest, banner: tribe.banner, palette: tribe.palette,
      kinship_total: Number(tribe.kinship_total),
      wins: Number(tribe.wins), losses: Number(tribe.losses)
    } : null,
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
router.post('/tribe/donate', rateLimit('donate', 30), wrap(async (req) => await Tribes.donate(req.user, req.body?.amount)));

router.post('/checkin', rateLimit('checkin', 10), wrap(async (req) => {
  const u = req.user;
  const last = u.last_checkin ? new Date(u.last_checkin).getTime() : 0;
  const since = Date.now() - last;
  if (since < 20 * 3600 * 1000) return { ok: false, reason: 'already', nextIn: 20 * 3600 * 1000 - since };
  const streak = since < 44 * 3600 * 1000 ? Number(u.streak) + 1 : 1;
  const reward = Number(CFG.checkin_base) + Math.min(Number(CFG.checkin_streak_max), streak * Number(CFG.checkin_streak_step));
  await q('UPDATE users SET sparks=sparks+$1, streak=$2, last_checkin=now(), kinship=kinship+15 WHERE id=$3', [reward, streak, u.id]);
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
  return { ok: true, gain, units };
}));

router.post('/arena/ranked/find', rateLimit('arena_r', 30), wrap(async (req) =>
  await Arena.findRankedMatch(req.user)));
router.post('/arena/ranked/poll', rateLimit('arena_poll', 240), wrap(async (req) =>
  await Arena.pollRankedMatch(req.user)));
router.post('/arena/ranked/cancel', rateLimit('arena_r', 60), wrap(async (req) =>
  await Arena.cancelRankedSearch(req.user)));
router.post('/arena/ranked/resolve', rateLimit('arena_r', 60), wrap(async (req) =>
  await Arena.resolveRankedDuel(req.user, Number(req.body?.duel_id), req.body || {})));
router.post('/arena/friendly/create', rateLimit('arena_r', 30), wrap(async (req) =>
  await Arena.createFriendly(req.user)));
router.post('/arena/friendly/accept', rateLimit('arena_r', 30), wrap(async (req) =>
  await Arena.acceptFriendly(req.user, req.body?.code)));
router.post('/arena/friendly/poll', rateLimit('arena_poll', 240), wrap(async (req) =>
  await Arena.pollFriendly(req.user, req.body?.code)));
router.post('/arena/friendly/cancel', rateLimit('arena_r', 30), wrap(async (req) =>
  await Arena.cancelFriendly(req.user, req.body?.code)));
router.get('/arena/recent', rateLimit('arena_r', 60), wrap(async (req) => ({
  matches: await Arena.recentMatches(req.user.id, 20)
})));

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
  const game = req.body?.game || 'rune_match';
  return await War.resolveWarMatch(req.user, warState.war, frontIdx, game, payload);
}));
router.post('/war/front', rateLimit('war_match', 120), wrap(async (req) => {
  if (!req.user.tribe_id) throw new Error('no tribe');
  const warState = await War.getActiveWar(req.user.tribe_id);
  if (!warState) throw new Error('no active war');
  const frontIdx = Number(req.body?.front) || 0;
  return await War.enterFront(req.user, warState, frontIdx);
}));

router.get('/kiva', rateLimit('kiva', 240), wrap(async (req) => {
  const u = req.user;
  if (!u.tribe_id) throw new Error('no tribe');
  const since = Number(req.query.since) || 0;
  const rows = since ? await Kiva.listMessages(u.tribe_id, since, 50) : await Kiva.latestMessages(u.tribe_id, 50);
  const pinned = since ? undefined : await Kiva.pinnedMessages(u.tribe_id);
  return { messages: rows, pinned, tribe_id: u.tribe_id };
}));
router.post('/kiva', rateLimit('kiva', 40), wrap(async (req) => {
  const u = req.user;
  if (!u.tribe_id) throw new Error('no tribe');
  const body = String(req.body?.body || '').slice(0, 280);
  if (!body.trim()) throw new Error('empty');
  const msg = await Kiva.postMessage(u.tribe_id, u.id, body, 'chat');
  return { message: msg };
}));
router.post('/kiva/read', rateLimit('kiva', 240), wrap(async (req) => {
  if (!req.user.tribe_id) return { ok: true };
  await Kiva.markRead(req.user.tribe_id, req.user.id, Number(req.body?.lastSeenId) || 0);
  return { ok: true };
}));
router.post('/kiva/react', rateLimit('kiva', 120), wrap(async (req) => {
  const u = req.user;
  if (!u.tribe_id) throw new Error('no tribe');
  return await Kiva.toggleReaction(
    u.tribe_id, u.id, Number(req.body?.messageId || 0), String(req.body?.emojiKey || '')
  );
}));
router.post('/kiva/pin', rateLimit('kiva', 40), wrap(async (req) => {
  const u = req.user;
  if (!u.tribe_id) throw new Error('no tribe');
  return await Kiva.pinMessage(u.tribe_id, u.id, Number(req.body?.messageId || 0));
}));
router.post('/kiva/unpin', rateLimit('kiva', 40), wrap(async (req) => {
  const u = req.user;
  if (!u.tribe_id) throw new Error('no tribe');
  return await Kiva.unpinMessage(u.tribe_id, Number(req.body?.messageId || 0));
}));

router.get('/relics/state', rateLimit('relics', 60), wrap(async (req) => await Relics.stateFor(req.user.id)));
router.post('/relics/equip', rateLimit('relic_equip', 40), wrap(async (req) =>
  await Relics.equip(req.user.id, Number(req.body?.relicId || 0))));
router.post('/relics/unequip', rateLimit('relic_equip', 40), wrap(async (req) =>
  await Relics.unequip(req.user.id, String(req.body?.category || 'flame'))));

router.get('/emoji/sets', rateLimit('relics', 60), wrap(async (req) => await Emoji.stateFor(req.user.id)));
router.post('/emoji/unlock', rateLimit('relic_equip', 40), wrap(async (req) =>
  await Emoji.unlock(req.user, String(req.body?.slug || ''))));

router.post('/gift/preview', rateLimit('gift', 60), wrap(async (req) => await Gift.preview(req.user.id, String(req.body?.code || ''))));
router.post('/gift/redeem', rateLimit('gift', 30), wrap(async (req) => await Gift.redeem(req.user, String(req.body?.code || ''))));

router.get('/notifications', rateLimit('notif', 120), wrap(async (req) => ({
  notifications: await Notif.list(req.user.id),
  unread: await Notif.unreadCount(req.user.id)
})));
router.post('/notifications/seen/:id', rateLimit('notif', 120), wrap(async (req) =>
  await Notif.markOneSeen(req.user.id, Number(req.params.id))));

router.get('/referral', rateLimit('ref', 60), wrap(async (req) => ({
  code: req.user.referral_code,
  count: Number(req.user.referral_count || 0)
})));

// Live content API (read-only for clients)
router.get('/content/all', rateLimit('content', 60), wrap(async () => {
  const files = await listLive();
  const out = {};
  for (const f of files) {
    const data = await readLive(f);
    out[f.replace('.json', '')] = data;
  }
  return out;
}));

// Rank tiers
router.get('/rank/tiers', rateLimit('rank', 60), wrap(async () => {
  const rows = (await q('SELECT * FROM rank_tiers WHERE active=true ORDER BY sort_order')).rows;
  return { tiers: rows };
}));

// Live leaderboard — top real players by rank rating, plus the caller's own
// standing (rank position among all real players). Forgotten bots (negative ids)
// and guests are excluded so the board shows only real humans.
router.get('/leaderboard', rateLimit('rank', 120), wrap(async (req) => {
  const u = req.user;
  const top = (await q(
    `SELECT id, first_name, username, name_color, rank_rating, rank_wins, rank_games, tribe_id
     FROM users
     WHERE id > 0 AND banned=false AND COALESCE(is_guest,false)=false
     ORDER BY rank_rating DESC, rank_wins DESC, id ASC
     LIMIT 50`
  )).rows;
  const me = (await q(
    `SELECT rank_rating, rank_wins, rank_games FROM users WHERE id=$1`, [u.id]
  )).rows[0] || {};
  const higher = (await q(
    `SELECT count(*)::int AS n FROM users
     WHERE id > 0 AND banned=false AND COALESCE(is_guest,false)=false
     AND (rank_rating > $1 OR (rank_rating = $1 AND rank_wins > $2))`,
    [me.rank_rating || 1000, me.rank_wins || 0]
  )).rows[0];
  const total = (await q(
    `SELECT count(*)::int AS n FROM users
     WHERE id > 0 AND banned=false AND COALESCE(is_guest,false)=false`
  )).rows[0];
  const withTier = [];
  for (const r of top) {
    const tier = await getTierFor(r.rank_rating);
    withTier.push({
      id: r.id, name: r.first_name || r.username || 'Kin',
      name_color: r.name_color, rank_rating: r.rank_rating,
      wins: r.rank_wins, games: r.rank_games,
      tier: tier ? { title: tier.title, emoji: tier.emoji, color_hex: tier.color_hex } : null,
      me: Number(r.id) === Number(u.id),
    });
  }
  return {
    top: withTier,
    me: {
      rank: (higher?.n || 0) + 1,
      total: total?.n || withTier.length,
      rank_rating: me.rank_rating || 1000,
      wins: me.rank_wins || 0,
      games: me.rank_games || 0,
    },
  };
}));

// Game defs
router.get('/games', rateLimit('games', 60), wrap(async () => {
  const rows = (await q('SELECT * FROM game_defs WHERE active=true ORDER BY sort_order')).rows;
  return { games: rows };
}));

// Help
router.get('/help', rateLimit('help', 60), wrap(async () => {
  const articles = await readLive('help.json');
  return articles || [];
}));

// File versions (for admin UI)
router.get('/versions/:file', rateLimit('versions', 60), wrap(async (req) => {
  return await listVersions(req.params.file);
}));