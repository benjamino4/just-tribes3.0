// ---------------------------------------------------------------------------
// REST API for TRIBES. Batch 1 adds war-revamp endpoints (fronts, actions,
// cry, stance, defender, chronicle, momentum). All additive.
// ---------------------------------------------------------------------------
import express from 'express';
import { q } from './db.js';
import { resolveUser } from './auth.js';
import {
  CHALLENGES, pickChallenge, maybeResolve, getTribeMetric,
  createFronts, getFronts, recordAction, momentumFor, activeLegendary,
  scheduleLegendary, recordDefenderAction, currentSeason, tribeScore
} from './war.js';
import { STAR_ITEMS, createStarInvoice, handleWebhook } from './stars.js';
import { TON_ITEMS, makeIntent, verifyPayment, linkWallet, tonConfigured, receiveAddress } from './ton.js';
import { CFG, PALETTES, BANNERS, parseJSON, cfgJSON } from './config.js';
import { isAdmin } from './admin.js';
import { listTrials, trialAvailable, completeTrial } from './trials.js';
import * as Kiva from './kiva.js';

export const router = express.Router();

const buckets = new Map();
function rateLimit(key, perMin){
  return (req,res,next)=>{
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
setInterval(()=>{ const now=Date.now(); for(const [k,b] of buckets) if(now>b.resetAt) buckets.delete(k); }, 60000).unref();

const ROLE_TIERS = [[20000,'Head'],[8000,'Elder'],[2000,'Hunter'],[500,'Kin'],[0,'Toddler']];
function roleFor(l){ for (const [t,r] of ROLE_TIERS) if (l>=t) return r; return 'Toddler'; }

router.use(async (req,res,next)=>{
  try{
    const r = await resolveUser(req);
    if (!r) return res.status(401).json({ error:'unauthorized', hint:'Open inside Telegram.' });
    if (r.error === 'no_username') return res.status(401).json({
      error:'no_username', hint:'Set a Telegram username to enter the tribes.', deepLink:'tg://settings',
    });
    const u = r.user;
    if (u.banned) return res.status(403).json({ error:'banned', reason: u.ban_reason || 'You were banished.' });
    if (Number(CFG.maintenance) && req.method === 'POST')
      return res.status(503).json({ error:'maintenance' });
    req.user = u; next();
  }catch(e){ next(e); }
});

async function tribeOf(u){
  if (!u.tribe_id) return null;
  return (await q('SELECT * FROM tribes WHERE id=$1', [u.tribe_id])).rows[0] || null;
}
async function refreshUserRole(u){
  const t = await tribeOf(u);
  let role = roleFor(Number(u.loyalty));
  if (t && Number(t.created_by) === Number(u.id)) role = 'Chief';
  if (role !== u.role){ await q('UPDATE users SET role=$1 WHERE id=$2',[role,u.id]); u.role = role; }
  return role;
}
async function addLoyalty(u, n){
  await q('UPDATE users SET loyalty = loyalty + $1 WHERE id=$2', [n, u.id]);
  if (u.tribe_id) await q('UPDATE tribes SET loyalty_total = loyalty_total + $1 WHERE id=$2', [n, u.tribe_id]);
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

// ================= STATE =================
router.get('/state', rateLimit('state', 120), async (req,res,next)=>{ try{
  const u = req.user; await refreshUserRole(u);
  const fresh = (await q('SELECT * FROM users WHERE id=$1', [u.id])).rows[0];
  const tribe = await tribeOf(fresh);

  const now = Date.now();
  const readyAt = fresh.ash_ready_at ? new Date(fresh.ash_ready_at).getTime() : now;
  const elapsed = Math.max(0, now - (readyAt - CFG.ashMinutes*60000));
  let ashPending = fresh.ash_ready_at
    ? Math.min(CFG.ashCap, Math.floor(elapsed/(CFG.ashMinutes*60000)))
    : 0;

  const lb = (await q(
    `SELECT id,name,hue,banner,palette,loyalty_total,members,wins,losses,treasury,level
       FROM tribes ORDER BY loyalty_total DESC LIMIT 20`
  )).rows;

  const trials = await listTrials(false);
  const state = fresh.trials_state || {};
  const nowMs = Date.now();
  const trialsView = trials.map(t => {
    const av = trialAvailable(t, state, nowMs);
    return { ...t, available: av.ok, reason: av.reason || null, nextIn: av.nextIn || 0 };
  });

  const bonfire = await activeBonfire();
  const season = await currentSeason();

  res.json({
    user: fresh,
    tribe,
    ashPending, ashUnit: CFG.ashUnit,
    isAdmin: isAdmin(fresh.id),
    config: {
      ashMinutes: CFG.ashMinutes, ashCap: CFG.ashCap, foundEmber: CFG.foundEmber,
      maintenance: Number(CFG.maintenance)?1:0,
      allowWar: Number(CFG.allowWar)?1:0,
      allowStore: Number(CFG.allowStore)?1:0,
      palette: PALETTES, banners: BANNERS,
      levelTable: levelTable(),
      starterBundlePrice: Number(CFG.starter_bundle_price_stars)||150,
      war_front_count: Number(CFG.war_front_count)||3,
      war_front_names: cfgJSON('war_front_names', ['North','Center','South']),
      war_stances: cfgJSON('war_stances', []),
      war_cries: cfgJSON('war_cries', []),
      season_length_weeks: Number(CFG.season_length_weeks)||6,
    },
    leaderboard: lb,
    challenges: CHALLENGES.map(c=>({id:c.id,name:c.name,glyph:c.glyph,desc:c.desc,days:c.days,stake:c.stake})),
    payments: { starItems: STAR_ITEMS, tonItems: TON_ITEMS, tonEnabled: tonConfigured(), tonAddress: receiveAddress() },
    trials: trialsView,
    bonfire,
    season: season ? { n: season.n, ends_at: season.ends_at } : null,
  });
}catch(e){ next(e); }});

// ================= TRIALS =================
router.get('/trials', rateLimit('trials', 60), async (req,res,next)=>{ try{
  res.json({ trials: await listTrials(true) });
}catch(e){ next(e); }});

router.post('/trials/:slug', rateLimit('trial', 30), async (req,res,next)=>{ try{
  const slug = String(req.params.slug || '').slice(0,32);
  const t = (await q('SELECT * FROM trials WHERE slug=$1 AND active=true', [slug])).rows[0];
  if (!t) return res.status(404).json({ error:'no such trial' });
  if (t.kind === 'rewarded_ad') return res.json({ ok:false, reason:'ad_not_configured' });
  const u = req.user;
  const av = trialAvailable(t, u.trials_state || {});
  if (!av.ok) return res.json({ ok:false, reason: av.reason, nextIn: av.nextIn || 0 });

  // ---- Sift the Ash: verify the pick server-side ----
  // The reward pile position is derived from a daily seed per user.
  // The client sends `pick` (0-4). We compute the correct index and
  // only grant if they match. This prevents spoofing the choice.
  if (t.minigame === 'sift'){
    const pick = Math.max(0, Math.min(4, Number(req.body?.pick)));
    const seedStr = `${u.id}:${new Date().toISOString().slice(0,10)}`;
    // Simple deterministic hash → 0..4
    let h = 5381;
    for (let i = 0; i < seedStr.length; i++) h = ((h * 33) ^ seedStr.charCodeAt(i)) >>> 0;
    const correct = h % 5;
    if (pick !== correct){
      // Cooldown still applies — the miss counts.
      await completeTrial(u, t);
      if (u.tribe_id) await q('UPDATE tribes SET quests_total = quests_total + 1 WHERE id=$1', [u.tribe_id]);
      return res.json({ ok:true, hit:false, correct, reward_ember:0, reward_loyalty:0 });
    }
    const reward = await completeTrial(u, t);
    if (u.tribe_id) await q('UPDATE tribes SET quests_total = quests_total + 1 WHERE id=$1', [u.tribe_id]);
    return res.json({ ok:true, hit:true, correct, reward_ember: reward.reward_ember, reward_loyalty: reward.reward_loyalty });
  }

  const reward = await completeTrial(u, t);
  if (u.tribe_id) await q('UPDATE tribes SET quests_total = quests_total + 1 WHERE id=$1', [u.tribe_id]);
  res.json({ ok:true, reward_ember: reward.reward_ember, reward_loyalty: reward.reward_loyalty });
}catch(e){ next(e); }});
// ================= CHECKIN / ASH / SHARE =================
router.post('/checkin', rateLimit('checkin', 10), async (req,res,next)=>{ try{
  const u = req.user;
  const last = u.last_checkin ? new Date(u.last_checkin).getTime() : 0;
  const since = Date.now() - last;
  if (since < 20*3600*1000) return res.json({ ok:false, reason:'already', nextIn: 20*3600*1000 - since });
  const streak = since < 44*3600*1000 ? Number(u.streak)+1 : 1;
  let reward = CFG.checkin_base + Math.min(CFG.checkin_streakMax, streak*CFG.checkin_streakStep);
  const bf = await activeBonfire();
  if (bf && bf.metric === 'checkin') reward = Math.floor(reward * Number(bf.multiplier));
  await q('UPDATE users SET ember=ember+$1, streak=$2, last_checkin=now() WHERE id=$3', [reward, streak, u.id]);
  if (u.tribe_id) await q('UPDATE tribes SET checkins_total=checkins_total+1 WHERE id=$1', [u.tribe_id]);
  await addLoyalty(u, CFG.loy_checkin);
  res.json({ ok:true, reward, streak });
}catch(e){ next(e); }});

router.post('/ash/collect', rateLimit('ash', 30), async (req,res,next)=>{ try{
  const u = req.user;
  const now = Date.now();
  const readyAt = u.ash_ready_at ? new Date(u.ash_ready_at).getTime() : now;
  const elapsed = u.ash_ready_at ? Math.max(0, now - (readyAt - CFG.ashMinutes*60000)) : 0;
  let units = u.ash_ready_at ? Math.min(CFG.ashCap, Math.floor(elapsed/(CFG.ashMinutes*60000))) : 0;
  const bf = await activeBonfire();
  if (bf && bf.metric === 'ash') units = Math.floor(units * Number(bf.multiplier));
  if (units < 1) return res.json({ ok:false, reason:'not_ready' });
  const gain = units * CFG.ashUnit;
  await q(`UPDATE users SET ember=ember+$1, ash_ready_at=now(), ash_count=ash_count+$2 WHERE id=$3`, [gain, units, u.id]);
  if (u.tribe_id) await q('UPDATE tribes SET ash_total=ash_total+$1 WHERE id=$2', [units, u.tribe_id]);
  await addLoyalty(u, CFG.loy_ash);
  res.json({ ok:true, gain, units });
}catch(e){ next(e); }});

router.post('/share', rateLimit('share', 10), async (req,res,next)=>{ try{
  const u = req.user;
  if (u.tribe_id) await q('UPDATE tribes SET shares_total=shares_total+1 WHERE id=$1', [u.tribe_id]);
  await addLoyalty(u, CFG.loy_share);
  res.json({ ok:true });
}catch(e){ next(e); }});

// ================= GIFT CODES =================
router.post('/redeem', rateLimit('redeem', 10), async (req,res,next)=>{ try{
  const u = req.user;
  const code = String(req.body?.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'');
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
}catch(e){ next(e); }});

// ================= TRIBES =================
router.get('/tribes', rateLimit('tribes', 60), async (req,res,next)=>{ try{
  const r = await q(
    `SELECT id,name,hue,motto,crest,banner,palette,members,loyalty_total,treasury,wins,losses,level
       FROM tribes ORDER BY loyalty_total DESC, members DESC LIMIT 60`
  );
  res.json({ tribes: r.rows });
}catch(e){ next(e); }});

router.get('/tribe/names', rateLimit('names', 60), async (req,res,next)=>{ try{
  const r = await q(`SELECT id, name FROM tribe_names WHERE claimed_by_tribe_id IS NULL ORDER BY name`);
  res.json({ names: r.rows });
}catch(e){ next(e); }});

router.post('/tribe/create', rateLimit('create', 5), async (req,res,next)=>{ try{
  const u = req.user;
  if (u.tribe_id) return res.status(400).json({ error:'already in a tribe' });
  const nameId = Number(req.body?.nameId);
  if (!nameId) return res.status(400).json({ error:'pick a name' });
  const palette = String(req.body?.palette || 'ember').slice(0,16);
  const banner  = String(req.body?.banner  || 'sun').slice(0,16);
  if (!PALETTES[palette]) return res.status(400).json({ error:'bad palette' });
  if (!BANNERS.includes(banner)) return res.status(400).json({ error:'bad banner' });
  if (Number(u.ember) < CFG.foundEmber) return res.status(400).json({ error:'not enough Ember', need: CFG.foundEmber });

  const nameRow = (await q(
    `SELECT id, name FROM tribe_names WHERE id=$1 AND claimed_by_tribe_id IS NULL FOR UPDATE`,
    [nameId]
  )).rows[0];
  if (!nameRow) return res.status(409).json({ error:'that name has been claimed' });

  const created = (await q(
    `INSERT INTO tribes (name, name_id, hue, motto, crest, banner, palette, level, created_by, members, members_total, treasury)
     VALUES ($1,$2,0,'',$3,$4,$5,1,$6,1,1,0) RETURNING *`,
    [nameRow.name, nameRow.id, 'totem', banner, palette, u.id]
  )).rows[0];

  await q('UPDATE tribe_names SET claimed_by_tribe_id=$1 WHERE id=$2', [created.id, nameRow.id]);
  await q('UPDATE users SET tribe_id=$1, ember=ember-$2, role=$3 WHERE id=$4', [created.id, CFG.foundEmber, 'Chief', u.id]);
  await Kiva.postMessage(created.id, u.id, `The fire is lit. ${nameRow.name} rises.`, 'system');
  res.json({ ok:true, tribe: created });
}catch(e){ next(e); }});

router.post('/tribe/join', rateLimit('join', 20), async (req,res,next)=>{ try{
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
  res.json({ ok:true, tribe: t });
}catch(e){ next(e); }});

router.post('/tribe/leave', rateLimit('leave', 10), async (req,res,next)=>{ try{
  const u = req.user;
  if (!u.tribe_id) return res.json({ ok:true });
  await q('UPDATE tribes SET members=GREATEST(0,members-1) WHERE id=$1', [u.tribe_id]);
  await q('UPDATE users SET tribe_id=NULL WHERE id=$1', [u.id]);
  res.json({ ok:true });
}catch(e){ next(e); }});

router.post('/tribe/donate', rateLimit('donate', 30), async (req,res,next)=>{ try{
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'join a tribe first' });
  const amt = Math.floor(Number(req.body?.amount)||0);
  if (amt < 1) return res.status(400).json({ error:'bad amount' });
  if (Number(u.ember) < amt) return res.status(400).json({ error:'not enough Ember' });
  await q('UPDATE users SET ember=ember-$1 WHERE id=$2', [amt, u.id]);
  await q('UPDATE tribes SET treasury=treasury+$1, donated_total=donated_total+$1 WHERE id=$2', [amt, u.tribe_id]);
  await addLoyalty(u, Math.floor(amt / CFG.loy_donateDiv));
  res.json({ ok:true, donated: amt });
}catch(e){ next(e); }});

router.post('/tribe/upgrade', rateLimit('upgrade', 6), async (req,res,next)=>{ try{
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  if (!['Chief','Head','Elder'].includes(u.role)) return res.status(403).json({ error:'only Elders+' });
  const t = (await q('SELECT * FROM tribes WHERE id=$1', [u.tribe_id])).rows[0];
  if (!t) return res.status(404).json({ error:'no tribe' });
  const { caps, costs, names } = levelTable();
  const cur = Number(t.level)||1;
  if (cur >= costs.length) return res.status(400).json({ error:'already at the highest level' });
  const nextCost = Number(costs[cur]);
  if (Number(t.treasury) < nextCost) return res.status(400).json({ error:'the Great Pyre is too shallow', need: nextCost });
  await q('UPDATE tribes SET treasury=treasury-$1, level=level+1 WHERE id=$2', [nextCost, t.id]);
  const newLevel = cur + 1;
  const newName = names[newLevel-1] || ('Level '+newLevel);
  await Kiva.postMessage(t.id, u.id, `⚔️ ${t.name} rises to ${newName}!`, 'level');
  res.json({ ok:true, level: newLevel, name: newName, cap: caps[newLevel-1] });
}catch(e){ next(e); }});

// ================= KIVA =================
router.get('/kiva', rateLimit('kiva', 240), async (req,res,next)=>{ try{
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  const since = Number(req.query.since)||0;
  const rows = since ? await Kiva.listMessages(u.tribe_id, since, 50) : await Kiva.latestMessages(u.tribe_id, 50);
  res.json({ messages: rows, tribe_id: u.tribe_id });
}catch(e){ next(e); }});

router.post('/kiva', rateLimit('kiva', 40), async (req,res,next)=>{ try{
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  const body = String(req.body?.body || '').slice(0,280);
  if (!body.trim()) return res.status(400).json({ error:'empty' });
  const msg = await Kiva.postMessage(u.tribe_id, u.id, body, 'chat');
  res.json({ ok:true, message: msg });
}catch(e){ next(e); }});

router.post('/kiva/pin', rateLimit('kiva', 20), async (req,res,next)=>{ try{
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  if (!['Chief','Head','Elder'].includes(u.role)) return res.status(403).json({ error:'only Elders+ can pin' });
  const id = Number(req.body?.id);
  const pinned = !!req.body?.pinned;
  const row = await Kiva.setPin(u.tribe_id, id, pinned);
  res.json({ ok:true, pinned: row.pinned });
}catch(e){ next(e); }});

router.post('/kiva/read', rateLimit('kiva', 240), async (req,res,next)=>{ try{
  const u = req.user;
  if (!u.tribe_id) return res.json({ ok:true });
  await Kiva.markRead(u.tribe_id, u.id, Number(req.body?.lastSeenId)||0);
  res.json({ ok:true });
}catch(e){ next(e); }});

export function kivaSse(req,res){
  const tribeId = Number(req.query.tribeId);
  if (!tribeId) return res.status(400).end();
  res.writeHead(200, {
    'Content-Type':'text/event-stream',
    'Cache-Control':'no-cache, no-transform',
    'Connection':'keep-alive',
    'X-Accel-Buffering':'no',
  });
  res.write('retry: 5000\n\n');
  Kiva.subscribe(tribeId, res);
}

// ================= WAR =================
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
  return { ...war, attacker:ta, defender:td,
    challenge:{ id:ch.id, name:ch.name, glyph:ch.glyph, desc:ch.desc },
    fronts, momentum, legendary,
    mine: Number(myTribe) === Number(war.attacker_id) ? 'attacker' : 'defender' };
}

