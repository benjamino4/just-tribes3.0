-- =====================================================================
-- BATCH B1 — RELICS FOUNDATION
--   Builds the single-equip relic model from the project brief ON TOP of
--   the existing relics/user_relics tables (the council loadout/idol system
--   is left untouched — these columns and tables are additive).
--
--   Adds: relic categories + cursed metadata, a single equipped slot per
--   user, cursed shards, the Cursed Pack + pity ledger, a pull feed log,
--   and seeds the 30-relic catalog + the Cursed Pack.
--   Every statement is idempotent (IF NOT EXISTS / ON CONFLICT) because
--   MIGRATE=1 re-runs every migration on boot.
-- =====================================================================

-- ---- relic catalog metadata for the brief's model ----
ALTER TABLE relics
  ADD COLUMN IF NOT EXISTS category     TEXT DEFAULT 'personal',  -- war|tribe|personal|cursed
  ADD COLUMN IF NOT EXISTS cursed       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS effect_key   TEXT,                     -- machine key for triggers
  ADD COLUMN IF NOT EXISTS shatter_rule TEXT,                     -- when a cursed relic shatters
  ADD COLUMN IF NOT EXISTS pause_in_war BOOLEAN DEFAULT false,    -- personal cursed relics pause in war
  ADD COLUMN IF NOT EXISTS pack_pool    TEXT,                     -- which pack this can drop from
  ADD COLUMN IF NOT EXISTS earn_hint    TEXT;                     -- how it is earned free

-- ---- single equipped relic + shards on the player ----
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS equipped_relic_id BIGINT REFERENCES relics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cursed_shards     INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS relic_paused_json JSONB;   -- preserved personal-relic timer during war

