/* =====================================================================
   Postgres pool + base schema + migrations runner.
   MIGRATE=1 runs ./migrations/*.sql in order, each in its own tx.
===================================================================== */
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
    console.warn('[db] DATABASE_URL is not set — DB calls will fail.');
    return null;
  }
  // strip query params that conflict with our explicit ssl config
  url = url
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])sslrootcert=[^&]*/gi, '$1')
    .replace(/([?&])sslcert=[^&]*/gi, '$1')
    .replace(/([?&])sslkey=[^&]*/gi, '$1')
    .replace(/([?&])sslpassword=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?')
    .replace(/&&/g, '&');

  return new Pool({
    connectionString: url,
    ssl: url.startsWith('postgres://localhost') || url.startsWith('postgresql://localhost')
      ? false
      : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    max: 8,
    idleTimeoutMillis: 30000,
    keepAlive: true,
  });
}

export const pool = buildPool();

export async function q(text, params) {
  if (!pool) throw new Error('Database not configured (DATABASE_URL missing).');
  return pool.query(text, params);
}

/* ---------------------------------------------------------------------
   Base schema — Phase 1 only.
   Additional tables arrive in later migrations.
   Every statement is idempotent.
   --------------------------------------------------------------------- */
const SCHEMA = `
-- === config: runtime-tunable settings (DB overrides DEFAULTS in config.js) ===
CREATE TABLE IF NOT EXISTS config (
  k TEXT PRIMARY KEY,
  v TEXT
);

-- === audit: every admin action writes one row ===
CREATE TABLE IF NOT EXISTS audit (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    BIGINT,
  action      TEXT NOT NULL,
  detail      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_recent_idx ON audit (created_at DESC);

-- === users ===
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT PRIMARY KEY,
  username      TEXT,
  first_name    TEXT,
  photo_url     TEXT,
  role          TEXT DEFAULT 'Toddler',
  ember         BIGINT DEFAULT 500,
  stars         BIGINT DEFAULT 0,
  renown        BIGINT DEFAULT 0,
  streak        INT DEFAULT 0,
  last_checkin  TIMESTAMPTZ,
  ash_ready_at  TIMESTAMPTZ,
  ash_count     INT DEFAULT 0,
  ton_address   TEXT,
  tribe_id      BIGINT,
  name_color    TEXT,
  avatar_glow   TEXT,
  avatar_id     BIGINT,
  trials_state  JSONB DEFAULT '{}'::jsonb,
  is_guest      BOOLEAN DEFAULT false,
  banned        BOOLEAN DEFAULT false,
  ban_reason    TEXT,
  blessed       BOOLEAN DEFAULT false,
  wallet_verified_at TIMESTAMPTZ,
  allocation    BIGINT DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by   BIGINT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_tribe_idx      ON users (tribe_id);
CREATE INDEX IF NOT EXISTS users_renown_idx     ON users (renown DESC);
CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users (referred_by);
CREATE INDEX IF NOT EXISTS users_banned_idx     ON users (banned);

-- === tribes ===
CREATE TABLE IF NOT EXISTS tribes (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT UNIQUE NOT NULL,
  name_id         BIGINT,
  hue             INT DEFAULT 0,
  motto           TEXT DEFAULT '',
  crest           TEXT DEFAULT 'totem',
  banner          TEXT DEFAULT 'sun',
  palette         TEXT DEFAULT 'ember',
  level           INT DEFAULT 1,
  treasury        BIGINT DEFAULT 0,
  created_by      BIGINT,
  members         INT DEFAULT 0,
  renown_total    BIGINT DEFAULT 0,
  donated_total   BIGINT DEFAULT 0,
  members_total   BIGINT DEFAULT 0,
  ash_total       BIGINT DEFAULT 0,
  quests_total    BIGINT DEFAULT 0,
  checkins_total  BIGINT DEFAULT 0,
  relics_total    BIGINT DEFAULT 0,
  shares_total    BIGINT DEFAULT 0,
  wins            INT DEFAULT 0,
  losses          INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tribes_renown_idx ON tribes (renown_total DESC);

-- === tribe names pool ===
CREATE TABLE IF NOT EXISTS tribe_names (
  id                   BIGSERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  is_seed              BOOLEAN DEFAULT false,
  claimed_by_tribe_id  BIGINT
);
CREATE UNIQUE INDEX IF NOT EXISTS tribe_names_lower_unique
  ON tribe_names (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS tribe_names_claim_unique
  ON tribe_names (claimed_by_tribe_id) WHERE claimed_by_tribe_id IS NOT NULL;

-- === notifications (point 16) ===
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  type        TEXT NOT NULL,
  icon        TEXT DEFAULT 'spark',
  severity    TEXT DEFAULT 'info',
  title       TEXT NOT NULL,
  body        TEXT,
  action_kind TEXT,
  action_data JSONB,
  seen_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, created_at DESC) WHERE seen_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_user_all_idx
  ON notifications (user_id, created_at DESC);

-- === unified admin feed ===
CREATE TABLE IF NOT EXISTS admin_feed (
  id         BIGSERIAL PRIMARY KEY,
  ts         TIMESTAMPTZ DEFAULT now(),
  type       TEXT NOT NULL,
  icon       TEXT,
  severity   TEXT DEFAULT 'info',
  text       TEXT NOT NULL,
  detail     JSONB,
  actor      TEXT
);
CREATE INDEX IF NOT EXISTS admin_feed_id_desc  ON admin_feed (id DESC);
CREATE INDEX IF NOT EXISTS admin_feed_ts_desc  ON admin_feed (ts DESC);
CREATE INDEX IF NOT EXISTS admin_feed_type     ON admin_feed (type, id DESC);

-- === migrations ledger (so we can skip already-applied files) ===
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT now()
);
`;

async function runMigrations() {
  if (!pool) return;
  let files;
  try {
    files = (await fs.readdir(MIGRATIONS_DIR))
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch {
    console.log('[db] no migrations directory — skipping');
    return;
  }
  if (!files.length) { console.log('[db] no migration files'); return; }

  // ledger of already-applied migrations
  const applied = new Set(
    (await pool.query('SELECT filename FROM schema_migrations')).rows.map(r => r.filename)
  );

  for (const f of files) {
    if (applied.has(f)) { console.log('[db] skip (applied) ' + f); continue; }

    let sql = await fs.readFile(path.join(MIGRATIONS_DIR, f), 'utf8');
    if (!sql.endsWith('\n')) sql += '\n';

    const client = await pool.connect();
    try {
      console.log('[db] running migration ' + f);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log('[db] applied ' + f);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[db] migration FAILED ' + f + ':', e.message);
      client.release();
      throw e;
    }
    client.release();
  }
}

export async function initDb() {
  if (!pool) return false;
  try {
    console.log('[db] applying base schema…');
    await pool.query(SCHEMA);
    console.log('[db] base schema ready');
  } catch (e) {
    console.error('[db] base schema FAILED:', e.message);
    throw e;
  }
  if (process.env.MIGRATE === '1') {
    console.log('[db] MIGRATE=1 → running migrations');
    await runMigrations();
    console.log('[db] MIGRATE=1 → migrations complete; remove the env var next boot');
  }
  return true;
}