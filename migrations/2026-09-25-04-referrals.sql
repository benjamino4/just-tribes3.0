-- =====================================================================
-- Referral system
-- =====================================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by   BIGINT;

CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users (referred_by);

CREATE TABLE IF NOT EXISTS referral_events (
  id            BIGSERIAL PRIMARY KEY,
  referrer_id   BIGINT NOT NULL,
  referee_id    BIGINT NOT NULL UNIQUE,  -- one referral per referee
  reward_ember  BIGINT DEFAULT 0,
  rewarded_at   TIMESTAMPTZ DEFAULT now(),
  note          TEXT
);

CREATE INDEX IF NOT EXISTS ref_events_referrer_idx ON referral_events (referrer_id, rewarded_at DESC);

-- Backfill: any user without a code gets one derived from their id
UPDATE users
   SET referral_code = 'TRB' || upper(lpad(to_hex(id), 8, '0'))
 WHERE referral_code IS NULL;