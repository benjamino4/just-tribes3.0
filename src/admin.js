// ---------------------------------------------------------------------------
// TRIBES admin control plane. Two surfaces, one shared action library:
//   1) a SEPARATE Telegram admin bot (ADMIN_BOT_TOKEN) \u2014 chat commands,
//      locked to the Telegram user ids in ADMIN_IDS.
//   2) a web dashboard at /admin, guarded by ADMIN_TOKEN.
// Every mutating action is written to the `audit` table.
// ---------------------------------------------------------------------------
import express from 'express';
import { q } from './db.js';
import { CFG, DEFAULTS, setConfig, resetConfig } from './config.js';
import { CHALLENGES, pickChallenge, maybeResolve, getTribeMetric } from './war.js';

const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN || '';
const MAIN_BOT_TOKEN  = process.env.BOT_TOKEN || '';
const WEB_TOKEN       = process.env.ADMIN_TOKEN || '';
const ADMIN_IDS = new Set((process.env.ADMIN_IDS || '').split(',').map(s=>s.trim()).filter(Boolean));
const ROLES = ['Toddler','Kin','Hunter','Elder','Head','Chief'];

export function isAdmin(id){ return ADMIN_IDS.has(String(id)); }
export function adminBotConfigured(){ return !!ADMIN_BOT_TOKEN; }

async function botSend(token, chatId, text){
  if (!token || !chatId) return;
  try{ await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ chat_id:chatId, text, parse_mode:'HTML', disable_web_page_preview:true })
  }); }catch(e){ console.error('[admin] send', e.message); }
}
async function audit(adminId, action, detail){
  try{ await q(`INSERT INTO audit(admin_id,action,detail) VALUES ($1,$2,$3)`, [adminId||null, action, detail||'']); }catch(e){}
}
const n = v => Number(v)||0;
const fmt = v => (Number(v)||0).toLocaleString('en-US');