-- ---- relic packs (chance-based, pity) ----
CREATE TABLE IF NOT EXISTS relic_packs (
  id           BIGSERIAL PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  price_stars  INT DEFAULT 400,
  pool         TEXT NOT NULL,          -- 'cursed' | 'rare' | 'legendary'
  odds_json    JSONB NOT NULL,         -- { common:0.55, rare:0.30, epic:0.12, legendary:0.03 }
  pity_epic_in INT DEFAULT 6,          -- guarantee an epic by the Nth pull if none in prior N-1
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ---- per-user pity tracker per pack ----
CREATE TABLE IF NOT EXISTS user_pack_state (
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_slug        TEXT   NOT NULL,
  total_pulls      INT DEFAULT 0,
  pulls_since_epic INT DEFAULT 0,
  PRIMARY KEY (user_id, pack_slug)
);

-- ---- pull / shatter / shard ledger (also feeds the Kiva pull feed) ----
CREATE TABLE IF NOT EXISTS relic_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tribe_id   BIGINT,
  kind       TEXT NOT NULL,          -- 'pull' | 'shatter' | 'shard_redeem' | 'equip'
  relic_id   BIGINT,
  relic_slug TEXT,
  rarity     TEXT,
  detail     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relic_events_user_idx  ON relic_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS relic_events_tribe_idx ON relic_events(tribe_id, created_at);

-- ---- categorise the relics that already exist ----
UPDATE relics SET category='personal' WHERE slug IN ('firestone','moonshard');
UPDATE relics SET category='tribe'    WHERE slug IN ('boneidol','sundisc');
UPDATE relics SET category='war'      WHERE slug IN ('warhorn','ward','ashfang','sunspear');

-- =====================================================================
-- 30-RELIC CATALOG (brief Part 4). Additive; re-runnable.
--   cols: slug,name,description,rarity,category,cursed,effect_key,
--         shatter_rule,pause_in_war,pack_pool,earn_hint,buff_type,
--         buff_value,price_stars,kind,sort_order
-- =====================================================================

-- ---- WAR relics ----
INSERT INTO relics
  (slug,name,description,rarity,category,cursed,effect_key,shatter_rule,pause_in_war,pack_pool,earn_hint,buff_type,buff_value,price_stars,kind,sort_order,active)
VALUES
  ('warpaint','Warpaint','+30% on your first 5 war contributions.','common','war',false,'warpaint_first5',NULL,false,NULL,'War drop / 60 Stars','warpaint_first5',0.30,60,'passive',10,true),
  ('bone_charm','Bone Charm','+25% contribution while your tribe is behind.','rare','war',false,'behind_boost',NULL,false,NULL,'War drop / 200 Stars','behind_boost',0.25,200,'passive',11,true),
  ('ember_torch','Ember Torch','+15% war contribution. Pairs with an Ambush surge.','common','war',false,'flat_war',NULL,false,NULL,'War drop / 60 Stars','flat_war',0.15,60,'passive',12,true),
  ('ancestors_spears','Ancestor Spears','+20% per Vengeance token you hold against the foe.','rare','war',false,'vengeance_boost',NULL,false,NULL,'War drop / 200 Stars','vengeance_boost',0.20,200,'passive',13,true),
  ('warchief_banner','Warchief Banner','+20% war contribution, always.','rare','war',false,'flat_war',NULL,false,NULL,'War drop / 200 Stars','flat_war',0.20,200,'passive',14,true),
  ('siegebreaker','Siegebreaker','+35% war contribution on siege terrain.','epic','war',false,'flat_war',NULL,false,NULL,'Season reward / 500 Stars','flat_war',0.35,500,'passive',15,true)
ON CONFLICT (slug) DO UPDATE SET
  category=EXCLUDED.category, cursed=EXCLUDED.cursed, effect_key=EXCLUDED.effect_key,
  shatter_rule=EXCLUDED.shatter_rule, pause_in_war=EXCLUDED.pause_in_war,
  pack_pool=EXCLUDED.pack_pool, earn_hint=EXCLUDED.earn_hint;

-- ---- TRIBE relics (passive, whole-tribe) ----
INSERT INTO relics
  (slug,name,description,rarity,category,cursed,effect_key,shatter_rule,pause_in_war,pack_pool,earn_hint,buff_type,buff_value,price_stars,kind,sort_order,active)
VALUES
  ('hearth_stone','Hearth Stone','+10% Pyre gained from every donation, tribe-wide.','common','tribe',false,'pyre_gain',NULL,false,NULL,'Tribe milestone / 60 Stars','pyre_gain',0.10,60,'passive',20,true),
  ('oracle_eye','Oracle Eye','Your tribe sees incoming war declarations 1 hour early.','rare','tribe',false,'war_foresight',NULL,false,NULL,'Tribe milestone / 200 Stars','war_foresight',1,200,'passive',21,true),
  ('war_drum','War Drum','+5% war contribution for every tribe member online.','rare','tribe',false,'rally_online',NULL,false,NULL,'Tribe milestone / 200 Stars','rally_online',0.05,200,'passive',22,true),
  ('sun_disc','Sun Disc','+8% Ember per tap for the whole tribe.','rare','tribe',false,'tribe_tap',NULL,false,NULL,'Tribe milestone / 200 Stars','tribe_tap',0.08,200,'passive',23,true),
  ('firekeepers_mantle','Firekeeper''s Mantle','All tribe members gain +20% Ember per tap.','legendary','tribe',false,'tribe_tap',NULL,false,NULL,'Tournament win / 2000 Stars','tribe_tap',0.20,2000,'passive',24,true)
ON CONFLICT (slug) DO UPDATE SET
  category=EXCLUDED.category, cursed=EXCLUDED.cursed, effect_key=EXCLUDED.effect_key,
  shatter_rule=EXCLUDED.shatter_rule, pause_in_war=EXCLUDED.pause_in_war,
  pack_pool=EXCLUDED.pack_pool, earn_hint=EXCLUDED.earn_hint;

-- ---- PERSONAL relics (passive, individual) ----
INSERT INTO relics
  (slug,name,description,rarity,category,cursed,effect_key,shatter_rule,pause_in_war,pack_pool,earn_hint,buff_type,buff_value,price_stars,kind,sort_order,active)
VALUES
  ('feather_cloak','Feather Cloak','Trials have -20% cooldown.','common','personal',false,'trial_cd',NULL,false,NULL,'Trials milestone / 60 Stars','trial_cd',0.20,60,'passive',30,true),
  ('sunstone','Sunstone','Daily check-in rewards +40%.','common','personal',false,'checkin_boost',NULL,false,NULL,'Streak milestone / 60 Stars','checkin_boost',0.40,60,'passive',31,true),
  ('ancestor_coin','Ancestor Coin','+10% Ember from every trial.','rare','personal',false,'trial_ember',NULL,false,NULL,'Trials milestone / 200 Stars','trial_ember',0.10,200,'passive',32,true),
  ('ash_walker','Ash Walker','+15% Ash from war victories.','epic','personal',false,'ash_boost',NULL,false,NULL,'Season reward / 500 Stars','ash_boost',0.15,500,'passive',33,true),
  ('living_idol','Living Idol','+1% all resources per 10 active tribe members (max +30%).','legendary','personal',false,'living_idol',NULL,false,NULL,'Tournament win / 2000 Stars','living_idol',0.01,2000,'passive',34,true)
ON CONFLICT (slug) DO UPDATE SET
  category=EXCLUDED.category, cursed=EXCLUDED.cursed, effect_key=EXCLUDED.effect_key,
  shatter_rule=EXCLUDED.shatter_rule, pause_in_war=EXCLUDED.pause_in_war,
  pack_pool=EXCLUDED.pack_pool, earn_hint=EXCLUDED.earn_hint;

-- =====================================================================
-- CURSED RELICS (the Cursed Pack pool: 5 war + 2 rare war + 12 personal = 19)
--   pause_in_war=true only for personal cursed relics (brief PAUSE RULE).
--   war cursed relics fire/shatter during war.
-- =====================================================================

-- ---- WAR cursed (5) ----
INSERT INTO relics
  (slug,name,description,rarity,category,cursed,effect_key,shatter_rule,pause_in_war,pack_pool,earn_hint,buff_type,buff_value,price_stars,kind,sort_order,active)
VALUES
  ('blood_iron','Blood Iron','+60% contribution, but you earn no loyalty from donations. Shatters on first war contribution.','common','cursed',true,'blood_iron','first_war_contribution',false,'cursed','Cursed Pack','war_boost',0.60,0,'passive',40,true),
  ('shattered_star','Shattered Star','A 3-hour Ambush, but only triggerable on Day 3. Shatters when you trigger Ambush.','common','cursed',true,'shattered_star','trigger_ambush',false,'cursed','Cursed Pack','war_boost',0.50,0,'passive',41,true),
  ('serpent_fang','Serpent Fang','Double Vengeance, but enemies see your exact Kin total. Shatters on first war.','rare','cursed',true,'serpent_fang','first_war',false,'cursed','Cursed Pack','vengeance_boost',1.00,0,'passive',42,true),
  ('frozen_heart','Frozen Heart','Immune to Raid, but tribe loses 25% Pyre income. Shatters on first Raid against you.','rare','cursed',true,'frozen_heart','first_raid',false,'cursed','Cursed Pack','raid_immune',0.25,0,'passive',43,true),
  ('wailing_mask','Wailing Mask','Enemies see you 50% weaker, but spies read your Kiva 24h old. Shatters on first war.','common','cursed',true,'wailing_mask','first_war',false,'cursed','Cursed Pack','conceal',0.50,0,'passive',44,true)
ON CONFLICT (slug) DO UPDATE SET
  category=EXCLUDED.category, cursed=EXCLUDED.cursed, effect_key=EXCLUDED.effect_key,
  shatter_rule=EXCLUDED.shatter_rule, pause_in_war=EXCLUDED.pause_in_war,
  pack_pool=EXCLUDED.pack_pool, earn_hint=EXCLUDED.earn_hint;

-- ---- RARE WAR cursed (2) ----
INSERT INTO relics
  (slug,name,description,rarity,category,cursed,effect_key,shatter_rule,pause_in_war,pack_pool,earn_hint,buff_type,buff_value,price_stars,kind,sort_order,active)
VALUES
  ('thunderstone','Thunderstone','Your Ambush window is invisible to enemy scouting. Shatters on first war.','legendary','cursed',true,'thunderstone','first_war',false,'cursed','Cursed Pack','conceal_ambush',1.00,0,'passive',45,true),
  ('ashen_crown','Ashen Crown','+40% war contribution and immune to the first enemy tactic. Shatters on first war.','epic','cursed',true,'ashen_crown','first_war',false,'cursed','Cursed Pack','war_boost',0.40,0,'passive',46,true)
ON CONFLICT (slug) DO UPDATE SET
  category=EXCLUDED.category, cursed=EXCLUDED.cursed, effect_key=EXCLUDED.effect_key,
  shatter_rule=EXCLUDED.shatter_rule, pause_in_war=EXCLUDED.pause_in_war,
  pack_pool=EXCLUDED.pack_pool, earn_hint=EXCLUDED.earn_hint;

-- ---- PERSONAL cursed (12) — pause_in_war=true (PAUSE RULE) ----
INSERT INTO relics
  (slug,name,description,rarity,category,cursed,effect_key,shatter_rule,pause_in_war,pack_pool,earn_hint,buff_type,buff_value,price_stars,kind,sort_order,active)
VALUES
  ('hollow_bone','Hollow Bone','+80% Ember per tap, but daily blessing is halved. Shatters after 500 taps.','common','cursed',true,'tap_boost','after_500_taps',true,'cursed','Cursed Pack','tap_boost',0.80,0,'passive',50,true),
  ('ravens_eye','Raven''s Eye','See rival Kiva 2h fresher, but your own leaks 6h. Shatters after 3 spies.','common','cursed',true,'spy_edge','after_3_spies',true,'cursed','Cursed Pack','spy_edge',1.00,0,'passive',51,true),
  ('ember_wraith','Ember Wraith','Trials give +50% Ember, but cooldowns +50%. Shatters after 10 trials.','common','cursed',true,'trial_ember','after_10_trials',true,'cursed','Cursed Pack','trial_ember',0.50,0,'passive',52,true),
  ('cinder_veil','Cinder Veil','+30% Ash gain, but check-in streak can''t grow. Shatters after next war.','rare','cursed',true,'ash_boost','after_next_war',true,'cursed','Cursed Pack','ash_boost',0.30,0,'passive',53,true),
  ('grave_whisper','Grave Whisper','Daily blessing doubled, but no trial rewards. Shatters after 5 blessings.','common','cursed',true,'checkin_boost','after_5_blessings',true,'cursed','Cursed Pack','checkin_boost',1.00,0,'passive',54,true),
  ('molten_core','Molten Core','+100% Ember per tap for 1 hour after equip, then shatters.','rare','cursed',true,'tap_boost','after_1_hour',true,'cursed','Cursed Pack','tap_boost',1.00,0,'passive',55,true),
  ('pale_lantern','Pale Lantern','Reveals one hidden rival stat daily, but costs 200 Ember/day. Shatters after 7 days.','common','cursed',true,'scry','after_7_days',true,'cursed','Cursed Pack','scry',1.00,0,'passive',56,true),
  ('thorn_heart','Thorn Heart','Attackers who Raid you lose 10% too, but your Pyre income -10%. Shatters after next war.','rare','cursed',true,'thorns','after_next_war',true,'cursed','Cursed Pack','thorns',0.10,0,'passive',57,true),
  ('dusk_idol','Dusk Idol','+25% to all night-terrain contributions, useless by day. Shatters after next war.','common','cursed',true,'night_boost','after_next_war',true,'cursed','Cursed Pack','night_boost',0.25,0,'passive',58,true),
  ('bloodmoon_totem','Bloodmoon Totem','+45% contribution on Day 3 only. Shatters after next war.','epic','cursed',true,'day3_boost','after_next_war',true,'cursed','Cursed Pack','day3_boost',0.45,0,'passive',59,true),
  ('widows_thread','Widow''s Thread','Trial cooldowns -40%, but a random trial locks daily. Shatters after 20 trials.','common','cursed',true,'trial_cd','after_20_trials',true,'cursed','Cursed Pack','trial_cd',0.40,0,'passive',60,true),
  ('shadow_coin','Shadow Coin','Spy costs are free, but caught-odds double. Shatters after 5 spies.','rare','cursed',true,'spy_free','after_5_spies',true,'cursed','Cursed Pack','spy_free',1.00,0,'passive',61,true)
ON CONFLICT (slug) DO UPDATE SET
  category=EXCLUDED.category, cursed=EXCLUDED.cursed, effect_key=EXCLUDED.effect_key,
  shatter_rule=EXCLUDED.shatter_rule, pause_in_war=EXCLUDED.pause_in_war,
  pack_pool=EXCLUDED.pack_pool, earn_hint=EXCLUDED.earn_hint;

-- =====================================================================
-- PACK SEEDS (chance-based, pity). Odds visible on the pack per brief.
-- =====================================================================
INSERT INTO relic_packs (slug,name,description,price_stars,pool,odds_json,pity_epic_in,active) VALUES
  ('cursed_pack','Cursed Pack','One payment, one roll. Every pull is a new cursed relic. Odds shown below. 6th pull guarantees Epic if none in 5.',400,'cursed',
    '{"common":0.55,"rare":0.30,"epic":0.12,"legendary":0.03}'::jsonb,6,true),
  ('rare_pack','Rare Pack','A chance-based pull from the earnable relic pool, with a pity guarantee.',250,'rare',
    '{"common":0.70,"rare":0.25,"epic":0.045,"legendary":0.005}'::jsonb,8,true),
  ('legendary_pack','Legendary Pack','A richer pull weighted toward Epic and Legendary relics.',800,'legendary',
    '{"common":0.30,"rare":0.45,"epic":0.20,"legendary":0.05}'::jsonb,4,true)
ON CONFLICT (slug) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, price_stars=EXCLUDED.price_stars,
  pool=EXCLUDED.pool, odds_json=EXCLUDED.odds_json, pity_epic_in=EXCLUDED.pity_epic_in;
