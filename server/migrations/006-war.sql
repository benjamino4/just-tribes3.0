-- TRIBES-FILE: server/migrations/006-war.sql
-- PHASE: 6 — War
-- Wars, fronts, actions, momentum, legendary events, vengeance,
-- blood alliances, chronicles, rivalries, seasons.

-- ---------- wars ----------
CREATE TABLE IF NOT EXISTS wars (
  id             BIGSERIAL PRIMARY KEY,
  attacker_id    BIGINT REFERENCES tribes(id) ON DELETE CASCADE,
  defender_id    BIGINT REFERENCES tribes(id) ON DELETE CASCADE,
  challenge_id   TEXT NOT NULL,
  status         TEXT DEFAULT 'active',
  goal           BIGINT NOT NULL,
  metric         TEXT NOT NULL,
  stake_pct      INT DEFAULT 20,
  reward_ember   BIGINT DEFAULT 5000,
  attacker_start BIGINT DEFAULT 0,
  defender_start BIGINT DEFAULT 0,
  attacker_score BIGINT DEFAULT 0,
  defender_score BIGINT DEFAULT 0,
  winner_id      BIGINT,
  tribute        BIGINT DEFAULT 0,
  start_at       TIMESTAMPTZ DEFAULT now(),
  end_at         TIMESTAMPTZ NOT NULL,
  resolved_at    TIMESTAMPTZ,
  attacker_chest BIGINT DEFAULT 0,
  defender_chest BIGINT DEFAULT 0,
  stance         TEXT,
  front_count    INT DEFAULT 3,
  cry_used       TEXT
);
CREATE INDEX IF NOT EXISTS wars_active_idx  ON wars (status);
CREATE INDEX IF NOT EXISTS wars_tribes_idx  ON wars (attacker_id, defender_id);

-- ---------- fronts ----------
CREATE TABLE IF NOT EXISTS war_fronts (
  war_id         BIGINT NOT NULL,
  idx            INT NOT NULL,
  name           TEXT NOT NULL,
  terrain        TEXT,
  attacker_score BIGINT DEFAULT 0,
  defender_score BIGINT DEFAULT 0,
  fortify_until  TIMESTAMPTZ,
  PRIMARY KEY (war_id, idx)
);

