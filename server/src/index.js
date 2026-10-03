// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/index.js
// PURPOSE: Express app. Boot. SSE endpoints. Static hosting. Cron.
// DEPENDS ON: everything
// ═══════════════════════════════════════════════════════════════════
import './env.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, pool, q } from './db.js';
import { loadConfig, CFG } from './config.js';
import { router } from './routes.js';
import { emojiRouter } from './routes/emoji.js';
import { contentRouter } from './routes/content.js';
import { kivaSse } from './kiva.js';
import { adminBotWebhook, setupAdminBot } from './admin_bot.js';
import { startFlusher, flushQueue } from './push.js';
import { warTick } from './war.js';
import { subscribe as eventSubscribe } from './events.js';
import { verifyInitData } from './auth.js';
import { recalcAllSeats, decayInactiveRanks } from './rank.js';
import { ensureWorldPopulation } from './forgotten.js';
import { runSelfEditWatcher } from './admin_edit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const app = express();
app.disable('x-powered-by');

// SSE endpoints
app.get('/api/kiva/stream', (req, res) => kivaSse(req, res));

app.get('/api/events/stream', (req, res) => {
  const initData = req.query.initData || '';
  const u = verifyInitData(initData);
  if (!u) return res.status(401).end();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 5000\n\n');
  eventSubscribe(u.id, res);
});

app.use(express.json({ limit: '400kb' }));
app.use((req, res, next) => { res.removeHeader('X-Frame-Options'); next(); });

app.get('/api/health', async (req, res) => {
  let db = false;
  try { if (pool) { await pool.query('SELECT 1'); db = true; } } catch {}
  res.json({
    ok: true, db,
    bot: !!process.env.BOT_TOKEN,
    admin: !!process.env.ADMIN_BOT_TOKEN && !!process.env.ADMIN_WEBHOOK_SECRET,
    ton: !!process.env.TON_RECEIVE_ADDRESS,
    pyscore: !!process.env.PYSCORE_URL,
    maintenance: Number(CFG.maintenance) ? 1 : 0,
    version: '5.0',
    ts: Date.now()
  });
});

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
    await q("DELETE FROM push_queue WHERE sent_at IS NOT NULL AND sent_at < now() - interval '7 days'");
    await q("DELETE FROM live_feed WHERE created_at < now() - interval '30 days'");
    await q("DELETE FROM notifications WHERE seen_at IS NOT NULL AND seen_at < now() - interval '30 days'");
    await q("UPDATE users SET last_seen_at = now() WHERE last_seen_at < now() - interval '10 minutes' AND id IN (SELECT user_id FROM notifications WHERE created_at > now() - interval '15 minutes')");
  } catch (e) { out.error = e.message; }
  res.json(out);
});

app.get('/api/cron/seats', async (req, res) => {
  const secret = process.env.CRON_SECRET || '';
  if (secret) {
    const t = req.get('X-Cron-Secret') || req.query.secret || '';
    if (t !== secret) return res.status(401).json({ error: 'unauthorized' });
  }
  await recalcAllSeats();
  await decayInactiveRanks();
  res.json({ ok: true });
});

function checkTgSecret(req, secretEnv) {
  const secret = process.env[secretEnv] || '';
  if (!secret) return false;
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

app.use('/api/emoji', emojiRouter);
app.use('/api/content', contentRouter);
app.use('/api', router);

app.get('/tonconnect-manifest.json', (req, res) => {
  const xfProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const host = req.get('host') || '';
  const local = host.startsWith('localhost') || host.startsWith('127.') || host.startsWith('0.0.0.0');
  const origin = `${local ? (xfProto || req.protocol || 'http') : 'https'}://${host}`;
  res.json({
    url: origin, name: 'TRIBES',
    iconUrl: origin + '/icon.png',
    termsOfUseUrl: origin + '/',
    privacyPolicyUrl: origin + '/'
  });
});

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
  }
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[api error]', err.message);
  res.status(500).json({ error: 'server error' });
});

const PORT = process.env.PORT || 3000;
export { app };

if (process.env.TRIBES_TEST !== '1') {
  (async () => {
    try {
      console.log('[boot] starting');
      await initDb();
      await loadConfig(q);
      await ensureWorldPopulation(Number(CFG.forgotten_world_min) || 40);
      startFlusher(Number(process.env.PUSH_FLUSH_SECONDS) || 20);
      runSelfEditWatcher();
      console.log('[boot] ready');
    } catch (e) { console.error('[boot] FAILED:', e.message); }
    finally {
      app.listen(PORT, () => {
        console.log(`TRIBES on :${PORT}`);
        setupAdminBot(process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || '');
      });
    }
  })();
}