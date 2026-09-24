-- ===========================================================================
-- TRIBES — Batch 1: War revamp foundation
-- Adds: fronts, actions, momentum, legendary, defender, chronicles,
--       rivalries, seasons, season titles, profile badges, kiva reactions,
--       kiva pins, trial daily rotation.
-- All additive. Idempotent. Non-destructive.
-- ===========================================================================

BEGIN;

-- ---------- wars: new columns ----------
ALTER TABLE wars ADD COLUMN IF NOT EXISTS stance            TEXT DEFAULT 'skirmish';
ALTER TABLE wars ADD COLUMN IF NOT EXISTS cry_used          TEXT;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS season_id         BIGINT;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS front_count       INT DEFAULT 3;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS front_goal        BIGINT DEFAULT 0;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS attacker_chest    BIGINT DEFAULT 0;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS defender_chest    BIGINT DEFAULT 0;

-- ---------- war_fronts ----------
CREATE TABLE IF NOT EXISTS war_fronts (
  id          BIGSERIAL PRIMARY KEY,
  war_id      BIGINT NOT NULL REFERENCES wars(id) ON DELETE CASCADE,
  idx         INT NOT NULL,           -- 0, 1, 2 (or 0..4 for 5 fronts)
  name        TEXT NOT NULL,
  attacker_score BIGINT DEFAULT 0,
  defender_score BIGINT DEFAULT 0,
  fortify_until  TIMESTAMPTZ,         -- defender Fortify on this front
  UNIQUE (war_id, idx)
);
CREATE INDEX IF NOT EXISTS war_fronts_war_idx ON war_fronts(war_id);