// ===================== CORE ACTION LIBRARY =====================
export async function stats(){
  const u = (await q(`SELECT count(*)::int n, coalesce(sum(ember),0)::bigint ember,
    coalesce(sum(stars),0)::bigint stars, count(*) filter (where banned)::int banned FROM users`)).rows[0];
  const t = (await q(`SELECT count(*)::int n, coalesce(sum(treasury),0)::bigint pyre,
    coalesce(sum(loyalty_total),0)::bigint loyalty FROM tribes`)).rows[0];
  const w = (await q(`SELECT count(*) filter (where status='active')::int active, count(*)::int total FROM wars`)).rows[0];
  const p = (await q(`SELECT count(*) filter (where kind='stars')::int starTx,
    coalesce(sum(amount) filter (where kind='stars'),0)::bigint stars,
    count(*) filter (where kind='ton' and status='paid')::int tonTx FROM payments`)).rows[0];
  return { users:u, tribes:t, wars:w, payments:p, maintenance:Number(CFG.maintenance)?1:0 };
}
export async function findPlayers(query){
  const s = String(query||'').trim();
  let r;
  if (/^\d+$/.test(s)) r = await q(`SELECT id,username,first_name,role,ember,stars,loyalty,banned,tribe_id FROM users WHERE id=$1`,[s]);
  else r = await q(`SELECT id,username,first_name,role,ember,stars,loyalty,banned,tribe_id FROM users
    WHERE username ILIKE $1 OR first_name ILIKE $1 ORDER BY loyalty DESC LIMIT 20`,['%'+s+'%']);
  return r.rows;
}
export async function playerDetail(id){
  const r = await q(`SELECT u.*, t.name AS tribe_name FROM users u LEFT JOIN tribes t ON t.id=u.tribe_id WHERE u.id=$1`,[id]);
  return r.rows[0] || null;
}
export async function grant(adminId, id, kind, amount){
  const col = ({ember:'ember',stars:'stars',loyalty:'loyalty'})[kind];
  if (!col) throw new Error('kind must be ember, stars or loyalty');
  const amt = Math.floor(n(amount));
  const r = await q(`UPDATE users SET ${col}=${col}+$1 WHERE id=$2 RETURNING id,${col}`,[amt,id]);
  if (!r.rowCount) throw new Error('no such player');
  if (kind==='loyalty'){ const t=(await q('SELECT tribe_id FROM users WHERE id=$1',[id])).rows[0];
    if (t && t.tribe_id) await q('UPDATE tribes SET loyalty_total=loyalty_total+$1 WHERE id=$2',[amt,t.tribe_id]); }
  await audit(adminId,'grant',`${amt} ${kind} -> user ${id}`);
  return r.rows[0];
}
export async function setRole(adminId, id, role){
  if (!ROLES.includes(role)) throw new Error('role must be one of: '+ROLES.join(', '));
  const r = await q('UPDATE users SET role=$1 WHERE id=$2 RETURNING id,role',[role,id]);
  if (!r.rowCount) throw new Error('no such player');
  await audit(adminId,'setRole',`user ${id} -> ${role}`); return r.rows[0];
}
export async function setLoyalty(adminId, id, value){
  const v = Math.floor(n(value));
  const r = await q('UPDATE users SET loyalty=$1 WHERE id=$2 RETURNING id,loyalty',[v,id]);
  if (!r.rowCount) throw new Error('no such player');
  await audit(adminId,'setLoyalty',`user ${id} = ${v}`); return r.rows[0];
}
export async function ban(adminId, id, reason){
  const r = await q('UPDATE users SET banned=true, ban_reason=$2 WHERE id=$1 RETURNING id',[id,reason||'']);
  if (!r.rowCount) throw new Error('no such player');
  await audit(adminId,'ban',`user ${id}: ${reason||''}`); return { id, banned:true };
}
export async function unban(adminId, id){
  const r = await q('UPDATE users SET banned=false, ban_reason=NULL WHERE id=$1 RETURNING id',[id]);
  if (!r.rowCount) throw new Error('no such player');
  await audit(adminId,'unban',`user ${id}`); return { id, banned:false };
}
export async function delUser(adminId, id){
  const u = (await q('SELECT tribe_id FROM users WHERE id=$1',[id])).rows[0];
  if (!u) throw new Error('no such player');
  if (u.tribe_id) await q('UPDATE tribes SET members=GREATEST(0,members-1) WHERE id=$1',[u.tribe_id]);
  await q('DELETE FROM users WHERE id=$1',[id]);
  await audit(adminId,'delUser',`user ${id}`); return { id, deleted:true };
}
// ---- tribes ----
export async function tribesTop(limit=20){
  return (await q(`SELECT id,name,crest,members,loyalty_total,treasury,wins,losses,created_by
    FROM tribes ORDER BY loyalty_total DESC LIMIT $1`,[limit])).rows;
}
export async function tribeDetail(id){
  const t = (await q('SELECT * FROM tribes WHERE id=$1',[id])).rows[0];
  if (!t) return null;
  const members = (await q('SELECT id,username,first_name,role,loyalty FROM users WHERE tribe_id=$1 ORDER BY loyalty DESC LIMIT 30',[id])).rows;
  return { ...t, roster:members };
}
export async function renameTribe(adminId, id, name){
  name = String(name||'').trim().slice(0,32);
  if (name.length<3) throw new Error('name too short');
  const r = await q('UPDATE tribes SET name=$1 WHERE id=$2 RETURNING id,name',[name,id]);
  if (!r.rowCount) throw new Error('no such tribe');
  await audit(adminId,'renameTribe',`tribe ${id} -> ${name}`); return r.rows[0];
}
export async function setTreasury(adminId, id, value){
  const v = Math.floor(n(value));
  const r = await q('UPDATE tribes SET treasury=$1 WHERE id=$2 RETURNING id,treasury',[v,id]);
  if (!r.rowCount) throw new Error('no such tribe');
  await audit(adminId,'setTreasury',`tribe ${id} = ${v}`); return r.rows[0];
}
export async function disband(adminId, id){
  const t = (await q('SELECT id FROM tribes WHERE id=$1',[id])).rows[0];
  if (!t) throw new Error('no such tribe');
  await q('UPDATE users SET tribe_id=NULL WHERE tribe_id=$1',[id]);
  await q(`DELETE FROM wars WHERE attacker_id=$1 OR defender_id=$1`,[id]);
  await q('DELETE FROM tribes WHERE id=$1',[id]);
  await audit(adminId,'disband',`tribe ${id}`); return { id, disbanded:true };
}

