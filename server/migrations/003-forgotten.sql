-- ═══════════════════════════════════════════════════════════════════
-- FILE: server/migrations/003-forgotten.sql
-- PURPOSE: The Forgotten Ones — AI opponents that learn.
--          Adds tables and seeds a starter population.
-- DEPENDS ON: 001, 002
-- ═══════════════════════════════════════════════════════════════════

-- Already created in base schema: forgotten_ones, forgotten_matches

-- Performance index for matchmaking queries
CREATE INDEX IF NOT EXISTS forgotten_ones_matchmaking_idx
  ON forgotten_ones (active, rank_rating DESC) WHERE active = true;

-- Extra column: how many times this Forgotten One has been displaced from a tribe
ALTER TABLE forgotten_ones
  ADD COLUMN IF NOT EXISTS displacements INT DEFAULT 0;

-- Extra column: last time this Forgotten One was substituted in a war
ALTER TABLE forgotten_ones
  ADD COLUMN IF NOT EXISTS last_substituted_at TIMESTAMPTZ;

-- Extra column: what game archetypes it prefers (denormalized for speed)
ALTER TABLE forgotten_ones
  ADD COLUMN IF NOT EXISTS preferred_archetype TEXT DEFAULT 'reaction';

-- Index for finding Forgotten Ones by preferred archetype
CREATE INDEX IF NOT EXISTS forgotten_archetype_idx
  ON forgotten_ones (preferred_archetype) WHERE active = true;