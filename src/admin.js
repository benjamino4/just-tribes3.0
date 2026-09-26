/* =====================================================================
   TRIBES — Admin control plane.
   REST endpoints + Telegram admin bot + SSE live feed.
===================================================================== */
import express from 'express';
import {
  previewReset, backupToJSON, resetProgression, factoryReset, listTables,
} from './admin_reset.js';
import { q } from './db.js';
import { CFG, DEFAULTS, setConfig, resetConfig } from './config.js';
import {
  CHALLENGES, pickChallenge, maybeResolve, getTribeMetric,
  currentSeason, startSeason, endSeason,
} from './war.js';
import { verifyInitData } from './auth.js';
import { resetAllTrials } from './trials.js';
import { enqueue as pushEnqueue } from './push.js';
import { feedWrite, feedRead, feedLatest, feedCounts } from './feed.js';

/* ---------- SSE ---------- */
const adminSubscribers = new Set();

export function broadcastAdmin(event){
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of adminSubscribers){
    try { res.write(line); } catch (e){}
  }
}

setInterval(() => {
  for (const res of adminSubscribers){ try { res.write(': ping\n\n'); } catch (e){} }
}, 25000).unref();

const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN || '';
const MAIN_BOT_TOKEN  = process.env.BOT_TOKEN || '';
const WEB_TOKEN       = process.env.ADMIN_TOKEN || '';
const ADMIN_IDS = new Set(
  (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
);
const ROLES = ['Toddler','Kin','Hunter','Elder','Head','Chief'];

export function isAdmin(id){ return ADMIN_IDS.has(String(id)); }

/* ---------- SSE with dual auth ---------- */
export function adminSse(req, res){
  const t = req.query.token || '';
  const initData = req.query.initData || '';

  let ok = false;
  let actor = null;

  if (WEB_TOKEN && t === WEB_TOKEN){
    ok = true;
    actor = 'web';
  } else if (initData){
    const tgUser = verifyInitData(initData);
    if (tgUser && isAdmin(tgUser.id)){
      ok = true;
      actor = String(tgUser.id);
    }
  }

  if (!ok) return res.status(401).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  res.write(`data: ${JSON.stringify({ type:'hello', at: Date.now(), actor })}\n\n`);

  adminSubscribers.add(res);
  res.on('close', () => adminSubscribers.delete(res));
}

export function adminBotConfigured(){ return !!ADMIN_BOT_TOKEN; }

async function botSend(token, chatId, text){
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        chat_id: chatId, text, parse_mode:'HTML', disable_web_page_preview:true,
      }),
    });
  } catch(e){ console.error('[admin] send', e.message); }
}

async function audit(adminId, action, detail){
  try {
    await q(
      `INSERT INTO audit(admin_id,action,detail) VALUES ($1,$2,$3)`,
      [adminId || null, action, detail || '']
    );
    broadcastAdmin({
      type:'audit', action, detail: detail || '',
      adminId: adminId || null, at: Date.now(),
    });
    feedWrite({
      type: 'audit',
      icon: 'shield',
      severity: action.toLowerCase().includes('reset') ? 'danger' : 'info',
      text: `${action}: ${detail || ''}`.slice(0, 240),
      actor: adminId,
    });
  } catch(e){}
}

const n = v => Number(v) || 0;
const fmt = v => (Number(v) || 0).toLocaleString('en-US');

/* ---------- stats ---------- */
export async function stats(){
  const u = (await q(
    `SELECT count(*)::int n, coalesce(sum(ember),0)::bigint ember,
            count(*) filter (where banned)::int banned FROM users`
  )).rows[0];
  const t = (await q(
    `SELECT count(*)::int n, coalesce(sum(treasury),0)::bigint pyre,
            coalesce(sum(loyalty_total),0)::bigint loyalty FROM tribes`
  )).rows[0];
  const w = (await q(
    `SELECT count(*) filter (where status='active')::int active, count(*)::int total FROM wars`
  )).rows[0];
  const p = (await q(
    `SELECT count(*) filter (where kind='stars')::int starTx,
            coalesce(sum(amount) filter (where kind='stars'),0)::bigint stars,
            count(*) filter (where kind='ton' and status='paid')::int tonTx FROM payments`
  )).rows[0];
  return { users:u, tribes:t, wars:w, payments:p, maintenance: Number(CFG.maintenance) ? 1 : 0 };
}

/* ---------- players ---------- */
export async function findPlayers(query){
  const s = String(query || '').trim();
  let r;
  if (/^\d+$/.test(s))
    r = await q(
      `SELECT id,username,first_name,role,ember,loyalty,banned,tribe_id
         FROM users WHERE id=$1`, [s]
    );
  else
    r = await q(
      `SELECT id,username,first_name,role,ember,loyalty,banned,tribe_id
         FROM users WHERE username ILIKE $1 OR first_name ILIKE $1
         ORDER BY loyalty DESC LIMIT 20`, ['%' + s + '%']
    );
  return r.rows;
}
export async function playerDetail(id){
  const r = await q(
    `SELECT u.*, t.name AS tribe_name FROM users u
      LEFT JOIN tribes t ON t.id=u.tribe_id WHERE u.id=$1`, [id]
  );
  return r.rows[0] || null;
}
export async function grant(adminId, id, kind, amount){
  const col = ({ ember:'ember', loyalty:'loyalty' })[kind];
  if (!col) throw new Error('kind must be ember or loyalty');
  const amt = Math.floor(n(amount));
  const r = await q(
    `UPDATE users SET ${col}=${col}+$1 WHERE id=$2 RETURNING id,${col}`,
    [amt, id]
  );
  if (!r.rowCount) throw new Error('no such player');
  if (kind === 'loyalty'){
    const t = (await q('SELECT tribe_id FROM users WHERE id=$1', [id])).rows[0];
    if (t && t.tribe_id)
      await q('UPDATE tribes SET loyalty_total=loyalty_total+$1 WHERE id=$2', [amt, t.tribe_id]);
  }
  await audit(adminId, 'grant', `${amt} ${kind} -> user ${id}`);
  return r.rows[0];
}
export async function setRole(adminId, id, role){
  if (!ROLES.includes(role)) throw new Error('role must be one of: ' + ROLES.join(', '));
  const r = await q('UPDATE users SET role=$1 WHERE id=$2 RETURNING id,role', [role, id]);
  if (!r.rowCount) throw new Error('no such player');
  await audit(adminId, 'setRole', `user ${id} -> ${role}`);
  return r.rows[0];
}
export async function setLoyalty(adminId, id, value){
  const v = Math.floor(n(value));
  const r = await q('UPDATE users SET loyalty=$1 WHERE id=$2 RETURNING id,loyalty', [v, id]);
  if (!r.rowCount) throw new Error('no such player');
  await audit(adminId, 'setLoyalty', `user ${id} = ${v}`);
  return r.rows[0];
}
export async function ban(adminId, id, reason){
  const r = await q(
    'UPDATE users SET banned=true, ban_reason=$2 WHERE id=$1 RETURNING id',
    [id, reason || '']
  );
  if (!r.rowCount) throw new Error('no such player');
  await audit(adminId, 'ban', `user ${id}: ${reason || ''}`);
  return { id, banned:true };
}
export async function unban(adminId, id){
  const r = await q('UPDATE users SET banned=false, ban_reason=NULL WHERE id=$1 RETURNING id', [id]);
  if (!r.rowCount) throw new Error('no such player');
  await audit(adminId, 'unban', `user ${id}`);
  return { id, banned:false };
}
export async function delUser(adminId, id){
  const u = (await q('SELECT tribe_id FROM users WHERE id=$1', [id])).rows[0];
  if (!u) throw new Error('no such player');
  if (u.tribe_id)
    await q('UPDATE tribes SET members=GREATEST(0,members-1) WHERE id=$1', [u.tribe_id]);
  await q('DELETE FROM users WHERE id=$1', [id]);
  await audit(adminId, 'delUser', `user ${id}`);
  return { id, deleted:true };
}

