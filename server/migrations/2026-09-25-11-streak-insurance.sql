-- =====================================================================
-- Streak insurance — pay Stars to protect the streak on a missed day
-- =====================================================================
CREATE TABLE IF NOT EXISTS streak_insurance (
  user_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stars_spent   INT DEFAULT 0,
  covers_until  DATE,             -- the day it protects (UTC date)
  active        BOOLEAN DEFAULT false,
  purchased_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS streak_insurance_config (
  id             INT PRIMARY KEY DEFAULT 1,
  enabled        BOOLEAN DEFAULT true,
  price_stars    INT DEFAULT 20,      -- admin-editable
  max_per_month  INT DEFAULT 3,
  updated_at     TIMESTAMPTZ DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO streak_insurance_config (id) VALUES (1) ON CONFLICT DO NOTHING;
