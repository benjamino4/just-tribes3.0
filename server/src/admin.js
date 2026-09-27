// TRIBES-FILE: server/src/admin.js
// PHASE: 7 — Meta & Admin
// Admin REST. Routes mounted at /api/admin, gated by requireAdmin.

import express from 'express';
import crypto from 'crypto';
import { q } from './db.js';
import { CFG, DEFAULTS, setConfig, resetConfig } from './config.js';
import { verifyInitData } from './auth.js';
import { previewReset, backupToJSON, resetProgression, factoryReset, listTables } from './admin_reset.js';
import { feedRecent } from './feed.js';
import * as Bonfires from './bonfires.js';
import * as X from './xquests.js';
import * as Notif from './notifications.js';

const WEB_TOKEN  = process.env.ADMIN_TOKEN || '';
const ADMIN_IDS  = new Set(
  (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
);

export function isAdmin(id) {
  return ADMIN_IDS.has(String(id));
}

/* ---------- auth ---------- */
function safeEq(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

export function requireAdmin(req, res, next) {
  const t = req.get('X-Admin-Token') ||
            (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');

  if (WEB_TOKEN && t && safeEq(t, WEB_TOKEN)) {
    req.adminId = 'web';
    return next();
  }

  const tgUser = verifyInitData(
    req.get('X-Init-Data') || (req.body && req.body.initData) || ''
  );
  if (tgUser && isAdmin(tgUser.id)) {
    req.adminId = String(tgUser.id);
    return next();
  }

  if (!WEB_TOKEN && !ADMIN_IDS.size) {
    return res.status(503).json({ error: 'admin disabled' });
  }
  return res.status(401).json({ error: 'bad admin token' });
}

/* ---------- SSE ---------- */
const adminSubs = new Set();

export function adminSse(req, res) {
  const t = req.query.token || '';
  const initData = req.query.initData || '';
  let ok = false, actor = null;

  if (WEB_TOKEN && t && safeEq(t, WEB_TOKEN)) { ok = true; actor = 'web'; }
  else if (initData) {
    const u = verifyInitData(initData);
    if (u && isAdmin(u.id)) { ok = true; actor = String(u.id); }
  }
  if (!ok) return res.status(401).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  res.write(`data: ${JSON.stringify({ type: 'hello', at: Date.now(), actor })}\n\n`);

  adminSubs.add(res);
  res.on('close', () => adminSubs.delete(res));
}

export function broadcastAdmin(event) {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of adminSubs) { try { res.write(line); } catch {} }
}

setInterval(() => {
  for (const res of adminSubs) { try { res.write(': ping\n\n'); } catch {} }
}, 25000).unref();

/* ---------- audit ---------- */
async function audit(adminId, action, detail) {
  try {
    await q(
      'INSERT INTO audit (admin_id, action, detail) VALUES ($1,$2,$3)',
      [adminId || null, action, detail || '']
    );
    broadcastAdmin({ type: 'audit', action, detail: detail || '', adminId, at: Date.now() });
  } catch {}
}

/* ---------- routes ---------- */
export const adminRouter = express.Router();
adminRouter.use(requireAdmin);

const who = (req) => req.adminId || 'web';
const wrap = (fn) => async (req, res) => {
  try { res.json({ ok: true, data: await fn(req) }); }
  catch (e) { res.status(400).json({ ok: false, error: e.message }); }
};

/* stats */
adminRouter.get('/stats', wrap(async () => {
  const u = (await q(
    `SELECT count(*)::int AS n,
            count(*) filter (where banned)::int AS banned,
            coalesce(sum(ember),0)::bigint AS ember
       FROM users`
  )).rows[0];
  const t = (await q(
    `SELECT count(*)::int AS n, coalesce(sum(treasury),0)::bigint AS pyre
       FROM tribes`
  )).rows[0];
  const w = (await q(
    `SELECT count(*) filter (where status='active')::int AS active,
            count(*)::int AS total FROM wars`
  )).rows[0];
  const p = (await q(
    `SELECT count(*)::int AS starTx,
            coalesce(sum(amount) filter (where kind='stars'),0)::bigint AS stars
       FROM payments`
  )).rows[0];
  return { users: u, tribes: t, wars: w, payments: p, maintenance: Number(CFG.maintenance) ? 1 : 0 };
}));

/* players */
adminRouter.get('/players', wrap(async (req) => {
  const s = String(req.query.q || '').trim();
  if (/^\d+$/.test(s)) {
    return (await q(
      'SELECT id, username, first_name, role, ember, renown, banned, tribe_id FROM users WHERE id=$1',
      [s]
    )).rows;
  }
  return (await q(
    `SELECT id, username, first_name, role, ember, renown, banned, tribe_id
       FROM users
      WHERE username ILIKE $1 OR first_name ILIKE $1
      ORDER BY renown DESC LIMIT 20`,
    ['%' + s + '%']
  )).rows;
}));

/* ban / unban / bless */
adminRouter.post('/ban', wrap(async (req) => {
  const r = await q(
    'UPDATE users SET banned=true, ban_reason=$2 WHERE id=$1 RETURNING id',
    [req.body.id, String(req.body.reason || '').slice(0, 200)]
  );
  if (!r.rowCount) throw new Error('no such user');
  await audit(who(req), 'ban', `${req.body.id}: ${req.body.reason || ''}`);
  return { id: req.body.id, banned: true };
}));

adminRouter.post('/unban', wrap(async (req) => {
  const r = await q(
    'UPDATE users SET banned=false, ban_reason=NULL WHERE id=$1 RETURNING id',
    [req.body.id]
  );
  if (!r.rowCount) throw new Error('no such user');
  await audit(who(req), 'unban', String(req.body.id));
  return { id: req.body.id, banned: false };
}));

adminRouter.post('/bless', wrap(async (req) => {
  const on = /^(1|true|on|yes)$/i.test(String(req.body.on));
  const r = await q(
    'UPDATE users SET blessed=$1 WHERE id=$2 RETURNING id, blessed',
    [on, req.body.id]
  );
  if (!r.rowCount) throw new Error('no such user');
  await audit(who(req), on ? 'bless' : 'unbless', String(req.body.id));
  if (on) {
    await Notif.notify({
      userId: req.body.id, type: 'blessing',
      title: 'You have been Blessed',
      body: 'Store purchases are free for you.',
      severity: 'success', action_kind: 'post',
    });
  }
  return r.rows[0];
}));

/* grant */
adminRouter.post('/grant', wrap(async (req) => {
  const kind = String(req.body.kind || 'ember');
  if (!['ember', 'renown', 'stars'].includes(kind)) throw new Error('bad kind');
  const amt = Math.floor(Number(req.body.amount) || 0);
  const r = await q(
    `UPDATE users SET ${kind} = ${kind} + $1 WHERE id=$2 RETURNING id, ${kind}`,
    [amt, req.body.id]
  );
  if (!r.rowCount) throw new Error('no such user');
  await audit(who(req), 'grant', `${amt} ${kind} -> user ${req.body.id}`);
  return r.rows[0];
}));

/* config */
adminRouter.get('/econ', wrap(async () => ({ ...CFG, _defaults: DEFAULTS })));
adminRouter.post('/econ', wrap(async (req) => {
  if (!(req.body.key in DEFAULTS)) throw new Error('unknown key');
  const v = await setConfig(q, req.body.key, req.body.value);
  await audit(who(req), 'econSet', `${req.body.key} = ${req.body.value}`);
  return { key: req.body.key, value: v };
}));
adminRouter.post('/econ/reset', wrap(async (req) => {
  await resetConfig(q);
  await audit(who(req), 'econReset', '');
  return { ...CFG, _defaults: DEFAULTS };
}));

/* maintenance / broadcast */
adminRouter.post('/maintenance', wrap(async (req) => {
  const on = /^(on|1|true|yes)$/i.test(String(req.body.on));
  await setConfig(q, 'maintenance', on ? 1 : 0);
  await audit(who(req), 'maintenance', String(on));
  return { maintenance: on ? 1 : 0 };
}));

adminRouter.post('/broadcast', wrap(async (req) => {
  const text = String(req.body.text || '').slice(0, 500);
  if (!text) throw new Error('empty broadcast');
  const ids = (await q('SELECT id FROM users WHERE banned=false')).rows;
  for (const r of ids) {
    await Notif.notify({
      userId: r.id, type: 'system',
      title: 'Announcement', body: text,
      severity: 'info', action_kind: 'inbox', push: true,
    });
  }
  await audit(who(req), 'broadcast', `${ids.length} users`);
  return { sent: ids.length };
}));

/* resets */
adminRouter.post('/reset/preview', wrap(async () => previewReset()));
adminRouter.post('/reset/backup', wrap(async (req) => backupToJSON(who(req))));
adminRouter.post('/reset/progression', wrap(async (req) => {
  const r = await resetProgression(who(req));
  broadcastAdmin({ type: 'reset', kind: 'progression', at: Date.now() });
  return r;
}));
adminRouter.post('/reset/factory', wrap(async (req) => {
  const r = await factoryReset(who(req));
  broadcastAdmin({ type: 'reset', kind: 'factory', at: Date.now() });
  return r;
}));
adminRouter.post('/reset/tables', wrap(async () => listTables()));

/* feed */
adminRouter.get('/feed', wrap(async (req) => feedRecent({
  since: Number(req.query.since) || 0,
  limit: Number(req.query.limit) || 60,
  type: req.query.type || null,
})));

/* bonfires */
adminRouter.get('/bonfires', wrap(async () => Bonfires.list()));
adminRouter.post('/bonfires', wrap(async (req) => Bonfires.create(who(req), req.body)));
adminRouter.post('/bonfires/end', wrap(async (req) => Bonfires.end(who(req), req.body.id)));

/* x quests */
adminRouter.get('/x-quests', wrap(async () => X.adminList()));
adminRouter.post('/x-quests', wrap(async (req) => X.adminCreate(who(req), req.body)));
adminRouter.post('/x-quests/update', wrap(async (req) => X.adminUpdate(who(req), req.body.id, req.body)));
adminRouter.post('/x-quests/delete', wrap(async (req) => X.adminDelete(who(req), req.body.id)));
adminRouter.post('/x-quests/toggle', wrap(async (req) => X.adminToggle(who(req), req.body.id, req.body.active)));
adminRouter.get('/x-claims', wrap(async (req) => X.claimsList({
  status: req.query.status || 'pending',
  q: req.query.q || '',
  limit: Number(req.query.limit) || 60,
})));
adminRouter.post('/x-claims/approve', wrap(async (req) => X.claimApprove(who(req), req.body.id)));
adminRouter.post('/x-claims/reject', wrap(async (req) => X.claimReject(who(req), req.body.id, req.body.reason)));
adminRouter.get('/x-stats', wrap(async () => X.stats()));

/* whoami */
adminRouter.get('/whoami', wrap(async (req) => ({ adminId: who(req) })));