/* ---------- tribes ---------- */
export async function tribesTop(limit = 20){
  return (await q(
    `SELECT id,name,crest,banner,palette,level,members,loyalty_total,treasury,wins,losses,created_by
       FROM tribes ORDER BY loyalty_total DESC LIMIT $1`, [limit]
  )).rows;
}
export async function tribeDetail(id){
  const t = (await q('SELECT * FROM tribes WHERE id=$1', [id])).rows[0];
  if (!t) return null;
  const members = (await q(
    `SELECT id,username,first_name,role,loyalty FROM users
      WHERE tribe_id=$1 ORDER BY loyalty DESC LIMIT 30`, [id]
  )).rows;
  return { ...t, roster: members };
}
export async function renameTribe(adminId, id, name){
  name = String(name || '').trim().slice(0, 32);
  if (name.length < 3) throw new Error('name too short');
  const r = await q('UPDATE tribes SET name=$1 WHERE id=$2 RETURNING id,name', [name, id]);
  if (!r.rowCount) throw new Error('no such tribe');
  await audit(adminId, 'renameTribe', `tribe ${id} -> ${name}`);
  return r.rows[0];
}
export async function setTreasury(adminId, id, value){
  const v = Math.floor(n(value));
  const r = await q('UPDATE tribes SET treasury=$1 WHERE id=$2 RETURNING id,treasury', [v, id]);
  if (!r.rowCount) throw new Error('no such tribe');
  await audit(adminId, 'setTreasury', `tribe ${id} = ${v}`);
  return r.rows[0];
}
export async function disband(adminId, id){
  const t = (await q('SELECT id FROM tribes WHERE id=$1', [id])).rows[0];
  if (!t) throw new Error('no such tribe');
  await q('UPDATE users SET tribe_id=NULL WHERE tribe_id=$1', [id]);
  await q('DELETE FROM wars WHERE attacker_id=$1 OR defender_id=$1', [id]);
  await q('DELETE FROM tribes WHERE id=$1', [id]);
  await audit(adminId, 'disband', `tribe ${id}`);
  return { id, disbanded:true };
}

/* ---------- wars ---------- */
export async function warsActive(){
  return (await q(
    `SELECT w.*, a.name a_name, d.name d_name FROM wars w
      JOIN tribes a ON a.id=w.attacker_id
      JOIN tribes d ON d.id=w.defender_id
      WHERE w.status='active' ORDER BY w.start_at DESC LIMIT 30`
  )).rows;
}
export async function resolveWar(adminId, id){
  const w = (await q('SELECT * FROM wars WHERE id=$1', [id])).rows[0];
  if (!w) throw new Error('no such war');
  await q("UPDATE wars SET end_at = now() - interval '1 minute' WHERE id=$1", [id]);
  const fresh = (await q('SELECT * FROM wars WHERE id=$1', [id])).rows[0];
  const done = await maybeResolve(fresh);
  await audit(adminId, 'resolveWar', `war ${id}`);
  return done;
}
export async function cancelWar(adminId, id){
  const r = await q(
    `UPDATE wars SET status='resolved', winner_id=NULL, tribute=0, resolved_at=now(),
                       end_at = CASE WHEN end_at > now() THEN now() ELSE end_at END
       WHERE id=$1 AND status='active' RETURNING id`, [id]
  );
  if (!r.rowCount) throw new Error('no active war with that id');
  await audit(adminId, 'cancelWar', `war ${id}`);
  return { id, cancelled:true };
}
export async function startWar(adminId, attackerId, defenderId){
  if (String(attackerId) === String(defenderId)) throw new Error('a tribe cannot fight itself');
  for (const t of [attackerId, defenderId]){
    const ex = await q('SELECT 1 FROM tribes WHERE id=$1', [t]);
    if (!ex.rowCount) throw new Error('tribe ' + t + ' not found');
    const busy = await q(
      `SELECT 1 FROM wars WHERE status='active' AND (attacker_id=$1 OR defender_id=$1)`, [t]
    );
    if (busy.rowCount) throw new Error('tribe ' + t + ' is already at war');
  }
  const c = pickChallenge();
  const aStart = await getTribeMetric(attackerId, c.metric);
  const dStart = await getTribeMetric(defenderId, c.metric);
  const war = (await q(
    `INSERT INTO wars (attacker_id,defender_id,challenge_id,goal,metric,stake_pct,reward_ember,
                       attacker_start,defender_start,end_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + ($10 || ' hours')::interval)
     RETURNING *`,
    [attackerId, defenderId, c.id, c.goal, c.metric, c.stake, c.reward,
     aStart, dStart, String(Number(CFG.war_cap_hours) || 72)]
  )).rows[0];
  await audit(adminId, 'startWar', `${attackerId} vs ${defenderId} (${c.id})`);
  return war;
}

/* ---------- payments ---------- */
export async function paymentsRecent(limit = 20){
  return (await q(
    `SELECT id,user_id,kind,charge_id,payload,amount,currency,status,refunded,created_at
       FROM payments ORDER BY created_at DESC LIMIT $1`, [limit]
  )).rows;
}
export async function refund(adminId, chargeId){
  const p = (await q('SELECT * FROM payments WHERE charge_id=$1', [chargeId])).rows[0];
  if (!p) throw new Error('no such payment');
  if (p.refunded) return { chargeId, already:true };
  await q(`UPDATE payments SET refunded=true, status='refunded' WHERE id=$1`, [p.id]);
  await audit(adminId, 'refund', `payment ${chargeId} (${p.kind} ${p.amount})`);
  return { chargeId, refunded:true, kind:p.kind, amount:p.amount };
}

/* ---------- config ---------- */
export function econGet(){ return { ...CFG, _defaults: DEFAULTS }; }
export async function econSet(adminId, key, value){
  if (!(key in DEFAULTS))
    throw new Error('unknown key. valid: ' + Object.keys(DEFAULTS).join(', '));
  const v = await setConfig(q, key, value);
  await audit(adminId, 'econSet', `${key} = ${value}`);
  return { key, value: v };
}
export async function econReset(adminId){
  await resetConfig(q);
  await audit(adminId, 'econReset', '');
  return econGet();
}
export async function setMaintenance(adminId, on){
  const v = on ? 1 : 0;
  await setConfig(q, 'maintenance', v);
  await audit(adminId, 'maintenance', String(v));
  return { maintenance: v };
}
export async function wipeSeason(adminId){
  await q('UPDATE users SET loyalty=0');
  await q('UPDATE tribes SET loyalty_total=0, wins=0, losses=0');
  await q("UPDATE wars SET status='resolved', resolved_at=now(), end_at = CASE WHEN end_at > now() THEN now() ELSE end_at END WHERE status='active'");
  await audit(adminId, 'wipeSeason', 'loyalty + war records reset');
  return { wiped:true };
}
export async function broadcast(adminId, text){
  if (!MAIN_BOT_TOKEN) throw new Error('BOT_TOKEN not set — cannot broadcast');
  const ids = (await q('SELECT id FROM users WHERE banned=false')).rows.map(r => r.id);
  let sent = 0;
  for (const id of ids){
    await botSend(MAIN_BOT_TOKEN, id, text);
    sent++;
    if (sent % 25 === 0) await new Promise(r => setTimeout(r, 1100));
  }
  await audit(adminId, 'broadcast', `${sent} users`);
  return { sent };
}

