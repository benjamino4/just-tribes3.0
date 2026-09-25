-- =====================================================================
-- X (Twitter) quests — admin-reviewed flow
-- =====================================================================
CREATE TABLE IF NOT EXISTS x_quests (
  id            BIGSERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT DEFAULT 'brand-x',
  kind          TEXT NOT NULL,        -- follow|retweet|like|tweet|hashtag|quote
  target        TEXT,
  target_label  TEXT,
  reward_ember  BIGINT DEFAULT 0,     -- Ember ONLY (locked decision)
  per_user_limit INT DEFAULT 1,
  max_completions INT DEFAULT 0,
  active        BOOLEAN DEFAULT true,
  sort_order    INT DEFAULT 100,
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  created_by    BIGINT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS x_claims (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id      BIGINT NOT NULL REFERENCES x_quests(id) ON DELETE CASCADE,
  x_handle      TEXT NOT NULL,
  note          TEXT,
  status        TEXT DEFAULT 'pending',  -- pending|approved|rejected
  reviewed_by   BIGINT,
  reviewed_at   TIMESTAMPTZ,
  reject_reason TEXT,
  reward_paid   JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- one pending claim per user per quest
CREATE UNIQUE INDEX IF NOT EXISTS x_claims_pending_unique
  ON x_claims (user_id, quest_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS x_claims_status_idx ON x_claims (status, created_at DESC);
CREATE INDEX IF NOT EXISTS x_claims_user_idx   ON x_claims (user_id);
CREATE INDEX IF NOT EXISTS x_claims_handle_idx ON x_claims (lower(x_handle));

-- one X handle = one TRIBES account (enforced on approval)
CREATE TABLE IF NOT EXISTS x_handle_owners (
  x_handle   TEXT PRIMARY KEY,       -- lowercase, no @
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_at  TIMESTAMPTZ DEFAULT now()
);
