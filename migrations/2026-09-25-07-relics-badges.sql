-- =====================================================================
-- Relics (with buffs + art) and Badges
-- =====================================================================
CREATE TABLE IF NOT EXISTS relics (
  id           BIGSERIAL PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  icon_file    TEXT,                    -- filename in /assets/relics/
  rarity       TEXT DEFAULT 'common',   -- common|rare|epic|legendary
  buff_type    TEXT NOT NULL,           -- see relics README
  buff_value   NUMERIC(10,4) DEFAULT 0,
  price_stars  INT DEFAULT 0,
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_relics (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relic_id   BIGINT NOT NULL REFERENCES relics(id) ON DELETE CASCADE,
  count      INT DEFAULT 1,
  first_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, relic_id)
);

CREATE TABLE IF NOT EXISTS badges (
  id           BIGSERIAL PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  icon_file    TEXT,                    -- filename in /assets/badges/
  tier         TEXT DEFAULT 'bronze',   -- bronze|silver|gold|legendary
  rule_json    JSONB,                   -- { kind:'streak', amount:7 } etc.
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id    BIGINT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at  TIMESTAMPTZ DEFAULT now(),
  seen        BOOLEAN DEFAULT false,
  PRIMARY KEY (user_id, badge_id)
);

-- Seed the default badges (icon_file points at /assets/badges/<slug>.svg)
INSERT INTO badges (slug, name, description, tier, rule_json) VALUES
  ('firekeeper', 'Firekeeper', 'Fed the fire 7 days running',  'bronze',    '{"kind":"streak","amount":7}'::jsonb),
  ('eternal',    'Eternal',    '30-day check-in streak',        'silver',    '{"kind":"streak","amount":30}'::jsonb),
  ('warlord',    'Warlord',    'Won 3 wars',                    'silver',    '{"kind":"wins","amount":3}'::jsonb),
  ('founder',    'Founder',    'Founded a tribe',               'bronze',    '{"kind":"founded"}'::jsonb),
  ('hoarder',    'Hoarder',    'Held 100k Ember',               'gold',      '{"kind":"ember","amount":100000}'::jsonb),
  ('crown',      'Crowned',    'Reached Kingdom tribe level',   'gold',      '{"kind":"tribe_level","amount":10}'::jsonb),
  ('shadow',     'Shadow',     'Performed 10 war actions',      'silver',    '{"kind":"war_actions","amount":10}'::jsonb),
  ('legend',     'Legend',     'Top-3 season finish',           'legendary', '{"kind":"season_top","amount":3}'::jsonb)
ON CONFLICT (slug) DO NOTHING;