/* ---------- trials ---------- */
export async function trialsList(){
  return (await q(
    `SELECT id, slug, name, glyph, hint, reward_ember, reward_loyalty,
            cooldown_hours, max_per_window, window_hours, window_start_utc,
            active, sort_order, kind, minigame, created_at
       FROM trial_defs ORDER BY sort_order, id`
  )).rows;
}
export async function trialCreate(adminId, data){
  const slug = String(data.slug || '').trim().toLowerCase()
    .replace(/[^a-z0-9_]/g, '').slice(0, 32);
  if (slug.length < 2) throw new Error('slug must be 2+ chars a-z0-9_');
  const kind = data.kind === 'rewarded_ad' ? 'rewarded_ad' : 'standard';
  const minigame = String(data.minigame || 'hold').slice(0, 16);
  const r = await q(
    `INSERT INTO trial_defs (slug, name, glyph, hint, reward_ember, reward_loyalty,
                             cooldown_hours, max_per_window, window_hours, window_start_utc,
                             active, sort_order, kind, minigame)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [slug,
     String(data.name || '').slice(0, 40) || slug,
     String(data.glyph || '🔥').slice(0, 8),
     String(data.hint || '').slice(0, 120),
     Math.max(0, Math.floor(Number(data.reward_ember) || 0)),
     Math.max(0, Math.floor(Number(data.reward_loyalty) || 0)),
     Math.max(0, Math.floor(Number(data.cooldown_hours) || 20)),
     Math.max(1, Math.floor(Number(data.max_per_window) || 1)),
     Math.max(0, Math.floor(Number(data.window_hours) || 0)),
     Math.max(0, Math.min(23, Math.floor(Number(data.window_start_utc) || 0))),
     data.active !== false,
     Math.floor(Number(data.sort_order) || 100),
     kind, minigame]
  );
  await audit(adminId, 'trialCreate', slug + ' [' + kind + ']');
  return r.rows[0];
}
export async function trialUpdate(adminId, id, data){
  const cur = (await q('SELECT * FROM trial_defs WHERE id=$1', [id])).rows[0];
  if (!cur) throw new Error('no such trial');
  const merged = { ...cur, ...data };
  const kind = merged.kind === 'rewarded_ad' ? 'rewarded_ad' : 'standard';
  const r = await q(
    `UPDATE trial_defs SET name=$1, glyph=$2, hint=$3, reward_ember=$4, reward_loyalty=$5,
        cooldown_hours=$6, max_per_window=$7, window_hours=$8, window_start_utc=$9,
        active=$10, sort_order=$11, kind=$12, minigame=$13
      WHERE id=$14 RETURNING *`,
    [String(merged.name || '').slice(0, 40),
     String(merged.glyph || '🔥').slice(0, 8),
     String(merged.hint || '').slice(0, 120),
     Math.max(0, Math.floor(Number(merged.reward_ember) || 0)),
     Math.max(0, Math.floor(Number(merged.reward_loyalty) || 0)),
     Math.max(0, Math.floor(Number(merged.cooldown_hours) || 0)),
     Math.max(1, Math.floor(Number(merged.max_per_window) || 1)),
     Math.max(0, Math.floor(Number(merged.window_hours) || 0)),
     Math.max(0, Math.min(23, Math.floor(Number(merged.window_start_utc) || 0))),
     !!merged.active,
     Math.floor(Number(merged.sort_order) || 100),
     kind,
     String(merged.minigame || 'hold').slice(0, 16),
     id]
  );
  await audit(adminId, 'trialUpdate', `trial ${id} [${kind}]`);
  return r.rows[0];
}
export async function trialDelete(adminId, id){
  const r = await q('DELETE FROM trial_defs WHERE id=$1 RETURNING slug', [id]);
  if (!r.rowCount) throw new Error('no such trial');
  await audit(adminId, 'trialDelete', r.rows[0].slug);
  return { id, deleted:true };
}
export async function setTrialMinigame(adminId, slug, minigame){
  const allowed = ['hold','stoke','feed','cry','sift','ad'];
  if (!allowed.includes(minigame))
    throw new Error('bad minigame: ' + allowed.join(', '));
  const r = await q(
    `UPDATE trial_defs SET minigame=$1 WHERE slug=$2 RETURNING slug, name, minigame`,
    [minigame, String(slug || '').slice(0, 32)]
  );
  if (!r.rowCount) throw new Error('no such trial');
  await audit(adminId, 'setTrialMinigame', `${r.rows[0].slug} → ${minigame}`);
  return r.rows[0];
}
export async function trialResetAll(adminId){
  const r = await resetAllTrials();
  await audit(adminId, 'trialResetAll', r.reset_at);
  return r;
}

/* ---------- bonfire ---------- */
export async function bonfireList(){
  return (await q(
    `SELECT id, title, metric, multiplier, start_at, end_at, created_by, created_at
       FROM bonfire_events ORDER BY start_at DESC LIMIT 30`
  )).rows;
}
export async function bonfireCreate(adminId, data){
  const title = String(data.title || '').slice(0, 60) || 'Bonfire';
  const metric = String(data.metric || 'ember');
  if (!['ember','loyalty','ash','checkin','war'].includes(metric))
    throw new Error('bad metric');
  const mult = Math.max(1, Math.min(10, Number(data.multiplier) || 2));
  const start = data.start_at ? new Date(data.start_at) : new Date();
  const end   = data.end_at   ? new Date(data.end_at)   : new Date(Date.now() + 2*3600*1000);
  if (end <= start) throw new Error('end must be after start');

  await q(`UPDATE bonfire_events SET end_at = LEAST(end_at, $1) WHERE end_at > $1`, [start]);

  const r = await q(
    `INSERT INTO bonfire_events (title, metric, multiplier, start_at, end_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [title, metric, mult, start, end, adminId]
  );
  await audit(adminId, 'bonfireCreate', `${title} (${metric} x${mult})`);

  const ids = (await q('SELECT id FROM users WHERE banned=false')).rows;
  for (const row of ids)
    await pushEnqueue(row.id, `🔥 ${title} — ${metric} ×${mult} until ${end.toUTCString().slice(0,16)}`);

  return r.rows[0];
}
export async function bonfireEnd(adminId, id){
  const r = await q(`UPDATE bonfire_events SET end_at = now() WHERE id=$1 RETURNING id`, [id]);
  if (!r.rowCount) throw new Error('no such bonfire');
  await audit(adminId, 'bonfireEnd', String(id));
  return { id, ended:true };
}

/* ---------- names ---------- */
export async function namesList(){
  return (await q(
    `SELECT n.id, n.name, n.is_seed, n.claimed_by_tribe_id, t.name AS claimed_by_name
       FROM tribe_names n LEFT JOIN tribes t ON t.id = n.claimed_by_tribe_id
       ORDER BY n.claimed_by_tribe_id IS NULL DESC, n.name`
  )).rows;
}
export async function nameAdd(adminId, name){
  const clean = String(name || '').trim().slice(0, 32);
  if (clean.length < 3) throw new Error('name too short');
  const r = await q(
    `INSERT INTO tribe_names (name, is_seed) VALUES ($1, false)
     ON CONFLICT DO NOTHING RETURNING id, name`, [clean]
  );
  if (!r.rowCount) throw new Error('name already in pool');
  await audit(adminId, 'nameAdd', clean);
  return r.rows[0];
}
export async function nameDelete(adminId, id){
  const r = await q(
    `DELETE FROM tribe_names WHERE id=$1 AND claimed_by_tribe_id IS NULL RETURNING name`, [id]
  );
  if (!r.rowCount) throw new Error('not found or already claimed');
  await audit(adminId, 'nameDelete', r.rows[0].name);
  return { id, deleted:true };
}

/* ---------- codes ---------- */
export async function codeList(){
  return (await q(
    `SELECT c.*, (SELECT count(*)::int FROM code_redemptions r WHERE r.code=c.code) redeemed
       FROM codes c ORDER BY c.created_at DESC LIMIT 100`
  )).rows;
}
export async function codeCreate(adminId, code, kind, amount, maxUses, note, expiresDays){
  code = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (code.length < 3) throw new Error('code must be at least 3 characters (A-Z 0-9 _ -)');
  if (!['ember','loyalty'].includes(kind)) throw new Error('kind must be ember or loyalty');
  const amt = Math.floor(n(amount));
  if (amt <= 0) throw new Error('amount must be positive');
  const mu = Math.max(0, Math.floor(n(maxUses)));
  const exp = n(expiresDays) > 0
    ? `now() + interval '${Math.floor(n(expiresDays))} days'`
    : 'NULL';
  const r = await q(
    `INSERT INTO codes(code,kind,amount,max_uses,note,created_by,expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,${exp})
     ON CONFLICT (code) DO UPDATE
       SET kind=EXCLUDED.kind, amount=EXCLUDED.amount, max_uses=EXCLUDED.max_uses,
           note=EXCLUDED.note, expires_at=EXCLUDED.expires_at
     RETURNING *`,
    [code, kind, amt, mu, note || '', adminId || null]
  );
  await audit(adminId, 'codeCreate', `${code}: ${amt} ${kind}${mu ? (' x' + mu) : ''}`);
  return r.rows[0];
}
export async function codeUpdate(adminId, code, patch){
  code = String(code || '').toUpperCase();
  patch = patch || {};
  const allowed = ['amount','max_uses','note','kind'];
  const sets = [];
  const params = [code];
  let i = 2;
  // validate kind if present
  if ('kind' in patch && !['ember','loyalty'].includes(patch.kind))
    throw new Error('kind must be ember or loyalty');
  if ('amount' in patch){
    patch.amount = Math.floor(n(patch.amount));
    if (patch.amount <= 0) throw new Error('amount must be positive');
  }
  if ('max_uses' in patch) patch.max_uses = Math.max(0, Math.floor(n(patch.max_uses)));
  for (const k of allowed){
    if (k in patch){
      sets.push(`${k} = $${i++}`);
      params.push(patch[k]);
    }
  }
  // relative expiry: expiresDays > 0 sets a new expiry, === 0 clears it, absent leaves it
  if ('expiresDays' in patch){
    const d = Math.floor(n(patch.expiresDays));
    sets.push(d > 0 ? `expires_at = now() + interval '${d} days'` : 'expires_at = NULL');
  }
  if (!sets.length) throw new Error('nothing to update');
  const r = await q(
    `UPDATE codes SET ${sets.join(', ')} WHERE code=$1 RETURNING *`, params
  );
  if (!r.rowCount) throw new Error('no such code');
  await audit(adminId, 'codeUpdate', `${code} updated`);
  return r.rows[0];
}
export async function codeDelete(adminId, code){
  const r = await q(
    'DELETE FROM codes WHERE code=$1 RETURNING code',
    [String(code || '').toUpperCase()]
  );
  if (!r.rowCount) throw new Error('no such code');
  await audit(adminId, 'codeDelete', r.rows[0].code);
  return { code:r.rows[0].code, deleted:true };
}

/* ---------- seasons ---------- */
export async function seasonsList(){
  return (await q(`SELECT * FROM seasons ORDER BY n DESC LIMIT 20`)).rows;
}
export async function seasonStartNew(adminId){
  const last = await currentSeason();
  if (last) throw new Error('a season is already active');
  const nn = ((await q('SELECT COALESCE(MAX(n),0)::int AS n FROM seasons')).rows[0].n || 0) + 1;
  const s = await startSeason(nn);
  await audit(adminId, 'seasonStart', `n=${nn}`);
  return s;
}
export async function seasonEndNow(adminId){
  const r = await endSeason();
  if (!r) throw new Error('no active season');
  await audit(adminId, 'seasonEnd', `n=${r.season.n}`);
  return r;
}

/* ---------- X quests ---------- */
export async function xQuestsList(){
  const quests = (await q(
    `SELECT q.*,
            (SELECT count(*)::int FROM x_claims c WHERE c.quest_id=q.id AND c.status='pending') AS pending,
            (SELECT count(*)::int FROM x_claims c WHERE c.quest_id=q.id AND c.status='approved') AS approved
       FROM x_quests q ORDER BY q.sort_order, q.id`
  )).rows;
  return quests;
}
export async function xQuestCreate(adminId, data){
  const slug = String(data.slug || '').trim().toLowerCase()
    .replace(/[^a-z0-9_]/g, '').slice(0, 40);
  if (slug.length < 2) throw new Error('slug must be 2+ chars');
  const r = await q(
    `INSERT INTO x_quests (slug, title, description, icon, kind, target, target_label,
                           reward_ember, per_user_limit, max_completions, active, sort_order,
                           starts_at, ends_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [slug,
     String(data.title || slug).slice(0, 80),
     String(data.description || '').slice(0, 240),
     String(data.icon || 'brand-x').slice(0, 32),
     String(data.kind || 'follow').slice(0, 16),
     String(data.target || '').slice(0, 120),
     String(data.target_label || '').slice(0, 80),
     Math.max(0, Math.floor(Number(data.reward_ember) || 0)),
     Math.max(1, Math.floor(Number(data.per_user_limit) || 1)),
     Math.max(0, Math.floor(Number(data.max_completions) || 0)),
     data.active !== false,
     Math.floor(Number(data.sort_order) || 100),
     data.starts_at || null,
     data.ends_at || null,
     adminId]
  );
  await audit(adminId, 'xQuestCreate', slug);
  return r.rows[0];
}
export async function xQuestUpdate(adminId, id, data){
  const cur = (await q('SELECT * FROM x_quests WHERE id=$1', [id])).rows[0];
  if (!cur) throw new Error('no such quest');
  const m = { ...cur, ...data };
  const r = await q(
    `UPDATE x_quests SET title=$1, description=$2, icon=$3, kind=$4, target=$5, target_label=$6,
                         reward_ember=$7, per_user_limit=$8, max_completions=$9, active=$10,
                         sort_order=$11, starts_at=$12, ends_at=$13
     WHERE id=$14 RETURNING *`,
    [String(m.title).slice(0, 80),
     String(m.description || '').slice(0, 240),
     String(m.icon || 'brand-x').slice(0, 32),
     String(m.kind).slice(0, 16),
     String(m.target || '').slice(0, 120),
     String(m.target_label || '').slice(0, 80),
     Math.max(0, Math.floor(Number(m.reward_ember) || 0)),
     Math.max(1, Math.floor(Number(m.per_user_limit) || 1)),
     Math.max(0, Math.floor(Number(m.max_completions) || 0)),
     !!m.active,
     Math.floor(Number(m.sort_order) || 100),
     m.starts_at || null,
     m.ends_at || null,
     id]
  );
  await audit(adminId, 'xQuestUpdate', `quest ${id}`);
  return r.rows[0];
}
export async function xQuestDelete(adminId, id){
  const r = await q('DELETE FROM x_quests WHERE id=$1 RETURNING slug', [id]);
  if (!r.rowCount) throw new Error('no such quest');
  await audit(adminId, 'xQuestDelete', r.rows[0].slug);
  return { id, deleted:true };
}
export async function xQuestToggle(adminId, id, active){
  const r = await q(
    'UPDATE x_quests SET active=$1 WHERE id=$2 RETURNING id, active',
    [!!active, id]
  );
  if (!r.rowCount) throw new Error('no such quest');
  await audit(adminId, 'xQuestToggle', `quest ${id} → ${active}`);
  return r.rows[0];
}
export async function xClaimsList({ status = 'pending', q: query = '', limit = 60 } = {}){
  const like = '%' + query + '%';
  return (await q(
    `SELECT c.id, c.user_id, c.quest_id, c.x_handle, c.note, c.status,
            c.reviewed_by, c.reviewed_at, c.reject_reason, c.reward_paid, c.created_at,
            u.username, u.first_name, u.ember,
            q.slug AS quest_slug, q.title AS quest_title, q.icon AS quest_icon,
            q.kind AS quest_kind, q.target AS quest_target, q.target_label AS quest_target_label,
            q.reward_ember AS quest_reward_ember,
            (SELECT user_id FROM x_handle_owners WHERE x_handle = lower(c.x_handle)) AS handle_owner_user
       FROM x_claims c
       JOIN users u ON u.id = c.user_id
       JOIN x_quests q ON q.id = c.quest_id
      WHERE ($1 = 'all' OR c.status = $1)
        AND ($2 = '%%' OR c.x_handle ILIKE $2 OR u.username ILIKE $2 OR u.first_name ILIKE $2)
      ORDER BY c.created_at DESC LIMIT $3`,
    [status, like, Math.min(limit, 200)]
  )).rows;
}
export async function xClaimApprove(adminId, id){
  const c = (await q(
    `SELECT c.*, q.reward_ember, q.per_user_limit, q.max_completions
       FROM x_claims c JOIN x_quests q ON q.id = c.quest_id
      WHERE c.id=$1`, [id]
  )).rows[0];
  if (!c) throw new Error('no such claim');
  if (c.status !== 'pending') throw new Error('already reviewed');
  if (String(c.user_id) === String(adminId)) throw new Error('cannot review your own claim');

  const handle = String(c.x_handle || '').replace(/^@/, '').toLowerCase();
  const owner = (await q(
    'SELECT user_id FROM x_handle_owners WHERE x_handle=$1', [handle]
  )).rows[0];
  if (owner && Number(owner.user_id) !== Number(c.user_id))
    throw new Error('that X handle is already linked to another account');

  // claim the handle + credit rewards
  await q(
    `INSERT INTO x_handle_owners (x_handle, user_id) VALUES ($1,$2)
     ON CONFLICT (x_handle) DO NOTHING`,
    [handle, c.user_id]
  );
  await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [c.reward_ember, c.user_id]);
  await q(
    `UPDATE x_claims
        SET status='approved', reviewed_by=$1, reviewed_at=now(),
            reward_paid=$2
      WHERE id=$3`,
    [adminId, JSON.stringify({ ember: c.reward_ember }), id]
  );

  feedWrite({
    type: 'x',
    icon: 'status-approved',
    severity: 'success',
    text: `Approved @${handle} — ${c.quest_title}`,
    detail: { claimId: id, questId: c.quest_id, userId: c.user_id, reward: c.reward_ember },
    actor: adminId,
  });
  await audit(adminId, 'xClaimApprove', `claim ${id} → @${handle}`);
  return { ok:true, id, reward_ember: c.reward_ember };
}
export async function xClaimReject(adminId, id, reason){
  const c = (await q('SELECT * FROM x_claims WHERE id=$1', [id])).rows[0];
  if (!c) throw new Error('no such claim');
  if (c.status !== 'pending') throw new Error('already reviewed');
  const why = String(reason || '').trim();
  if (!why) throw new Error('reason is required');
  await q(
    `UPDATE x_claims
        SET status='rejected', reviewed_by=$1, reviewed_at=now(), reject_reason=$2
      WHERE id=$3`,
    [adminId, why.slice(0, 200), id]
  );
  feedWrite({
    type: 'x',
    icon: 'status-rejected',
    severity: 'warn',
    text: `Rejected @${c.x_handle}: ${why}`,
    detail: { claimId: id, reason: why },
    actor: adminId,
  });
  await audit(adminId, 'xClaimReject', `claim ${id}: ${why}`);
  return { ok:true, id, reason: why };
}
export async function xClaimsBulkApprove(adminId, ids){
  const out = { ok:0, fail:0 };
  for (const id of ids){
    try { await xClaimApprove(adminId, id); out.ok++; }
    catch(e){ out.fail++; }
  }
  return out;
}
export async function xStats(){
  const s = (await q(
    `SELECT
       (SELECT count(*)::int FROM x_quests WHERE active=true) AS active_quests,
       (SELECT count(*)::int FROM x_claims WHERE status='pending') AS pending,
       (SELECT count(*)::int FROM x_claims WHERE status='approved') AS approved,
       (SELECT count(*)::int FROM x_claims WHERE status='rejected') AS rejected,
       (SELECT count(*)::int FROM x_handle_owners) AS linked_handles`
  )).rows[0];
  const per = (await q(
    `SELECT q.slug, q.title, count(c.id) filter (where c.status='approved')::int AS approved,
            count(c.id) filter (where c.status='pending')::int AS pending
       FROM x_quests q LEFT JOIN x_claims c ON c.quest_id=q.id
       GROUP BY q.id, q.slug, q.title ORDER BY q.sort_order`
  )).rows;
  return { ...s, perQuest: per };
}

/* ---------- spin admin ---------- */
export async function spinConfigGet(){
  const cfg = (await q('SELECT * FROM spin_config WHERE id=1')).rows[0];
  const rewards = (await q(
    'SELECT * FROM spin_rewards ORDER BY slot_index'
  )).rows;
  return { config: cfg, rewards };
}
export async function spinConfigUpdate(adminId, patch){
  const cur = (await q('SELECT * FROM spin_config WHERE id=1')).rows[0];
  const m = { ...cur, ...patch };
  await q(
    `UPDATE spin_config
        SET cooldown_hours=$1, free_spins_per_day=$2, max_paid_per_day=$3,
            stars_per_spin=$4, updated_at=now()
      WHERE id=1`,
    [Math.max(1, Math.floor(Number(m.cooldown_hours) || 24)),
     Math.max(0, Math.floor(Number(m.free_spins_per_day) || 1)),
     Math.max(0, Math.floor(Number(m.max_paid_per_day) || 3)),
     Math.max(1, Math.floor(Number(m.stars_per_spin) || 25))]
  );
  await audit(adminId, 'spinConfigUpdate', JSON.stringify(patch));
  return spinConfigGet();
}
export async function spinRewardsReplace(adminId, rewards){
  if (!Array.isArray(rewards)) throw new Error('rewards must be array');
  // clear and reinsert
  await q('DELETE FROM spin_rewards');
  for (let i = 0; i < rewards.length; i++){
    const r = rewards[i];
    await q(
      `INSERT INTO spin_rewards (slot_index, kind, amount, weight, icon, label, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [i,
       String(r.kind || 'ember').slice(0, 16),
       Math.max(0, Math.floor(Number(r.amount) || 0)),
       Math.max(1, Math.floor(Number(r.weight) || 100)),
       r.icon ? String(r.icon).slice(0, 32) : null,
       r.label ? String(r.label).slice(0, 24) : null,
       r.active !== false]
    );
  }
  await audit(adminId, 'spinRewardsReplace', `${rewards.length} slots`);
  return spinConfigGet();
}

/* ---------- feed reader ---------- */
export async function feedRecent({ since = 0, limit = 60, type = null } = {}){
  if (since > 0){
    return feedRead({ since, limit, type });
  }
  return feedLatest(limit);
}

/* ================= TELEGRAM ADMIN BOT ================= */
const HELP = [
  '<b>🔥 TRIBES — Admin Console</b>',
  '',
  '/stats — overview',
  '/resetprogress   ·   /factoryreset',
  '/find &lt;name|id&gt;   ·   /player &lt;id&gt;',
  '/grant &lt;id&gt; &lt;ember|loyalty&gt; &lt;amount&gt;',
  '/setrole &lt;id&gt; &lt;role&gt;   ·   /setloyalty &lt;id&gt; &lt;value&gt;',
  '/ban &lt;id&gt; [reason]   ·   /unban &lt;id&gt;   ·   /deluser &lt;id&gt;',
  '',
  '/tribes [n]   ·   /tribe &lt;id&gt;   ·   /rename &lt;id&gt; &lt;name&gt;',
  '/treasury &lt;id&gt; &lt;value&gt;   ·   /disband &lt;id&gt;',
  '',
  '/wars   ·   /startwar &lt;a&gt; &lt;b&gt;   ·   /resolvewar &lt;id&gt;   ·   /cancelwar &lt;id&gt;',
  '',
  '/payments [n]   ·   /refund &lt;chargeId&gt;',
  '',
  '/econ   ·   /set &lt;key&gt; &lt;value&gt;   ·   /econreset',
  '/maintenance &lt;on|off&gt;   ·   /wipeseason   ·   /broadcast &lt;message&gt;',
  '',
  '/codes   ·   /addcode &lt;CODE&gt; &lt;ember|loyalty&gt; &lt;amount&gt; [maxUses] [days]   ·   /delcode &lt;CODE&gt;',
  '/seasonstart   ·   /seasonend',
].join('\n');

const CMD_LIST = [
  {command:'stats',description:'Global overview'},
  {command:'find',description:'Find players'},
  {command:'resetprogress',description:'Wipe progression (keep accounts)'},
  {command:'factoryreset',description:'Wipe everything (keep accounts)'},
  {command:'player',description:'Player detail'},
  {command:'grant',description:'Grant ember/loyalty'},
  {command:'setrole',description:'Set a player role'},
  {command:'setloyalty',description:'Set loyalty'},
  {command:'ban',description:'Ban a player'},
  {command:'unban',description:'Unban'},
  {command:'tribes',description:'Top tribes'},
  {command:'tribe',description:'Tribe detail'},
  {command:'rename',description:'Rename a tribe'},
  {command:'treasury',description:'Set tribe treasury'},
  {command:'disband',description:'Disband a tribe'},
  {command:'wars',description:'Active wars'},
  {command:'startwar',description:'Force a war'},
  {command:'resolvewar',description:'Resolve a war'},
  {command:'cancelwar',description:'Cancel a war'},
  {command:'payments',description:'Recent payments'},
  {command:'refund',description:'Refund a payment'},
  {command:'econ',description:'Show economy'},
  {command:'set',description:'Set a config key'},
  {command:'maintenance',description:'Toggle maintenance'},
  {command:'wipeseason',description:'Reset loyalty & wars'},
  {command:'broadcast',description:'Message all'},
  {command:'codes',description:'List gift codes'},
  {command:'addcode',description:'Create a code'},
  {command:'delcode',description:'Delete a code'},
  {command:'seasonstart',description:'Start a season'},
  {command:'seasonend',description:'End current season'},
  {command:'help',description:'Command list'},
];

const pendingResets = new Map();

function setPending(adminId, kind){
  const t = setTimeout(() => pendingResets.delete(String(adminId)), 60000);
  pendingResets.set(String(adminId), { kind, timer: t, startedAt: Date.now() });
}
function clearPending(adminId){
  const p = pendingResets.get(String(adminId));
  if (p){ clearTimeout(p.timer); pendingResets.delete(String(adminId)); }
}

async function runCommand(adminId, cmd, a){
  switch(cmd){
    case 'reset': {
      const p = pendingResets.get(String(adminId));
      if (!p || p.kind !== 'progression') return 'Nothing to reset. Send /resetprogress to start.';
      clearPending(adminId);
      await resetProgression(adminId);
      broadcastAdmin({ type:'reset', kind:'progression', at: Date.now() });
      return `✅ <b>Progression reset complete.</b>\nRun /stats to verify.`;
    }
    case 'factory': {
      const p = pendingResets.get(String(adminId));
      if (!p || p.kind !== 'factory') return 'Nothing to reset. Send /factoryreset to start.';
      clearPending(adminId);
      await factoryReset(adminId);
      broadcastAdmin({ type:'reset', kind:'factory', at: Date.now() });
      return `✅ <b>FACTORY RESET complete.</b>`;
    }
    case 'cancel': {
      clearPending(adminId);
      return 'Cancelled.';
    }
    case 'start': case 'help': return HELP;
    case 'stats': {
      const s = await stats();
      return `<b>📊 Overview</b>\nPlayers: <b>${fmt(s.users.n)}</b> (banned ${s.users.banned})\nEmber: <b>${fmt(s.users.ember)}</b>\nTribes: <b>${fmt(s.tribes.n)}</b> · Pyre ${fmt(s.tribes.pyre)}\nWars: <b>${s.wars.active}</b> active / ${s.wars.total}\nStar tx: ${s.payments.starTx || 0} (${fmt(s.payments.stars)}⭐)\nMaintenance: <b>${s.maintenance?'ON':'off'}</b>`;
    }
    case 'find': {
      const rows = await findPlayers(a.join(' '));
      if (!rows.length) return 'No players found.';
      return rows.map(r => `#${r.id} <b>${r.first_name||''}</b> @${r.username||'?'} — ${r.role} · ${fmt(r.ember)}E ${fmt(r.loyalty)}❤${r.banned?' ⛔':''}`).join('\n');
    }
    case 'player': {
      const p = await playerDetail(a[0]);
      if (!p) return 'No such player.';
      return `<b>#${p.id} ${p.first_name||''}</b> @${p.username||'?'}\nRole: ${p.role}\nEmber: ${fmt(p.ember)} · Loyalty: ${fmt(p.loyalty)}\nStreak: ${p.streak} · Tribe: ${p.tribe_name||'—'}`;
    }
    case 'grant': {
      const r = await grant(adminId, a[0], a[1], a[2]);
      return `✅ user ${r.id} now has ${fmt(r[a[1]])} ${a[1]}`;
    }
    case 'setrole': {
      const r = await setRole(adminId, a[0], a[1]);
      return `✅ user ${r.id} role = ${r.role}`;
    }
    case 'setloyalty': {
      const r = await setLoyalty(adminId, a[0], a[1]);
      return `✅ user ${r.id} loyalty = ${fmt(r.loyalty)}`;
    }
    case 'ban': { await ban(adminId, a[0], a.slice(1).join(' ')); return `⛔ user ${a[0]} banned`; }
    case 'unban': { await unban(adminId, a[0]); return `✅ user ${a[0]} unbanned`; }
    case 'deluser': { await delUser(adminId, a[0]); return `🗑 user ${a[0]} deleted`; }
    case 'tribes': {
      const rows = await tribesTop(n(a[0]) || 15);
      if (!rows.length) return 'No tribes yet.';
      return rows.map((t, i) => `${i+1}. #${t.id} <b>${t.name}</b> — ${fmt(t.members)} kin · ${fmt(t.loyalty_total)}❤ · Pyre ${fmt(t.treasury)} · 🏆${t.wins}/${t.losses}`).join('\n');
    }
    case 'tribe': {
      const t = await tribeDetail(a[0]);
      if (!t) return 'No such tribe.';
      return `<b>#${t.id} ${t.name}</b>\nLevel: ${t.level||1}\nKin: ${fmt(t.members)} · Loyalty: ${fmt(t.loyalty_total)} · Pyre: ${fmt(t.treasury)}\nRecord: ${t.wins}W / ${t.losses}L`;
    }
    case 'rename': {
      const r = await renameTribe(adminId, a[0], a.slice(1).join(' '));
      return `✅ tribe ${r.id} → ${r.name}`;
    }
    case 'treasury': {
      const r = await setTreasury(adminId, a[0], a[1]);
      return `✅ tribe ${r.id} Pyre = ${fmt(r.treasury)}`;
    }
    case 'disband': { await disband(adminId, a[0]); return `💥 tribe ${a[0]} disbanded`; }
    case 'wars': {
      const rows = await warsActive();
      if (!rows.length) return 'No active wars.';
      return rows.map(w => `⚔ war #${w.id}: <b>${w.a_name}</b> vs <b>${w.d_name}</b> · ${w.challenge_id} · stance ${w.stance||'-'}`).join('\n');
    }
    case 'startwar': {
      const w = await startWar(adminId, a[0], a[1]);
      return `⚔ war #${w.id} started`;
    }
    case 'resolvewar': {
      const w = await resolveWar(adminId, a[0]);
      return `✅ war #${w.id} resolved. winner: ${w.winner_id||'draw'}`;
    }
    case 'cancelwar': { await cancelWar(adminId, a[0]); return `🚫 war ${a[0]} cancelled`; }
    case 'payments': {
      const rows = await paymentsRecent(n(a[0]) || 15);
      if (!rows.length) return 'No payments.';
      return rows.map(p => `${p.kind} ${fmt(p.amount)}${p.currency==='XTR'?'⭐':''} · user ${p.user_id} · ${p.status}`).join('\n');
    }
    case 'refund': {
      const r = await refund(adminId, a[0]);
      return r.already ? `already refunded` : `✅ refunded ${r.kind} ${fmt(r.amount)}`;
    }
    case 'econ': {
      const c = econGet();
      return '<b>⚙️ Economy</b>\n' + Object.keys(DEFAULTS).slice(0, 30).map(k => `${k} = <b>${c[k]}</b>`).join('\n') + '\n(...)';
    }
    case 'set': {
      const r = await econSet(adminId, a[0], a[1]);
      return `✅ ${r.key} = ${r.value}`;
    }
    case 'econreset': { await econReset(adminId); return '✅ economy reset'; }
    case 'maintenance': {
      const on = /^(on|1|true|yes)$/i.test(a[0]||'');
      await setMaintenance(adminId, on);
      return `🔧 maintenance ${on?'ON':'off'}`;
    }
    case 'wipeseason': { await wipeSeason(adminId); return '🌀 season wiped'; }
    case 'broadcast': {
      const text = a.join(' ');
      if (!text) return 'Usage: /broadcast message';
      const r = await broadcast(adminId, text);
      return `📣 sent to ${r.sent}`;
    }
    case 'codes': {
      const rows = await codeList();
      if (!rows.length) return 'No codes yet.';
      return rows.map(c => `<code>${c.code}</code> → ${fmt(c.amount)} ${c.kind} · used ${c.uses}`).join('\n');
    }
    case 'addcode': {
      const c = await codeCreate(adminId, a[0], a[1], a[2], a[3], '', a[4]);
      return `✅ code <code>${c.code}</code>`;
    }
    case 'delcode': {
      await codeDelete(adminId, a[0]);
      return `🗑 code ${String(a[0]||'').toUpperCase()} deleted`;
    }
    case 'seasonstart': { const s = await seasonStartNew(adminId); return `✅ season ${s.n} started`; }
    case 'seasonend': { const r = await seasonEndNow(adminId); return `✅ season ${r.season.n} ended · ${r.titled} titles awarded`; }
    case 'resetprogress': {
      const p = await previewReset();
      setPending(adminId, 'progression');
      return `⚠️ <b>Progression reset requested</b>\n\nThis will affect:\n` +
        `• ${p.usersWithProgress} users with progress\n` +
        `• ${p.tribes} tribes\n` +
        `• ${p.activeWars} active wars\n\n` +
        `To confirm, send <code>RESET</code> within 60 seconds.\n` +
        `Send <code>CANCEL</code> to abort.`;
    }
    case 'factoryreset': {
      const p = await previewReset();
      setPending(adminId, 'factory');
      return `🛑 <b>FACTORY RESET requested</b>\n\nThis will DELETE:\n` +
        `• All ${p.tribes} tribes\n` +
        `• All ${p.totalWars} wars\n` +
        `• All ${p.kivaMessages} Kiva messages\n` +
        `• All ${p.payments} payment records\n\n` +
        `To confirm, send <code>FACTORY</code> within 60 seconds.\n` +
        `Send <code>CANCEL</code> to abort.`;
    }
    default: return 'Unknown command. Send /help.';
  }
}

export async function adminBotWebhook(update){
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return;
  const from = msg.from && msg.from.id, chat = msg.chat && msg.chat.id;
  if (!isAdmin(from)){ await botSend(ADMIN_BOT_TOKEN, chat, '⛔ Unauthorized.'); return; }
  const parts = msg.text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase().replace(/^\//, '').split('@')[0];
  try { await botSend(ADMIN_BOT_TOKEN, chat, await runCommand(from, cmd, parts.slice(1))); }
  catch(e){ await botSend(ADMIN_BOT_TOKEN, chat, '⚠️ ' + e.message); }
}

export async function setupAdminBot(baseUrl){
  if (!ADMIN_BOT_TOKEN){ console.log('[admin] ADMIN_BOT_TOKEN not set — admin bot disabled'); return; }
  if (!baseUrl){ console.log('[admin] no base url'); return; }
  try {
    await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/setWebhook`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        url: baseUrl.replace(/\/$/, '') + '/api/admin/webhook',
        allowed_updates:['message'],
      }),
    });
    await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/setMyCommands`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ commands: CMD_LIST }),
    });
    console.log('[admin] admin bot webhook + commands set');
  } catch(e){ console.error('[admin] setup', e.message); }
}

