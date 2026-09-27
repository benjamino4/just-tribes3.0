// TRIBES-FILE: server/src/index.js
// PHASE: 2 — Identity & shell
// Mounts the real /api router. Keeps SSE-ready ordering
// (SSE routes will be added in Phase 5, before express.json).

import './env.js';                        // must be the first import — loads .env before db/auth read process.env
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, pool, q } from './db.js';
import { loadConfig, CFG } from './config.js';
import { router } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const app = express();
app.disable('x-powered-by');

/* ---- SSE routes (Phase 5 mounts kiva/notif streams here) ---- */

app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => { res.removeHeader('X-Frame-Options'); next(); });

/* ---------- health ---------- */
app.get('/api/health', async (req, res) => {
  let db = false;
  try { if (pool) { await pool.query('SELECT 1'); db = true; } } catch {}
  res.json({
    ok: true,
    db,
    bot: !!process.env.BOT_TOKEN,
    ton: !!process.env.TON_RECEIVE_ADDRESS,
    maintenance: Number(CFG.maintenance) ? 1 : 0,
    phase: 2,
    ts: Date.now(),
  });
});

/* ---------- TON Connect manifest ---------- */
app.get('/tonconnect-manifest.json', (req, res) => {
  const xfProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const host = req.get('host') || '';
  const local = host.startsWith('localhost') || host.startsWith('127.') || host.startsWith('0.0.0.0');
  const origin = `${local ? (xfProto || req.protocol || 'http') : 'https'}://${host}`;
  res.json({
    url: origin,
    name: 'TRIBES',
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

// SPA fallback. Written as a path-less terminal middleware instead of
// app.get('*') so it is safe under Express 5 (path-to-regexp no longer
// accepts a bare '*' string and would throw at startup).
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

/* ---------- error handler ---------- */
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
      console.log('[boot] ready');
    } catch (e) {
      console.error('[boot] FAILED:', e.message);
      console.error(e.stack);
    } finally {
      app.listen(PORT, () => {
        console.log(`TRIBES server on :${PORT}`);
      });
    }
  })();
}