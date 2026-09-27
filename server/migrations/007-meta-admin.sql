-- TRIBES-FILE: server/migrations/007-meta-admin.sql
-- PHASE: 7 — Meta & Admin
-- Push queue, bonfires, raids, X-quests, avatars, feed extras.

-- ---------- push queue ----------
CREATE TABLE IF NOT EXISTS push_queue (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  body       TEXT NOT NULL,
  attempts   INT DEFAULT 0,
  last_error TEXT,
  send_at    TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS push_queue_pending_idx
  ON push_queue (send_at) WHERE sent_at IS NULL;

-- ---------- bonfire events (also used in economy) ----------
CREATE TABLE IF NOT EXISTS bonfire_events (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  metric      TEXT NOT NULL,
  multiplier  NUMERIC(6,2) DEFAULT 2,
  start_at    TIMESTAMPTZ DEFAULT now(),
  end_at      TIMESTAMPTZ NOT NULL,
  created_by  BIGINT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bonfire_active_idx ON bonfire_events (start_at, end_at);

-- ---------- raids / buffs ----------
CREATE TABLE IF NOT EXISTS raids (
  id            BIGSERIAL PRIMARY KEY,
  kind          TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT DEFAULT 'war-swords',
  effect_json   JSONB,
  target_tribe  BIGINT,
  starts_at     TIMESTAMPTZ DEFAULT now(),
  ends_at       TIMESTAMPTZ,
  push_sent     BOOLEAN DEFAULT false,
  kiva_posted   BOOLEAN DEFAULT false,
  created_by    BIGINT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS raids_active_idx ON raids (starts_at, ends_at);

-- ---------- X quests ----------
CREATE TABLE IF NOT EXISTS x_quests (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  icon            TEXT DEFAULT 'brand-x',
  kind            TEXT NOT NULL,
  target          TEXT,
  target_label    TEXT,
  reward_ember    BIGINT DEFAULT 0,
  per_user_limit  INT DEFAULT 1,
  max_completions INT DEFAULT 0,
  active          BOOLEAN DEFAULT true,
  sort_order      INT DEFAULT 100,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  created_by      BIGINT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS x_claims (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id      BIGINT NOT NULL REFERENCES x_quests(id) ON DELETE CASCADE,
  x_handle      TEXT NOT NULL,
  note          TEXT,
  status        TEXT DEFAULT 'pending',
  reviewed_by   BIGINT,
  reviewed_at   TIMESTAMPTZ,
  reject_reason TEXT,
  reward_paid   JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS x_claims_pending_unique
  ON x_claims (user_id, quest_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS x_claims_status_idx ON x_claims (status, created_at DESC);
CREATE INDEX IF NOT EXISTS x_claims_user_idx   ON x_claims (user_id);
CREATE INDEX IF NOT EXISTS x_claims_handle_idx ON x_claims (lower(x_handle));

CREATE TABLE IF NOT EXISTS x_handle_owners (
  x_handle   TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_at  TIMESTAMPTZ DEFAULT now()
);

-- ---------- gift codes ----------
CREATE TABLE IF NOT EXISTS codes (
  code       TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  amount     BIGINT NOT NULL,
  max_uses   INT DEFAULT 0,
  uses       INT DEFAULT 0,
  note       TEXT,
  expires_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS code_redemptions (
  code    TEXT,
  user_id BIGINT,
  at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (code, user_id)
);

-- ---------- avatars ----------
CREATE TABLE IF NOT EXISTS avatars (
  id         BIGSERIAL PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  svg        TEXT NOT NULL,
  active     BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id BIGINT REFERENCES avatars(id) ON DELETE SET NULL;

-- ---------- first pack / streak insurance config ----------
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

-- ---------- month-long events ----------
CREATE TABLE IF NOT EXISTS admin_events (
  id         BIGSERIAL PRIMARY KEY,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  push       BOOLEAN DEFAULT true,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);