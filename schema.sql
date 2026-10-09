CREATE TABLE IF NOT EXISTS users (
  telegram_id   BIGINT PRIMARY KEY,
  username      TEXT,
  first_name    TEXT,
  points        INTEGER DEFAULT 0,
  streak        INTEGER DEFAULT 0,
  best_streak   INTEGER DEFAULT 0,
  last_pick     TEXT,
  banned        BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Self-heal: legacy tables created before these columns existed.
-- CREATE TABLE IF NOT EXISTS never adds columns, so add them idempotently.
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS best_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_pick TEXT;

CREATE TABLE IF NOT EXISTS challenges (
  id              SERIAL PRIMARY KEY,
  challenge_date  DATE UNIQUE NOT NULL,
  question        TEXT NOT NULL,
  options         JSONB NOT NULL,      -- [{ id, text }]
  outcome_text    TEXT,
  use_ai          BOOLEAN DEFAULT TRUE,
  reveal_at       TIMESTAMPTZ NOT NULL,
  winner_id       TEXT,                 -- best option
  ranking         JSONB,                -- [{ id, rank, points }] full ordered ranking
  ai_votes        JSONB,
  ai_reason       TEXT,
  status          TEXT DEFAULT 'open',  -- open | closed | revealed
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Self-heal: resolution-reason controls (feature: admin-customizable reasons).
-- show_reason lets the admin publish a verdict with NO reason shown at all;
-- ai_reason already exists and now also stores admin-authored custom reasons.
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS show_reason BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS picks (
  id            SERIAL PRIMARY KEY,
  telegram_id   BIGINT NOT NULL,
  challenge_id  INTEGER NOT NULL,
  choice        TEXT NOT NULL,
  points_earned INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(telegram_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_picks_challenge ON picks(challenge_id);
CREATE INDEX IF NOT EXISTS idx_picks_user      ON picks(telegram_id);

CREATE TABLE IF NOT EXISTS quests (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  reward       INTEGER NOT NULL,
  action_url   TEXT,
  action_type  TEXT DEFAULT 'link',
  verify_text  TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Self-heal: richer quest types + optional legal T&C agreement.
--   action_type : link | task | x_follow | research | terms
--   requires_terms / terms_text : gate completion behind an "I agree" step
--   proof_type  : none | username | link | screenshot
--                 what the player must submit after doing the task; anything
--                 other than 'none' routes the completion through admin review.
ALTER TABLE quests ADD COLUMN IF NOT EXISTS action_type    TEXT DEFAULT 'link';
ALTER TABLE quests ADD COLUMN IF NOT EXISTS verify_text    TEXT;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS requires_terms BOOLEAN DEFAULT FALSE;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS terms_text     TEXT;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS proof_type     TEXT DEFAULT 'none';

CREATE TABLE IF NOT EXISTS quest_completions (
  id           SERIAL PRIMARY KEY,
  telegram_id  BIGINT NOT NULL,
  quest_id     INTEGER NOT NULL,
  agreed_terms BOOLEAN DEFAULT FALSE,
  status       TEXT DEFAULT 'approved',   -- pending | approved | rejected
  proof_type   TEXT DEFAULT 'none',
  proof_value  TEXT,                       -- username / profile link
  proof_image  TEXT,                       -- data URL of a submitted screenshot
  reviewed_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(telegram_id, quest_id)
);

-- Self-heal for legacy quest_completions created before T&C / review tracking.
ALTER TABLE quest_completions ADD COLUMN IF NOT EXISTS agreed_terms BOOLEAN DEFAULT FALSE;
ALTER TABLE quest_completions ADD COLUMN IF NOT EXISTS status      TEXT DEFAULT 'approved';
ALTER TABLE quest_completions ADD COLUMN IF NOT EXISTS proof_type  TEXT DEFAULT 'none';
ALTER TABLE quest_completions ADD COLUMN IF NOT EXISTS proof_value TEXT;
ALTER TABLE quest_completions ADD COLUMN IF NOT EXISTS proof_image TEXT;
ALTER TABLE quest_completions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ai_chats (
  id          SERIAL PRIMARY KEY,
  prompt      TEXT NOT NULL,
  response    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Extra OpenAI-compatible AI providers the admin registers later from the
-- admin bot (name | endpoint url | model | api key). The three free providers
-- (groq/cerebras/gemini) live in code + env; these augment them at runtime.
CREATE TABLE IF NOT EXISTS ai_providers (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,       -- chat/completions endpoint
  model       TEXT NOT NULL,
  api_key     TEXT NOT NULL,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);