-- ---------- actions ----------
CREATE TABLE IF NOT EXISTS war_actions (
  id         BIGSERIAL PRIMARY KEY,
  war_id     BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  tribe_id   BIGINT NOT NULL,
  side       TEXT NOT NULL,
  front_idx  INT NOT NULL,
  kind       TEXT NOT NULL,
  cost_ember BIGINT DEFAULT 0,
  points     BIGINT DEFAULT 0,
  multiplier NUMERIC(6,3) DEFAULT 1,
  tactic     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS war_actions_war_idx ON war_actions (war_id, side);

-- ---------- momentum ----------
CREATE TABLE IF NOT EXISTS war_momentum (
  war_id    BIGINT NOT NULL,
  tribe_id  BIGINT NOT NULL,
  tokens    INT DEFAULT 0,
  on_rout   BOOLEAN DEFAULT false,
  last_wave TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (war_id, tribe_id)
);

-- ---------- legendary ----------
CREATE TABLE IF NOT EXISTS war_legendary (
  id            BIGSERIAL PRIMARY KEY,
  war_id        BIGINT NOT NULL,
  fires_at      TIMESTAMPTZ NOT NULL,
  duration_min  INT DEFAULT 60,
  multiplier    NUMERIC(6,2) DEFAULT 3,
  triggered_by  BIGINT,
  active        BOOLEAN DEFAULT true
);
CREATE INDEX IF NOT EXISTS war_legendary_active_idx ON war_legendary (war_id, fires_at);

-- ---------- defender actions ----------
CREATE TABLE IF NOT EXISTS war_defender_actions (
  id         BIGSERIAL PRIMARY KEY,
  war_id     BIGINT NOT NULL,
  tribe_id   BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  kind       TEXT NOT NULL,
  front_idx  INT,
  cost_ember BIGINT DEFAULT 0,
  tactic     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- vengeance ----------
CREATE TABLE IF NOT EXISTS war_vengeance (
  id         BIGSERIAL PRIMARY KEY,
  tribe_id   BIGINT NOT NULL,
  target_id  BIGINT NOT NULL,
  war_id     BIGINT,
  tokens     INT DEFAULT 0,
  spent      INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS war_vengeance_tribe_idx  ON war_vengeance (tribe_id, target_id);
CREATE INDEX IF NOT EXISTS war_vengeance_expiry_idx ON war_vengeance (expires_at);

-- ---------- blood alliances ----------
CREATE TABLE IF NOT EXISTS blood_alliances (
  id         BIGSERIAL PRIMARY KEY,
  tribe_a    BIGINT NOT NULL,
  tribe_b    BIGINT NOT NULL,
  formed_by  BIGINT,
  active     BOOLEAN DEFAULT true,
  formed_at  TIMESTAMPTZ DEFAULT now(),
  broken_at  TIMESTAMPTZ,
  UNIQUE (tribe_a, tribe_b)
);
CREATE INDEX IF NOT EXISTS blood_alliances_active_idx ON blood_alliances (active);

-- ---------- chronicles ----------
CREATE TABLE IF NOT EXISTS war_chronicles (
  id              BIGSERIAL PRIMARY KEY,
  war_id          BIGINT UNIQUE NOT NULL,
  attacker_id     BIGINT NOT NULL,
  defender_id     BIGINT NOT NULL,
  winner_id       BIGINT,
  attacker_name   TEXT,
  defender_name   TEXT,
  attacker_crest  TEXT,
  defender_crest  TEXT,
  score_a         BIGINT DEFAULT 0,
  score_d         BIGINT DEFAULT 0,
  front_results   JSONB,
  tribute         BIGINT DEFAULT 0,
  top_attacker    JSONB,
  top_defender    JSONB,
  legendary_events JSONB,
  stance          TEXT,
  cry_used        TEXT,
  is_rivalry      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS war_chronicles_attacker_idx ON war_chronicles (attacker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS war_chronicles_defender_idx ON war_chronicles (defender_id, created_at DESC);

-- ---------- rivalries ----------
CREATE TABLE IF NOT EXISTS rivalries (
  id           BIGSERIAL PRIMARY KEY,
  tribe_a      BIGINT NOT NULL,
  tribe_b      BIGINT NOT NULL,
  wars_fought  INT DEFAULT 0,
  a_wins       INT DEFAULT 0,
  b_wins       INT DEFAULT 0,
  is_active    BOOLEAN DEFAULT false,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tribe_a, tribe_b)
);

-- ---------- spoils log ----------
CREATE TABLE IF NOT EXISTS war_spoils_log (
  id         BIGSERIAL PRIMARY KEY,
  war_id     BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  tribe_id   BIGINT,
  kind       TEXT NOT NULL,
  relic_id   BIGINT,
  relic_slug TEXT,
  amount     BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS war_spoils_war_idx ON war_spoils_log (war_id);

-- ---------- seasons ----------
CREATE TABLE IF NOT EXISTS seasons (
  id         BIGSERIAL PRIMARY KEY,
  n          INT NOT NULL,
  title_fmt  TEXT DEFAULT 'Conqueror of Season {n}',
  started_at TIMESTAMPTZ DEFAULT now(),
  ends_at    TIMESTAMPTZ NOT NULL,
  ended_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS season_titles (
  season_id BIGINT NOT NULL,
  tribe_id  BIGINT NOT NULL,
  title     TEXT NOT NULL,
  rank      INT NOT NULL,
  PRIMARY KEY (season_id, tribe_id)
);

CREATE TABLE IF NOT EXISTS season_rewards (
  id         BIGSERIAL PRIMARY KEY,
  season_id  BIGINT,
  user_id    BIGINT,
  tribe_id   BIGINT,
  rank       INT,
  ember      BIGINT DEFAULT 0,
  renown     BIGINT DEFAULT 0,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS season_rewards_user_idx ON season_rewards (user_id);

-- ---------- spies ----------
CREATE TABLE IF NOT EXISTS spy_missions (
  id             BIGSERIAL PRIMARY KEY,
  attacker_tribe BIGINT NOT NULL,
  target_tribe   BIGINT NOT NULL,
  spy_user       BIGINT NOT NULL,
  kind           TEXT DEFAULT 'recon',
  status         TEXT DEFAULT 'active',
  intel          JSONB,
  resolves_at    TIMESTAMPTZ NOT NULL,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spy_missions_status_idx ON spy_missions (status, resolves_at);
CREATE INDEX IF NOT EXISTS spy_missions_target_idx ON spy_missions (target_tribe);

CREATE TABLE IF NOT EXISTS tribe_counterspy (
  tribe_id   BIGINT PRIMARY KEY,
  level      INT DEFAULT 0,
  expires_at TIMESTAMPTZ
);