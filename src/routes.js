// ---------------------------------------------------------------------------
// REST API for TRIBES. All /api routes (except the Telegram webhook) require a
// valid Telegram initData signature (or a guest id when ALLOW_GUEST=1).
// ---------------------------------------------------------------------------
import express from 'express';
import { q } from './db.js';
import { resolveUser } from './auth.js';
import { CHALLENGES, pickChallenge, maybeResolve, refreshWar, getTribeMetric } from './war.js';
import { STAR_ITEMS, createStarInvoice, handleWebhook } from './stars.js';
import { TON_ITEMS, makeIntent, verifyPayment, linkWallet, tonConfigured, receiveAddress } from './ton.js';
import { CFG } from './config.js';

export const router = express.Router();

// ---- economy: role tiers (rewards/costs come from CFG, tunable at runtime) ----
const ROLE_TIERS = [[20000,'Head'],[8000,'Elder'],[2000,'Hunter'],[500,'Kin'],[0,'Toddler']];
function roleFor(loyalty){ for (const [t,r] of ROLE_TIERS) if (loyalty>=t) return r; return 'Toddler'; }

// ---- auth guard ----
router.use(async (req,res,next)=>{
  try{
    const u = await resolveUser(req);
    if (!u) return res.status(401).json({ error:'unauthorized', hint:'Open inside Telegram, or enable ALLOW_GUEST for browser preview.' });
    if (u.banned) return res.status(403).json({ error:'banned', reason: u.ban_reason || 'You were banished from the tribes.' });
    if (Number(CFG.maintenance) && req.method === 'POST')
      return res.status(503).json({ error:'maintenance', hint:'The elders are tending the fire \u2014 actions are paused. Try again soon.' });
    req.user = u; next();
  }catch(e){ next(e); }
});

async function tribeOf(u){
  if (!u.tribe_id) return null;
  const r = await q('SELECT * FROM tribes WHERE id=$1',[u.tribe_id]);
  return r.rows[0] || null;
}
async function refreshUserRole(u){
  const t = await tribeOf(u);
  let role = roleFor(Number(u.loyalty));
  if (t && Number(t.created_by) === Number(u.id)) role = 'Chief';
  if (role !== u.role){ await q('UPDATE users SET role=$1 WHERE id=$2',[role,u.id]); u.role=role; }
  return role;
}
async function addLoyalty(u, n){
  await q('UPDATE users SET loyalty = loyalty + $1 WHERE id=$2',[n,u.id]);
  if (u.tribe_id) await q('UPDATE tribes SET loyalty_total = loyalty_total + $1 WHERE id=$2',[n,u.tribe_id]);
  u.loyalty = Number(u.loyalty) + n;
}

// ================= STATE =================
router.get('/state', async (req,res,next)=>{ try{
  const u = req.user; await refreshUserRole(u);
  const fresh = (await q('SELECT * FROM users WHERE id=$1',[u.id])).rows[0];
  const tribe = await tribeOf(fresh);
  // idle ash preview
  const now = Date.now();
  const readyAt = fresh.ash_ready_at ? new Date(fresh.ash_ready_at).getTime() : now;
  const elapsed = Math.max(0, now - (readyAt - CFG.ashMinutes*60000));
  let ashPending = Math.min(CFG.ashCap, Math.floor(elapsed/(CFG.ashMinutes*60000)));
  if (!fresh.ash_ready_at) ashPending = 0;
  const lb = (await q('SELECT id,name,hue,loyalty_total,members,wins,losses,treasury FROM tribes ORDER BY loyalty_total DESC LIMIT 20')).rows;
  res.json({
    user: fresh, tribe, ashPending, ashUnit: CFG.ashUnit,
    config: { ashMinutes:CFG.ashMinutes, ashCap:CFG.ashCap, foundEmber:CFG.foundEmber, foundMembers:1,
              maintenance:Number(CFG.maintenance)?1:0, allowWar:Number(CFG.allowWar)?1:0, allowStore:Number(CFG.allowStore)?1:0 },
    leaderboard: lb, challenges: CHALLENGES.map(c=>({id:c.id,name:c.name,glyph:c.glyph,desc:c.desc,days:c.days,stake:c.stake})),
    payments: { starItems: STAR_ITEMS, tonItems: TON_ITEMS, tonEnabled: tonConfigured(), tonAddress: receiveAddress() }
  });
}catch(e){ next(e); }});

