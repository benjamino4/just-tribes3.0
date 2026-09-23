// ---------------------------------------------------------------------------
// Postgres pool + schema. Works with Aiven / Render managed Postgres.
// SSL FIX: strip ?sslmode=... from the URL before pg parses it and set SSL
// explicitly, otherwise Aiven throws a self-signed / sslmode warning.
// ---------------------------------------------------------------------------
import pg from 'pg';
const { Pool } = pg;

function buildPool() {
  let url = process.env.DATABASE_URL || '';
  if (!url) {
    console.warn('[db] DATABASE_URL is not set — API calls that need the DB will fail until you add it.');
    return null;
  }
  // strip sslmode (and channel_binding) from the query string; we set ssl below
  url = url.replace(/([?&])sslmode=[^&]*/i, '$1').replace(/([?&])channel_binding=[^&]*/i, '$1')
           .replace(/[?&]$/, '').replace(/\?&/, '?');
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    max: 10,
    idleTimeoutMillis: 30000,
  });
}

export const pool = buildPool();

export async function q(text, params) {
  if (!pool) throw new Error('Database not configured (DATABASE_URL missing).');
  return pool.query(text, params);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tribes (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT UNIQUE NOT NULL,
  hue           INT  DEFAULT 0,
  motto         TEXT DEFAULT '',
  crest         TEXT DEFAULT 'totem',
  treasury      BIGINT DEFAULT 0,          -- The Great Pyre
  created_by    BIGINT,
  members       INT  DEFAULT 0,
  loyalty_total   BIGINT DEFAULT 0,
  donated_total   BIGINT DEFAULT 0,
  members_total   BIGINT DEFAULT 0,
  ash_total       BIGINT DEFAULT 0,
  quests_total    BIGINT DEFAULT 0,
  checkins_total  BIGINT DEFAULT 0,
  relics_total    BIGINT DEFAULT 0,
  shares_total    BIGINT DEFAULT 0,
  wins   INT DEFAULT 0,
  losses INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id           BIGINT PRIMARY KEY,          -- telegram user id
  username     TEXT,
  first_name   TEXT,
  photo_url    TEXT,
  role         TEXT DEFAULT 'Toddler',
  ember        BIGINT DEFAULT 500,
  stars        BIGINT DEFAULT 0,
  loyalty      BIGINT DEFAULT 0,
  streak       INT DEFAULT 0,
  last_checkin TIMESTAMPTZ,
  ash_ready_at TIMESTAMPTZ,
  ash_count    INT DEFAULT 0,
  ton_address  TEXT,
  tribe_id     BIGINT REFERENCES tribes(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wars (
  id             BIGSERIAL PRIMARY KEY,
  attacker_id    BIGINT REFERENCES tribes(id) ON DELETE CASCADE,
  defender_id    BIGINT REFERENCES tribes(id) ON DELETE CASCADE,
  challenge_id   TEXT NOT NULL,
  status         TEXT DEFAULT 'active',      -- active | resolved
  goal           BIGINT NOT NULL,
  metric         TEXT NOT NULL,
  stake_pct      INT DEFAULT 20,
  reward_ember   BIGINT DEFAULT 5000,
  attacker_start BIGINT DEFAULT 0,
  defender_start BIGINT DEFAULT 0,
  attacker_score BIGINT DEFAULT 0,
  defender_score BIGINT DEFAULT 0,
  winner_id      BIGINT,
  tribute        BIGINT DEFAULT 0,
  start_at       TIMESTAMPTZ DEFAULT now(),
  end_at         TIMESTAMPTZ NOT NULL,
  resolved_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS wars_active_idx ON wars(status);
CREATE INDEX IF NOT EXISTS wars_tribes_idx ON wars(attacker_id, defender_id);

CREATE TABLE IF NOT EXISTS payments (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT,
  kind          TEXT,                        -- stars | ton
  charge_id     TEXT UNIQUE,
  payload       TEXT,
  amount        BIGINT,
  currency      TEXT,
  status        TEXT DEFAULT 'paid',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT,
  tribe_id   BIGINT,
  kind       TEXT,
  detail     TEXT,
  ember      BIGINT DEFAULT 0,
  stars      BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
`;

export async function initDb() {
  if (!pool) return false;
  await pool.query(SCHEMA);
  console.log('[db] schema ready');
  return true;
}