// ---- wars ----
export async function warsActive(){
  return (await q(`SELECT w.*, a.name a_name, d.name d_name FROM wars w
    JOIN tribes a ON a.id=w.attacker_id JOIN tribes d ON d.id=w.defender_id
    WHERE w.status='active' ORDER BY w.start_at DESC LIMIT 30`)).rows;
}
export async function resolveWar(adminId, id){
  const w = (await q('SELECT * FROM wars WHERE id=$1',[id])).rows[0];
  if (!w) throw new Error('no such war');
  await q("UPDATE wars SET end_at = now() - interval '1 minute' WHERE id=$1",[id]);
  const fresh = (await q('SELECT * FROM wars WHERE id=$1',[id])).rows[0];
  const done = await maybeResolve(fresh);
  await audit(adminId,'resolveWar',`war ${id}`); return done;
}
export async function cancelWar(adminId, id){
  const r = await q(`UPDATE wars SET status='resolved', winner_id=NULL, tribute=0, resolved_at=now()
    WHERE id=$1 AND status='active' RETURNING id`,[id]);
  if (!r.rowCount) throw new Error('no active war with that id');
  await audit(adminId,'cancelWar',`war ${id}`); return { id, cancelled:true };
}
export async function startWar(adminId, attackerId, defenderId){
  if (String(attackerId)===String(defenderId)) throw new Error('a tribe cannot fight itself');
  for (const t of [attackerId,defenderId]){
    const ex = await q('SELECT 1 FROM tribes WHERE id=$1',[t]); if (!ex.rowCount) throw new Error('tribe '+t+' not found');
    const busy = await q(`SELECT 1 FROM wars WHERE status='active' AND (attacker_id=$1 OR defender_id=$1)`,[t]);
    if (busy.rowCount) throw new Error('tribe '+t+' is already at war');
  }
  const c = pickChallenge();
  const aStart = await getTribeMetric(attackerId, c.metric);
  const dStart = await getTribeMetric(defenderId, c.metric);
  const war = (await q(`INSERT INTO wars(attacker_id,defender_id,challenge_id,goal,metric,stake_pct,reward_ember,attacker_start,defender_start,end_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + ($10 || ' days')::interval) RETURNING *`,
    [attackerId,defenderId,c.id,c.goal,c.metric,c.stake,c.reward,aStart,dStart,String(c.days)])).rows[0];
  await audit(adminId,'startWar',`${attackerId} vs ${defenderId} (${c.id})`); return war;
}

// ---- payments ----
export async function paymentsRecent(limit=20){
  return (await q(`SELECT id,user_id,kind,charge_id,payload,amount,currency,status,refunded,created_at
    FROM payments ORDER BY created_at DESC LIMIT $1`,[limit])).rows;
}
export async function refund(adminId, chargeId){
  const p = (await q('SELECT * FROM payments WHERE charge_id=$1',[chargeId])).rows[0];
  if (!p) throw new Error('no such payment');
  if (p.refunded) return { chargeId, already:true };
  await q(`UPDATE payments SET refunded=true, status='refunded' WHERE id=$1`,[p.id]);
  await audit(adminId,'refund',`payment ${chargeId} (${p.kind} ${p.amount})`);
  return { chargeId, refunded:true, kind:p.kind, amount:p.amount };
}

