-- =====================================================================
-- First-time user pack
-- =====================================================================
CREATE TABLE IF NOT EXISTS first_pack_config (
  id              INT PRIMARY KEY DEFAULT 1,
  enabled         BOOLEAN DEFAULT true,
  reward_ember    BIGINT DEFAULT 2500,
  reward_loyalty  BIGINT DEFAULT 25,
  free_relic_slug TEXT DEFAULT 'firestone',
  duration_hours  INT DEFAULT 24,           -- window after first login
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO first_pack_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS first_pack_claims (
  user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  claimed_at  TIMESTAMPTZ DEFAULT now(),
  reward_paid JSONB
);