/* ---------- middleware ---------- */
/* ---------- avatars ---------- */
// Strip anything active/executable from uploaded SVG before we store or
// ever render it (XSS defence). Hex escapes (\x3c = '<', \x3e = '>') keep
// this source safe from tooling that mangles angle brackets.
function sanitizeSvg(raw){
  let s = String(raw || '').trim();
  if (!/\x3csvg[\s\x3e]/i.test(s)) throw new Error('not a valid SVG');
  // remove <script>...</script> blocks and any stray script tags
  s = s.replace(/\x3cscript[\s\S]*?\x3c\/script\x3e/gi, '');
  s = s.replace(/\x3cscript[^\x3e]*\/?\x3e/gi, '');
  // foreignObject can smuggle HTML/JS — drop it entirely
  s = s.replace(/\x3cforeignObject[\s\S]*?\x3c\/foreignObject\x3e/gi, '');
  // inline event handlers  on...="..." / on...='...'
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  // neutralise javascript: URIs
  s = s.replace(/javascript:/gi, '');
  s = s.trim();
  if (!s) throw new Error('SVG empty after sanitising');
  if (s.length > 200000) throw new Error('SVG too large (max ~200KB)');
  return s;
}

export async function avatarsList(){
  return (await q(
    `SELECT id, slug, name, svg, active, sort_order
       FROM avatars ORDER BY sort_order ASC, id ASC`
  )).rows;
}
export async function avatarCreate(adminId, { slug, name, svg } = {}){
  const clean = sanitizeSvg(svg);
  let s = String(slug || '').trim().toLowerCase()
    .replace(/[^a-z0-9\-]+/g, '-').replace(/^\-+/, '').replace(/\-+$/, '').slice(0, 48);
  if (!s) s = 'avatar-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000);
  const nm = (String(name || '').trim().slice(0, 48)) || s;
  const r = await q(
    `INSERT INTO avatars (slug, name, svg, active, sort_order)
     VALUES ($1,$2,$3,true,100)
     ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, svg=EXCLUDED.svg
     RETURNING id, slug, name, active, sort_order`,
    [s, nm, clean]
  );
  await audit(adminId, 'avatarCreate', s);
  return r.rows[0];
}
export async function avatarToggle(adminId, id, active){
  const on = /^(1|true|on|yes)$/i.test(String(active));
  const r = await q('UPDATE avatars SET active=$1 WHERE id=$2 RETURNING id, active', [on, id]);
  if (!r.rowCount) throw new Error('avatar not found');
  await audit(adminId, 'avatarToggle', id + ' -> ' + on);
  return r.rows[0];
}
export async function avatarDelete(adminId, id){
  await q('UPDATE users SET avatar_id=NULL WHERE avatar_id=$1', [id]);
  const r = await q('DELETE FROM avatars WHERE id=$1 RETURNING slug', [id]);
  if (!r.rowCount) throw new Error('avatar not found');
  await audit(adminId, 'avatarDelete', r.rows[0].slug);
  return { id, deleted:true };
}

