-- =====================================================================
-- BATCH A — War restructure: tactical layer
--   * terrain per front (6 types) — modifies tactic effectiveness
--   * tactic ledger column (which named tactic produced an action)
--   * vengeance tokens (grudge) — loser earns bonus vs the same victor
--   * blood alliances — two tribes cannot war each other while allied
-- All statements idempotent: migrations re-run on every MIGRATE=1 boot.
-- =====================================================================

-- ---- terrain on each front ----
ALTER TABLE war_fronts
  ADD COLUMN IF NOT EXISTS terrain TEXT;

-- ---- record which named tactic each action used ----
ALTER TABLE war_actions
  ADD COLUMN IF NOT EXISTS tactic TEXT;
ALTER TABLE war_defender_actions
  ADD COLUMN IF NOT EXISTS tactic TEXT;

-- ---- vengeance / grudge tokens ----
CREATE TABLE IF NOT EXISTS war_vengeance (
  id           BIGSERIAL PRIMARY KEY,
  tribe_id     BIGINT NOT NULL,          -- who holds the grudge (the loser)
  target_id    BIGINT NOT NULL,          -- against whom (the victor)
  war_id       BIGINT,                   -- war that created the grudge
  tokens       INT DEFAULT 0,
  spent        INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  expires_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS war_vengeance_tribe_idx  ON war_vengeance(tribe_id, target_id);
CREATE INDEX IF NOT EXISTS war_vengeance_expiry_idx  ON war_vengeance(expires_at);

-- ---- blood alliances (tribe_a < tribe_b canonical) ----
CREATE TABLE IF NOT EXISTS blood_alliances (
  id         BIGSERIAL PRIMARY KEY,
  tribe_a    BIGINT NOT NULL,
  tribe_b    BIGINT NOT NULL,
  formed_by  BIGINT,
  active     BOOLEAN DEFAULT TRUE,
  formed_at  TIMESTAMPTZ DEFAULT now(),
  broken_at  TIMESTAMPTZ,
  UNIQUE (tribe_a, tribe_b)
);
CREATE INDEX IF NOT EXISTS blood_alliances_active_idx ON blood_alliances(active);
