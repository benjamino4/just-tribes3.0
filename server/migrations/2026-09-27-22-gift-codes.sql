-- =====================================================================
-- Gift Codes — universal reward codes.
-- =====================================================================

ALTER TABLE codes
  ADD COLUMN IF NOT EXISTS kind          TEXT DEFAULT 'ember',
  ADD COLUMN IF NOT EXISTS payload       JSONB,
  ADD COLUMN IF NOT EXISTS max_uses      INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_user_limit INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS starts_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scope         TEXT DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS scope_tribe_id BIGINT,
  ADD COLUMN IF NOT EXISTS hero_image_svg TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS campaign      TEXT,
  ADD COLUMN IF NOT EXISTS active        BOOLEAN DEFAULT true;

ALTER TABLE code_redemptions
  ADD COLUMN IF NOT EXISTS amount BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times  INT DEFAULT 1;

CREATE TABLE IF NOT EXISTS code_grants (
  code        TEXT NOT NULL,
  user_id     BIGINT NOT NULL,
  granted_at  TIMESTAMPTZ DEFAULT now(),
  granted_by  BIGINT,
  redeemed_at TIMESTAMPTZ,
  PRIMARY KEY (code, user_id)
);
CREATE INDEX IF NOT EXISTS code_grants_user_idx ON code_grants (user_id) WHERE redeemed_at IS NULL;