// ---- economy / flags ----
export function econGet(){ return { ...CFG, _defaults:DEFAULTS }; }
export async function econSet(adminId, key, value){
  if (!(key in DEFAULTS)) throw new Error('unknown key. valid: '+Object.keys(DEFAULTS).join(', '));
  const v = await setConfig(q, key, value);
  await audit(adminId,'econSet',`${key} = ${value}`); return { key, value:v };
}
export async function econReset(adminId){ await resetConfig(q); await audit(adminId,'econReset',''); return econGet(); }
export async function setMaintenance(adminId, on){
  const v = on?1:0; await setConfig(q,'maintenance',v);
  await audit(adminId,'maintenance',String(v)); return { maintenance:v };
}
export async function wipeSeason(adminId){
  await q('UPDATE users SET loyalty=0');
  await q('UPDATE tribes SET loyalty_total=0, wins=0, losses=0');
  await q("UPDATE wars SET status='resolved', resolved_at=now() WHERE status='active'");
  await audit(adminId,'wipeSeason','loyalty + war records reset'); return { wiped:true };
}
export async function broadcast(adminId, text){
  if (!MAIN_BOT_TOKEN) throw new Error('BOT_TOKEN not set \u2014 cannot broadcast');
  const ids = (await q('SELECT id FROM users WHERE banned=false')).rows.map(r=>r.id);
  let sent=0;
  for (const id of ids){ await botSend(MAIN_BOT_TOKEN, id, text); sent++; if (sent%25===0) await new Promise(r=>setTimeout(r,1100)); }
  await audit(adminId,'broadcast',`${sent} users`); return { sent };
}
// ===================== TELEGRAM ADMIN BOT =====================
const HELP = [
  '<b>\uD83D\uDD25 TRIBES \u2014 Admin Console</b>',
  '',
  '<b>Stats</b>',
  '/stats \u2014 global overview',
  '',
  '<b>Players</b>',
  '/find &lt;name|id&gt;',
  '/player &lt;id&gt;',
  '/grant &lt;id&gt; &lt;ember|stars|loyalty&gt; &lt;amount&gt;',
  '/setrole &lt;id&gt; &lt;role&gt;',
  '/setloyalty &lt;id&gt; &lt;value&gt;',
  '/ban &lt;id&gt; [reason]   \u00b7   /unban &lt;id&gt;',
  '/deluser &lt;id&gt;',
  '',
  '<b>Tribes</b>',
  '/tribes [n]   \u00b7   /tribe &lt;id&gt;',
  '/rename &lt;id&gt; &lt;name&gt;',
  '/treasury &lt;id&gt; &lt;value&gt;',
  '/disband &lt;id&gt;',
  '',
  '<b>Wars</b>',
  '/wars',
  '/startwar &lt;attackerId&gt; &lt;defenderId&gt;',
  '/resolvewar &lt;warId&gt;   \u00b7   /cancelwar &lt;warId&gt;',
  '',
  '<b>Payments</b>',
  '/payments [n]   \u00b7   /refund &lt;chargeId&gt;',
  '',
  '<b>Economy &amp; control</b>',
  '/econ   \u00b7   /set &lt;key&gt; &lt;value&gt;   \u00b7   /econreset',
  '/maintenance &lt;on|off&gt;',
  '/wipeseason',
  '/broadcast &lt;message&gt;',
].join('\n');

const CMD_LIST = [
  {command:'stats',description:'Global overview'},
  {command:'find',description:'Find players by name or id'},
  {command:'player',description:'Player detail'},
  {command:'grant',description:'Grant ember/stars/loyalty'},
  {command:'setrole',description:'Set a player role'},
  {command:'setloyalty',description:'Set player loyalty'},
  {command:'ban',description:'Ban a player'},
  {command:'unban',description:'Unban a player'},
  {command:'tribes',description:'Top tribes'},
  {command:'tribe',description:'Tribe detail'},
  {command:'rename',description:'Rename a tribe'},
  {command:'treasury',description:'Set tribe treasury'},
  {command:'disband',description:'Disband a tribe'},
  {command:'wars',description:'Active wars'},
  {command:'startwar',description:'Force a war'},
  {command:'resolvewar',description:'Force-resolve a war'},
  {command:'cancelwar',description:'Cancel a war'},
  {command:'payments',description:'Recent payments'},
  {command:'refund',description:'Refund a payment'},
  {command:'econ',description:'Show economy config'},
  {command:'set',description:'Set a config key'},
  {command:'maintenance',description:'Toggle maintenance'},
  {command:'wipeseason',description:'Reset loyalty & war records'},
  {command:'broadcast',description:'Message all players'},
  {command:'help',description:'Command list'},
];

