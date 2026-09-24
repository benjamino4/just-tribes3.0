// ---------------------------------------------------------------------------
// Postgres pool + schema + optional auto-migration.
// MIGRATE=1 in env runs migrations/*.sql on boot, in order, inside one tx.
// Remove the env var after the first successful boot.
// ---------------------------------------------------------------------------
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function buildPool() {
  let url = process.env.DATABASE_URL || '';
  if (!url) {
    console.warn('[db] DATABASE_URL is not set — API calls that need the DB will fail until you add it.');
    return null;
  }
  url = url.replace(/([?&])sslmode=[^&]*/i, '$1')
           .replace(/([?&])channel_binding=[^&]*/i, '$1')
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
  treasury      BIGINT DEFAULT 0,
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
  id           BIGINT PRIMARY KEY,
  username     TEXT,
  first_name   TEXT,
  photo_url    TEXT,
  role         TEXT DEFAULT 'Toddler',
  ember        BIGINT DEFAULT 500,
  stars        BIGINT DEFAULT 0,           -- legacy, no longer read
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
  status         TEXT DEFAULT 'active',
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
  kind          TEXT,
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

CREATE TABLE IF NOT EXISTS config (
  k TEXT PRIMARY KEY,
  v TEXT
);

CREATE TABLE IF NOT EXISTS audit (
  id         BIGSERIAL PRIMARY KEY,
  admin_id   BIGINT,
  action     TEXT,
  detail     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE users    ADD COLUMN IF NOT EXISTS banned     BOOLEAN DEFAULT false;
ALTER TABLE users    ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded   BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS codes (
  code       TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  amount     BIGINT NOT NULL,
  max_uses   INT DEFAULT 0,
  uses       INT DEFAULT 0,
  note       TEXT,
  expires_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS code_redemptions (
  code    TEXT,
  user_id BIGINT,
  at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (code, user_id)
);
`;

async function runMigrations() {
  if (!pool) return;
  let files;
  try { files = (await fs.readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort(); }
  catch { console.log('[db] no migrations directory — skipping'); return; }
  if (!files.length) { console.log('[db] no migration files'); return; }

  for (const f of files) {
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, f), 'utf8');
    const client = await pool.connect();
    try {
      console.log(`[db] running migration ${f}`);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`[db] migration ${f} applied`);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`[db] migration ${f} FAILED:`, e.message);
      client.release();
      throw e;
    }
    client.release();
  }
}

export async function initDb() {
  if (!pool) return false;
  await pool.query(SCHEMA);
  console.log('[db] base schema ready');
  if (process.env.MIGRATE === '1') {
    console.log('[db] MIGRATE=1 → running migrations');
    await runMigrations();
    console.log('[db] MIGRATE=1 → migrations complete; remove the env var to skip next boot');
  }
  return true;
}