router.get('/war', rateLimit('war', 60), async (req,res,next)=>{ try{
  const u = req.user; if (!u.tribe_id) return res.json({ war:null, reason:'no_tribe' });
  let war = await currentWar(u.tribe_id);
  if (war && war.status === 'active') war = await maybeResolve(war);
  res.json({ war: war ? await decorate(war, u.tribe_id) : null });
}catch(e){ next(e); }});

router.post('/war/declare', rateLimit('war', 6), async (req,res,next)=>{ try{
  const u = req.user; if (!u.tribe_id) return res.status(400).json({ error:'join a tribe first' });
  if (!Number(CFG.allowWar)) return res.status(400).json({ error:'war has been sealed' });
  if (!['Chief','Head','Elder'].includes(u.role)) return res.status(403).json({ error:'only Elders+' });
  const active = await q(`SELECT 1 FROM wars WHERE status='active' AND (attacker_id=$1 OR defender_id=$1)`, [u.tribe_id]);
  if (active.rowCount) return res.status(400).json({ error:'your tribe is already at war' });

  const stanceId = String(req.body?.stance || 'skirmish').slice(0,32);
  const stances = cfgJSON('war_stances', []);
  const stance = stances.find(s => s.id === stanceId) || stances[0] || { durMult: 1 };

  const foe = (await q(
    `SELECT id FROM tribes t WHERE t.id<>$1
      AND NOT EXISTS (SELECT 1 FROM wars w WHERE w.status='active' AND (w.attacker_id=t.id OR w.defender_id=t.id))
      ORDER BY random() LIMIT 1`, [u.tribe_id]
  )).rows[0];
  if (!foe) return res.status(400).json({ error:'no rival tribe is available' });

  const c = pickChallenge();
  const capHours = Number(CFG.war_cap_hours) || 72;
  const durHours = Math.round(capHours * Number(stance.durMult || 1));
  const stake = Math.max(Number(CFG.war_stake_min), Math.min(Number(CFG.war_stake_max), c.stake));
  const reward = Math.max(0, Math.round(c.reward * (Number(CFG.warRewardMult)||1)));
  const aStart = await getTribeMetric(u.tribe_id, c.metric);
  const dStart = await getTribeMetric(foe.id, c.metric);

  const war = (await q(
    `INSERT INTO wars (attacker_id,defender_id,challenge_id,goal,metric,stake_pct,reward_ember,
                       attacker_start,defender_start,end_at,stance,front_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + ($10 || ' hours')::interval, $11, $12)
     RETURNING *`,
    [u.tribe_id, foe.id, c.id, c.goal, c.metric, stake, reward, aStart, dStart,
     String(durHours), stanceId, Number(CFG.war_front_count)||3]
  )).rows[0];

  await createFronts(war.id);
  await scheduleLegendary(war, null);

  const foeName = (await q('SELECT name FROM tribes WHERE id=$1', [foe.id])).rows[0]?.name || 'a rival';
  await Kiva.postMessage(u.tribe_id, u.id, `⚔️ War declared against ${foeName} · stance: ${stance.name||stanceId}.`, 'war');
  await Kiva.postMessage(foe.id, u.id, `⚔️ ${(await q('SELECT name FROM tribes WHERE id=$1',[u.tribe_id])).rows[0]?.name||'A tribe'} declared war. Stance: ${stance.name||stanceId}.`, 'war');

  res.json({ ok:true, war: await decorate(war, u.tribe_id) });
}catch(e){ next(e); }});

