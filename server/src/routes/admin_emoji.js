import express from 'express';
import { q } from '../db.js';
import { sanitizeSvg, isValidKey, slugifyKey, isRaster, isSvg } from '../lib/sanitizeSvg.js';
import { verifyInitData } from '../auth.js';

const ADMIN_IDS = new Set(
  (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
);

const router = express.Router();

router.use((req, res, next) => {
  const t = req.get('X-Admin-Token') || '';
  const secret = process.env.ADMIN_TOKEN || '';
  if (secret && t === secret) return next();
  const initData = req.get('X-Init-Data') || '';
  const u = verifyInitData(initData);
  if (u && ADMIN_IDS.has(String(u.id))) { req.adminId = String(u.id); return next(); }
  return res.status(401).json({ ok: false, error: 'unauthorized' });
});

router.get('/', async (_req, res) => {
  try {
    const [defs, sets] = await Promise.all([
      q(`SELECT id, key, name, svg, image_url, set_slug, price_stars, sort_order, builtin, active, created_at FROM emoji_defs ORDER BY sort_order, id`),
      q(`SELECT id, slug, name, description, price_stars, emoji_keys, sort_order, active FROM emoji_sets ORDER BY sort_order, id`)
    ]);
    res.json({ ok: true, defs: defs.rows, sets: sets.rows });
  } catch (e) { res.status(500).json({ ok: false, error: String(e.message) }); }
});

router.post('/seed-builtins', async (_req, res) => {
  try {
    const { BUILTIN_SEED } = await import('../lib/builtinEmojis.js');
    let inserted = 0;
    for (const e of BUILTIN_SEED) {
      if (!isValidKey(e.key)) continue;
      const r = await q(
        `INSERT INTO emoji_defs (key, name, svg, set_slug, price_stars, sort_order, builtin, active)
         VALUES ($1,$2,$3,$4,$5,$6,true,true) ON CONFLICT (key) DO NOTHING RETURNING id`,
        [e.key, e.name, e.svg, e.set_slug || null, e.price_stars || 0, e.sort_order || 100]
      );
      if (r.rowCount) inserted++;
    }
    res.json({ ok: true, inserted, total: BUILTIN_SEED.length });
  } catch (e) { res.status(500).json({ ok: false, error: String(e.message) }); }
});

export const adminEmojiRouter = router;