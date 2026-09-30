-- TRIBES v4 — Store / tribe customization (monetization)
-- Adds paid tribe-branding columns. Self-healing: safe to re-run.

ALTER TABLE tribes ADD COLUMN IF NOT EXISTS icon_url    TEXT;
ALTER TABLE tribes ADD COLUMN IF NOT EXISTS name_font   TEXT DEFAULT 'default';
ALTER TABLE tribes ADD COLUMN IF NOT EXISTS name_style  TEXT DEFAULT 'plain';
ALTER TABLE tribes ADD COLUMN IF NOT EXISTS banner_style TEXT DEFAULT 'plain';

-- One-time paid perks (unlocked with Stars, then edited freely by the Chief).
ALTER TABLE tribes ADD COLUMN IF NOT EXISTS perk_name   BOOLEAN DEFAULT FALSE;
ALTER TABLE tribes ADD COLUMN IF NOT EXISTS perk_icon   BOOLEAN DEFAULT FALSE;
ALTER TABLE tribes ADD COLUMN IF NOT EXISTS perk_banner BOOLEAN DEFAULT FALSE;

-- Backfill any legacy NULLs to their defaults so reads are total.
UPDATE tribes SET name_font    = 'default' WHERE name_font    IS NULL;
UPDATE tribes SET name_style   = 'plain'   WHERE name_style   IS NULL;
UPDATE tribes SET banner_style = 'plain'   WHERE banner_style IS NULL;
UPDATE tribes SET perk_name   = FALSE WHERE perk_name   IS NULL;
UPDATE tribes SET perk_icon   = FALSE WHERE perk_icon   IS NULL;
UPDATE tribes SET perk_banner = FALSE WHERE perk_banner IS NULL;