// ---- NEW: War actions ----
router.post('/war/action', rateLimit('war_action', 60), async (req,res,next)=>{ try{
  const u = req.user; if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  const war = await currentWar(u.tribe_id);
  if (!war || war.status !== 'active') return res.status(400).json({ error:'no active war' });

  const side = Number(war.attacker_id) === Number(u.tribe_id) ? 'attacker' : 'defender';
  const frontIdx = Math.max(0, Math.min((Number(war.front_count)||3)-1, Number(req.body?.front)||0));
  const kind = String(req.body?.kind || 'rally').slice(0,16);
  const tribe = await tribeOf(u);

  const result = await recordAction(war, u, tribe, side, frontIdx, kind);
  res.json(result);
}catch(e){ res.status(400).json({ error: e.message }); }});

// ---- NEW: War Cry ----
router.post('/war/cry', rateLimit('war_cry', 6), async (req,res,next)=>{ try{
  const u = req.user; if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  if (!['Chief','Head','Elder'].includes(u.role)) return res.status(403).json({ error:'only Elders+' });
  const war = await currentWar(u.tribe_id);
  if (!war || war.status !== 'active') return res.status(400).json({ error:'no active war' });
  if (war.cry_used) return res.status(400).json({ error:'a cry has already been raised this war' });

  const cryId = String(req.body?.cry || '').slice(0,32);
  const cries = cfgJSON('war_cries', []);
  const cry = cries.find(c => c.id === cryId);
  if (!cry) return res.status(400).json({ error:'unknown cry' });

  const tribe = await tribeOf(u);
  if (Number(tribe.treasury) < Number(cry.cost)) return res.status(400).json({ error:'the Great Pyre is too shallow' });
  await q('UPDATE tribes SET treasury = treasury - $1 WHERE id=$2', [Number(cry.cost), tribe.id]);
  await q('UPDATE wars SET cry_used=$1 WHERE id=$2', [cryId, war.id]);

  if (cry.effect === 'instant_score'){
    const col = Number(war.attacker_id) === Number(tribe.id) ? 'attacker_score' : 'defender_score';
    await q(`UPDATE war_fronts SET ${col} = ${col} + $1 WHERE war_id=$2 AND idx=0`,
      [Number(cry.magnitude)||0, war.id]);
  }
  // 'tribe_buff' and 'double_next' are consumed by the UI/engine on next actions.

  await Kiva.postMessage(tribe.id, u.id, `📣 ${tribe.name} raised ${cry.name}!`, 'war');
  await Kiva.postMessage(Number(war.attacker_id) === Number(tribe.id) ? war.defender_id : war.attacker_id,
    u.id, `📣 ${tribe.name} raised ${cry.name}!`, 'war');

  res.json({ ok:true, cry });
}catch(e){ res.status(400).json({ error: e.message }); }});

