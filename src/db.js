/* =====================================================================
   Postgres pool + base schema + optional migrations.
   MIGRATE=1 in env runs ./migrations/*.sql in order, each in its own tx.
   Remove the env var after the first successful boot.
===================================================================== */
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function buildPool(){
  let url = process.env.DATABASE_URL || '';
  if (!url){
    console.warn('[db] DATABASE_URL is not set — DB calls will fail.');
    return null;
  }
  // strip query params that conflict with our explicit ssl config (Aiven)
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
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    max: 8,
    idleTimeoutMillis: 30000,
    keepAlive: true,
  });
}

export const pool = buildPool();

export async function q(text, params){
  if (!pool) throw new Error('Database not configured (DATABASE_URL missing).');
  return pool.query(text, params);
}

/* ---------------------------------------------------------------------
   Base schema — safe IF NOT EXISTS. Migrations add the rest.
   --------------------------------------------------------------------- */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS tribes (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT UNIQUE NOT NULL,
  name_id       BIGINT,
  hue           INT  DEFAULT 0,
  motto         TEXT DEFAULT '',
  crest         TEXT DEFAULT 'totem',
  banner        TEXT DEFAULT 'sun',
  palette       TEXT DEFAULT 'ember',
  level         INT  DEFAULT 1,
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
  stars        BIGINT DEFAULT 0,
  loyalty      BIGINT DEFAULT 0,
  streak       INT DEFAULT 0,
  last_checkin TIMESTAMPTZ,
  ash_ready_at TIMESTAMPTZ,
  ash_count    INT DEFAULT 0,
  ton_address  TEXT,
  tribe_id     BIGINT REFERENCES tribes(id) ON DELETE SET NULL,
  name_color   TEXT,
  avatar_glow  TEXT,
  trials_state JSONB DEFAULT '{}'::jsonb,
  is_guest     BOOLEAN DEFAULT false,
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
  resolved_at    TIMESTAMPTZ,
  attacker_chest BIGINT DEFAULT 0,
  defender_chest BIGINT DEFAULT 0,
  stance         TEXT,
  front_count    INT DEFAULT 3,
  cry_used       TEXT
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
  refunded      BOOLEAN DEFAULT false,
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

CREATE TABLE IF NOT EXISTS tribe_names (
  id                   BIGSERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  is_seed              BOOLEAN DEFAULT false,
  claimed_by_tribe_id  BIGINT
);

CREATE TABLE IF NOT EXISTS trial_defs (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  glyph           TEXT,
  hint            TEXT,
  reward_ember    BIGINT DEFAULT 0,
  reward_loyalty  BIGINT DEFAULT 0,
  cooldown_hours  INT DEFAULT 20,
  max_per_window  INT DEFAULT 1,
  window_hours    INT DEFAULT 0,
  window_start_utc INT DEFAULT 0,
  active          BOOLEAN DEFAULT true,
  sort_order      INT DEFAULT 100,
  kind            TEXT DEFAULT 'standard',
  minigame        TEXT DEFAULT 'hold',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trial_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT,
  slug       TEXT,
  at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kiva_messages (
  id         BIGSERIAL PRIMARY KEY,
  tribe_id   BIGINT,
  user_id    BIGINT,
  body       TEXT,
  kind       TEXT DEFAULT 'chat',
  pinned     BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kiva_tribe_idx ON kiva_messages (tribe_id, id);

CREATE TABLE IF NOT EXISTS kiva_reads (
  tribe_id     BIGINT,
  user_id      BIGINT,
  last_seen_id BIGINT DEFAULT 0,
  PRIMARY KEY (tribe_id, user_id)
);

CREATE TABLE IF NOT EXISTS kiva_reactions (
  message_id BIGINT,
  user_id    BIGINT,
  emoji      TEXT,
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS push_queue (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS bonfire_events (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  metric      TEXT NOT NULL,
  multiplier  NUMERIC(6,2) DEFAULT 2,
  start_at    TIMESTAMPTZ DEFAULT now(),
  end_at      TIMESTAMPTZ NOT NULL,
  created_by  BIGINT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS war_fronts (
  war_id        BIGINT NOT NULL,
  idx           INT NOT NULL,
  name          TEXT NOT NULL,
  attacker_score BIGINT DEFAULT 0,
  defender_score BIGINT DEFAULT 0,
  fortify_until TIMESTAMPTZ,
  PRIMARY KEY (war_id, idx)
);

CREATE TABLE IF NOT EXISTS war_actions (
  id         BIGSERIAL PRIMARY KEY,
  war_id     BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  tribe_id   BIGINT NOT NULL,
  side       TEXT NOT NULL,
  front_idx  INT NOT NULL,
  kind       TEXT NOT NULL,
  cost_ember BIGINT DEFAULT 0,
  points     BIGINT DEFAULT 0,
  multiplier NUMERIC(6,3) DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS war_actions_war_idx ON war_actions (war_id, side);

CREATE TABLE IF NOT EXISTS war_momentum (
  war_id    BIGINT NOT NULL,
  tribe_id  BIGINT NOT NULL,
  tokens    INT DEFAULT 0,
  on_rout   BOOLEAN DEFAULT false,
  last_wave TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (war_id, tribe_id)
);

CREATE TABLE IF NOT EXISTS war_legendary (
  id            BIGSERIAL PRIMARY KEY,
  war_id        BIGINT NOT NULL,
  fires_at      TIMESTAMPTZ NOT NULL,
  duration_min  INT DEFAULT 60,
  multiplier    NUMERIC(6,2) DEFAULT 3,
  triggered_by  BIGINT,
  active        BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS war_defender_actions (
  id           BIGSERIAL PRIMARY KEY,
  war_id       BIGINT NOT NULL,
  tribe_id     BIGINT NOT NULL,
  user_id      BIGINT NOT NULL,
  kind         TEXT NOT NULL,
  front_idx    INT,
  cost_ember   BIGINT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS war_chronicles (
  id              BIGSERIAL PRIMARY KEY,
  war_id          BIGINT UNIQUE NOT NULL,
  attacker_id     BIGINT NOT NULL,
  defender_id     BIGINT NOT NULL,
  winner_id       BIGINT,
  attacker_name   TEXT,
  defender_name   TEXT,
  attacker_crest  TEXT,
  defender_crest  TEXT,
  score_a         BIGINT DEFAULT 0,
  score_d         BIGINT DEFAULT 0,
  front_results   JSONB,
  tribute         BIGINT DEFAULT 0,
  top_attacker    JSONB,
  top_defender    JSONB,
  legendary_events JSONB,
  stance          TEXT,
  cry_used        TEXT,
  is_rivalry      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rivalries (
  id             BIGSERIAL PRIMARY KEY,
  tribe_a        BIGINT NOT NULL,
  tribe_b        BIGINT NOT NULL,
  wars_fought    INT DEFAULT 0,
  a_wins         INT DEFAULT 0,
  b_wins         INT DEFAULT 0,
  is_active      BOOLEAN DEFAULT false,
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tribe_a, tribe_b)
);

CREATE TABLE IF NOT EXISTS seasons (
  id         BIGSERIAL PRIMARY KEY,
  n          INT NOT NULL,
  title_fmt  TEXT DEFAULT 'Conqueror of Season {n}',
  started_at TIMESTAMPTZ DEFAULT now(),
  ends_at    TIMESTAMPTZ NOT NULL,
  ended_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS season_titles (
  season_id BIGINT NOT NULL,
  tribe_id  BIGINT NOT NULL,
  title     TEXT NOT NULL,
  rank      INT NOT NULL,
  PRIMARY KEY (season_id, tribe_id)
);

CREATE TABLE IF NOT EXISTS cosmetic_purchases (
  user_id     BIGINT NOT NULL,
  cosmetic_id TEXT NOT NULL,
  kind        TEXT,
  value       TEXT,
  bought_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, cosmetic_id)
);

CREATE TABLE IF NOT EXISTS calendar_state (
  id             INT PRIMARY KEY DEFAULT 1,
  day            INT DEFAULT 0,
  streak_days    INT DEFAULT 0,
  total_claims   INT DEFAULT 0,
  last_claim     TIMESTAMPTZ,
  CHECK (id = 1)
);`;

async function runMigrations(){
  if (!pool) return;
  let files;
  try { files = (await fs.readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort(); }
  catch { console.log('[db] no migrations directory — skipping'); return; }
  if (!files.length){ console.log('[db] no migration files'); return; }

  for (const f of files){
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, f), 'utf8');
    const client = await pool.connect();
    try {
      console.log('[db] running migration ' + f);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('[db] migration ' + f + ' applied');
    } catch (e){
      await client.query('ROLLBACK').catch(() => {});
      console.error('[db] migration ' + f + ' FAILED:', e.message);
      client.release();
      throw e;
    }
    client.release();
  }
}

export async function initDb(){
  if (!pool) return false;
  try {
    console.log('[db] applying base schema…');
    await pool.query(SCHEMA);
    console.log('[db] base schema ready');
  } catch (e){
    console.error('[db] base schema FAILED:', e.message);
    throw e;
  }
  if (process.env.MIGRATE === '1'){
    console.log('[db] MIGRATE=1 → running migrations');
    await runMigrations();
    console.log('[db] MIGRATE=1 → migrations complete; remove the env var to skip next boot');
  }
  return true;
}
