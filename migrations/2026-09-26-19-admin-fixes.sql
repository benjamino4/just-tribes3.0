-- =====================================================================
-- Admin center fixes (Batch: admin repairs)
--   * users.banned / ban_reason  -> Overview + Players ban flow referenced
--     these columns but no migration ever created them, so stats() threw
--     "column banned does not exist". Additive + idempotent.
--   * wallet verification for allocation -> record when a TON wallet was
--     connected/verified so an allocation snapshot can trust it.
-- Safe to re-run: every clause is IF NOT EXISTS.
-- =====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS banned            BOOLEAN     DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason        TEXT;

-- Wallet-as-verification for token allocation
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS allocation         BIGINT      DEFAULT 0;

-- Backfill: any user who already linked a TON address counts as verified.
UPDATE users
   SET wallet_verified_at = COALESCE(wallet_verified_at, now())
 WHERE ton_address IS NOT NULL AND ton_address <> '' AND wallet_verified_at IS NULL;

CREATE INDEX IF NOT EXISTS users_banned_idx ON users (banned);
CREATE INDEX IF NOT EXISTS users_wallet_idx ON users (wallet_verified_at) WHERE wallet_verified_at IS NOT NULL;
