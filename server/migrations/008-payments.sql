-- TRIBES-FILE: server/migrations/008-payments.sql
-- PHASE: 8 — Payments + Polish
-- Payments ledger additions (table exists from base schema).
-- Add cosmetic purchases + settlement upgrade columns.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS name_color TEXT,
  ADD COLUMN IF NOT EXISTS avatar_glow TEXT;

CREATE TABLE IF NOT EXISTS cosmetic_purchases (
  user_id     BIGINT NOT NULL,
  cosmetic_id TEXT NOT NULL,
  kind        TEXT,
  value       TEXT,
  bought_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, cosmetic_id)
);

-- Settlement buildings — per tribe
CREATE TABLE IF NOT EXISTS tribe_buildings (
  tribe_id    BIGINT NOT NULL,
  building_id TEXT NOT NULL,
  level       INT DEFAULT 1,
  upgraded_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (tribe_id, building_id)
);

-- Standing snapshot (optional cache; live computed from tribes)
CREATE TABLE IF NOT EXISTS standings_snapshot (
  id           BIGSERIAL PRIMARY KEY,
  kind         TEXT NOT NULL,     -- tribe | user
  rank         INT NOT NULL,
  entity_id    BIGINT NOT NULL,
  name         TEXT,
  score        BIGINT,
  taken_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS standings_snapshot_kind_rank ON standings_snapshot (kind, rank);