// ================= DAILY / IDLE =================
router.post('/checkin', async (req,res,next)=>{ try{
  const u = req.user;
  const last = u.last_checkin ? new Date(u.last_checkin).getTime() : 0;
  const since = Date.now() - last;
  if (since < 20*3600*1000) return res.json({ ok:false, reason:'already', nextIn: 20*3600*1000 - since });
  const streak = since < 44*3600*1000 ? Number(u.streak)+1 : 1;
  const reward = CFG.checkin_base + Math.min(CFG.checkin_streakMax, streak*CFG.checkin_streakStep);
  await q('UPDATE users SET ember=ember+$1, streak=$2, last_checkin=now() WHERE id=$3',[reward,streak,u.id]);
  if (u.tribe_id) await q('UPDATE tribes SET checkins_total=checkins_total+1 WHERE id=$1',[u.tribe_id]);
  await addLoyalty(u, CFG.loy_checkin);
  res.json({ ok:true, reward, streak });
}catch(e){ next(e); }});

router.post('/ash/collect', async (req,res,next)=>{ try{
  const u = req.user;
  const now = Date.now();
  const readyAt = u.ash_ready_at ? new Date(u.ash_ready_at).getTime() : now;
  const elapsed = u.ash_ready_at ? Math.max(0, now - (readyAt - CFG.ashMinutes*60000)) : 0;
  const units = Math.min(CFG.ashCap, Math.floor(elapsed/(CFG.ashMinutes*60000)));
  if (units < 1){ await q('UPDATE users SET ash_ready_at = now() + interval \'30 minutes\' WHERE id=$1 AND ash_ready_at IS NULL',[u.id]);
    return res.json({ ok:false, reason:'not_ready' }); }
  const gain = units*CFG.ashUnit;
  await q('UPDATE users SET ember=ember+$1, ash_ready_at = now() + interval \'30 minutes\', ash_count=ash_count+$2 WHERE id=$3',[gain,units,u.id]);
  if (u.tribe_id) await q('UPDATE tribes SET ash_total=ash_total+$1 WHERE id=$2',[units,u.tribe_id]);
  await addLoyalty(u, CFG.loy_ash);
  res.json({ ok:true, gain, units });
}catch(e){ next(e); }});

router.post('/quest/:id', async (req,res,next)=>{ try{
  const u = req.user; const id = req.params.id;
  const reward = CFG['quest_'+id]; if (reward==null) return res.status(400).json({error:'bad quest'});
  await q('UPDATE users SET ember=ember+$1 WHERE id=$2',[reward,u.id]);
  if (u.tribe_id) await q('UPDATE tribes SET quests_total=quests_total+1 WHERE id=$1',[u.tribe_id]);
  await addLoyalty(u, CFG.loy_quest);
  res.json({ ok:true, reward });
}catch(e){ next(e); }});

router.post('/share', async (req,res,next)=>{ try{
  const u = req.user;
  if (u.tribe_id) await q('UPDATE tribes SET shares_total=shares_total+1 WHERE id=$1',[u.tribe_id]);
  await addLoyalty(u, CFG.loy_share);
  res.json({ ok:true });
}catch(e){ next(e); }});
// ================= TRIBES =================
router.get('/tribes', async (req,res,next)=>{ try{
  const r = await q('SELECT id,name,hue,motto,crest,members,loyalty_total,treasury,wins,losses FROM tribes ORDER BY loyalty_total DESC, members DESC LIMIT 60');
  res.json({ tribes:r.rows });
}catch(e){ next(e); }});

