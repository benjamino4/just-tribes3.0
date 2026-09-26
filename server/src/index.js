/* =====================================================================
   TRIBES — Express entry.
   SSE routes mount BEFORE express.json so streams are never buffered.
===================================================================== */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, pool } from './db.js';
import { loadConfig, CFG } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const app = express();
app.disable('x-powered-by');

/* ---------- body parser (256kb — SVG uploads via admin) ---------- */
app.use(express.json({ limit: '256kb' }));

/* ---------- allow Mini App embedding ---------- */
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  next();
});

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
    phase: 1,
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

/* ---------- main API (Phase 1: just /api/state demo) ---------- */
app.get('/api/state', async (req, res) => {
  // Phase 1: no auth yet. Return a synthetic state so the shell renders.
  // Phase 2 replaces this with the real auth + user loader.
  res.json({
    demo: true,
    user: {
      id: 0,
      username: 'wanderer',
      first_name: 'Wanderer',
      role: 'Hunter',
      ember: 12480,
      stars: 3,
      renown: 8600,
      streak: 6,
      ash_ready_at: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
      ash_count: 3,
    },
    tribe: {
      id: 1,
      name: 'Ashborn',
      role: 'Hunter',
      level: 4,
      members: 28,
      treasury: 184200,
      motto: 'From the ash, we rise.',
      crest: 'totem',
      rank: 3,
      renown_total: 240900,
    },
    ash: { ready: false, per_pool: 420, pools_stored: 3, next_ready_in_ms: 12 * 60 * 1000, interval_min: 30 },
    daily: [
      { id: 'checkin', title: 'Feed the Fire',     reward: 120, done: true  },
      { id: 'stoke',   title: 'Stoke the Great Pyre', reward: 200, done: false },
      { id: 'gather',  title: 'Gather the Ash twice', reward: 150, done: false },
    ],
    war: {
      active: true,
      opponent: 'Stormfang',
      attacker_score: 6120,
      defender_score: 5890,
      ends_in_ms: 5 * 60 * 60 * 1000,
      goal: 10000,
    },
    bonfire: { active: true, title: 'Double Ash Hour', multiplier: 2, ends_in_ms: 42 * 60 * 1000 },
    notifications: [],
  });
});

/* ---------- static ---------- */
app.use(express.static(PUBLIC, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.includes(path.sep + 'assets' + path.sep)) {
      // Vite hashes assets — cache them aggressively
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // other static files (icon.png, manifest) — short cache
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
}));

/* ---------- SPA fallback ---------- */
app.get('*', (req, res) => {
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
      await loadConfig(pool);
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
