-- TRIBES-FILE: server/migrations/004-relics.sql
-- PHASE: 4 — Relics
-- Catalog, ownership, single-equip (wield), packs with pity,
-- Ashen Shards, cursed shatter, personal pause, fusion, emoji sets.

-- ---------- relic catalog ----------
CREATE TABLE IF NOT EXISTS relics (
  id            BIGSERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  rarity        TEXT NOT NULL DEFAULT 'common',    -- common | rare | epic | legendary
  category      TEXT NOT NULL DEFAULT 'personal',  -- war | tribe | personal | cursed
  cursed        BOOLEAN DEFAULT false,
  effect_key    TEXT,
  shatter_rule  TEXT,
  pause_in_war  BOOLEAN DEFAULT false,
  pack_pool     TEXT,                              -- cursed | rare | legendary
  earn_hint     TEXT,
  buff_type     TEXT DEFAULT 'none',
  buff_value    NUMERIC(10,4) DEFAULT 0,
  price_stars   INT DEFAULT 0,
  icon_file     TEXT,
  svg           TEXT,
  image_url     TEXT,
  sort_order    INT DEFAULT 100,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relics_rarity_idx  ON relics (rarity);
CREATE INDEX IF NOT EXISTS relics_pool_idx    ON relics (pack_pool) WHERE active = true;
CREATE INDEX IF NOT EXISTS relics_sort_idx    ON relics (sort_order, id);

-- ---------- user ownership ----------
CREATE TABLE IF NOT EXISTS user_relics (
  user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relic_id  BIGINT NOT NULL REFERENCES relics(id) ON DELETE CASCADE,
  count     INT DEFAULT 1,
  first_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, relic_id)
);

-- ---------- single-equip slot on the user ----------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS equipped_relic_id BIGINT REFERENCES relics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cursed_shards     INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS relic_paused_json JSONB;

