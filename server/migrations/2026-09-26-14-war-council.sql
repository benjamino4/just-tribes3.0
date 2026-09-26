-- =====================================================================
-- WAR COUNCIL expansion
--   * War roles (Chieftain / Warlord / Warrior / Shaman)
--   * The Muster (tribe votes a warband into war)
--   * Tribe Idols (shared relic that changes state live)
--   * Individual relic loadouts (Charms) + active/consumable relics
-- All idempotent. Runs when MIGRATE=1.
-- =====================================================================

-- ---- extend relics into Charms (individual) with domains + active use ----
ALTER TABLE relics
  ADD COLUMN IF NOT EXISTS kind         TEXT DEFAULT 'passive',  -- passive | active
  ADD COLUMN IF NOT EXISTS domain       TEXT DEFAULT 'fire',     -- fire|bone|sun|moon|ash
  ADD COLUMN IF NOT EXISTS counters     TEXT,                    -- domain this relic beats
  ADD COLUMN IF NOT EXISTS cooldown_min INT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS war_effect   TEXT;                    -- combo|slow|ward|revive|reveal

-- tag the existing four passive relics with domains
UPDATE relics SET domain='fire' WHERE slug='firestone';
UPDATE relics SET domain='bone' WHERE slug='boneidol';
UPDATE relics SET domain='sun'  WHERE slug='sundisc';
UPDATE relics SET domain='moon' WHERE slug='moonshard';

-- seed active (consumable) Charms used during war
INSERT INTO relics (slug, name, description, icon_file, rarity, buff_type, buff_value, kind, domain, counters, cooldown_min, war_effect, active) VALUES
  ('warhorn', 'Warhorn',    'Sound it to ignite a tribe-wide combo surge.',        'warhorn.webp',  'rare',      'war_combo',  0.25, 'active', 'fire', 'bone', 30, 'combo',  true),
  ('ward',    'Bone Ward',  'Raise a ward that blunts the enemy surge for a spell.','ward.webp',     'rare',      'war_slow',   0.20, 'active', 'bone', 'sun',  30, 'slow',   true),
  ('ashfang', 'Ashfang',    'Forged from a fallen tribe. Revives a broken front.',  'ashfang.webp',  'legendary', 'war_revive', 1.00, 'active', 'ash',  'fire', 60, 'revive', true),
  ('sunspear','Sun Spear',  'A siege charm that pierces enemy wards.',              'sunspear.webp', 'epic',      'war_siege',  0.30, 'active', 'sun',  'bone', 45, 'reveal', true)
ON CONFLICT (slug) DO NOTHING;

-- ---- Tribe Idols: one shared, forgeable relic per tribe ----
CREATE TABLE IF NOT EXISTS tribe_idols (
  tribe_id      BIGINT PRIMARY KEY REFERENCES tribes(id) ON DELETE CASCADE,
  slug          TEXT DEFAULT 'great-totem',
  name          TEXT DEFAULT 'Great Totem',
  tier          INT  DEFAULT 1,             -- upgrades as re-forged
  forge_progress BIGINT DEFAULT 0,          -- Ember contributed toward next tier
  forge_goal     BIGINT DEFAULT 50000,
  state         TEXT DEFAULT 'dormant',     -- dormant|blazing|cracking|shattered
  buff_value    NUMERIC(6,3) DEFAULT 0.10,  -- tribe-wide War Might multiplier bonus
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idol_contributions (
  tribe_id  BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  user_id   BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  amount    BIGINT DEFAULT 0,
  PRIMARY KEY (tribe_id, user_id)
);

-- ---- War roles: who fills each war position in a tribe ----
CREATE TABLE IF NOT EXISTS war_roles (
  tribe_id    BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  position    TEXT NOT NULL,                -- chieftain|warlord|warrior|shaman
  assigned_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (tribe_id, user_id)
);
CREATE INDEX IF NOT EXISTS war_roles_tribe_idx ON war_roles(tribe_id);

-- ---- The Muster: a tribe vote to field the warband ----
CREATE TABLE IF NOT EXISTS musters (
  id         BIGSERIAL PRIMARY KEY,
  tribe_id   BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  status     TEXT DEFAULT 'open',           -- open | closed
  slots      INT  DEFAULT 3,                -- warband seats scaled by tribe level
  opened_by  BIGINT,
  opened_at  TIMESTAMPTZ DEFAULT now(),
  closes_at  TIMESTAMPTZ,
  closed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS musters_tribe_idx ON musters(tribe_id, status);

CREATE TABLE IF NOT EXISTS muster_votes (
  muster_id    BIGINT NOT NULL REFERENCES musters(id) ON DELETE CASCADE,
  voter_id     BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  candidate_id BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  position     TEXT DEFAULT 'warrior',
  voted_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (muster_id, voter_id, candidate_id)
);

-- ---- Individual Charm loadouts (2-3 slots per member) ----
CREATE TABLE IF NOT EXISTS relic_loadouts (
  user_id    BIGINT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  slot_index INT    NOT NULL,
  relic_id   BIGINT REFERENCES relics(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, slot_index)
);

-- ---- Active relic usage log (cooldown enforcement) ----
CREATE TABLE IF NOT EXISTS relic_uses (
  id        BIGSERIAL PRIMARY KEY,
  user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relic_id  BIGINT NOT NULL REFERENCES relics(id) ON DELETE CASCADE,
  war_id    BIGINT,
  used_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relic_uses_user_idx ON relic_uses(user_id, used_at);