async function runCommand(adminId, cmd, a){
  switch(cmd){
    case 'start': case 'help': return HELP;
    case 'stats': { const s=await stats();
      return `<b>\uD83D\uDCCA Overview</b>\nPlayers: <b>${fmt(s.users.n)}</b> (banned ${s.users.banned})\n`+
        `Ember in play: <b>${fmt(s.users.ember)}</b>\nStars held: <b>${fmt(s.users.stars)}</b>\n`+
        `Tribes: <b>${fmt(s.tribes.n)}</b> \u00b7 Pyre ${fmt(s.tribes.pyre)} \u00b7 Loyalty ${fmt(s.tribes.loyalty)}\n`+
        `Wars: <b>${s.wars.active}</b> active / ${s.wars.total} total\n`+
        `Payments: ${s.payments.startx||s.payments.starTx||0} Stars tx (${fmt(s.payments.stars)}\u2b50), ${s.payments.tontx||s.payments.tonTx||0} TON\n`+
        `Maintenance: <b>${s.maintenance?'ON':'off'}</b>`; }
    case 'find': { const rows=await findPlayers(a.join(' ')); if(!rows.length) return 'No players found.';
      return rows.map(r=>`#${r.id} <b>${r.first_name||''}</b> @${r.username||'?'} \u2014 ${r.role} \u00b7 ${fmt(r.ember)}E ${fmt(r.stars)}\u2b50 ${fmt(r.loyalty)}\u2764${r.banned?' \u26D4':''}`).join('\n'); }
    case 'player': { const p=await playerDetail(a[0]); if(!p) return 'No such player.';
      return `<b>#${p.id} ${p.first_name||''}</b> @${p.username||'?'}\nRole: ${p.role}\nEmber: ${fmt(p.ember)} \u00b7 Stars: ${fmt(p.stars)} \u00b7 Loyalty: ${fmt(p.loyalty)}\nStreak: ${p.streak} \u00b7 Tribe: ${p.tribe_name||'\u2014'}\nTON: ${p.ton_address||'\u2014'}\nBanned: ${p.banned?('yes ('+(p.ban_reason||'')+')'):'no'}`; }
    case 'grant': { const r=await grant(adminId,a[0],a[1],a[2]); return `\u2705 user ${r.id} now has ${fmt(r[a[1]])} ${a[1]}`; }
    case 'setrole': { const r=await setRole(adminId,a[0],a[1]); return `\u2705 user ${r.id} role = ${r.role}`; }
    case 'setloyalty': { const r=await setLoyalty(adminId,a[0],a[1]); return `\u2705 user ${r.id} loyalty = ${fmt(r.loyalty)}`; }
    case 'ban': { await ban(adminId,a[0],a.slice(1).join(' ')); return `\u26D4 user ${a[0]} banned`; }
    case 'unban': { await unban(adminId,a[0]); return `\u2705 user ${a[0]} unbanned`; }
    case 'deluser': { await delUser(adminId,a[0]); return `\uD83D\uDDD1 user ${a[0]} deleted`; }
    case 'tribes': { const rows=await tribesTop(n(a[0])||15); if(!rows.length) return 'No tribes yet.';
      return rows.map((t,i)=>`${i+1}. #${t.id} <b>${t.name}</b> \u2014 ${fmt(t.members)} kin \u00b7 ${fmt(t.loyalty_total)}\u2764 \u00b7 Pyre ${fmt(t.treasury)} \u00b7 \uD83C\uDFC6${t.wins}/${t.losses}`).join('\n'); }
    case 'tribe': { const t=await tribeDetail(a[0]); if(!t) return 'No such tribe.';
      return `<b>#${t.id} ${t.name}</b>\n\u201c${t.motto||''}\u201d\nKin: ${fmt(t.members)} \u00b7 Loyalty: ${fmt(t.loyalty_total)} \u00b7 Pyre: ${fmt(t.treasury)}\nRecord: ${t.wins}W / ${t.losses}L\nTop kin:\n`+
        t.roster.slice(0,8).map(m=>` \u2022 #${m.id} ${m.first_name||''} (${m.role}, ${fmt(m.loyalty)}\u2764)`).join('\n'); }
    case 'rename': { const r=await renameTribe(adminId,a[0],a.slice(1).join(' ')); return `\u2705 tribe ${r.id} \u2192 ${r.name}`; }
    case 'treasury': { const r=await setTreasury(adminId,a[0],a[1]); return `\u2705 tribe ${r.id} Pyre = ${fmt(r.treasury)}`; }
    case 'disband': { await disband(adminId,a[0]); return `\uD83D\uDCA5 tribe ${a[0]} disbanded`; }
    case 'wars': { const rows=await warsActive(); if(!rows.length) return 'No active wars.';
      return rows.map(w=>`\u2694 war #${w.id}: <b>${w.a_name}</b> ${fmt(w.attacker_score)} vs ${fmt(w.defender_score)} <b>${w.d_name}</b> \u00b7 ${w.challenge_id} \u00b7 goal ${fmt(w.goal)}`).join('\n'); }
    case 'startwar': { const w=await startWar(adminId,a[0],a[1]); return `\u2694 war #${w.id} started: ${a[0]} vs ${a[1]} (${w.challenge_id})`; }
    case 'resolvewar': { const w=await resolveWar(adminId,a[0]); return `\u2705 war #${w.id} resolved. winner: ${w.winner_id||'draw'} \u00b7 tribute ${fmt(w.tribute)}`; }
    case 'cancelwar': { await cancelWar(adminId,a[0]); return `\uD83D\uDEAB war ${a[0]} cancelled`; }
    case 'payments': { const rows=await paymentsRecent(n(a[0])||15); if(!rows.length) return 'No payments.';
      return rows.map(p=>`${p.kind} ${fmt(p.amount)}${p.currency==='XTR'?'\u2b50':''} \u00b7 user ${p.user_id} \u00b7 ${p.status}${p.refunded?' (refunded)':''}\n   ${p.charge_id}`).join('\n'); }
    case 'refund': { const r=await refund(adminId,a[0]); return r.already?`already refunded`:`\u2705 refunded ${r.kind} ${fmt(r.amount)} (${r.chargeId})`; }
    case 'econ': { const c=econGet(); return '<b>\u2699\uFE0F Economy</b>\n'+Object.keys(DEFAULTS).map(k=>`${k} = <b>${c[k]}</b>`).join('\n')+'\n\nChange with /set &lt;key&gt; &lt;value&gt;'; }
    case 'set': { const r=await econSet(adminId,a[0],a[1]); return `\u2705 ${r.key} = ${r.value}`; }
    case 'econreset': { await econReset(adminId); return '\u2705 economy reset to defaults'; }
    case 'maintenance': { const on=/^(on|1|true|yes)$/i.test(a[0]||''); await setMaintenance(adminId,on); return `\uD83D\uDD27 maintenance ${on?'ON \u2014 player actions paused':'off'}`; }
    case 'wipeseason': { await wipeSeason(adminId); return '\uD83C\uDF00 season wiped \u2014 loyalty & war records reset (balances kept)'; }
    case 'broadcast': { const text=a.join(' '); if(!text) return 'Usage: /broadcast your message'; const r=await broadcast(adminId,text); return `\uD83D\uDCE3 sent to ${r.sent} players`; }
    default: return 'Unknown command. Send /help for the list.';
  }
}

