CREATE TABLE IF NOT EXISTS users (
  telegram_id   BIGINT PRIMARY KEY,
  username      TEXT,
  first_name    TEXT,
  points        INTEGER DEFAULT 0,
  streak        INTEGER DEFAULT 0,
  best_streak   INTEGER DEFAULT 0,
  last_pick     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS quest_completions (
  id           SERIAL PRIMARY KEY,
  telegram_id  BIGINT NOT NULL,
  quest_id     INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(telegram_id, quest_id)
);

CREATE TABLE IF NOT EXISTS ai_chats (
  id          SERIAL PRIMARY KEY,
  prompt      TEXT NOT NULL,
  response    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);