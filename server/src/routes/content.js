// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/routes/content.js
// PURPOSE: Serve live-editable content to the client.
// DEPENDS ON: db.js
// ═══════════════════════════════════════════════════════════════════
import express from 'express';
import { q } from '../db.js';

const router = express.Router();

router.get('/all', async (_req, res) => {
  try {
    const [games, verses, rewards, tiers, help] = await Promise.all([
      q(`SELECT slug, name, description, archetype, engine, material, terrain_pool, sort_order
           FROM game_defs WHERE active=true ORDER BY sort_order`),
      q(`SELECT pattern, category, literal FROM verse_templates WHERE active=true ORDER BY sort_order`),
      q(`SELECT slug, label, category, sparks, kinship, stars FROM reward_defs WHERE active=true`),
      q(`SELECT slug, name, title, min_rating, max_rating, color_hex, emoji
           FROM rank_tiers WHERE active=true ORDER BY sort_order`),
      q(`SELECT slug, section, title, body FROM help_articles WHERE active=true ORDER BY sort_order`)
    ]);

    res.json({
      ok: true,
      games: games.rows,
      verses: verses.rows,
      rewards: rewards.rows,
      tiers: tiers.rows,
      help: help.rows,
      fetched_at: Date.now()
    });
  } catch (e) {
    // help_articles may not exist yet — return partial
    res.json({ ok: true, games: [], verses: [], rewards: [], tiers: [], help: [], error: e.message });
  }
});

export const contentRouter = router;