// ---- NEW: Legendary (Star insurance) ----
router.post('/war/legendary/force', rateLimit('war_leg', 3), async (req,res,next)=>{ try{
  const u = req.user; if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  const war = await currentWar(u.tribe_id);
  if (!war || war.status !== 'active') return res.status(400).json({ error:'no active war' });
  const existing = await activeLegendary(war.id);
  if (existing) return res.status(400).json({ error:'a legendary is already active' });
  const created = await scheduleLegendary(war, u.id);
  if (!created) return res.status(400).json({ error:'could not schedule' });
  res.json({ ok:true, legendary: created });
}catch(e){ res.status(400).json({ error: e.message }); }});

// ---- NEW: Defender actions ----
router.post('/war/defend', rateLimit('war_def', 20), async (req,res,next)=>{ try{
  const u = req.user; if (!u.tribe_id) return res.status(400).json({ error:'no tribe' });
  const war = await currentWar(u.tribe_id);
  if (!war || war.status !== 'active') return res.status(400).json({ error:'no active war' });
  if (Number(war.defender_id) !== Number(u.tribe_id)) return res.status(403).json({ error:'only defenders may use this' });
  const kind = String(req.body?.kind || '').slice(0,16);
  const frontIdx = req.body?.front != null ? Number(req.body.front) : null;
  const tribe = await tribeOf(u);
  const result = await recordDefenderAction(war, u, tribe, kind, frontIdx);
  res.json(result);
}catch(e){ res.status(400).json({ error: e.message }); }});

