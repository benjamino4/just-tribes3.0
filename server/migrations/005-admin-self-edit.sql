-- ═══════════════════════════════════════════════════════════════════
-- FILE: server/migrations/005-admin-self-edit.sql
-- PURPOSE: Game definitions, rewards, verses as DB rows so admin can
--          edit everything from the bot.
-- DEPENDS ON: 001, 002, 003, 004
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS game_defs (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  archetype       TEXT NOT NULL,
  engine          TEXT NOT NULL,
  material        TEXT NOT NULL DEFAULT 'ember',
  active          BOOLEAN DEFAULT true,
  min_duration_ms INT DEFAULT 30000,
  max_duration_ms INT DEFAULT 90000,
  terrain_pool    JSONB DEFAULT '[]'::jsonb,
  reward_json     JSONB DEFAULT '{}'::jsonb,
  config_json     JSONB DEFAULT '{}'::jsonb,
  sort_order      INT DEFAULT 100,
  created_at      TIMESTAMPTZ DEFAULT now()
);

INSERT INTO game_defs (slug, name, description, archetype, engine, material, terrain_pool, sort_order)
VALUES
  ('rune_match',   'Rune Match',    'Swap runes. Match three to clear.',         'match3',    'match3',    'stone', '["plains","hills"]'::jsonb,   10),
  ('stone_stack',  'Stone Stack',   'Stack stones. Do not miss.',                'stacker',   'stacker',   'clay',  '["plains","forest"]'::jsonb,  20),
  ('fireflies',    'Fireflies',     'Catch every firefly.',                      'catcher',   'catcher',   'ember', '["forest","swamp"]'::jsonb,   30),
  ('rite_hands',   'Rite of Hands', 'Read their pattern. Beat their throw.',     'choice',    'choice',    'metal', '["hills","ruins"]'::jsonb,    40),
  ('ember_flow',   'Ember Flow',    'Rotate tiles to guide the fire.',           'pathpuzzle','pathpuzzle','frost', '["ruins","swamp"]'::jsonb,    50),
  ('stone_sort',   'Stone Sort',    'Sort stones into matching piles.',          'sorter',    'sorter',    'clay',  '["plains","hills"]'::jsonb,   60),
  ('bid_fold',     'Bid or Fold',   'Bid more than them or fold.',               'choice',    'choice',    'clay',  '["swamp","hills"]'::jsonb,    70),
  ('three_masks',  'Three Masks',   'Guess their mask.',                         'deduction', 'deduction', 'bone',  '["swamp","forest"]'::jsonb,   80),
  ('chain_fire',   'Chain of Fire', 'Keep the chain alive.',                     'sequence',  'sequence',  'ember', '["ashlands","hills"]'::jsonb, 90),
  ('ember_cascade','Ember Cascade', 'Rotate falling runes. Complete lines.',     'falling',   'falling',   'ember', '["ashlands","ruins"]'::jsonb, 100),
  ('rune_line',    'Rune Line',     'Connect every rune in one stroke.',         'one_stroke','one_stroke','metal', '["ruins","hills"]'::jsonb,    110),
  ('rune_bloom',   'Rune Bloom',    'Combine runes to grow them.',               'bloom',     'bloom',     'frost', '["forest","ruins"]'::jsonb,   120)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS reward_defs (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  label           TEXT NOT NULL,
  category        TEXT NOT NULL,
  sparks          BIGINT DEFAULT 0,
  kinship         BIGINT DEFAULT 0,
  stars           BIGINT DEFAULT 0,
  json            JSONB DEFAULT '{}'::jsonb,
  active          BOOLEAN DEFAULT true,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

INSERT INTO reward_defs (slug, label, category, sparks, kinship)
VALUES
  ('checkin_base',         'Check-in base Sparks',      'checkin',  250,  0),
  ('checkin_kinship',      'Check-in Kinship',          'checkin',  0,    15),
  ('ash_unit',             'Ash unit Sparks',           'ash',      90,   0),
  ('ash_kinship',          'Ash Kinship',               'ash',      0,    8),
  ('duel_win_kinship',     'Duel win Kinship',          'match',    0,    25),
  ('duel_loss_kinship',    'Duel loss Kinship',         'match',    0,    5),
  ('war_win_kinship',      'War win Kinship',           'war',      0,    50),
  ('war_loss_kinship',     'War loss Kinship',          'war',      0,    15),
  ('referral_bonus_sparks','Referral bonus Sparks',     'referral', 1000, 0),
  ('referral_bonus_kinship','Referral bonus Kinship',   'referral', 0,    50)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS verse_templates (
  id              BIGSERIAL PRIMARY KEY,
  pattern         TEXT NOT NULL,
  category        TEXT DEFAULT 'any',
  literal         BOOLEAN DEFAULT false,
  active          BOOLEAN DEFAULT true,
  sort_order      INT DEFAULT 100
);

INSERT INTO verse_templates (pattern, category, literal, sort_order)
VALUES
  ('{verb} the {noun}.',                'any',     false, 10),
  ('{adj} {noun}, {adj} {noun}.',       'any',     false, 20),
  ('The {noun} {verb}s.',               'any',     false, 30),
  ('{verb} from the {noun}.',           'any',     false, 40),
  ('{noun} is {adj}.',                  'any',     false, 50),
  ('{verb} bright, fade slow.',         'any',     false, 60),
  ('Blood remembers blood.',            'war',     true,  70),
  ('Feed the fire, {noun}.',            'welcome', false, 80),
  ('The flame remembers you.',          'streak',  true,  90),
  ('Cold ash, warm kin.',               'return',  true,  100)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS game_defs_active_idx ON game_defs (active, sort_order);
CREATE INDEX IF NOT EXISTS reward_defs_cat_idx ON reward_defs (category, active);
CREATE INDEX IF NOT EXISTS verse_templates_cat_idx ON verse_templates (category, active);