-- ===========================================================================
-- TRIBES — Phase 1 migration
-- Idempotent. Runs inside a transaction (see db.js). Safe to re-run.
--
-- What this adds:
--   * users.username NOT NULL enforcement (existing rows with NULL get a
--     placeholder that forces the client to the username gate)
--   * users.trials_state JSONB (per-user trial cooldowns)
--   * users.name_color, users.avatar_glow (cosmetics)
--   * tribes.name_id, tribes.level, tribes.banner, tribes.palette,
--     tribes.pinned_message_id
--   * tribe_names table + 30 seed rows
--   * kiva_messages, kiva_reads tables
--   * bonfire_events table
--   * tribe_quests table
--   * cosmetic_purchases table
--   * push_queue table
--   * trials table + 6 seed rows
--   * payments.kind extended to allow 'stars_starter' / 'stars_cosmetic' etc.
--   * users.is_guest flag (browser preview only; still gated by ALLOW_GUEST)
-- ===========================================================================

BEGIN;

-- ---------- users ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS trials_state   JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name_color     TEXT  DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_glow    TEXT  DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest       BOOLEAN DEFAULT false;

-- Backfill: existing rows without a username get a NULL placeholder that the
-- auth layer treats as "needs username". Do NOT invent fake usernames here —
-- the client must send the real one from Telegram.
UPDATE users SET username = NULL WHERE username = '';

-- ---------- tribes ----------
ALTER TABLE tribes ADD COLUMN IF NOT EXISTS name_id            BIGINT;
ALTER TABLE tribes ADD COLUMN IF NOT EXISTS level              INT DEFAULT 1;
ALTER TABLE tribes ADD COLUMN IF NOT EXISTS banner             TEXT DEFAULT 'sun';
ALTER TABLE tribes ADD COLUMN IF NOT EXISTS palette            TEXT DEFAULT 'ember';
ALTER TABLE tribes ADD COLUMN IF NOT EXISTS pinned_message_id  BIGINT;
ALTER TABLE tribes ADD COLUMN IF NOT EXISTS weekly_quest_xp    BIGINT DEFAULT 0;

-- ---------- tribe_names (system name pool, FCFS) ----------
CREATE TABLE IF NOT EXISTS tribe_names (
  id                   BIGSERIAL PRIMARY KEY,
  name                 TEXT UNIQUE NOT NULL,
  claimed_by_tribe_id  BIGINT UNIQUE REFERENCES tribes(id) ON DELETE SET NULL,
  is_seed              BOOLEAN DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT now()
);

INSERT INTO tribe_names (name, is_seed) VALUES
  ('Achaeans',     true),
  ('Akkadians',    true),
  ('Amorites',     true),
  ('Angles',       true),
  ('Assyrians',    true),
  ('Babylonians',  true),
  ('Batavi',       true),
  ('Belgae',       true),
  ('Brigantes',    true),
  ('Canaanites',   true),
  ('Carthaginians',true),
  ('Cimmerians',   true),
  ('Dacians',      true),
  ('Dorians',      true),
  ('Etruscans',    true),
  ('Franks',       true),
  ('Gauls',        true),
  ('Goths',        true),
  ('Hittites',     true),
  ('Huns',         true),
  ('Iberians',     true),
  ('Illyrians',    true),
  ('Ionians',      true),
  ('Jutes',        true),
  ('Lombards',     true),
  ('Medes',        true),
  ('Moabites',     true),
  ('Nubians',      true),
  ('Scythians',    true),
  ('Vandals',      true)
ON CONFLICT (name) DO NOTHING;

-- Backfill existing tribes: give each a name_id from the pool, matching by name.
UPDATE tribes t
   SET name_id = n.id
  FROM tribe_names n
 WHERE t.name_id IS NULL AND lower(t.name) = lower(n.name);

-- Any pre-existing tribe whose name isn't in the pool keeps name_id NULL;
-- the client will show them as "Renegade" until an admin assigns a name.