// ---- NEW: Chronicle ----
router.get('/war/chronicle', rateLimit('war_chr', 60), async (req,res,next)=>{ try{
  const u = req.user; if (!u.tribe_id) return res.json({ chronicles: [] });
  const other = req.query.vs ? Number(req.query.vs) : null;
  const rows = other
    ? (await q(
        `SELECT * FROM war_chronicles
          WHERE (attacker_id=$1 AND defender_id=$2) OR (attacker_id=$2 AND defender_id=$1)
          ORDER BY created_at DESC LIMIT 20`,
        [u.tribe_id, other]
      )).rows
    : (await q(
        `SELECT * FROM war_chronicles
          WHERE attacker_id=$1 OR defender_id=$1
          ORDER BY created_at DESC LIMIT 20`,
        [u.tribe_id]
      )).rows;
  res.json({ chronicles: rows });
}catch(e){ next(e); }});

// ---- NEW: Live war leaderboard ----
router.get('/war/leaderboard', rateLimit('war_lb', 60), async (req,res,next)=>{ try{
  const u = req.user; if (!u.tribe_id) return res.json({ rows: [] });
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
}catch(e){ next(e); }});

// ================= BONFIRE =================
router.get('/bonfire', rateLimit('bf', 60), async (req,res,next)=>{ try{
  res.json({ bonfire: await activeBonfire() });
}catch(e){ next(e); }});

