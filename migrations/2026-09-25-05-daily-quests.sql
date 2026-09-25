-- =====================================================================
-- Daily quests (rotating pool)
-- =====================================================================
CREATE TABLE IF NOT EXISTS daily_quests (
  id            BIGSERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT DEFAULT 'trials-scroll',
  goal_kind     TEXT NOT NULL,      -- checkin|trials|donate|share|spin|kiva_msg|war_action|ash
  goal_amount   INT DEFAULT 1,
  reward_ember  BIGINT DEFAULT 0,
  reward_loyalty BIGINT DEFAULT 0,
  active        BOOLEAN DEFAULT true,
  weight        INT DEFAULT 100,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_quest_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  quest_id      BIGINT NOT NULL REFERENCES daily_quests(id) ON DELETE CASCADE,
  day_key       TEXT NOT NULL,       -- 'YYYY-MM-DD' UTC
  progress      INT DEFAULT 0,
  claimed_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, quest_id, day_key)
);

CREATE INDEX IF NOT EXISTS daily_quest_log_user_day_idx ON daily_quest_log (user_id, day_key);

-- seed a starter pool (admin can edit/delete)
INSERT INTO daily_quests (slug, title, description, icon, goal_kind, goal_amount, reward_ember, reward_loyalty, weight)
VALUES
  ('dq_checkin',  'Feed the fire',       'Check in once today.',            'home-fire',      'checkin',     1,   300, 5,  100),
  ('dq_trials2',  'Two trials',          'Complete 2 trials today.',        'trials-scroll',  'trials',      2,   500, 8,  100),
  ('dq_donate',   'Stoke the Pyre',      'Donate 500 Ember to your tribe.', 'kiva-flame',     'donate',      500, 400, 10, 80),
  ('dq_share',    'Spread the chant',    'Share TRIBES once today.',        'share',          'share',       1,   250, 6,  80),
  ('dq_ash',      'Gather ash',          'Gather ash from the pit.',        'res-ash',        'ash',         1,   300, 5,  70),
  ('dq_kiva',     'Speak in the Kiva',   'Post a message in tribe chat.',   'kiva-flame',     'kiva_msg',    1,   200, 4,  70)
ON CONFLICT (slug) DO NOTHING;