router.post('/tribe/create', async (req,res,next)=>{ try{
  const u = req.user;
  if (u.tribe_id) return res.status(400).json({error:'already in a tribe'});
  const name = String(req.body?.name||'').trim().slice(0,32);
  const hue = Number(req.body?.hue)||0, motto = String(req.body?.motto||'').slice(0,80), crest = String(req.body?.crest||'totem').slice(0,24);
  if (name.length < 3) return res.status(400).json({error:'name too short'});
  if (Number(u.ember) < CFG.foundEmber) return res.status(400).json({error:'not enough Ember', need:CFG.foundEmber});
  const dup = await q('SELECT 1 FROM tribes WHERE lower(name)=lower($1)',[name]);
  if (dup.rowCount) return res.status(400).json({error:'name taken'});
  const t = (await q(`INSERT INTO tribes(name,hue,motto,crest,created_by,members,members_total,treasury)
                      VALUES ($1,$2,$3,$4,$5,1,1,0) RETURNING *`,[name,hue,motto,crest,u.id])).rows[0];
  await q('UPDATE users SET tribe_id=$1, ember=ember-$2, role=$3 WHERE id=$4',[t.id,CFG.foundEmber,'Chief',u.id]);
  res.json({ ok:true, tribe:t });
}catch(e){ next(e); }});

router.post('/tribe/join', async (req,res,next)=>{ try{
  const u = req.user;
  if (u.tribe_id) return res.status(400).json({error:'already in a tribe'});
  const id = Number(req.body?.tribeId);
  const t = (await q('SELECT * FROM tribes WHERE id=$1',[id])).rows[0];
  if (!t) return res.status(404).json({error:'no such tribe'});
  await q('UPDATE tribes SET members=members+1, members_total=members_total+1 WHERE id=$1',[id]);
  await q('UPDATE users SET tribe_id=$1 WHERE id=$2',[id,u.id]);
  res.json({ ok:true, tribe:t });
}catch(e){ next(e); }});

router.post('/tribe/leave', async (req,res,next)=>{ try{
  const u = req.user;
  if (!u.tribe_id) return res.json({ ok:true });
  await q('UPDATE tribes SET members=GREATEST(0,members-1) WHERE id=$1',[u.tribe_id]);
  await q('UPDATE users SET tribe_id=NULL WHERE id=$1',[u.id]);
  res.json({ ok:true });
}catch(e){ next(e); }});

router.post('/tribe/donate', async (req,res,next)=>{ try{
  const u = req.user;
  if (!u.tribe_id) return res.status(400).json({error:'join a tribe first'});
  const amt = Math.floor(Number(req.body?.amount)||0);
  if (amt < 1) return res.status(400).json({error:'bad amount'});
  if (Number(u.ember) < amt) return res.status(400).json({error:'not enough Ember'});
  await q('UPDATE users SET ember=ember-$1 WHERE id=$2',[amt,u.id]);
  await q('UPDATE tribes SET treasury=treasury+$1, donated_total=donated_total+$1 WHERE id=$2',[amt,u.tribe_id]);
  await q(`INSERT INTO ledger(user_id,tribe_id,kind,detail,ember) VALUES ($1,$2,'donate','Stoked the Great Pyre',$3)`,[u.id,u.tribe_id,amt]);
  await addLoyalty(u, Math.floor(amt/CFG.loy_donateDiv));
  res.json({ ok:true, donated:amt });
}catch(e){ next(e); }});

// ================= TRIBE WAR =================
async function currentWar(tribeId){
  const r = await q(`SELECT * FROM wars WHERE (attacker_id=$1 OR defender_id=$1)
                     ORDER BY (status='active') DESC, start_at DESC LIMIT 1`,[tribeId]);
  return r.rows[0] || null;
}
async function decorate(war, myTribe){
  const ta = (await q('SELECT id,name,hue,crest FROM tribes WHERE id=$1',[war.attacker_id])).rows[0];
  const td = (await q('SELECT id,name,hue,crest FROM tribes WHERE id=$1',[war.defender_id])).rows[0];
  const ch = CHALLENGES.find(c=>c.id===war.challenge_id) || {};
  return { ...war, attacker:ta, defender:td, challenge:{ id:ch.id, name:ch.name, glyph:ch.glyph, desc:ch.desc },
           mine: Number(myTribe)===Number(war.attacker_id) ? 'attacker' : 'defender' };
}

