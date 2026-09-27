-- TRIBES-FILE: server/migrations/005-council-kiva.sql
-- PHASE: 5 — Council & Kiva
-- Kiva chat with SSE, polls, seals, chief boons, Moot elections,
-- Warband roles, Tribe Idol + forging, Charm loadouts.

-- ============================================================
-- KIVA
-- ============================================================
CREATE TABLE IF NOT EXISTS kiva_messages (
  id         BIGSERIAL PRIMARY KEY,
  tribe_id   BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  body       TEXT,
  kind       TEXT DEFAULT 'chat',       -- chat | system | war | relic | level | poll
  pinned     BOOLEAN DEFAULT false,
  sealed_at  TIMESTAMPTZ,                -- set when someone seals (pins) it
  sealed_by  BIGINT,
  poll_data  JSONB,                      -- { q, opts: [{ t, v }], ends_at, chief_lock }
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kiva_tribe_idx   ON kiva_messages (tribe_id, id DESC);
CREATE INDEX IF NOT EXISTS kiva_pinned_idx  ON kiva_messages (tribe_id, pinned) WHERE pinned = true;

CREATE TABLE IF NOT EXISTS kiva_reads (
  tribe_id     BIGINT NOT NULL,
  user_id      BIGINT NOT NULL,
  last_seen_id BIGINT DEFAULT 0,
  PRIMARY KEY (tribe_id, user_id)
);

CREATE TABLE IF NOT EXISTS kiva_reactions (
  message_id BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  emoji      TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Chief-called Curfew: while active, only the poll author can post.
CREATE TABLE IF NOT EXISTS kiva_curfews (
  tribe_id    BIGINT PRIMARY KEY,
  started_by  BIGINT NOT NULL,
  started_at  TIMESTAMPTZ DEFAULT now(),
  ends_at     TIMESTAMPTZ NOT NULL
);

-- ============================================================
-- CHIEF'S BOONS (paid buffs on the user + tribe)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_boons (
  user_id    BIGINT NOT NULL,
  boon_slug  TEXT NOT NULL,
  active     BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, boon_slug)
);

CREATE TABLE IF NOT EXISTS tribe_boons (
  tribe_id   BIGINT NOT NULL,
  boon_slug  TEXT NOT NULL,
  active     BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (tribe_id, boon_slug)
);

-- ============================================================
-- MOOT (elections)
-- ============================================================
CREATE TABLE IF NOT EXISTS musters (
  id         BIGSERIAL PRIMARY KEY,
  tribe_id   BIGINT NOT NULL,
  status     TEXT DEFAULT 'open',     -- open | closed
  slots      INT DEFAULT 3,
  opened_by  BIGINT,
  opened_at  TIMESTAMPTZ DEFAULT now(),
  closes_at  TIMESTAMPTZ,
  closed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS musters_tribe_idx ON musters (tribe_id, status);

CREATE TABLE IF NOT EXISTS muster_votes (
  muster_id    BIGINT NOT NULL REFERENCES musters(id) ON DELETE CASCADE,
  voter_id     BIGINT NOT NULL,
  candidate_id BIGINT NOT NULL,
  position     TEXT DEFAULT 'warrior',
  voted_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (muster_id, voter_id, candidate_id)
);

-- ============================================================
-- WARBAND ROLES (permanent until re-Moot)
-- ============================================================
CREATE TABLE IF NOT EXISTS war_roles (
  tribe_id    BIGINT NOT NULL,
  user_id     BIGINT NOT NULL,
  position    TEXT NOT NULL,          -- chieftain | warlord | warrior | shaman
  assigned_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (tribe_id, user_id)
);
CREATE INDEX IF NOT EXISTS war_roles_tribe_idx ON war_roles (tribe_id);

-- ============================================================
-- TRIBE IDOL (shared relic; forgeable)
-- ============================================================
CREATE TABLE IF NOT EXISTS tribe_idols (
  tribe_id       BIGINT PRIMARY KEY,
  slug           TEXT DEFAULT 'great-totem',
  name           TEXT DEFAULT 'Great Totem',
  tier           INT DEFAULT 1,
  forge_progress BIGINT DEFAULT 0,
  forge_goal     BIGINT DEFAULT 50000,
  state          TEXT DEFAULT 'dormant',      -- dormant | blazing | cracking | shattered
  buff_value     NUMERIC(6,3) DEFAULT 0.10,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idol_contributions (
  tribe_id BIGINT NOT NULL,
  user_id  BIGINT NOT NULL,
  amount   BIGINT DEFAULT 0,
  PRIMARY KEY (tribe_id, user_id)
);

-- ============================================================
-- CHARM LOADOUTS (multi-slot relic equip)
-- NOTE: user-level single-equip lives on users.equipped_relic_id.
-- This table is the parallel 3-slot loadout used by the council.
-- Both can coexist; UI exposes whichever is active in the phase.
-- ============================================================
CREATE TABLE IF NOT EXISTS relic_loadouts (
  user_id    BIGINT NOT NULL,
  slot_index INT NOT NULL,
  relic_id   BIGINT REFERENCES relics(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, slot_index)
);