// ================= COSMETICS / STARTER =================
router.get('/cosmetics', rateLimit('cos', 60), async (req,res,next)=>{ try{
  const rows = (await q('SELECT cosmetic_id, kind, value FROM cosmetic_purchases WHERE user_id=$1', [req.user.id])).rows;
  res.json({ owned: rows });
}catch(e){ next(e); }});

router.post('/starter-bundle', rateLimit('starter', 3), async (req,res,next)=>{ try{
  if (!Number(CFG.allowStore)) return res.status(400).json({ error:'store closed' });
  const link = await createStarInvoice(req.user.id, 'starter_bundle');
  res.json({ ok:true, link });
}catch(e){ res.status(400).json({ error:e.message }); }});

// ================= PAYMENTS =================
router.post('/stars/invoice', rateLimit('invoice', 20), async (req,res,next)=>{ try{
  if (!Number(CFG.allowStore)) return res.status(400).json({ error:'the trading post is closed' });
  const link = await createStarInvoice(req.user.id, String(req.body?.itemId || ''));
  res.json({ ok:true, link });
}catch(e){ res.status(400).json({ error:e.message }); }});

router.post('/ton/intent', rateLimit('intent', 20), async (req,res,next)=>{ try{
  if (!Number(CFG.allowStore)) return res.status(400).json({ error:'the trading post is closed' });
  res.json({ ok:true, intent: await makeIntent(req.user.id, String(req.body?.itemId || '')) });
}catch(e){ res.status(400).json({ error:e.message }); }});

router.post('/ton/verify', rateLimit('verify', 40), async (req,res,next)=>{ try{
  res.json(await verifyPayment(req.user.id, String(req.body?.nonce || '')));
}catch(e){ res.status(400).json({ error:e.message }); }});

router.post('/ton/link', rateLimit('link', 20), async (req,res,next)=>{ try{
  const addr = String(req.body?.address || '').slice(0, 80);
  if (!addr) return res.status(400).json({ error:'no address' });
  await linkWallet(req.user.id, addr);
  res.json({ ok:true });
}catch(e){ next(e); }});

export { handleWebhook };