-- =====================================================================
-- Emoji Registry
-- Every emoji in the app is a named SVG (or image URL). Merges with
-- the client's built-in registry at runtime. Builtins can only be
-- renamed / reordered / hidden; custom emojis have full CRUD.
-- Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS emoji_defs (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  svg         TEXT,
  image_url   TEXT,
  set_slug    TEXT,
  price_stars INT DEFAULT 0,
  sort_order  INT DEFAULT 100,
  builtin     BOOLEAN DEFAULT false,
  active      BOOLEAN DEFAULT true,
  created_by  BIGINT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS emoji_defs_set_idx  ON emoji_defs (set_slug) WHERE active = true;
CREATE INDEX IF NOT EXISTS emoji_defs_free_idx ON emoji_defs (active)   WHERE set_slug IS NULL;

ALTER TABLE emoji_sets ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 100;
ALTER TABLE emoji_sets ADD COLUMN IF NOT EXISTS active     BOOLEAN DEFAULT true;
ALTER TABLE emoji_sets ADD COLUMN IF NOT EXISTS icon_hint  TEXT;

CREATE TABLE IF NOT EXISTS user_emoji_defs (
  user_id    BIGINT NOT NULL,
  emoji_id   BIGINT NOT NULL REFERENCES emoji_defs(id) ON DELETE CASCADE,
  source     TEXT DEFAULT 'code',
  granted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, emoji_id)
);

CREATE INDEX IF NOT EXISTS user_emoji_defs_user_idx ON user_emoji_defs (user_id);