export async function adminBotWebhook(update){
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return;
  const from = msg.from && msg.from.id, chat = msg.chat && msg.chat.id;
  if (!isAdmin(from)){ await botSend(ADMIN_BOT_TOKEN, chat, '\u26D4 You are not authorized to use this console.'); return; }
  const parts = msg.text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase().replace(/^\//,'').split('@')[0];
  try{ await botSend(ADMIN_BOT_TOKEN, chat, await runCommand(from, cmd, parts.slice(1))); }
  catch(e){ await botSend(ADMIN_BOT_TOKEN, chat, '\u26A0\uFE0F '+e.message); }
}

export async function setupAdminBot(baseUrl){
  if (!ADMIN_BOT_TOKEN){ console.log('[admin] ADMIN_BOT_TOKEN not set \u2014 admin bot disabled'); return; }
  if (!baseUrl){ console.log('[admin] no base url (RENDER_EXTERNAL_URL/APP_URL) \u2014 set webhook manually'); return; }
  try{
    await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/setWebhook`, { method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ url: baseUrl.replace(/\/$/,'')+'/api/admin/webhook', allowed_updates:['message'] }) });
    await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/setMyCommands`, { method:'POST',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify({ commands: CMD_LIST }) });
    console.log('[admin] admin bot webhook + commands set');
  }catch(e){ console.error('[admin] setup', e.message); }
}

