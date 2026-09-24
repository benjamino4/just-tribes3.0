// ---------------------------------------------------------------------------
// TRIBES — server. Phase 1 additions:
//   * SSE route for Kiva mounted BEFORE express.json (streaming, no body parse)
//   * /api/cron/tick endpoint for external keep-alive + maintenance sweeps
//   * Background push queue flusher when the instance is warm
// ---------------------------------------------------------------------------
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, pool, q } from './db.js';
import { router, handleWebhook, kivaSse } from './routes.js';
import { loadConfig, CFG } from './config.js';
import { adminRouter, adminBotWebhook, setupAdminBot } from './admin.js';
import { startFlusher, flushQueue } from './push.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const app = express();
app.disable('x-powered-by');

// SSE — must be before express.json so the stream isn't buffered by the parser.
app.get('/api/kiva/stream', (req,res)=>kivaSse(req,res));
// ---------------------------------------------------------------
// Boot-time backfill: ensure every active war has its fronts.
// Idempotent — safe to run every boot.
// ---------------------------------------------------------------
async function backfillWarFronts(){
  try{
    const r = await q(`
      INSERT INTO war_fronts (war_id, idx, name)
      SELECT w.id, i, (ARRAY['North','Center','South'])[i+1]
        FROM wars w
       CROSS JOIN generate_series(0, COALESCE(w.front_count,3)-1) AS i
       WHERE w.status='active'
         AND NOT EXISTS (SELECT 1 FROM war_fronts f WHERE f.war_id = w.id AND f.idx = i)
    `);
    if (r.rowCount) console.log(`[war] backfilled ${r.rowCount} war fronts`);
  }catch(e){ console.warn('[war] backfill skipped:', e.message); }
}
app.use(express.json({ limit:'256kb' }));
app.use((req,res,next)=>{ res.removeHeader('X-Frame-Options'); next(); });

// health
app.get('/api/health', async (req,res)=>{
  let db = false;
  try { if (pool) { await pool.query('SELECT 1'); db = true; } } catch {}
  res.json({ ok:true, db, bot: !!process.env.BOT_TOKEN, ton: !!process.env.TON_RECEIVE_ADDRESS, ts: Date.now() });
});

// cron tick — hit by an external scheduler every 10 min to keep the instance
// warm AND to run the maintenance sweeps we can't trust to a sleeping process.
app.get('/api/cron/tick', async (req,res)=>{
  const out = { ok:true, ts: Date.now() };
  try{
    // flush push queue
    const flushed = await flushQueue(60);
    out.push = flushed;

    // expire any bonfires that have ended
    await q(`UPDATE bonfire_events SET end_at = LEAST(end_at, now()) WHERE end_at < now()`);

    // prune orphan users older than 30 days with no tribe and < 100 ember
    await q(`DELETE FROM users WHERE tribe_id IS NULL AND ember < 100 AND created_at < now() - interval '30 days'`);

    // prune push queue rows already sent, older than 7 days
    await q(`DELETE FROM push_queue WHERE sent_at IS NOT NULL AND sent_at < now() - interval '7 days'`);
  }catch(e){ out.error = e.message; }
  res.json(out);
});

// Telegram webhook (Stars)
app.post('/api/tg/webhook', async (req,res)=>{
  try { await handleWebhook(req.body || {}); } catch(e){ console.error('[webhook]', e.message); }
  res.json({ ok:true });
});

// Admin bot webhook
app.post('/api/admin/webhook', async (req,res)=>{
  try { await adminBotWebhook(req.body || {}); } catch(e){ console.error('[admin webhook]', e.message); }
  res.json({ ok:true });
});

// Admin web dashboard API
app.use('/api/admin', adminRouter);

// TON Connect manifest
app.get('/tonconnect-manifest.json', (req,res)=>{
  const origin = `${req.protocol}://${req.get('host')}`;
  res.json({
    url: origin, name: 'TRIBES',
    iconUrl: origin + '/icon.png',
    termsOfUseUrl: origin + '/', privacyPolicyUrl: origin + '/'
  });
});

// authed API
app.use('/api', router);

// static Mini App
app.use(express.static(PUBLIC, {
  extensions:['html'],
  maxAge:'1h',
  setHeaders(res, filePath){
    if (filePath.endsWith('.html')){
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // JS/CSS are versioned via ?v=N so we can cache them hard.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));
app.get('*', (req,res)=>{
  if (req.path.startsWith('/api/')) return res.status(404).json({ error:'not found' });
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

app.use((err,req,res,next)=>{
  console.error('[api error]', err.message);
  res.status(500).json({ error: 'server error', detail: err.message });
});

const PORT = process.env.PORT || 3000;
export { app };
if (process.env.TRIBES_TEST !== '1') {
  initDb()
        .then(()=> backfillWarFronts())
    .then(()=> loadConfig(q))
    .then(()=> startFlusher(Number(process.env.PUSH_FLUSH_SECONDS)||20))
    .catch(e=>console.error('[boot]', e.message))
    .finally(()=>{
      app.listen(PORT, ()=> {
        console.log(`TRIBES server on :${PORT}`);
        setupAdminBot(process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || '');
      });
    });
}