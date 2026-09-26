-- =====================================================================
-- Tribe quests (admin push) and Raids/Buffs events
-- =====================================================================
CREATE TABLE IF NOT EXISTS tribe_quests (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT DEFAULT 'trials-scroll',
  goal_kind     TEXT NOT NULL,      -- donate|loyalty|trials|war_action|checkin|members
  goal_amount   BIGINT DEFAULT 1,
  reward_ember  BIGINT DEFAULT 0,   -- paid per participating member
  reward_loyalty BIGINT DEFAULT 0,
  starts_at     TIMESTAMPTZ DEFAULT now(),
  ends_at       TIMESTAMPTZ,
  active        BOOLEAN DEFAULT true,
  created_by    BIGINT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tribe_quest_progress (
  quest_id      BIGINT NOT NULL REFERENCES tribe_quests(id) ON DELETE CASCADE,
  tribe_id      BIGINT NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  progress      BIGINT DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  paid_at       TIMESTAMPTZ,
  PRIMARY KEY (quest_id, tribe_id)
);

CREATE TABLE IF NOT EXISTS raids (
  id            BIGSERIAL PRIMARY KEY,
  kind          TEXT NOT NULL,       -- 'raid' | 'buff'
  title         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT DEFAULT 'war-swords',
  effect_json   JSONB,               -- { ember_mult:1.5, duration_h:2 } etc
  target_tribe  BIGINT,              -- null = all tribes
  starts_at     TIMESTAMPTZ DEFAULT now(),
  ends_at       TIMESTAMPTZ,
  push_sent     BOOLEAN DEFAULT false,
  kiva_posted   BOOLEAN DEFAULT false,
  created_by    BIGINT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raids_active_idx ON raids (starts_at, ends_at);
