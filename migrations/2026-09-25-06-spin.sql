-- =====================================================================
-- Daily spin
-- =====================================================================
CREATE TABLE IF NOT EXISTS spin_config (
  id                 INT PRIMARY KEY DEFAULT 1,
  cooldown_hours     INT DEFAULT 24,
  free_spins_per_day INT DEFAULT 1,
  max_paid_per_day   INT DEFAULT 3,
  stars_per_spin     INT DEFAULT 25,       -- admin-editable
  updated_at         TIMESTAMPTZ DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO spin_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Pocket definitions (admin orders these; client renders exactly 12)
CREATE TABLE IF NOT EXISTS spin_rewards (
  id           BIGSERIAL PRIMARY KEY,
  slot_index   INT NOT NULL,          -- 0..11 pocket position
  kind         TEXT NOT NULL,         -- 'ember'|'loyalty'|'stars'|'relic'|'empty'
  amount       BIGINT DEFAULT 0,
  weight       INT DEFAULT 100,       -- higher = more likely
  icon         TEXT,                  -- optional override
  label        TEXT,
  active       BOOLEAN DEFAULT true,
  UNIQUE (slot_index)
);

-- Default 12-slot table (admin edits in Warden)
INSERT INTO spin_rewards (slot_index, kind, amount, weight, label) VALUES
  (0,  'ember',   100,  140, '100'),
  (1,  'ember',   250,  130, '250'),
  (2,  'loyalty', 5,    120, '+5'),
  (3,  'ember',   500,  100, '500'),
  (4,  'empty',   0,    90,  '—'),
  (5,  'ember',   1000, 80,  '1k'),
  (6,  'loyalty', 10,   70,  '+10'),
  (7,  'ember',   2500, 55,  '2.5k'),
  (8,  'stars',   10,   30,  '+10'),
  (9,  'relic',   0,    20,  'Relic'),
  (10, 'ember',   5000, 15,  '5k'),
  (11, 'stars',   50,   5,   '+50')
ON CONFLICT (slot_index) DO NOTHING;

CREATE TABLE IF NOT EXISTS spin_log (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL,
  day_key      TEXT NOT NULL,
  paid         BOOLEAN DEFAULT false,
  stars_cost   INT DEFAULT 0,
  reward_id    BIGINT,
  reward_kind  TEXT,
  reward_amount BIGINT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spin_log_user_day_idx ON spin_log (user_id, day_key);
CREATE INDEX IF NOT EXISTS spin_log_recent_idx   ON spin_log (created_at DESC);