-- =====================================================================
-- Batch B2 + C + D
--   B2: pack animation presets (anim_preset on relic_packs)
--   C : relic fusion ledger, spy system, season reward payouts
--   D : per-pack animation config (anim_json)
-- Every statement is idempotent (MIGRATE=1 re-runs all migrations).
-- =====================================================================

-- ---- B2/D: pack animation preset + custom animation config ----
ALTER TABLE relic_packs ADD COLUMN IF NOT EXISTS anim_preset TEXT    DEFAULT 'ember';
ALTER TABLE relic_packs ADD COLUMN IF NOT EXISTS anim_json   JSONB   DEFAULT '{}'::jsonb;

-- ---- C: relic fusion audit (combine duplicates -> higher rarity) ----
CREATE TABLE IF NOT EXISTS relic_fusions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_rarity TEXT NOT NULL,
  to_rarity   TEXT NOT NULL,
  consumed    INT  NOT NULL,
  result_id   BIGINT,
  result_slug TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ---- C: spy system ----
-- A spy mission is launched by one tribe against another. It resolves after
-- a delay; counter-spies raise the defender's detection chance.
CREATE TABLE IF NOT EXISTS spy_missions (
  id            BIGSERIAL PRIMARY KEY,
  attacker_tribe BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  target_tribe   BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  spy_user       BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  kind           TEXT NOT NULL DEFAULT 'recon',   -- recon | sabotage
  status         TEXT NOT NULL DEFAULT 'active',  -- active | success | caught | done
  intel          JSONB,
  resolves_at    TIMESTAMPTZ NOT NULL,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spy_missions_status_idx ON spy_missions (status, resolves_at);
CREATE INDEX IF NOT EXISTS spy_missions_target_idx ON spy_missions (target_tribe);

-- Counter-spy shield: a tribe can raise detection until an expiry.
CREATE TABLE IF NOT EXISTS tribe_counterspy (
  tribe_id   BIGINT PRIMARY KEY REFERENCES tribes(id) ON DELETE CASCADE,
  level      INT DEFAULT 0,
  expires_at TIMESTAMPTZ
);

-- ---- C: season reward payout ledger ----
CREATE TABLE IF NOT EXISTS season_rewards (
  id         BIGSERIAL PRIMARY KEY,
  season_id  BIGINT,
  user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
  tribe_id   BIGINT,
  rank       INT,
  ember      BIGINT DEFAULT 0,
  loyalty    BIGINT DEFAULT 0,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS season_rewards_user_idx ON season_rewards (user_id);

-- Seed the shipped packs with sensible animation presets.
UPDATE relic_packs SET anim_preset='cursed'    WHERE slug='cursed_pack'    AND (anim_preset IS NULL OR anim_preset='ember');
UPDATE relic_packs SET anim_preset='shards'    WHERE slug='rare_pack'      AND (anim_preset IS NULL OR anim_preset='ember');
UPDATE relic_packs SET anim_preset='goldburst' WHERE slug='legendary_pack' AND (anim_preset IS NULL OR anim_preset='ember');
