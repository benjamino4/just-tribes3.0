-- TRIBES-FILE: server/migrations/003-economy.sql
-- PHASE: 3 — Economy
-- Trials, daily tasks, spin, referrals, first-pack, streak insurance.

-- ---------- trials ----------
CREATE TABLE IF NOT EXISTS trial_defs (
  id               BIGSERIAL PRIMARY KEY,
  slug             TEXT UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  glyph            TEXT,
  hint             TEXT,
  reward_ember     BIGINT DEFAULT 0,
  reward_renown    BIGINT DEFAULT 0,
  cooldown_hours   INT DEFAULT 20,
  max_per_window   INT DEFAULT 1,
  window_hours     INT DEFAULT 0,
  window_start_utc INT DEFAULT 0,
  active           BOOLEAN DEFAULT true,
  sort_order       INT DEFAULT 100,
  kind             TEXT DEFAULT 'standard',
  minigame         TEXT DEFAULT 'hold',
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- self-heal: a legacy trial_defs (e.g. old 'loyalty' schema) may already exist.
-- CREATE TABLE IF NOT EXISTS never adds columns, so patch any missing ones here.
ALTER TABLE trial_defs ADD COLUMN IF NOT EXISTS reward_ember     BIGINT DEFAULT 0;
ALTER TABLE trial_defs ADD COLUMN IF NOT EXISTS reward_renown    BIGINT DEFAULT 0;
ALTER TABLE trial_defs ADD COLUMN IF NOT EXISTS cooldown_hours   INT DEFAULT 20;
ALTER TABLE trial_defs ADD COLUMN IF NOT EXISTS max_per_window   INT DEFAULT 1;
ALTER TABLE trial_defs ADD COLUMN IF NOT EXISTS window_hours     INT DEFAULT 0;
ALTER TABLE trial_defs ADD COLUMN IF NOT EXISTS window_start_utc INT DEFAULT 0;
ALTER TABLE trial_defs ADD COLUMN IF NOT EXISTS active           BOOLEAN DEFAULT true;
ALTER TABLE trial_defs ADD COLUMN IF NOT EXISTS sort_order       INT DEFAULT 100;
ALTER TABLE trial_defs ADD COLUMN IF NOT EXISTS kind             TEXT DEFAULT 'standard';
ALTER TABLE trial_defs ADD COLUMN IF NOT EXISTS minigame         TEXT DEFAULT 'hold';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'trial_defs' AND column_name = 'reward_loyalty') THEN
    UPDATE trial_defs SET reward_renown = reward_loyalty
      WHERE (reward_renown IS NULL OR reward_renown = 0) AND reward_loyalty IS NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS trial_log (
  id       BIGSERIAL PRIMARY KEY,
  user_id  BIGINT NOT NULL,
  slug     TEXT NOT NULL,
  at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trial_log_user_idx ON trial_log (user_id, at DESC);

-- ---------- daily tasks ----------
CREATE TABLE IF NOT EXISTS daily_quests (
  id             BIGSERIAL PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  icon           TEXT DEFAULT 'trials-scroll',
  goal_kind      TEXT NOT NULL,
  goal_amount    INT DEFAULT 1,
  reward_ember   BIGINT DEFAULT 0,
  reward_renown  BIGINT DEFAULT 0,
  active         BOOLEAN DEFAULT true,
  weight         INT DEFAULT 100,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- self-heal: patch a legacy daily_quests table missing newer columns.
ALTER TABLE daily_quests ADD COLUMN IF NOT EXISTS reward_ember   BIGINT DEFAULT 0;
ALTER TABLE daily_quests ADD COLUMN IF NOT EXISTS reward_renown  BIGINT DEFAULT 0;
ALTER TABLE daily_quests ADD COLUMN IF NOT EXISTS active         BOOLEAN DEFAULT true;
ALTER TABLE daily_quests ADD COLUMN IF NOT EXISTS weight         INT DEFAULT 100;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'daily_quests' AND column_name = 'reward_loyalty') THEN
    UPDATE daily_quests SET reward_renown = reward_loyalty
      WHERE (reward_renown IS NULL OR reward_renown = 0) AND reward_loyalty IS NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS daily_quest_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  quest_id   BIGINT NOT NULL REFERENCES daily_quests(id) ON DELETE CASCADE,
  day_key    TEXT NOT NULL,
  progress   INT DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, quest_id, day_key)
);
CREATE INDEX IF NOT EXISTS dq_log_user_day_idx ON daily_quest_log (user_id, day_key);

