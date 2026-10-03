import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function buildPool() {
  let url = process.env.DATABASE_URL || '';
  if (!url) { console.warn('[db] DATABASE_URL missing'); return null; }
  url = url
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])sslrootcert=[^&]*/gi, '$1')
    .replace(/([?&])sslcert=[^&]*/gi, '$1')
    .replace(/([?&])sslkey=[^&]*/gi, '$1')
    .replace(/([?&])sslpassword=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/[?&]$/, '').replace(/\?&/, '?').replace(/&&/g, '&');
  return new Pool({
    connectionString: url,
    ssl: url.startsWith('postgres://localhost') || url.startsWith('postgresql://localhost')
      ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    max: 8,
    idleTimeoutMillis: 30000,
    keepAlive: true,
  });
}

export const pool = buildPool();
export async function q(text, params) {
  if (!pool) throw new Error('Database not configured.');
  return pool.query(text, params);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS config (
  k TEXT PRIMARY KEY,
  v TEXT,
  category TEXT DEFAULT 'general',
  label TEXT,
  type TEXT DEFAULT 'string',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit (
  id BIGSERIAL PRIMARY KEY,
  admin_id TEXT, action TEXT NOT NULL, detail TEXT,
  before_json JSONB, after_json JSONB,
  reversible BOOLEAN DEFAULT true,
  reverted_at TIMESTAMPTZ, reverted_by TEXT,
  ip TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_recent_idx ON audit (created_at DESC);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  username TEXT, first_name TEXT, photo_url TEXT,
  role TEXT DEFAULT 'Toddler',
  sparks BIGINT DEFAULT 500,
  kinship BIGINT DEFAULT 0,
  stars BIGINT DEFAULT 0,
  streak INT DEFAULT 0,
  last_checkin TIMESTAMPTZ,
  ash_ready_at TIMESTAMPTZ, ash_count INT DEFAULT 0,
  ton_address TEXT, tribe_id BIGINT,
  name_color TEXT, avatar_glow TEXT, avatar_id BIGINT,
  trials_state JSONB DEFAULT '{}'::jsonb,
  is_guest BOOLEAN DEFAULT false,
  banned BOOLEAN DEFAULT false, ban_reason TEXT,
  blessed BOOLEAN DEFAULT false,
  wallet_verified_at TIMESTAMPTZ,
  allocation BIGINT DEFAULT 0,
  referral_code TEXT UNIQUE, referred_by BIGINT,
  referral_count INT DEFAULT 0,
  rank_rating INT DEFAULT 1000,
  rank_games INT DEFAULT 0,
  rank_wins INT DEFAULT 0,
  perf_tier TEXT DEFAULT 'balanced',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_tribe_idx ON users (tribe_id);
CREATE INDEX IF NOT EXISTS users_rank_idx ON users (rank_rating DESC);

CREATE TABLE IF NOT EXISTS tribes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  name_id BIGINT, hue INT DEFAULT 0, motto TEXT DEFAULT '',
  crest TEXT DEFAULT 'totem', banner TEXT DEFAULT 'sun', palette TEXT DEFAULT 'ember',
  level INT DEFAULT 1, treasury BIGINT DEFAULT 0, created_by BIGINT,
  members INT DEFAULT 0,
  kinship_total BIGINT DEFAULT 0,
  donated_total BIGINT DEFAULT 0, members_total BIGINT DEFAULT 0,
  wins INT DEFAULT 0, losses INT DEFAULT 0,
  forgotten BOOLEAN DEFAULT false,
  war_cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tribe_names (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL,
  is_seed BOOLEAN DEFAULT false, claimed_by_tribe_id BIGINT
);
CREATE UNIQUE INDEX IF NOT EXISTS tribe_names_lower_uq ON tribe_names (lower(name));

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL, type TEXT NOT NULL,
  icon TEXT DEFAULT 'spark', severity TEXT DEFAULT 'info',
  title TEXT NOT NULL, body TEXT, action_kind TEXT, action_data JSONB,
  seen_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_feed (
  id BIGSERIAL PRIMARY KEY,
  tribe_id BIGINT, kind TEXT NOT NULL,
  actor_id BIGINT, target_id BIGINT,
  data JSONB, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wars (
  id BIGSERIAL PRIMARY KEY,
  attacker_id BIGINT, defender_id BIGINT,
  status TEXT DEFAULT 'active',
  attacker_score BIGINT DEFAULT 0, defender_score BIGINT DEFAULT 0,
  winner_id BIGINT,
  start_at TIMESTAMPTZ DEFAULT now(), end_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  is_forgotten_opponent BOOLEAN DEFAULT false,
  intensity_phase TEXT DEFAULT 'opening'
);

CREATE TABLE IF NOT EXISTS war_fronts (
  war_id BIGINT NOT NULL, idx INT NOT NULL,
  name TEXT NOT NULL, terrain TEXT,
  attacker_score BIGINT DEFAULT 0, defender_score BIGINT DEFAULT 0,
  PRIMARY KEY (war_id, idx)
);

CREATE TABLE IF NOT EXISTS war_matches (
  id BIGSERIAL PRIMARY KEY,
  war_id BIGINT NOT NULL, front_idx INT NOT NULL,
  game_slug TEXT NOT NULL,
  attacker_id BIGINT, defender_id BIGINT,
  winner_id BIGINT, duration_ms INT DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS war_substitutions (
  id BIGSERIAL PRIMARY KEY,
  war_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  forgotten_id BIGINT NOT NULL,
  front_idx INT,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS duels (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'ranked',
  opener_id BIGINT NOT NULL, accepter_id BIGINT,
  game_slug TEXT,
  stake_sparks BIGINT DEFAULT 0,
  status TEXT DEFAULT 'open',
  winner_id BIGINT, loser_id BIGINT,
  opponent_score INT,
  opponent_rating INT,
  opponent_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS rank_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  rank_before INT, rank_after INT,
  reason TEXT, at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seat_assignments (
  id BIGSERIAL PRIMARY KEY,
  tribe_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
  position TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  week_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS forgotten_ones (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  rank_rating INT DEFAULT 1000,
  rank_games INT DEFAULT 0,
  rank_wins INT DEFAULT 0,
  personality TEXT DEFAULT 'methodical',
  style_profile JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forgotten_matches (
  id BIGSERIAL PRIMARY KEY,
  forgotten_id BIGINT NOT NULL,
  opponent_user_id BIGINT,
  game_slug TEXT NOT NULL,
  archetype TEXT NOT NULL,
  won BOOLEAN NOT NULL,
  opponent_plays JSONB,
  match_data JSONB,
  played_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rank_tiers (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  min_rating INT NOT NULL,
  max_rating INT,
  color_hex TEXT NOT NULL,
  emoji TEXT,
  sort_order INT DEFAULT 100,
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS game_defs (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  archetype TEXT NOT NULL,
  engine TEXT NOT NULL,
  material TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  min_duration_ms INT DEFAULT 30000,
  max_duration_ms INT DEFAULT 90000,
  terrain_pool JSONB DEFAULT '[]'::jsonb,
  config_json JSONB DEFAULT '{}'::jsonb,
  sort_order INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relics (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  description TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'common',
  category TEXT NOT NULL DEFAULT 'flame',
  effect_key TEXT, effect_value NUMERIC(10,4) DEFAULT 0,
  icon_svg TEXT,
  sort_order INT DEFAULT 100,
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS user_relics (
  user_id BIGINT NOT NULL, relic_id BIGINT NOT NULL,
  count INT DEFAULT 1, first_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, relic_id)
);

CREATE TABLE IF NOT EXISTS relic_slots (
  user_id BIGINT NOT NULL,
  category TEXT NOT NULL,
  relic_id BIGINT,
  PRIMARY KEY (user_id, category)
);

CREATE TABLE IF NOT EXISTS kiva_messages (
  id BIGSERIAL PRIMARY KEY,
  tribe_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
  body TEXT, kind TEXT DEFAULT 'chat',
  pinned BOOLEAN DEFAULT false,
  pinned_by BIGINT,
  pinned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kiva_reactions (
  message_id BIGINT NOT NULL,
  tribe_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  emoji_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji_key)
);

CREATE TABLE IF NOT EXISTS kiva_reads (
  tribe_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
  last_seen_id BIGINT DEFAULT 0,
  PRIMARY KEY (tribe_id, user_id)
);

CREATE TABLE IF NOT EXISTS referral_events (
  id BIGSERIAL PRIMARY KEY,
  referrer_id BIGINT NOT NULL,
  referee_id BIGINT UNIQUE NOT NULL,
  reward_sparks BIGINT DEFAULT 0,
  reward_kinship BIGINT DEFAULT 0,
  rewarded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'sparks',
  amount BIGINT DEFAULT 0,
  payload JSONB,
  max_uses INT DEFAULT 0, uses INT DEFAULT 0,
  per_user_limit INT DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_by BIGINT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS code_redemptions (
  code TEXT, user_id BIGINT,
  amount BIGINT DEFAULT 0, times INT DEFAULT 1,
  at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (code, user_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT, kind TEXT NOT NULL,
  charge_id TEXT UNIQUE,
  payload TEXT, amount BIGINT, currency TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emoji_defs (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  svg TEXT, image_url TEXT,
  set_slug TEXT, price_stars INT DEFAULT 0,
  sort_order INT DEFAULT 100,
  builtin BOOLEAN DEFAULT false, active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emoji_sets (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  description TEXT, price_stars INT DEFAULT 0,
  emoji_keys JSONB NOT NULL,
  sort_order INT DEFAULT 100, active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS user_emoji_sets (
  user_id BIGINT, set_slug TEXT,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, set_slug)
);

CREATE TABLE IF NOT EXISTS file_versions (
  id BIGSERIAL PRIMARY KEY,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  edited_by BIGINT,
  edited_at TIMESTAMPTZ DEFAULT now(),
  note TEXT
);
CREATE INDEX IF NOT EXISTS file_versions_path_idx ON file_versions (file_path, edited_at DESC);

CREATE TABLE IF NOT EXISTS pending_edits (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  old_content TEXT,
  new_content TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  applied_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT now()
);
`;

async function runMigrations() {
  if (!pool) return;
  let files;
  try {
    files = (await fs.readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort();
  } catch { return; }
  const applied = new Set(
    (await pool.query('SELECT filename FROM schema_migrations')).rows.map(r => r.filename)
  );
  for (const f of files) {
    if (applied.has(f)) continue;
    let sql = await fs.readFile(path.join(MIGRATIONS_DIR, f), 'utf8');
    if (!sql.endsWith('\n')) sql += '\n';
    const client = await pool.connect();
    try {
      console.log('[db] running migration ' + f);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      console.error('[db] migration FAILED ' + f + ':', e.message);
      throw e;
    }
    client.release();
  }
}

// Idempotent self-healing migration. CREATE TABLE IF NOT EXISTS never adds new
// columns to tables that already exist on legacy databases, so columns added to
// the schema above would be missing in production and cause "column … does not
// exist" boot/API crashes. These ADD COLUMN IF NOT EXISTS statements run on every
// boot and are a safe no-op once applied.
const SELF_HEAL = `
ALTER TABLE duels ADD COLUMN IF NOT EXISTS opponent_score INT;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS opponent_rating INT;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS opponent_name TEXT;
ALTER TABLE kiva_messages ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;
ALTER TABLE kiva_messages ADD COLUMN IF NOT EXISTS pinned_by BIGINT;
ALTER TABLE kiva_messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
`;

export async function initDb() {
  if (!pool) return false;
  try {
    console.log('[db] applying base schema…');
    await pool.query(SCHEMA);
    console.log('[db] base schema ready');
  } catch (e) { console.error('[db] base schema FAILED:', e.message); throw e; }
  try {
    await pool.query(SELF_HEAL);
    console.log('[db] self-healing columns ok');
  } catch (e) { console.error('[db] self-heal FAILED:', e.message); throw e; }
  try {
    const { seedEmoji } = await import('./seed_emoji.js');
    await seedEmoji(pool);
  } catch (e) { console.warn('[db] emoji seed skipped:', e.message); }
  if (process.env.MIGRATE === '1') {
    console.log('[db] MIGRATE=1 → running migrations');
    await runMigrations();
  }
  return true;
}