// ===================== WEB DASHBOARD API =====================
export function requireAdmin(req,res,next){
  if (!WEB_TOKEN) return res.status(503).json({ error:'admin web disabled \u2014 set ADMIN_TOKEN' });
  const t = req.get('X-Admin-Token') || (req.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  if (t !== WEB_TOKEN) return res.status(401).json({ error:'bad admin token' });
  next();
}

export const adminRouter = express.Router();
const A = adminRouter, admOf = req => (req.get('X-Admin-Token')?'web':'web');
const wrap = fn => async (req,res)=>{ try{ res.json({ ok:true, data: await fn(req) }); }catch(e){ res.status(400).json({ ok:false, error:e.message }); } };
A.use(requireAdmin);
A.get('/stats',   wrap(()=>stats()));
A.get('/players', wrap(req=>findPlayers(req.query.q||'')));
A.get('/player/:id', wrap(req=>playerDetail(req.params.id)));
A.post('/grant',  wrap(req=>grant('web',req.body.id,req.body.kind,req.body.amount)));
A.post('/role',   wrap(req=>setRole('web',req.body.id,req.body.role)));
A.post('/loyalty',wrap(req=>setLoyalty('web',req.body.id,req.body.value)));
A.post('/ban',    wrap(req=>ban('web',req.body.id,req.body.reason)));
A.post('/unban',  wrap(req=>unban('web',req.body.id)));
A.post('/deluser',wrap(req=>delUser('web',req.body.id)));
A.get('/tribes',  wrap(()=>tribesTop(50)));
A.get('/tribe/:id', wrap(req=>tribeDetail(req.params.id)));
A.post('/tribe/rename',  wrap(req=>renameTribe('web',req.body.id,req.body.name)));
A.post('/tribe/treasury',wrap(req=>setTreasury('web',req.body.id,req.body.value)));
A.post('/tribe/disband', wrap(req=>disband('web',req.body.id)));
A.get('/wars',    wrap(()=>warsActive()));
A.post('/war/start',  wrap(req=>startWar('web',req.body.attacker,req.body.defender)));
A.post('/war/resolve',wrap(req=>resolveWar('web',req.body.id)));
A.post('/war/cancel', wrap(req=>cancelWar('web',req.body.id)));
A.get('/payments',wrap(()=>paymentsRecent(50)));
A.post('/refund', wrap(req=>refund('web',req.body.chargeId)));
A.get('/econ',    wrap(()=>econGet()));
A.post('/econ',   wrap(req=>econSet('web',req.body.key,req.body.value)));
A.post('/econ/reset', wrap(()=>econReset('web')));
A.post('/maintenance',wrap(req=>setMaintenance('web',/^(on|1|true|yes)$/i.test(String(req.body.on)))));
A.post('/wipeseason', wrap(()=>wipeSeason('web')));
A.post('/broadcast',  wrap(req=>broadcast('web',req.body.text)));