export function requireAdmin(req, res, next){
  const t = req.get('X-Admin-Token') || (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (WEB_TOKEN && t === WEB_TOKEN){ req.adminId = 'web'; return next(); }
  const tgUser = verifyInitData(req.get('X-Init-Data') || (req.body && req.body.initData) || '');
  if (tgUser && isAdmin(tgUser.id)){ req.adminId = String(tgUser.id); return next(); }
  if (!WEB_TOKEN && !ADMIN_IDS.size) return res.status(503).json({ error:'admin disabled' });
  return res.status(401).json({ error:'bad admin token' });
}

export const adminRouter = express.Router();
const A = adminRouter;
const who = req => req.adminId || 'web';
const wrap = fn => async (req, res) => {
  try { res.json({ ok:true, data: await fn(req) }); }
  catch(e){ res.status(400).json({ ok:false, error: e.message }); }
};

A.use(requireAdmin);

/* stats & players */
A.get('/stats', wrap(() => stats()));
A.get('/players', wrap(req => findPlayers(req.query.q || '')));
A.get('/player/:id', wrap(req => playerDetail(req.params.id)));
A.post('/grant', wrap(req => grant(who(req), req.body.id, req.body.kind, req.body.amount)));
A.post('/role', wrap(req => setRole(who(req), req.body.id, req.body.role)));
A.post('/loyalty', wrap(req => setLoyalty(who(req), req.body.id, req.body.value)));
A.post('/ban', wrap(req => ban(who(req), req.body.id, req.body.reason)));
A.post('/unban', wrap(req => unban(who(req), req.body.id)));
A.post('/deluser', wrap(req => delUser(who(req), req.body.id)));

/* tribes */
A.get('/tribes', wrap(() => tribesTop(50)));
A.get('/tribe/:id', wrap(req => tribeDetail(req.params.id)));
A.post('/tribe/rename', wrap(req => renameTribe(who(req), req.body.id, req.body.name)));
A.post('/tribe/treasury', wrap(req => setTreasury(who(req), req.body.id, req.body.value)));
A.post('/tribe/disband', wrap(req => disband(who(req), req.body.id)));

/* wars */
A.get('/wars', wrap(() => warsActive()));
A.post('/war/start', wrap(req => startWar(who(req), req.body.attacker, req.body.defender)));
A.post('/war/resolve', wrap(req => resolveWar(who(req), req.body.id)));
A.post('/war/cancel', wrap(req => cancelWar(who(req), req.body.id)));

/* payments */
A.get('/payments', wrap(() => paymentsRecent(50)));
A.post('/refund', wrap(req => refund(who(req), req.body.chargeId)));

/* economy */
A.get('/econ', wrap(() => econGet()));
A.post('/econ', wrap(req => econSet(who(req), req.body.key, req.body.value)));
A.post('/econ/reset', wrap(() => econReset(who(req))));

/* control */
A.post('/maintenance', wrap(req => setMaintenance(who(req), /^(on|1|true|yes)$/i.test(String(req.body.on)))));
A.post('/wipeseason', wrap(() => wipeSeason(who(req))));
A.post('/broadcast', wrap(req => broadcast(who(req), req.body.text)));

/* codes */
A.get('/codes', wrap(() => codeList()));
A.post('/codes', wrap(req => codeCreate(who(req), req.body.code, req.body.kind, req.body.amount, req.body.maxUses, req.body.note, req.body.expiresDays)));
A.post('/codes/update', wrap(req => codeUpdate(who(req), req.body.code, req.body.patch || {})));
A.post('/codes/delete', wrap(req => codeDelete(who(req), req.body.code)));

/* trials */
A.get('/trials', wrap(() => trialsList()));
A.post('/trials', wrap(req => trialCreate(who(req), req.body)));
A.post('/trials/update', wrap(req => trialUpdate(who(req), req.body.id, req.body)));
A.post('/trials/delete', wrap(req => trialDelete(who(req), req.body.id)));
A.post('/trials/reset', wrap(() => trialResetAll(who(req))));
A.post('/trial/minigame', wrap(req => setTrialMinigame(who(req), req.body.slug, req.body.minigame)));

/* bonfire */
A.get('/bonfires', wrap(() => bonfireList()));
A.post('/bonfires', wrap(req => bonfireCreate(who(req), req.body)));
A.post('/bonfires/end', wrap(req => bonfireEnd(who(req), req.body.id)));

/* names */
A.get('/names', wrap(() => namesList()));
A.post('/names/add', wrap(req => nameAdd(who(req), req.body.name)));
A.post('/names/delete', wrap(req => nameDelete(who(req), req.body.id)));

/* seasons */
A.get('/seasons', wrap(() => seasonsList()));
A.post('/seasons/start', wrap(() => seasonStartNew(who(req))));
A.post('/seasons/end', wrap(() => seasonEndNow(who(req))));

/* X quests */
A.get('/x-quests', wrap(() => xQuestsList()));
A.post('/x-quests', wrap(req => xQuestCreate(who(req), req.body)));
A.post('/x-quests/update', wrap(req => xQuestUpdate(who(req), req.body.id, req.body)));
A.post('/x-quests/delete', wrap(req => xQuestDelete(who(req), req.body.id)));
A.post('/x-quests/toggle', wrap(req => xQuestToggle(who(req), req.body.id, req.body.active)));

A.get('/x-claims', wrap(req => xClaimsList({
  status: req.query.status || 'pending',
  q: req.query.q || '',
  limit: Number(req.query.limit) || 60,
})));
A.post('/x-claims/approve', wrap(req => xClaimApprove(who(req), req.body.id)));
A.post('/x-claims/reject', wrap(req => xClaimReject(who(req), req.body.id, req.body.reason)));
A.post('/x-claims/bulk-approve', wrap(req => xClaimsBulkApprove(who(req), req.body.ids || [])));
A.get('/x-stats', wrap(() => xStats()));

/* spin */
A.get('/spin', wrap(() => spinConfigGet()));
A.post('/spin/config', wrap(req => spinConfigUpdate(who(req), req.body)));
A.post('/spin/rewards', wrap(req => spinRewardsReplace(who(req), req.body.rewards || [])));

/* feed */
A.get('/feed', wrap(req => feedRecent({
  since: Number(req.query.since) || 0,
  limit: Number(req.query.limit) || 60,
  type: req.query.type || null,
})));
A.get('/feed/counts', wrap(() => feedCounts()));

/* avatars */
A.get('/avatars', wrap(() => avatarsList()));
A.post('/avatars', wrap(req => avatarCreate(who(req), req.body)));
A.post('/avatars/toggle', wrap(req => avatarToggle(who(req), req.body.id, req.body.active)));
A.post('/avatars/delete', wrap(req => avatarDelete(who(req), req.body.id)));

/* SSE */
A.get('/stream', (req, res) => adminSse(req, res));

/* resets */
A.post('/reset/preview', wrap(() => previewReset()));
A.post('/reset/backup', wrap(() => backupToJSON(who(req))));
A.post('/reset/progression', wrap(async (req) => {
  const r = await resetProgression(who(req));
  broadcastAdmin({ type:'reset', kind:'progression', at: Date.now() });
  return r;
}));
A.post('/reset/tables', wrap(() => listTables()));
A.post('/reset/factory', wrap(async (req) => {
  const r = await factoryReset(who(req));
  broadcastAdmin({ type:'reset', kind:'factory', at: Date.now() });
  return r;
}));

A.get('/whoami', wrap(req => ({ adminId: who(req) })));
/* =====================================================================
   RELIC admin control plane (appended) — create / modify relics with
   buffs + card art (inline SVG or data-URL image). Mirrors the avatar
   CRUD pattern. All SVG art passes through sanitizeSvg (XSS defence).
===================================================================== */

function relicSlugify(v, fallback){
  let s = String(v || '').trim().toLowerCase()
    .replace(/[^a-z0-9\-]+/g, '-').replace(/^\-+/, '').replace(/\-+$/, '').slice(0, 48);
  if (!s) s = (fallback || 'relic') + '-' + Date.now().toString(36);
  return s;
}

// Accept only a safe data-URL image (png/webp/jpeg/gif) or an in-app asset path.
function sanitizeRelicImageUrl(raw){
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\/assets\/[a-z0-9_\-\/\.]+$/i.test(s)) return s.slice(0, 300);
  const m = /^data:image\/(png|webp|jpeg|jpg|gif);base64,([a-z0-9+\/=\s]+)$/i.exec(s);
  if (!m) throw new Error('image must be a PNG/WEBP/JPEG data URL or an /assets path');
  const b64 = m[2].replace(/\s+/g, '');
  if (b64.length > 240000) throw new Error('image too large (max ~180KB)');
  return 'data:image/' + m[1].toLowerCase() + ';base64,' + b64;
}