-- ---------- war_actions ----------
CREATE TABLE IF NOT EXISTS war_actions (
  id         BIGSERIAL PRIMARY KEY,
  war_id     BIGINT NOT NULL REFERENCES wars(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tribe_id   BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  side       TEXT NOT NULL,           -- attacker | defender
  front_idx  INT NOT NULL,
  kind       TEXT NOT NULL,           -- rally | chant | raid | rally_burst
  cost_ember BIGINT DEFAULT 0,
  cost_stars INT DEFAULT 0,
  points     BIGINT NOT NULL,
  multiplier NUMERIC(6,2) DEFAULT 1.0, -- legendary/CRY/rout bonuses
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS war_actions_war_idx  ON war_actions(war_id, tribe_id);
CREATE INDEX IF NOT EXISTS war_actions_user_idx ON war_actions(user_id, created_at DESC);

-- ---------- war_momentum ----------
CREATE TABLE IF NOT EXISTS war_momentum (
  war_id     BIGINT NOT NULL REFERENCES wars(id) ON DELETE CASCADE,
  tribe_id   BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  tokens     INT DEFAULT 0,
  on_rout    BOOLEAN DEFAULT false,
  last_wave  TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,           -- Stars "Momentum Lock"
  PRIMARY KEY (war_id, tribe_id)
);

-- ---------- war_legendary ----------
CREATE TABLE IF NOT EXISTS war_legendary (
  id          BIGSERIAL PRIMARY KEY,
  war_id      BIGINT NOT NULL REFERENCES wars(id) ON DELETE CASCADE,
  fires_at    TIMESTAMPTZ NOT NULL,
  duration_min INT DEFAULT 60,
  multiplier  NUMERIC(6,2) DEFAULT 3.0,
  active      BOOLEAN DEFAULT false,
  triggered_by BIGINT,                -- user_id if Star-purchased insurance
  announced_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS war_legendary_war_idx ON war_legendary(war_id);

-- ---------- war_defender_actions ----------
CREATE TABLE IF NOT EXISTS war_defender_actions (
  id         BIGSERIAL PRIMARY KEY,
  war_id     BIGINT NOT NULL REFERENCES wars(id) ON DELETE CASCADE,
  tribe_id   BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  kind       TEXT NOT NULL,           -- fortify | ambush | rally_kin
  front_idx  INT,
  cost_ember BIGINT DEFAULT 0,
  cost_stars INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS war_defender_war_idx ON war_defender_actions(war_id, tribe_id);

-- ---------- war_chronicles ----------
CREATE TABLE IF NOT EXISTS war_chronicles (
  id           BIGSERIAL PRIMARY KEY,
  war_id       BIGINT UNIQUE REFERENCES wars(id) ON DELETE CASCADE,
  attacker_id  BIGINT REFERENCES tribes(id) ON DELETE SET NULL,
  defender_id  BIGINT REFERENCES tribes(id) ON DELETE SET NULL,
  winner_id    BIGINT,
  attacker_name TEXT,
  defender_name TEXT,
  attacker_crest TEXT,
  defender_crest TEXT,
  score_a      BIGINT DEFAULT 0,
  score_d      BIGINT DEFAULT 0,
  front_results JSONB DEFAULT '[]'::jsonb,
  tribute      BIGINT DEFAULT 0,
  top_attacker JSONB DEFAULT '[]'::jsonb,
  top_defender JSONB DEFAULT '[]'::jsonb,
  legendary_events JSONB DEFAULT '[]'::jsonb,
  cry_used     TEXT,
  stance       TEXT,
  is_rivalry   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS war_chronicles_pair_idx ON war_chronicles(attacker_id, defender_id);

-- ---------- rivalries ----------
CREATE TABLE IF NOT EXISTS rivalries (
  id         BIGSERIAL PRIMARY KEY,
  tribe_a    BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  tribe_b    BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  wars_fought INT DEFAULT 0,
  a_wins     INT DEFAULT 0,
  b_wins     INT DEFAULT 0,
  is_active  BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tribe_a, tribe_b)
);

-- ---------- seasons ----------
CREATE TABLE IF NOT EXISTS seasons (
  id         BIGSERIAL PRIMARY KEY,
  n          INT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at    TIMESTAMPTZ NOT NULL,
  ended_at   TIMESTAMPTZ,
  title_fmt  TEXT DEFAULT 'Conqueror of Season {n}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS season_titles (
  id         BIGSERIAL PRIMARY KEY,
  season_id  BIGINT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  tribe_id   BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  rank       INT NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (season_id, tribe_id)
);

-- ---------- profile badges ----------
CREATE TABLE IF NOT EXISTS profile_badges (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  descr       TEXT DEFAULT '',
  icon        TEXT DEFAULT '🏅',
  category    TEXT DEFAULT 'general',
  sort_order  INT DEFAULT 100,
  active      BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
  badge_id   TEXT REFERENCES profile_badges(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

-- ---------- kiva reactions & pins ----------
CREATE TABLE IF NOT EXISTS kiva_reactions (
  message_id BIGINT NOT NULL REFERENCES kiva_messages(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS kiva_pins (
  tribe_id   BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  message_id BIGINT NOT NULL REFERENCES kiva_messages(id) ON DELETE CASCADE,
  pinned_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  pinned_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (tribe_id, message_id)
);

-- ---------- trial daily rotation ----------
ALTER TABLE trials ADD COLUMN IF NOT EXISTS minigame TEXT DEFAULT 'hold';
-- minigame can be: hold | stoke | feed | cry | sift | ad

-- ---------- seed: profile badges ----------
INSERT INTO profile_badges (id, name, descr, icon, category, sort_order) VALUES
  ('founder',       'Founder',          'Founded a tribe',             '🏛️', 'tribe',   10),
  ('chief',         'Chief',            'Led your tribe as Chief',     '👑', 'tribe',   20),
  ('warrior',       'Warrior',          'Fought in a war',             '⚔️', 'war',     30),
  ('conqueror',     'Conqueror',        'Won a war',                   '🏆', 'war',     40),
  ('warlord',       'Warlord',          'Won 10 wars',                 '🗡️', 'war',     50),
  ('rival',         'Sworn Rival',      'Fought the same tribe 3+ times','🔥','war',    60),
  ('pyrelord',      'Pyre Lord',        'Donated 1M Ember to a Pyre',  '🪨', 'tribe',   70),
  ('kin_finder',    'Kin-Finder',       'Recruited 10 members',        '🤝', 'tribe',   80),
  ('season_i',      'Conqueror I',      'Won Season I',                '🥇', 'season',  90),
  ('legendary',     'Legend Trigger',   'Triggered a Legendary Moment','⚡', 'war',    100)
ON CONFLICT (id) DO NOTHING;

-- ---------- config defaults for war revamp ----------
INSERT INTO config (k, v) VALUES
  ('war_cap_hours',                '72'),
  ('war_front_count',              '3'),
  ('war_front_names',              '["North","Center","South"]'),
  ('war_stake_min',                '15'),
  ('war_stake_max',                '40'),
  ('war_stake_by_level',           '[15,15,15,20,20,20,30,30,30,40]'),
  ('war_defender_bonus_pct',       '10'),
  ('war_mercy_rule',               '0'),
  ('war_stances',                  '[{"id":"assault","name":"Assault","desc":"+30% first 12h, -20% last 12h","first":1.3,"last":0.8,"durMult":1.0},{"id":"siege","name":"Siege","desc":"-20% first 24h, +50% last 24h","first":0.8,"last":1.5,"durMult":1.0},{"id":"skirmish","name":"Skirmish","desc":"No modifiers, half duration","first":1.0,"last":1.0,"durMult":0.5}]'),
  ('war_cries',                    '[{"id":"thunder","name":"Thunder Drum","cost":5000,"effect":"tribe_buff","magnitude":0.05,"duration_h":6,"stars":0},{"id":"blood","name":"Blood Oath","cost":15000,"effect":"double_next","magnitude":2.0,"count":10,"stars":0},{"id":"ancestor","name":"Ancestor Call","cost":30000,"effect":"instant_score","magnitude":500,"stars":0}]'),
  ('war_cry_stars_enabled',        '1'),
  ('war_cry_stars_price',          '150'),
  ('war_momentum_interval_h',      '6'),
  ('war_momentum_token_pct',       '15'),
  ('war_rout_threshold',           '4'),
  ('war_rout_bonus_pct',           '20'),
  ('war_legendary_chance',         '0.6'),
  ('war_legendary_duration_min',   '60'),
  ('war_legendary_multiplier',     '3.0'),
  ('war_legendary_stars_price',    '400'),
  ('war_defender_fortify_cost',    '8000'),
  ('war_defender_fortify_pct',     '30'),
  ('war_defender_fortify_h',       '6'),
  ('war_defender_fortify_max',     '3'),
  ('war_defender_fortify_stars',   '80'),
  ('war_defender_ambush_cost',     '12000'),
  ('war_defender_ambush_pct',      '50'),
  ('war_defender_ambush_max',      '2'),
  ('war_defender_rally_cost',      '20000'),
  ('war_defender_rally_pct',       '10'),
  ('war_defender_rally_h',         '24'),
  ('war_defender_rally_max',       '1'),
  ('war_spoils_pyre_pct',          '50'),
  ('war_spoils_contrib_pct',       '30'),
  ('war_spoils_chest_pct',         '20'),
  ('war_spoils_top_count',         '5'),
  ('war_spoils_curve',             'weighted'),
  ('war_rivalry_threshold',        '3'),
  ('war_rivalry_tribute_mult',     '2.0'),
  ('war_rivalry_banner',           '1'),
  ('war_action_rally_cost',        '500'),
  ('war_action_rally_points',      '25'),
  ('war_action_chant_cost',        '2000'),
  ('war_action_chant_points',      '150'),
  ('war_action_raid_cost',         '10000'),
  ('war_action_raid_points',       '800'),
  ('war_action_raid_cooldown_h',   '4'),
  ('season_length_weeks',          '6'),
  ('season_auto_rollover',         '0'),
  ('season_titles_count',          '3'),
  ('season_pass_stars_price',      '800'),
  ('war_chest_topup_stars',        '100'),
  ('war_chest_topup_ember',        '5000'),
  ('rally_burst_stars',            '50'),
  ('rally_burst_limit_per_war',    '3'),
  ('momentum_lock_stars',          '250'),
  ('momentum_lock_limit',          '2'),
  ('chronicle_share_enabled',      '1'),
  ('chronicle_retention',          '50')
ON CONFLICT (k) DO NOTHING;

COMMIT;