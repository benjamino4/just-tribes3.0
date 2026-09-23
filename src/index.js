// ---------------------------------------------------------------------------
// TRIBES — server. Serves the Mini App (public/) and the REST API, verifies
// Telegram Stars payments via webhook, and exposes /api/health.
// ---------------------------------------------------------------------------
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, pool } from './db.js';
import { router, handleWebhook } from './routes.js';
import { loadConfig } from './config.js';
import { q } from './db.js';
import { adminRouter, adminBotWebhook, setupAdminBot } from './admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit:'256kb' }));

// Telegram loads the app in a webview — allow embedding.
app.use((req,res,next)=>{ res.removeHeader('X-Frame-Options'); next(); });

// health (no auth, no db required)
app.get('/api/health', async (req,res)=>{
  let db = false;
  try { if (pool){ await pool.query('SELECT 1'); db = true; } } catch {}
  res.json({ ok:true, db, bot: !!process.env.BOT_TOKEN, ton: !!process.env.TON_RECEIVE_ADDRESS, ts: Date.now() });
});

// Telegram webhook (Stars) — MUST be before the authed /api router.
app.post('/api/tg/webhook', async (req,res)=>{
  try { await handleWebhook(req.body || {}); } catch(e){ console.error('[webhook]', e.message); }
  res.json({ ok:true });
});

// Admin Telegram bot webhook (separate bot) — must be before the authed router.
app.post('/api/admin/webhook', async (req,res)=>{
  try { await adminBotWebhook(req.body || {}); } catch(e){ console.error('[admin webhook]', e.message); }
  res.json({ ok:true });
});

// Admin web dashboard API (token-guarded inside the router).
app.use('/api/admin', adminRouter);

// TON Connect manifest (generated so the url always matches the live origin).
app.get('/tonconnect-manifest.json', (req,res)=>{
  const origin = `${req.protocol}://${req.get('host')}`;
  res.json({
    url: origin,
    name: 'TRIBES',
    iconUrl: origin + '/icon.png',
    termsOfUseUrl: origin + '/',
    privacyPolicyUrl: origin + '/'
  });
});

// authed API
app.use('/api', router);

// static Mini App
app.use(express.static(PUBLIC, { extensions:['html'], maxAge:'1h' }));
app.get('*', (req,res)=>{
  if (req.path.startsWith('/api/')) return res.status(404).json({ error:'not found' });
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

// error handler
app.use((err,req,res,next)=>{
  console.error('[api error]', err.message);
  res.status(500).json({ error: 'server error', detail: err.message });
});

const PORT = process.env.PORT || 3000;
export { app };
if (process.env.TRIBES_TEST !== '1') {
  initDb()
    .then(()=> loadConfig(q))
    .catch(e=>console.error('[db init]', e.message))
    .finally(()=>{
      app.listen(PORT, ()=> {
        console.log(`TRIBES server on :${PORT}`);
        setupAdminBot(process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || '');
      });
    });
}