const RELIC_RARITIES = ['common', 'rare', 'epic', 'legendary'];
const RELIC_DOMAINS  = ['fire', 'bone', 'sun', 'moon', 'ash'];
const RELIC_KINDS    = ['passive', 'active'];

export async function relicsListAdmin(){
  return (await q(
    `SELECT id, slug, name, description, rarity, domain, kind, counters,
            buff_type, buff_value, war_effect, cooldown_min, price_stars,
            icon_file, svg, image_url, sort_order, active, created_at
       FROM relics
      ORDER BY sort_order ASC, rarity ASC, id ASC`
  )).rows;
}

export async function relicUpsert(adminId, body = {}){
  const b = body || {};
  const name = String(b.name || '').trim().slice(0, 64);
  if (!name) throw new Error('name is required');
  const rarity = RELIC_RARITIES.includes(String(b.rarity)) ? b.rarity : 'common';
  const domain = RELIC_DOMAINS.includes(String(b.domain)) ? b.domain : 'fire';
  const kind   = RELIC_KINDS.includes(String(b.kind)) ? b.kind : 'passive';
  const counters = RELIC_DOMAINS.includes(String(b.counters)) ? b.counters : null;
  const buffType = String(b.buff_type || 'none').trim().slice(0, 48) || 'none';
  const buffValue = Number(b.buff_value) || 0;
  const warEffect = b.war_effect ? String(b.war_effect).trim().slice(0, 24) : null;
  const cooldown = Math.max(0, Math.floor(Number(b.cooldown_min) || 0));
  const priceStars = Math.max(0, Math.floor(Number(b.price_stars) || 0));
  const sortOrder = Number.isFinite(Number(b.sort_order)) ? Math.floor(Number(b.sort_order)) : 100;
  const active = b.active == null ? true : /^(1|true|on|yes)$/i.test(String(b.active));
  const iconFile = b.icon_file ? String(b.icon_file).trim().slice(0, 120) : null;

  let svg = null, imageUrl = null;
  if (b.svg != null && String(b.svg).trim()) svg = sanitizeSvg(b.svg);
  if (b.image_url != null && String(b.image_url).trim()) imageUrl = sanitizeRelicImageUrl(b.image_url);

  if (b.id){
    const r = await q(
      `UPDATE relics SET
         name=$2, description=$3, rarity=$4, domain=$5, kind=$6, counters=$7,
         buff_type=$8, buff_value=$9, war_effect=$10, cooldown_min=$11,
         price_stars=$12, sort_order=$13, active=$14,
         icon_file=COALESCE($15, icon_file),
         svg=COALESCE($16, svg),
         image_url=COALESCE($17, image_url)
       WHERE id=$1
       RETURNING id, slug`,
      [b.id, name, b.description || null, rarity, domain, kind, counters,
       buffType, buffValue, warEffect, cooldown, priceStars, sortOrder, active,
       iconFile, svg, imageUrl]
    );
    if (!r.rowCount) throw new Error('relic not found');
    await audit(adminId, 'relicUpdate', r.rows[0].slug);
    return r.rows[0];
  }

  const slug = relicSlugify(b.slug || name, 'relic');
  const r = await q(
    `INSERT INTO relics
       (slug, name, description, rarity, domain, kind, counters, buff_type,
        buff_value, war_effect, cooldown_min, price_stars, sort_order, active,
        icon_file, svg, image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (slug) DO UPDATE SET
       name=EXCLUDED.name, description=EXCLUDED.description, rarity=EXCLUDED.rarity,
       domain=EXCLUDED.domain, kind=EXCLUDED.kind, counters=EXCLUDED.counters,
       buff_type=EXCLUDED.buff_type, buff_value=EXCLUDED.buff_value,
       war_effect=EXCLUDED.war_effect, cooldown_min=EXCLUDED.cooldown_min,
       price_stars=EXCLUDED.price_stars, sort_order=EXCLUDED.sort_order,
       active=EXCLUDED.active
     RETURNING id, slug`,
    [slug, name, b.description || null, rarity, domain, kind, counters, buffType,
     buffValue, warEffect, cooldown, priceStars, sortOrder, active,
     iconFile, svg, imageUrl]
  );
  await audit(adminId, 'relicCreate', slug);
  return r.rows[0];
}

