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
CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT);

CREATE TABLE IF NOT EXISTS audit (
  id BIGSERIAL PRIMARY KEY,
  admin_id TEXT, action TEXT NOT NULL, detail TEXT,
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
  rank_rating INT DEFAULT 1000,
  rank_games INT DEFAULT 0,
  rank_wins INT DEFAULT 0,
  perf_tier TEXT DEFAULT 'balanced',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_tribe_idx ON users (tribe_id);
CREATE INDEX IF NOT EXISTS users_kinship_idx ON users (kinship DESC);
CREATE INDEX IF NOT EXISTS users_rank_idx ON users (rank_rating DESC);
CREATE INDEX IF NOT EXISTS users_banned_idx ON users (banned);

CREATE TABLE IF NOT EXISTS tribes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  name_id BIGINT, hue INT DEFAULT 0, motto TEXT DEFAULT '',
  crest TEXT DEFAULT 'totem', banner TEXT DEFAULT 'sun', palette TEXT DEFAULT 'ember',
  level INT DEFAULT 1, treasury BIGINT DEFAULT 0, created_by BIGINT,
  members INT DEFAULT 0,
  kinship_total BIGINT DEFAULT 0,
  donated_total BIGINT DEFAULT 0, members_total BIGINT DEFAULT 0,
  ash_total BIGINT DEFAULT 0, quests_total BIGINT DEFAULT 0,
  checkins_total BIGINT DEFAULT 0, relics_total BIGINT DEFAULT 0,
  shares_total BIGINT DEFAULT 0, wins INT DEFAULT 0, losses INT DEFAULT 0,
  icon_url TEXT, name_font TEXT DEFAULT 'default',
  name_style TEXT DEFAULT 'plain', banner_style TEXT DEFAULT 'plain',
  perk_name BOOLEAN DEFAULT false, perk_icon BOOLEAN DEFAULT false,
  perk_banner BOOLEAN DEFAULT false,
  forgotten BOOLEAN DEFAULT false,
  war_cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tribes_kinship_idx ON tribes (kinship_total DESC);

CREATE TABLE IF NOT EXISTS tribe_names (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL,
  is_seed BOOLEAN DEFAULT false, claimed_by_tribe_id BIGINT
);
CREATE UNIQUE INDEX IF NOT EXISTS tribe_names_lower_uq ON tribe_names (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS tribe_names_claim_uq
  ON tribe_names (claimed_by_tribe_id) WHERE claimed_by_tribe_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL, type TEXT NOT NULL,
  icon TEXT DEFAULT 'spark', severity TEXT DEFAULT 'info',
  title TEXT NOT NULL, body TEXT, action_kind TEXT, action_data JSONB,
  seen_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notif_user_unread_idx
  ON notifications (user_id, created_at DESC) WHERE seen_at IS NULL;

CREATE TABLE IF NOT EXISTS live_feed (
  id BIGSERIAL PRIMARY KEY,
  tribe_id BIGINT, kind TEXT NOT NULL,
  actor_id BIGINT, target_id BIGINT,
  data JSONB, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_feed_tribe_idx ON live_feed (tribe_id, id DESC);

CREATE TABLE IF NOT EXISTS wars (
  id BIGSERIAL PRIMARY KEY,
  attacker_id BIGINT, defender_id BIGINT,
  status TEXT DEFAULT 'active',
  mode TEXT DEFAULT 'standard',
  goal BIGINT DEFAULT 0, metric TEXT DEFAULT 'score',
  stake_pct INT DEFAULT 20, reward_sparks BIGINT DEFAULT 0,
  attacker_score BIGINT DEFAULT 0, defender_score BIGINT DEFAULT 0,
  winner_id BIGINT, tribute BIGINT DEFAULT 0,
  start_at TIMESTAMPTZ DEFAULT now(), end_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  is_forgotten_opponent BOOLEAN DEFAULT false,
  intensity_phase TEXT DEFAULT 'opening'
);
CREATE INDEX IF NOT EXISTS wars_active_idx ON wars (status);

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
  winner_id BIGINT,
  duration_ms INT DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS war_matches_war_idx ON war_matches (war_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS duels (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'ranked',
  opener_id BIGINT NOT NULL, accepter_id BIGINT,
  game_slug TEXT,
  stake_sparks BIGINT DEFAULT 0,
  status TEXT DEFAULT 'open',
  winner_id BIGINT, loser_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS duels_status_idx ON duels (status, created_at DESC);

CREATE TABLE IF NOT EXISTS rank_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  rank_before INT, rank_after INT,
  reason TEXT, at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rank_hist_user_idx ON rank_history (user_id, at DESC);

CREATE TABLE IF NOT EXISTS seat_assignments (
  id BIGSERIAL PRIMARY KEY,
  tribe_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
  position TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  week_key TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS seat_tribe_week_idx ON seat_assignments (tribe_id, week_key);

CREATE TABLE IF NOT EXISTS relics (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  description TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'common',
  category TEXT NOT NULL DEFAULT 'flame',
  effect_key TEXT, effect_value NUMERIC(10,4) DEFAULT 0,
  icon_svg TEXT,
  sort_order INT DEFAULT 100,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relics_cat_idx ON relics (category, tier);

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

CREATE TABLE IF NOT EXISTS relic_packs (
  id BIGSERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL, description TEXT,
  price_stars INT DEFAULT 200,
  pool TEXT NOT NULL,
  odds_json JSONB NOT NULL,
  anim_preset TEXT DEFAULT 'ember',
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS relic_events (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL,
  kind TEXT NOT NULL, relic_id BIGINT, relic_slug TEXT,
  tier TEXT, detail TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relic_events_user_idx ON relic_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS kiva_messages (
  id BIGSERIAL PRIMARY KEY,
  tribe_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
  body TEXT, kind TEXT DEFAULT 'chat',
  pinned BOOLEAN DEFAULT false,
  sealed_at TIMESTAMPTZ, sealed_by BIGINT,
  poll_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kiva_tribe_idx ON kiva_messages (tribe_id, id DESC);

CREATE TABLE IF NOT EXISTS kiva_reads (
  tribe_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
  last_seen_id BIGINT DEFAULT 0,
  PRIMARY KEY (tribe_id, user_id)
);

CREATE TABLE IF NOT EXISTS kiva_curfews (
  tribe_id BIGINT PRIMARY KEY,
  started_by BIGINT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS trial_defs (
  id BIGSERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL, glyph TEXT, hint TEXT,
  reward_sparks BIGINT DEFAULT 0, reward_kinship BIGINT DEFAULT 0,
  cooldown_hours INT DEFAULT 8,
  archetype_bias TEXT,
  active BOOLEAN DEFAULT true, sort_order INT DEFAULT 100
);

CREATE TABLE IF NOT EXISTS trial_log (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL,
  slug TEXT NOT NULL, at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trial_log_user_idx ON trial_log (user_id, at DESC);

CREATE TABLE IF NOT EXISTS daily_quests (
  id BIGSERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL, description TEXT, icon TEXT DEFAULT 'trials-scroll',
  goal_kind TEXT NOT NULL, goal_amount INT DEFAULT 1,
  reward_sparks BIGINT DEFAULT 0, reward_kinship BIGINT DEFAULT 0,
  active BOOLEAN DEFAULT true, weight INT DEFAULT 100
);

CREATE TABLE IF NOT EXISTS daily_quest_log (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL,
  quest_id BIGINT NOT NULL, day_key TEXT NOT NULL,
  progress INT DEFAULT 0, claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, quest_id, day_key)
);

CREATE TABLE IF NOT EXISTS spin_config (
  id INT PRIMARY KEY DEFAULT 1,
  cooldown_hours INT DEFAULT 24,
  free_spins_per_day INT DEFAULT 1,
  max_paid_per_day INT DEFAULT 3,
  stars_per_spin INT DEFAULT 25
);
INSERT INTO spin_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS spin_rewards (
  id BIGSERIAL PRIMARY KEY, slot_index INT NOT NULL UNIQUE,
  kind TEXT NOT NULL, amount BIGINT DEFAULT 0,
  weight INT DEFAULT 100, icon TEXT, label TEXT,
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS spin_log (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL,
  day_key TEXT NOT NULL, paid BOOLEAN DEFAULT false,
  stars_cost INT DEFAULT 0,
  reward_kind TEXT, reward_amount BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_events (
  id BIGSERIAL PRIMARY KEY, referrer_id BIGINT NOT NULL,
  referee_id BIGINT UNIQUE NOT NULL,
  reward_sparks BIGINT DEFAULT 0,
  rewarded_at TIMESTAMPTZ DEFAULT now(),
  note TEXT
);

CREATE TABLE IF NOT EXISTS first_pack_config (
  id INT PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  reward_sparks BIGINT DEFAULT 2500,
  reward_kinship BIGINT DEFAULT 25,
  free_relic_slug TEXT DEFAULT 'firestone',
  duration_hours INT DEFAULT 24
);
INSERT INTO first_pack_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS first_pack_claims (
  user_id BIGINT PRIMARY KEY,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  reward_paid JSONB
);

CREATE TABLE IF NOT EXISTS streak_insurance (
  user_id BIGINT PRIMARY KEY,
  stars_spent INT DEFAULT 0,
  covers_until DATE,
  active BOOLEAN DEFAULT false,
  purchased_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS streak_insurance_config (
  id INT PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  price_stars INT DEFAULT 20,
  max_per_month INT DEFAULT 3
);
INSERT INTO streak_insurance_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'sparks',
  amount BIGINT DEFAULT 0,
  payload JSONB,
  max_uses INT DEFAULT 0, uses INT DEFAULT 0,
  per_user_limit INT DEFAULT 1,
  note TEXT, scope TEXT DEFAULT 'global',
  scope_tribe_id BIGINT,
  starts_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
  campaign TEXT, active BOOLEAN DEFAULT true,
  created_by BIGINT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS code_redemptions (
  code TEXT, user_id BIGINT,
  amount BIGINT DEFAULT 0, times INT DEFAULT 1,
  at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (code, user_id)
);

CREATE TABLE IF NOT EXISTS code_grants (
  code TEXT, user_id BIGINT,
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by BIGINT,
  redeemed_at TIMESTAMPTZ,
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

CREATE TABLE IF NOT EXISTS ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT, kind TEXT, detail TEXT,
  sparks BIGINT DEFAULT 0, kinship BIGINT DEFAULT 0, stars BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL, body TEXT NOT NULL,
  attempts INT DEFAULT 0, last_error TEXT,
  send_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_queue_pending_idx
  ON push_queue (send_at) WHERE sent_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_feed (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT now(),
  type TEXT NOT NULL, icon TEXT, severity TEXT DEFAULT 'info',
  text TEXT NOT NULL, detail JSONB, actor TEXT
);
CREATE INDEX IF NOT EXISTS admin_feed_id_desc ON admin_feed (id DESC);

CREATE TABLE IF NOT EXISTS emoji_defs (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  svg TEXT, image_url TEXT,
  set_slug TEXT, price_stars INT DEFAULT 0,
  sort_order INT DEFAULT 100,
  builtin BOOLEAN DEFAULT false, active BOOLEAN DEFAULT true,
  created_by BIGINT, created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emoji_sets (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  description TEXT, price_stars INT DEFAULT 0,
  emoji_keys JSONB NOT NULL,
  sort_order INT DEFAULT 100, active BOOLEAN DEFAULT true,
  icon_hint TEXT
);

CREATE TABLE IF NOT EXISTS user_emoji_sets (
  user_id BIGINT, set_slug TEXT,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, set_slug)
);

CREATE TABLE IF NOT EXISTS user_emoji_defs (
  user_id BIGINT, emoji_id BIGINT,
  source TEXT DEFAULT 'code',
  granted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, emoji_id)
);

CREATE TABLE IF NOT EXISTS avatars (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  svg TEXT NOT NULL, active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 100
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
  } catch { console.log('[db] no migrations directory'); return; }
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

export async function initDb() {
  if (!pool) return false;
  try {
    console.log('[db] applying base schema…');
    await pool.query(SCHEMA);
    console.log('[db] base schema ready');
  } catch (e) { console.error('[db] base schema FAILED:', e.message); throw e; }
  if (process.env.MIGRATE === '1') {
    console.log('[db] MIGRATE=1 → running migrations');
    await runMigrations();
  }
  return true;
}