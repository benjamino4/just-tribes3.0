-- 2026-09-27-30-warband-leadership.sql
-- TRIBES v4 "Rise of the Eternal Flame" — Phase A foundation.
-- Warband seats, leadership (Chief impeachment + Warlord), tournaments,
-- the war mini-game catalog, and daily bot-practice claims.
-- Fully idempotent: safe to re-run.

-- 20-seat warband ladder per tribe.
CREATE TABLE IF NOT EXISTS warband_seats (
  id          BIGSERIAL PRIMARY KEY,
  tribe_id    BIGINT NOT NULL,
  seat_no     INT    NOT NULL,
  user_id     BIGINT,
  held_since  TIMESTAMPTZ,
  last_active TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tribe_id, seat_no)
);
CREATE INDEX IF NOT EXISTS idx_warband_seats_user ON warband_seats(user_id);

-- Trial-by-Fire 1v1 challenges for a seat.
CREATE TABLE IF NOT EXISTS seat_challenges (
  id            BIGSERIAL PRIMARY KEY,
  tribe_id      BIGINT NOT NULL,
  seat_no       INT    NOT NULL,
  challenger_id BIGINT NOT NULL,
  defender_id   BIGINT,
  status        TEXT NOT NULL DEFAULT 'pending',
  game_slug     TEXT,
  winner_id     BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_seat_challenges_tribe ON seat_challenges(tribe_id, status);

-- Elected war leader (Warlord) per tribe.
CREATE TABLE IF NOT EXISTS warlords (
  tribe_id   BIGINT PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  elected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  term_ends  TIMESTAMPTZ
);

-- Bi-weekly single-elimination Warlord tournament (20p, RPS bo5 final).
CREATE TABLE IF NOT EXISTS warlord_tournaments (
  id           BIGSERIAL PRIMARY KEY,
  tribe_id     BIGINT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'scheduled',
  round        INT  NOT NULL DEFAULT 0,
  winner_id    BIGINT,
  scheduled_at TIMESTAMPTZ,
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warlord_tourn_tribe ON warlord_tournaments(tribe_id, status);

CREATE TABLE IF NOT EXISTS warlord_tourney_matches (
  id            BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL,
  round         INT NOT NULL,
  slot          INT NOT NULL,
  p1_id         BIGINT,
  p2_id         BIGINT,
  winner_id     BIGINT,
  game_slug     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  scheduled_at  TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ,
  UNIQUE (tournament_id, round, slot)
);

-- Seat auto-vacancy tournaments (when a seat holder goes inactive 7d).
CREATE TABLE IF NOT EXISTS seat_tournaments (
  id          BIGSERIAL PRIMARY KEY,
  tribe_id    BIGINT NOT NULL,
  seat_no     INT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',
  winner_id   BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Chief impeachment votes (passes at configurable %% of active members).
CREATE TABLE IF NOT EXISTS chief_impeachments (
  id          BIGSERIAL PRIMARY KEY,
  tribe_id    BIGINT NOT NULL,
  target_id   BIGINT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',
  opened_by   BIGINT,
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS impeachment_votes (
  id             BIGSERIAL PRIMARY KEY,
  impeachment_id BIGINT NOT NULL,
  user_id        BIGINT NOT NULL,
  vote           TEXT NOT NULL DEFAULT 'yes',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (impeachment_id, user_id)
);

-- War mini-game catalog (seat challenges + tournaments + bot practice).
CREATE TABLE IF NOT EXISTS war_games (
  slug       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'reflex',
  active     BOOLEAN NOT NULL DEFAULT true,
  weight     INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO war_games (slug, name, kind, weight) VALUES
  ('reflex', 'Ember Reflex',    'reflex', 10),
  ('memory', 'Ancestor Memory', 'memory', 10),
  ('rps',    'Rite of Hands',   'rps',    10)
ON CONFLICT (slug) DO NOTHING;

-- Daily bot-practice claims (once/day per user, admin-tunable reward).
CREATE TABLE IF NOT EXISTS bot_practice_claims (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL,
  claim_date   DATE NOT NULL,
  game_slug    TEXT,
  reward_ember INT NOT NULL DEFAULT 0,
  score        INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, claim_date)
);
