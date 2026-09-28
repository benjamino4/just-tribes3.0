// =====================================================================
// Public emoji API.
//   GET  /api/emoji/state   → defs + sets merged with owned status
//   POST /api/emoji/unlock  → unlock a set with Stars
// =====================================================================
import express from 'express';
import { q } from '../db.js';
import { verifyInitData } from '../auth.js';

const router = express.Router();

async function requireUser(req, res, next) {
  const initData = req.get('X-Init-Data') || '';
  const tgUser = verifyInitData(initData);
  if (!tgUser) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const u = (await q('SELECT * FROM users WHERE id=$1', [tgUser.id])).rows[0];
  if (!u) return res.status(401).json({ ok: false, error: 'no user' });
  if (u.banned) return res.status(403).json({ ok: false, error: 'banned' });
  req.user = u;
  next();
}

router.get('/state', requireUser, async (req, res) => {
  try {
    const [defs, sets, ownedSets, ownedDefs] = await Promise.all([
      q(`SELECT id, key, name, svg, image_url, set_slug, price_stars, sort_order, builtin
           FROM emoji_defs WHERE active = true
          ORDER BY sort_order ASC, id ASC`),
      q(`SELECT slug, name, description, price_stars, emoji_keys, sort_order
           FROM emoji_sets WHERE COALESCE(active, true) = true
          ORDER BY COALESCE(sort_order, 100) ASC, id ASC`),
      q('SELECT set_slug FROM user_emoji_sets WHERE user_id = $1', [req.user.id]),
      q('SELECT emoji_id FROM user_emoji_defs WHERE user_id = $1', [req.user.id]),
    ]);

    const ownedSetSlugs = new Set(ownedSets.rows.map((r) => r.set_slug));
    const ownedDefIds   = new Set(ownedDefs.rows.map((r) => Number(r.emoji_id)));

    const custom = {};
    for (const r of defs.rows) {
      custom[r.key] = r.image_url || r.svg;
    }

    const bySet = new Map();
    for (const r of defs.rows) {
      if (!r.set_slug) continue;
      if (!bySet.has(r.set_slug)) bySet.set(r.set_slug, []);
      bySet.get(r.set_slug).push(r.key);
    }

    const outSets = sets.rows.map((s) => {
      let keys = Array.isArray(s.emoji_keys) ? s.emoji_keys : [];
      if (!keys.length) keys = bySet.get(s.slug) || [];
      return {
        slug: s.slug,
        name: s.name,
        description: s.description,
        price: Number(s.price_stars) || 0,
        emojis: keys,
        unlocked: ownedSetSlugs.has(s.slug) || Number(s.price_stars) === 0,
      };
    });

    const free = defs.rows.filter((r) => !r.set_slug).map((r) => r.key);

    res.json({
      ok: true,
      custom,
      sets: outSets,
      free,
      ownedDefs: Array.from(ownedDefIds),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

router.post('/unlock', requireUser, async (req, res) => {
  try {
    const { slug } = req.body || {};
    if (!slug) return res.status(400).json({ ok: false, error: 'slug required' });

    const s = (await q(
      'SELECT slug, price_stars FROM emoji_sets WHERE slug = $1 AND COALESCE(active, true) = true',
      [slug]
    )).rows[0];
    if (!s) return res.status(404).json({ ok: false, error: 'set not found' });

    const already = await q(
      'SELECT 1 FROM user_emoji_sets WHERE user_id = $1 AND set_slug = $2',
      [req.user.id, slug]
    );
    if (already.rowCount) return res.json({ ok: true, already: true });

    const price = Number(s.price_stars) || 0;

    if (req.user.blessed) {
      await q(
        'INSERT INTO user_emoji_sets (user_id, set_slug) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [req.user.id, slug]
      );
      return res.json({ ok: true, blessed: true });
    }

    if (Number(req.user.stars) < price) {
      return res.status(402).json({ ok: false, error: 'not enough stars', need: price });
    }

    await q('UPDATE users SET stars = stars - $1 WHERE id = $2', [price, req.user.id]);
    await q(
      'INSERT INTO user_emoji_sets (user_id, set_slug) VALUES ($1,$2)',
      [req.user.id, slug]
    );
    res.json({ ok: true, cost: price });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

export const emojiRouter = router;