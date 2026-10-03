-- ═══════════════════════════════════════════════════════════════════
-- FILE: server/migrations/004-rank-tiers-referral.sql
-- PURPOSE: Nine rank tiers (Bone → Eternal) and the referral tier ladder.
-- DEPENDS ON: 001, 002, 003
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO rank_tiers (slug, name, title, min_rating, max_rating, color_hex, emoji, sort_order)
VALUES
  ('bone',     'Bone',     'Bone Carver',     0,    999,  '#b0a080', '🦴', 10),
  ('flint',    'Flint',    'Flint Knapper',   1000, 1199, '#8899aa', '🪨', 20),
  ('stone',    'Stone',    'Stone Setter',    1200, 1399, '#6a6a72', '⬛', 30),
  ('jade',     'Jade',     'Jade Warrior',    1400, 1599, '#55a882', '💚', 40),
  ('copper',   'Copper',   'Copper Chief',    1600, 1799, '#c08a4a', '🟠', 50),
  ('silver',   'Silver',   'Silver Chieftain',1800, 1999, '#c9d4e0', '⚪', 60),
  ('gold',     'Gold',     'Gold Warlord',    2000, 2199, '#efc168', '🟡', 70),
  ('obsidian', 'Obsidian', 'Obsidian King',   2200, 2499, '#2a2735', '⚫', 80),
  ('eternal',  'Eternal',  'Eternal Flame',   2500, NULL,  '#fff3d0', '🔥', 90)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO referral_tiers (slug, name, min_invites, max_invites, sparks_per, kinship_per, passive_pct, star_back_pct, sort_order)
VALUES
  ('bronze',   'Tribe Maker',    1,  4,    500,  25,  0.00,  0.00, 10),
  ('silver',   'Banner Bearer',  5,  14,   1000, 50,  0.05,  0.00, 20),
  ('gold',     'Firebringer',    15, 29,   2000, 100, 0.10,  0.05, 30),
  ('platinum', 'Warbringer',     30, 49,   3000, 150, 0.15,  0.10, 40),
  ('eternal',  'Eternal Inviter',50, NULL, 5000, 250, 0.20,  0.15, 50)
ON CONFLICT (slug) DO NOTHING;