-- ---------- spin ----------
CREATE TABLE IF NOT EXISTS spin_config (
  id                 INT PRIMARY KEY DEFAULT 1,
  cooldown_hours     INT DEFAULT 24,
  free_spins_per_day INT DEFAULT 1,
  max_paid_per_day   INT DEFAULT 3,
  stars_per_spin     INT DEFAULT 25,
  updated_at         TIMESTAMPTZ DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO spin_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS spin_rewards (
  id         BIGSERIAL PRIMARY KEY,
  slot_index INT NOT NULL UNIQUE,
  kind       TEXT NOT NULL,
  amount     BIGINT DEFAULT 0,
  weight     INT DEFAULT 100,
  icon       TEXT,
  label      TEXT,
  active     BOOLEAN DEFAULT true
);

INSERT INTO spin_rewards (slot_index, kind, amount, weight, label) VALUES
  (0,  'ember',   100,  140, '100'),
  (1,  'ember',   250,  130, '250'),
  (2,  'renown',  5,    120, '+5'),
  (3,  'ember',   500,  100, '500'),
  (4,  'empty',   0,    90,  '—'),
  (5,  'ember',   1000, 80,  '1k'),
  (6,  'renown',  10,   70,  '+10'),
  (7,  'ember',   2500, 55,  '2.5k'),
  (8,  'stars',   10,   30,  '+10'),
  (9,  'relic',   0,    20,  'Relic'),
  (10, 'ember',   5000, 15,  '5k'),
  (11, 'stars',   50,   5,   '+50')
ON CONFLICT (slot_index) DO NOTHING;

CREATE TABLE IF NOT EXISTS spin_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  day_key       TEXT NOT NULL,
  paid          BOOLEAN DEFAULT false,
  stars_cost    INT DEFAULT 0,
  reward_id     BIGINT,
  reward_kind   TEXT,
  reward_amount BIGINT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spin_log_user_day_idx ON spin_log (user_id, day_key);

-- ---------- referrals ----------
CREATE TABLE IF NOT EXISTS referral_events (
  id            BIGSERIAL PRIMARY KEY,
  referrer_id   BIGINT NOT NULL,
  referee_id    BIGINT NOT NULL UNIQUE,
  reward_ember  BIGINT DEFAULT 0,
  rewarded_at   TIMESTAMPTZ DEFAULT now(),
  note          TEXT
);
CREATE INDEX IF NOT EXISTS ref_events_referrer_idx ON referral_events (referrer_id, rewarded_at DESC);

UPDATE users
   SET referral_code = 'TRB' || upper(lpad(to_hex(id), 8, '0'))
 WHERE referral_code IS NULL;

-- ---------- first pack ----------
CREATE TABLE IF NOT EXISTS first_pack_config (
  id              INT PRIMARY KEY DEFAULT 1,
  enabled         BOOLEAN DEFAULT true,
  reward_ember    BIGINT DEFAULT 2500,
  reward_renown   BIGINT DEFAULT 25,
  free_relic_slug TEXT DEFAULT 'firestone',
  duration_hours  INT DEFAULT 24,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO first_pack_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS first_pack_claims (
  user_id    BIGINT PRIMARY KEY,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  reward_paid JSONB
);

-- ---------- streak insurance ----------
CREATE TABLE IF NOT EXISTS streak_insurance (
  user_id      BIGINT PRIMARY KEY,
  stars_spent  INT DEFAULT 0,
  covers_until DATE,
  active       BOOLEAN DEFAULT false,
  purchased_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS streak_insurance_config (
  id            INT PRIMARY KEY DEFAULT 1,
  enabled       BOOLEAN DEFAULT true,
  price_stars   INT DEFAULT 20,
  max_per_month INT DEFAULT 3,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO streak_insurance_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ---------- bonfire events (used by economy ticks) ----------
CREATE TABLE IF NOT EXISTS bonfire_events (
  id         BIGSERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  metric     TEXT NOT NULL,
  multiplier NUMERIC(6,2) DEFAULT 2,
  start_at   TIMESTAMPTZ DEFAULT now(),
  end_at     TIMESTAMPTZ NOT NULL,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bonfire_active_idx ON bonfire_events (start_at, end_at);

-- ---------- seed trials ----------
INSERT INTO trial_defs
  (slug, name, glyph, hint, reward_ember, reward_renown, cooldown_hours,
   max_per_window, window_hours, window_start_utc, active, sort_order, kind, minigame)
VALUES
  ('kindle', 'Kindle the Ember', '🔥',  'Hold to breathe life back into the coals.', 150, 2,  8, 1, 0, 0, true, 10, 'standard', 'hold'),
  ('stoke',  'Stoke the Blaze',  '🌬️', 'Fan the flames — keep the rhythm going.',   200, 3, 12, 1, 0, 0, true, 20, 'standard', 'stoke'),
  ('feed',   'Feed the Fire',    '🪵', 'Toss fuel on the fire before it dies down.',120, 2,  6, 1, 0, 0, true, 30, 'standard', 'feed'),
  ('warcry', 'Rally Cry',        '📣', 'Raise a cry that echoes across the tribe.', 180, 4, 10, 1, 0, 0, true, 40, 'standard', 'cry'),
  ('sift',   'Sift the Ashes',   '🌀', 'Sift the embers — pick the true spark.',    250, 3, 16, 1, 0, 0, true, 50, 'standard', 'sift')
ON CONFLICT (slug) DO NOTHING;

-- ---------- seed daily quests ----------
INSERT INTO daily_quests (slug, title, description, icon, goal_kind, goal_amount,
                          reward_ember, reward_renown, weight)
VALUES
  ('dq_checkin', 'Feed the fire',    'Check in once today.',            'home-fire',      'checkin',  1,   300, 5,  100),
  ('dq_trials2', 'Two trials',       'Complete 2 trials today.',        'trials-scroll',  'trials',   2,   500, 8,  100),
  ('dq_donate',  'Stoke the Pyre',   'Donate 500 Ember to your tribe.', 'kiva-flame',     'donate',   500, 400, 10, 80),
  ('dq_share',   'Spread the chant', 'Share TRIBES once today.',        'share',          'share',    1,   250, 6,  80),
  ('dq_ash',     'Gather ash',       'Gather ash from the pit.',        'res-ash',        'ash',      1,   300, 5,  70),
  ('dq_kiva',    'Speak in the Kiva','Post a message in tribe chat.',   'kiva-flame',     'kiva_msg', 1,   200, 4,  70)
ON CONFLICT (slug) DO NOTHING;