-- ---------- relic packs ----------
CREATE TABLE IF NOT EXISTS relic_packs (
  id           BIGSERIAL PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  price_stars  INT DEFAULT 400,
  pool         TEXT NOT NULL,
  odds_json    JSONB NOT NULL,
  pity_epic_in INT DEFAULT 6,
  anim_preset  TEXT DEFAULT 'ember',
  anim_json    JSONB DEFAULT '{}'::jsonb,
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ---------- per-user pity ----------
CREATE TABLE IF NOT EXISTS user_pack_state (
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_slug        TEXT NOT NULL,
  total_pulls      INT DEFAULT 0,
  pulls_since_epic INT DEFAULT 0,
  PRIMARY KEY (user_id, pack_slug)
);

-- ---------- pull / shatter / fuse ledger ----------
CREATE TABLE IF NOT EXISTS relic_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tribe_id   BIGINT,
  kind       TEXT NOT NULL,
  relic_id   BIGINT,
  relic_slug TEXT,
  rarity     TEXT,
  detail     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relic_events_user_idx  ON relic_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS relic_events_tribe_idx ON relic_events (tribe_id, created_at DESC);

-- ---------- fusion audit ----------
CREATE TABLE IF NOT EXISTS relic_fusions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_rarity TEXT NOT NULL,
  to_rarity   TEXT NOT NULL,
  consumed    INT NOT NULL,
  result_id   BIGINT,
  result_slug TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ---------- emoji sets (spec point 6) ----------
CREATE TABLE IF NOT EXISTS emoji_sets (
  id          BIGSERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  price_stars INT DEFAULT 100,
  emoji_keys  JSONB NOT NULL,      -- array of emoji identifiers
  sort_order  INT DEFAULT 100,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_emoji_sets (
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_slug    TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, set_slug)
);

-- ============================================================
-- Seed the 30-relic catalog (from the design brief)
-- ============================================================

-- WAR relics (6)
INSERT INTO relics (slug, name, description, rarity, category, cursed, effect_key,
                    buff_type, buff_value, price_stars, sort_order, pack_pool, earn_hint)
VALUES
  ('warpaint', 'Warpaint', '+30% on your first 5 war contributions.', 'common', 'war', false, 'warpaint_first5',
   'warpaint_first5', 0.30, 60, 10, 'rare', 'War drop / 60 Stars'),
  ('bone_charm', 'Bone Charm', '+25% contribution while your tribe is behind.', 'rare', 'war', false, 'behind_boost',
   'behind_boost', 0.25, 200, 11, 'rare', 'War drop / 200 Stars'),
  ('ember_torch', 'Ember Torch', '+15% war contribution.', 'common', 'war', false, 'flat_war',
   'flat_war', 0.15, 60, 12, 'rare', 'War drop / 60 Stars'),
  ('ancestors_spears', 'Ancestor Spears', '+20% per Vengeance token held.', 'rare', 'war', false, 'vengeance_boost',
   'vengeance_boost', 0.20, 200, 13, 'rare', 'War drop / 200 Stars'),
  ('warchief_banner', 'Warchief Banner', '+20% war contribution, always.', 'rare', 'war', false, 'flat_war',
   'flat_war', 0.20, 200, 14, 'rare', 'War drop / 200 Stars'),
  ('siegebreaker', 'Siegebreaker', '+35% war contribution on siege terrain.', 'epic', 'war', false, 'flat_war',
   'flat_war', 0.35, 500, 15, 'legendary', 'Season reward / 500 Stars')
ON CONFLICT (slug) DO NOTHING;

-- TRIBE relics (5)
INSERT INTO relics (slug, name, description, rarity, category, cursed, effect_key,
                    buff_type, buff_value, price_stars, sort_order, pack_pool, earn_hint)
VALUES
  ('hearth_stone', 'Hearth Stone', '+10% Pyre gained from every donation.', 'common', 'tribe', false, 'pyre_gain',
   'pyre_gain', 0.10, 60, 20, 'rare', 'Tribe milestone / 60 Stars'),
  ('oracle_eye', 'Oracle Eye', 'Your tribe sees incoming war declarations 1h early.', 'rare', 'tribe', false, 'war_foresight',
   'war_foresight', 1.00, 200, 21, 'rare', 'Tribe milestone / 200 Stars'),
  ('war_drum', 'War Drum', '+5% war contribution per tribe member online.', 'rare', 'tribe', false, 'rally_online',
   'rally_online', 0.05, 200, 22, 'rare', 'Tribe milestone / 200 Stars'),
  ('sun_disc', 'Sun Disc', '+8% Ember per tap for the whole tribe.', 'rare', 'tribe', false, 'tribe_tap',
   'tribe_tap', 0.08, 200, 23, 'rare', 'Tribe milestone / 200 Stars'),
  ('firekeepers_mantle', 'Firekeepers Mantle', 'All tribe members gain +20% Ember per tap.', 'legendary', 'tribe', false, 'tribe_tap',
   'tribe_tap', 0.20, 2000, 24, 'legendary', 'Tournament win')
ON CONFLICT (slug) DO NOTHING;

-- PERSONAL relics (5)
INSERT INTO relics (slug, name, description, rarity, category, cursed, effect_key,
                    buff_type, buff_value, price_stars, sort_order, pack_pool, earn_hint)
VALUES
  ('firestone', 'Firestone', '+10% idle Ember, forever.', 'common', 'personal', false, 'idle_ember',
   'idle_ember', 0.10, 120, 30, 'rare', 'Starter bundle'),
  ('boneidol', 'Bone Idol', '+5% tribe renown share.', 'common', 'personal', false, 'renown_share',
   'renown_share', 0.05, 280, 31, 'rare', '120 Stars'),
  ('sundisc', 'Sun Disc', '+25% Ash cap & 12h offline.', 'rare', 'personal', false, 'ash_cap',
   'ash_cap', 0.25, 640, 32, 'rare', '640 Stars'),
  ('moonshard', 'Moon Shard', '2x streak rewards.', 'rare', 'personal', false, 'streak_mult',
   'streak_mult', 2.00, 520, 33, 'rare', '520 Stars'),
  ('ancestor_coin', 'Ancestor Coin', '+10% Ember from every trial.', 'rare', 'personal', false, 'trial_ember',
   'trial_ember', 0.10, 200, 34, 'rare', 'Trials milestone')
ON CONFLICT (slug) DO NOTHING;

-- CURSED relics (7) — the Cursed Pack pool
INSERT INTO relics (slug, name, description, rarity, category, cursed, effect_key,
                    shatter_rule, pause_in_war, buff_type, buff_value, sort_order, pack_pool, earn_hint)
VALUES
  ('blood_iron',      'Blood Iron',       '+60% contribution, no donation renown. Shatters on first war contribution.', 'common', 'cursed', true, 'blood_iron',       'first_war_contribution', false, 'war_boost',      0.60, 40, 'cursed', 'Cursed Pack'),
  ('shattered_star',  'Shattered Star',   '3h Ambush on Day 3. Shatters when you trigger Ambush.',                    'common', 'cursed', true, 'shattered_star',   'trigger_ambush',         false, 'war_boost',      0.50, 41, 'cursed', 'Cursed Pack'),
  ('serpent_fang',    'Serpent Fang',     '2x Vengeance. Enemies see your exact Kin total. Shatters on first war.',   'rare',   'cursed', true, 'serpent_fang',     'first_war',              false, 'vengeance_boost',1.00, 42, 'cursed', 'Cursed Pack'),
  ('frozen_heart',    'Frozen Heart',     'Raid-immune, tribe loses 25% Pyre. Shatters on first Raid against you.',   'rare',   'cursed', true, 'frozen_heart',     'first_raid',             false, 'raid_immune',    0.25, 43, 'cursed', 'Cursed Pack'),
  ('wailing_mask',    'Wailing Mask',     'Enemies see 50% weaker. Spies read your Kiva 24h old. Shatters on first war.','common','cursed',true,'wailing_mask',    'first_war',              false, 'conceal',        0.50, 44, 'cursed', 'Cursed Pack'),
  ('thunderstone',    'Thunderstone',     'Ambush window invisible to enemy scouting. Shatters on first war.',        'legendary','cursed',true,'thunderstone',    'first_war',              false, 'conceal_ambush', 1.00, 45, 'cursed', 'Cursed Pack'),
  ('ashen_crown',     'Ashen Crown',      '+40% war contribution, immune to first enemy tactic. Shatters on first war.','epic',  'cursed', true, 'ashen_crown',     'first_war',              false, 'war_boost',      0.40, 46, 'cursed', 'Cursed Pack')
ON CONFLICT (slug) DO NOTHING;

-- PERSONAL cursed (6) — pause_in_war = true (PAUSE RULE)
INSERT INTO relics (slug, name, description, rarity, category, cursed, effect_key,
                    shatter_rule, pause_in_war, buff_type, buff_value, sort_order, pack_pool, earn_hint)
VALUES
  ('hollow_bone',    'Hollow Bone',    '+80% Ember per tap, blessing halved. Shatters after 500 taps.',      'common', 'cursed', true, 'tap_boost',     'after_500_taps',   true, 'tap_boost',    0.80, 50, 'cursed', 'Cursed Pack'),
  ('ravens_eye',     'Ravens Eye',     'Rival Kiva 2h fresher, yours leaks 6h. Shatters after 3 spies.',    'common', 'cursed', true, 'spy_edge',      'after_3_spies',    true, 'spy_edge',     1.00, 51, 'cursed', 'Cursed Pack'),
  ('ember_wraith',   'Ember Wraith',   '+50% trial Ember, +50% cooldowns. Shatters after 10 trials.',         'common', 'cursed', true, 'trial_ember',   'after_10_trials',  true, 'trial_ember',  0.50, 52, 'cursed', 'Cursed Pack'),
  ('molten_core',    'Molten Core',    '+100% tap Ember for 1h, then shatters.',                              'rare',   'cursed', true, 'tap_boost',     'after_1_hour',     true, 'tap_boost',    1.00, 53, 'cursed', 'Cursed Pack'),
  ('bloodmoon_totem','Bloodmoon Totem','+45% contribution on Day 3 only. Shatters after next war.',          'epic',   'cursed', true, 'day3_boost',    'after_next_war',   true, 'day3_boost',   0.45, 54, 'cursed', 'Cursed Pack'),
  ('grave_whisper',  'Grave Whisper',  'Double blessing, no trial rewards. Shatters after 5 blessings.',     'common', 'cursed', true, 'checkin_boost', 'after_5_blessings',true, 'checkin_boost',1.00, 55, 'cursed', 'Cursed Pack')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Packs
-- ============================================================
INSERT INTO relic_packs (slug, name, description, price_stars, pool, odds_json, pity_epic_in, anim_preset)
VALUES
  ('cursed_pack', 'Cursed Pack', 'One payment, one draw. Every pull is a new cursed relic. 6th pull guarantees Epic.', 400, 'cursed',
    '{"common":0.55,"rare":0.30,"epic":0.12,"legendary":0.03}'::jsonb, 6, 'cursed'),
  ('rare_pack', 'Rare Pack', 'A chance-based draw from the earnable relic pool, with a pity guarantee.', 250, 'rare',
    '{"common":0.70,"rare":0.25,"epic":0.045,"legendary":0.005}'::jsonb, 8, 'shards'),
  ('legendary_pack', 'Legendary Pack', 'A richer draw weighted toward Epic and Legendary relics.', 800, 'legendary',
    '{"common":0.30,"rare":0.45,"epic":0.20,"legendary":0.05}'::jsonb, 4, 'goldburst')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Emoji sets (spec point 6) — 5 free, 4 paid x 5
-- ============================================================
INSERT INTO emoji_sets (slug, name, description, price_stars, emoji_keys, sort_order)
VALUES
  ('free', 'Ember Basics', 'The five emojis everyone starts with.', 0,
    '["fire","clap","swords","thumbsup","joy"]'::jsonb, 0),
  ('spirits', 'Spirits of the Flame', 'Animated spirits that move and dance.', 120,
    '["flame_flicker","spark_orbit","skull_pulse","moon_phase","bolt_strike"]'::jsonb, 10),
  ('ancestors', 'Ancestors'' Blessings', 'Ethereal, glowing, watchful.', 260,
    '["eye_blink","eagle_flap","wolf_gaze","rune_draw","halo_glow"]'::jsonb, 20),
  ('rites', 'Blood Rites', 'Deep reds, dripping, hungry.', 420,
    '["dagger_drip","blood_seal","wound_open","crack_spread","ember_trail"]'::jsonb, 30),
  ('winter', 'Winter''s Grasp', 'Frost, ice, stillness.', 420,
    '["ice_crystal","frost_breath","snowfall","freeze_shatter","aurora_wave"]'::jsonb, 40)
ON CONFLICT (slug) DO NOTHING;