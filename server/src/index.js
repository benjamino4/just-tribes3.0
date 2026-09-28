// TRIBES-FILE: server/src/index.js
// PHASE: 7 — Meta & Admin
// Mounts kiva SSE, admin SSE, admin REST, notif SSE. All SSE before json.

import './env.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, pool, q } from './db.js';
import { loadConfig, CFG } from './config.js';
import { router } from './routes.js';
import { kivaSse } from './kiva.js';
import { adminRouter, adminSse, broadcastAdmin } from './admin.js';
import { adminBotWebhook, setupAdminBot } from './admin_bot.js';
import { startFlusher, flushQueue } from './push.js';
import { warTick } from './war.js';
import * as Notif from './notifications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const app = express();
app.disable('x-powered-by');

/* ---------- SSE routes (before json) ---------- */
app.get('/api/kiva/stream', (req, res) => kivaSse(req, res));
app.get('/api/admin/stream', (req, res) => adminSse(req, res));
app.get('/api/notifications/stream', (req, res) => {
  // auth via initData query param
  import('./auth.js').then(({ verifyInitData }) => {
    const u = verifyInitData(req.query.initData || '');
    if (!u) return res.status(401).end();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n\n');
    Notif.subscribe(u.id, res);
  }).catch(() => res.status(500).end());
});

/* ---------- JSON body ---------- */
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => { res.removeHeader('X-Frame-Options'); next(); });

/* ---------- health ---------- */
app.get('/api/health', async (req, res) => {
  let db = false;
  try { if (pool) { await pool.query('SELECT 1'); db = true; } } catch {}
  res.json({
    ok: true, db,
    bot: !!process.env.BOT_TOKEN,
    admin: !!process.env.ADMIN_TOKEN || !!process.env.ADMIN_IDS,
    ton: !!process.env.TON_RECEIVE_ADDRESS,
    maintenance: Number(CFG.maintenance) ? 1 : 0,
    phase: 7,
    ts: Date.now(),
  });
});

/* ---------- cron tick (secret-gated) ---------- */
app.get('/api/cron/tick', async (req, res) => {
  const secret = process.env.CRON_SECRET || '';
  if (secret) {
    const t = req.get('X-Cron-Secret') || req.query.secret || '';
    if (t !== secret) return res.status(401).json({ error: 'unauthorized' });
  }
  const out = { ok: true, ts: Date.now() };
  try {
    out.push = await flushQueue(60);
    out.war = await warTick();
    await q("UPDATE bonfire_events SET end_at = LEAST(end_at, now()) WHERE end_at < now()");
    await q("DELETE FROM users WHERE tribe_id IS NULL AND ember < 100 AND created_at < now() - interval '30 days'");
    await q("DELETE FROM push_queue WHERE sent_at IS NOT NULL AND sent_at < now() - interval '7 days'");
  } catch (e) { out.error = e.message; }
  res.json(out);
});

/* ---------- Telegram webhooks (secret-checked) ---------- */
function checkTgSecret(req, secretEnv) {
  const secret = process.env[secretEnv] || '';
  if (!secret) return true;
  const t = req.get('X-Telegram-Bot-Api-Secret-Token') || '';
  return t === secret;
}

app.post('/api/tg/webhook', async (req, res) => {
  if (!checkTgSecret(req, 'TG_WEBHOOK_SECRET')) return res.status(401).end();
  try {
    const { handleWebhook } = await import('./stars.js');
    await handleWebhook(req.body || {});
  } catch (e) { console.error('[webhook]', e.message); }
  res.json({ ok: true });
});

app.post('/api/admin/webhook', async (req, res) => {
  if (!checkTgSecret(req, 'ADMIN_WEBHOOK_SECRET')) return res.status(401).end();
  try { await adminBotWebhook(req.body || {}); }
  catch (e) { console.error('[admin webhook]', e.message); }
  res.json({ ok: true });
});

import { emojiRouter } from './routes/emoji.js';
import { adminEmojiRouter } from './routes/admin_emoji.js';
// ... (add these imports at the top with the other imports)

app.use('/api/emoji', emojiRouter);
app.use('/api/admin/emoji', adminEmojiRouter);
/* ---------- admin REST ---------- */
app.use('/api/admin', adminRouter);

/* ---------- TON Connect manifest ---------- */
app.get('/tonconnect-manifest.json', (req, res) => {
  const xfProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const host = req.get('host') || '';
  const local = host.startsWith('localhost') || host.startsWith('127.') || host.startsWith('0.0.0.0');
  const origin = `${local ? (xfProto || req.protocol || 'http') : 'https'}://${host}`;
  res.json({
    url: origin, name: 'TRIBES',
    iconUrl: origin + '/icon.png',
    termsOfUseUrl: origin + '/',
    privacyPolicyUrl: origin + '/',
  });
});

/* ---------- main API ---------- */
app.use('/api', router);

/* ---------- static ---------- */
app.use(express.static(PUBLIC, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    } else if (filePath.includes(path.sep + 'assets' + path.sep)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[api error]', err.message);
  res.status(500).json({ error: 'server error', detail: err.message });
});

/* ---------- boot ---------- */
const PORT = process.env.PORT || 3000;
export { app };

if (process.env.TRIBES_TEST !== '1') {
  (async () => {
    try {
      console.log('[boot] starting');
      console.log('[boot] DATABASE_URL:', process.env.DATABASE_URL ? 'configured' : 'MISSING');
      await initDb();
      await loadConfig(q);
      startFlusher(Number(process.env.PUSH_FLUSH_SECONDS) || 20);
      console.log('[boot] ready');
    } catch (e) {
      console.error('[boot] FAILED:', e.message);
      console.error(e.stack);
    } finally {
      app.listen(PORT, () => {
        console.log(`TRIBES server on :${PORT}`);
        setupAdminBot(process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || '');
      });
    }
  })();
}