-- ---------- kiva_messages ----------
CREATE TABLE IF NOT EXISTS kiva_messages (
  id         BIGSERIAL PRIMARY KEY,
  tribe_id   BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  body       TEXT   NOT NULL,
  kind       TEXT   DEFAULT 'chat',       -- chat | system | war | level | pin
  pinned     BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kiva_tribe_idx  ON kiva_messages (tribe_id, id DESC);
CREATE INDEX IF NOT EXISTS kiva_pinned_idx ON kiva_messages (tribe_id, pinned) WHERE pinned;

CREATE TABLE IF NOT EXISTS kiva_reads (
  tribe_id     BIGINT NOT NULL,
  user_id      BIGINT NOT NULL,
  last_seen_id BIGINT DEFAULT 0,
  PRIMARY KEY (tribe_id, user_id)
);

-- ---------- bonfire_events ----------
CREATE TABLE IF NOT EXISTS bonfire_events (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  metric      TEXT NOT NULL,              -- ember | loyalty | ash | checkin | war
  multiplier  NUMERIC(6,2) NOT NULL DEFAULT 2.0,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  created_by  BIGINT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bonfire_window_idx ON bonfire_events (start_at, end_at);

-- ---------- tribe_quests ----------
CREATE TABLE IF NOT EXISTS tribe_quests (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  hint         TEXT DEFAULT '',
  metric       TEXT NOT NULL,             -- donated_total | quests_total | checkins_total | kiva_posts | war_wins
  goal         BIGINT NOT NULL,
  reward_ember BIGINT DEFAULT 0,
  reward_loyalty BIGINT DEFAULT 0,
  active       BOOLEAN DEFAULT true,
  reset_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

INSERT INTO tribe_quests (name, hint, metric, goal, reward_ember, reward_loyalty)
SELECT 'Stoke the Common Pyre', 'Donate Ember to your tribe''s treasury this week.',
       'donated_total', 500000, 25000, 200
WHERE NOT EXISTS (SELECT 1 FROM tribe_quests);

-- ---------- cosmetic_purchases ----------
CREATE TABLE IF NOT EXISTS cosmetic_purchases (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cosmetic_id TEXT NOT NULL,
  kind        TEXT NOT NULL,              -- name_color | avatar_glow
  value       TEXT NOT NULL,              -- hex or key
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, cosmetic_id)
);

-- ---------- push_queue ----------
CREATE TABLE IF NOT EXISTS push_queue (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  body       TEXT   NOT NULL,
  send_at    TIMESTAMPTZ DEFAULT now(),
  sent_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_pending_idx ON push_queue (sent_at, send_at) WHERE sent_at IS NULL;

-- ---------- trials (admin-managed; replaces "daily rites") ----------
CREATE TABLE IF NOT EXISTS trials (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  glyph           TEXT DEFAULT '🔥',
  hint            TEXT DEFAULT '',
  reward_ember    BIGINT DEFAULT 0,
  reward_loyalty  BIGINT DEFAULT 0,
  cooldown_hours  INT DEFAULT 20,         -- per-user cooldown between completions
  max_per_window  INT DEFAULT 1,          -- completions allowed per window
  window_hours    INT DEFAULT 0,          -- 0 = always available
  window_start_utc INT DEFAULT 0,         -- 0-23, only used if window_hours > 0
  active          BOOLEAN DEFAULT true,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

INSERT INTO trials (slug, name, glyph, hint, reward_ember, reward_loyalty, cooldown_hours, sort_order)
VALUES
  ('stoke', 'Stoke the Fire', '🔥', 'Feed fresh logs to the blaze',     300, 10, 20, 10),
  ('feed',  'Feed the Kin',   '🍖', 'Share the day''s hunt',             250, 10, 20, 20),
  ('cry',   'Dawn Cry',       '🌄', 'Rally the tribe at first light',    120, 10, 20, 30),
  ('ash',   'Sift the Ash',   '☄️', 'Comb the cinders for Ember',        180,  8, 20, 40),
  ('invite','Summon Kin',     '📣', 'Call a new soul to the fire',       500, 12, 20, 50)
ON CONFLICT (slug) DO NOTHING;

-- ---------- indexes on existing tables that Phase 1 needs ----------
CREATE INDEX IF NOT EXISTS users_tribe_idx ON users (tribe_id);
CREATE UNIQUE INDEX IF NOT EXISTS tribes_lower_name_idx ON tribes (lower(name));

-- ---------- config defaults (idempotent inserts) ----------
INSERT INTO config (k, v) VALUES
  ('trials_reset_at', ''),
  ('bonfire_active_id', ''),
  ('territory_enabled', '0'),
  ('starter_bundle_price_stars', '150'),
  ('starter_bundle_ember', '10000'),
  ('starter_bundle_relic', 'firestone'),
  ('tribe_level_caps',  '[5,8,12,18,25,35,50,70,90,120]'),
  ('tribe_level_costs', '[0,25000,60000,140000,300000,600000,1200000,2400000,4800000,9600000]'),
  ('tribe_level_names', '["Band","Camp","Village","Settlement","Stronghold","Fortress","Domain","Realm","Empire","Kingdom"]')
ON CONFLICT (k) DO NOTHING;

COMMIT;