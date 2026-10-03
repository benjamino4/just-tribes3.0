-- ═══════════════════════════════════════════════════════════════════
-- FILE: server/migrations/002-relics-codes-emoji.sql
-- PURPOSE: Additional indexes for codes, emoji, and payments.
--          Extra seed data for relic events tracking.
-- DEPENDS ON: 001-foundation.sql
-- ═══════════════════════════════════════════════════════════════════

-- Codes: faster lookup by active + scope
CREATE INDEX IF NOT EXISTS codes_active_idx ON codes (active, expires_at) WHERE active = true;

-- Payments: faster lookup by user
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments (user_id, created_at DESC);

-- Ledger: faster lookup by user
CREATE INDEX IF NOT EXISTS ledger_user_idx ON ledger (user_id, created_at DESC);

-- User relics: faster lookup by relic
CREATE INDEX IF NOT EXISTS user_relics_relic_idx ON user_relics (relic_id);

-- Trial log: fast recent lookup
CREATE INDEX IF NOT EXISTS trial_log_slug_idx ON trial_log (slug, at DESC);

-- Spin log: fast daily count
CREATE INDEX IF NOT EXISTS spin_log_daily_idx ON spin_log (user_id, day_key);

-- Referral events: fast count
CREATE INDEX IF NOT EXISTS referral_referee_idx ON referral_events (referee_id);