router.get('/war', async (req,res,next)=>{ try{
  const u = req.user; if (!u.tribe_id) return res.json({ war:null, reason:'no_tribe' });
  let war = await currentWar(u.tribe_id);
  if (war && war.status==='active') war = await maybeResolve(war);
  res.json({ war: war ? await decorate(war, u.tribe_id) : null });
}catch(e){ next(e); }});

router.post('/war/declare', async (req,res,next)=>{ try{
  const u = req.user; if (!u.tribe_id) return res.status(400).json({error:'join a tribe first'});
  if (!Number(CFG.allowWar)) return res.status(400).json({error:'war has been sealed by the elders right now'});
  if (!['Chief','Head','Elder'].includes(u.role)) return res.status(403).json({error:'only Elders, Heads or the Chief may declare war'});
  const active = await q(`SELECT 1 FROM wars WHERE status='active' AND (attacker_id=$1 OR defender_id=$1)`,[u.tribe_id]);
  if (active.rowCount) return res.status(400).json({error:'your tribe is already at war'});
  // pick a random eligible opponent (not self, not already at war)
  const foe = (await q(`SELECT id FROM tribes t WHERE t.id<>$1
     AND NOT EXISTS (SELECT 1 FROM wars w WHERE w.status='active' AND (w.attacker_id=t.id OR w.defender_id=t.id))
     ORDER BY random() LIMIT 1`,[u.tribe_id])).rows[0];
  if (!foe) return res.status(400).json({error:'no rival tribe is available to challenge right now'});
  const c = pickChallenge();
  const stake = Math.max(1, Math.round(c.stake * (Number(CFG.warStakeMult)||1)));
  const reward = Math.max(0, Math.round(c.reward * (Number(CFG.warRewardMult)||1)));
  const aStart = await getTribeMetric(u.tribe_id, c.metric);
  const dStart = await getTribeMetric(foe.id, c.metric);
  const war = (await q(`INSERT INTO wars(attacker_id,defender_id,challenge_id,goal,metric,stake_pct,reward_ember,attacker_start,defender_start,end_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + ($10 || ' days')::interval) RETURNING *`,
     [u.tribe_id, foe.id, c.id, c.goal, c.metric, stake, reward, aStart, dStart, String(c.days)])).rows[0];
  res.json({ ok:true, war: await decorate(war, u.tribe_id) });
}catch(e){ next(e); }});

// ================= PAYMENTS =================
router.post('/stars/invoice', async (req,res,next)=>{ try{
  if (!Number(CFG.allowStore)) return res.status(400).json({ error:'the trading post is closed' });
  const link = await createStarInvoice(req.user.id, String(req.body?.itemId||''));
  res.json({ ok:true, link });
}catch(e){ res.status(400).json({ error:e.message }); }});

router.post('/ton/intent', async (req,res,next)=>{ try{
  if (!Number(CFG.allowStore)) return res.status(400).json({ error:'the trading post is closed' });
  res.json({ ok:true, intent: await makeIntent(req.user.id, String(req.body?.itemId||'')) });
}catch(e){ res.status(400).json({ error:e.message }); }});

router.post('/ton/verify', async (req,res,next)=>{ try{
  const r = await verifyPayment(req.user.id, String(req.body?.nonce||''));
  res.json(r);
}catch(e){ res.status(400).json({ error:e.message }); }});

router.post('/ton/link', async (req,res,next)=>{ try{
  const addr = String(req.body?.address||'').slice(0,80);
  if (!addr) return res.status(400).json({error:'no address'});
  await linkWallet(req.user.id, addr);
  res.json({ ok:true });
}catch(e){ next(e); }});

export { handleWebhook };