export async function relicSetImage(adminId, { id, svg, image_url } = {}){
  if (!id) throw new Error('relic id required');
  let cleanSvg = null, cleanUrl = null;
  if (svg != null && String(svg).trim()) cleanSvg = sanitizeSvg(svg);
  if (image_url != null && String(image_url).trim()) cleanUrl = sanitizeRelicImageUrl(image_url);
  if (!cleanSvg && !cleanUrl) throw new Error('provide an SVG or an image URL');
  const r = await q(
    `UPDATE relics SET svg=COALESCE($2, svg), image_url=COALESCE($3, image_url)
       WHERE id=$1 RETURNING id, slug`,
    [id, cleanSvg, cleanUrl]
  );
  if (!r.rowCount) throw new Error('relic not found');
  await audit(adminId, 'relicSetImage', r.rows[0].slug);
  return r.rows[0];
}

export async function relicClearImage(adminId, id){
  const r = await q('UPDATE relics SET svg=NULL, image_url=NULL WHERE id=$1 RETURNING slug', [id]);
  if (!r.rowCount) throw new Error('relic not found');
  await audit(adminId, 'relicClearImage', r.rows[0].slug);
  return r.rows[0];
}

export async function relicToggle(adminId, id, active){
  const on = /^(1|true|on|yes)$/i.test(String(active));
  const r = await q('UPDATE relics SET active=$1 WHERE id=$2 RETURNING id, active', [on, id]);
  if (!r.rowCount) throw new Error('relic not found');
  await audit(adminId, 'relicToggle', id + ' -> ' + on);
  return r.rows[0];
}

export async function relicDelete(adminId, id){
  const r = await q('DELETE FROM relics WHERE id=$1 RETURNING slug', [id]);
  if (!r.rowCount) throw new Error('relic not found');
  await audit(adminId, 'relicDelete', r.rows[0].slug);
  return r.rows[0];
}

/* ---- relic admin routes ---- */
A.get('/relics', wrap(() => relicsListAdmin()));
A.post('/relics', wrap(req => relicUpsert(who(req), req.body)));
A.post('/relics/image', wrap(req => relicSetImage(who(req), req.body)));
A.post('/relics/image/clear', wrap(req => relicClearImage(who(req), req.body.id)));
A.post('/relics/toggle', wrap(req => relicToggle(who(req), req.body.id, req.body.active)));
A.post('/relics/delete', wrap(req => relicDelete(who(req), req.body.id)));
