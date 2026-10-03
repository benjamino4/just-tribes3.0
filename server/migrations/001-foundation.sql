-- ═══════════════════════════════════════════════════════════════════
-- FILE: server/migrations/001-foundation.sql
-- PURPOSE: Seed 60 tribe names, spin rewards, trial defs, daily quests,
--          relics, relic packs, emoji sets. Idempotent.
-- DEPENDS ON: base schema (created in db.js on boot)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO tribe_names (name, is_seed) VALUES
  ('Kharuk', true), ('Vorak', true), ('Tumek', true), ('Arnok', true),
  ('Selun', true), ('Brakar', true), ('Keldis', true), ('Orruk', true),
  ('Vashkan', true), ('Dreyul', true), ('Noktar', true), ('Selvok', true),
  ('Karnak', true), ('Tuvak', true), ('Mehru', true), ('Aktur', true),
  ('Balor', true), ('Vuren', true), ('Kaskal', true), ('Ondrek', true),
  ('Thalun', true), ('Urmek', true), ('Sartok', true), ('Belkar', true),
  ('Vhora', true), ('Yntar', true), ('Moluk', true), ('Grendar', true),
  ('Ashur', true), ('Paltok', true), ('Zarrek', true), ('Rulgar', true),
  ('Ordun', true), ('Vhalm', true), ('Sarn', true), ('Kaldur', true),
  ('Erukk', true), ('Narak', true), ('Tolum', true), ('Skarn', true),
  ('Agra', true), ('Molvar', true), ('Durnak', true), ('Wrakk', true),
  ('Eldur', true), ('Sorren', true), ('Harnok', true), ('Veyl', true),
  ('Tarnak', true), ('Urkan', true), ('Drogath', true), ('Huruk', true),
  ('Sarnok', true), ('Bekka', true), ('Varek', true), ('Thonar', true),
  ('Kresh', true), ('Kaldra', true), ('Urahn', true), ('Sethra', true)
ON CONFLICT (lower(name)) DO NOTHING;

INSERT INTO spin_rewards (slot_index, kind, amount, weight, label) VALUES
  (0,  'sparks',  100,  140, '100'),
  (1,  'sparks',  250,  130, '250'),
  (2,  'kinship', 5,    120, '+5'),
  (3,  'sparks',  500,  100, '500'),
  (4,  'empty',   0,    90,  '—'),
  (5,  'sparks',  1000, 80,  '1k'),
  (6,  'kinship', 10,   70,  '+10'),
  (7,  'sparks',  2500, 55,  '2.5k'),
  (8,  'stars',   10,   30,  '+10'),
  (9,  'relic',   0,    20,  'Relic'),
  (10, 'sparks',  5000, 15,  '5k'),
  (11, 'stars',   50,   5,   '+50')
ON CONFLICT (slot_index) DO NOTHING;

INSERT INTO trial_defs (slug, name, glyph, hint, reward_sparks, reward_kinship, cooldown_hours, archetype_bias, sort_order)
VALUES
  ('kindle',   'Kindle the Ember', '🔥', 'Tap the fire as soon as it lights.',        150, 2, 8,  'reaction',  10),
  ('cascade',  'Cascade',          '✨', 'Tap the lights in the order they appeared.', 200, 3, 12, 'reaction',  20),
  ('ancestor', 'Ancestor Memory',  '🪶', 'Repeat the emoji sequence.',                 180, 3, 10, 'memory',    30),
  ('rune',     'Missing Rune',     '❄️', 'Name the missing rune.',                     200, 3, 10, 'memory',    40),
  ('hands',    'Rite of Hands',    '✊', 'Read their pattern, beat their throw.',      180, 3, 8,  'choice',    50),
  ('bid',      'Bid or Fold',      '🪙', 'Bid more than them or fold.',               220, 4, 12, 'choice',    60),
  ('chain',    'Chain of Fire',    '🔗', 'Keep the chain alive.',                      200, 3, 10, 'sequence',  70),
  ('masks',    'Three Masks',      '🎭', 'Guess their mask.',                          220, 4, 12, 'deduction', 80)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO daily_quests (slug, title, description, icon, goal_kind, goal_amount, reward_sparks, reward_kinship, weight)
VALUES
  ('dq_checkin', 'Feed the fire',      'Check in once today.',                 'hearth',       'checkin',    1,   300, 5,  100),
  ('dq_duel1',   'First blood',        'Win a duel today.',                    'swords',       'duel_win',   1,   500, 8,  100),
  ('dq_duel3',   'Three duels',        'Play 3 duels today.',                  'swords',       'duel_play',  3,   400, 6,  100),
  ('dq_trial1',  'Trial runner',       'Complete a trial today.',              'trials-scroll','trial',      1,   400, 6,  100),
  ('dq_donate',  'Stoke the Pyre',     'Donate 500 Sparks to your tribe.',     'kiva-flame',   'donate',     500, 400, 10, 80),
  ('dq_kiva',    'Speak in the Kiva',  'Post a message in tribe chat.',        'kiva-flame',   'kiva_msg',   1,   200, 4,  70)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO relics (slug, name, description, tier, category, effect_key, effect_value, sort_order)
VALUES
  ('firestone',       'Firestone',        'Your check-in gives +20% Sparks.',                    'common',    'flame', 'checkin_sparks',        0.20, 10),
  ('moon_shard',      'Moon Shard',       'Streak rewards are doubled.',                          'rare',      'flame', 'streak_mult',           2.00, 20),
  ('ancestor_coin',   'Ancestor Coin',    'Trial rewards are +25%.',                              'rare',      'flame', 'trial_sparks',          0.25, 30),
  ('warm_ember',      'Warm Ember',       'Ash collection gives +30% Sparks.',                    'common',    'flame', 'ash_sparks',            0.30, 40),
  ('eternal_flame',   'Eternal Flame',    'Spin rewards are +50%.',                               'epic',      'flame', 'spin_sparks',           0.50, 50),
  ('hearthstone',     'Hearthstone',      'All Sparks gains are +10%.',                           'legendary', 'flame', 'all_sparks',            0.10, 60),
  ('warpaint',        'Warpaint',         'Your reaction-game score is +10%.',                    'common',    'blade', 'reaction_boost',        0.10, 70),
  ('serpent_fang',    'Serpent Fang',     'You see the opponent''s last 5 moves in RPS.',         'rare',      'blade', 'rps_foresight',         5,    80),
  ('thunderstone',    'Thunderstone',     'Your first war match each day is hidden.',             'rare',      'blade', 'war_hidden_first',      1,    90),
  ('frozen_heart',    'Frozen Heart',     'You lose no Sparks on your first defeat each day.',    'rare',      'blade', 'first_loss_free',       1,    100),
  ('siegebreaker',    'Siegebreaker',     'Your war match score is +15% on ruins terrain.',       'epic',      'blade', 'ruins_boost',           0.15, 110),
  ('ashen_crown',     'Ashen Crown',      'You are immune to your first loss each war.',          'legendary', 'blade', 'war_first_loss_immune', 1,    120),
  ('bone_charm',      'Bone Charm',       '+15% Kinship from any win.',                           'common',    'voice', 'kinship_win',           0.15, 130),
  ('war_drum',        'War Drum',         '+5% match score per tribe member online.',             'rare',      'voice', 'rally_bonus',           0.05, 140),
  ('oracle_eye',      'Oracle Eye',       'See the terrain of all fronts before entering.',       'rare',      'voice', 'terrain_foresight',     1,    150),
  ('hearth_guide',    'Hearth Guide',     '+10% Kinship from tribe activities.',                  'epic',      'voice', 'tribe_kinship',         0.10, 160),
  ('firekeepers_mantle','Firekeeper''s Mantle','Your name is highlighted in the tribe feed.',     'epic',      'voice', 'feed_highlight',        1,    170),
  ('chiefs_seal',     'Chief''s Seal',    'Once per week, double your war contribution.',         'legendary', 'voice', 'war_double_weekly',     1,    180)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO relic_packs (slug, name, description, price_stars, pool, odds_json, anim_preset)
VALUES
  ('rare_pack',      'Rare Cache',      'A chance at rare and better relics.',   250,  'all',
   '{"common":0.70,"rare":0.25,"epic":0.045,"legendary":0.005}'::jsonb, 'ember'),
  ('epic_pack',      'Epic Cache',      'A richer draw weighted toward Epic.',   600,  'all',
   '{"common":0.30,"rare":0.45,"epic":0.20,"legendary":0.05}'::jsonb, 'goldburst'),
  ('legendary_pack', 'Legendary Cache', 'A chance at a legendary relic.',        1200, 'all',
   '{"common":0.10,"rare":0.40,"epic":0.35,"legendary":0.15}'::jsonb, 'goldburst')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO emoji_sets (slug, name, description, price_stars, emoji_keys, sort_order)
VALUES
  ('free',      'Ember Basics',        'The five everyone starts with.',  0,
    '["reaction-fire","reaction-clap","reaction-swords","reaction-thumbsup","reaction-joy"]'::jsonb, 0),
  ('spirits',   'Spirits of the Flame','Animated spirits that dance.',    120,
    '["flame_flicker","spark_orbit","skull_pulse","moon_phase","bolt_strike"]'::jsonb, 10),
  ('ancestors', 'Ancestors'' Blessings','Ethereal and watchful.',         260,
    '["eye_blink","eagle_flap","wolf_gaze","rune_draw","halo_glow"]'::jsonb, 20),
  ('rites',     'Blood Rites',         'Deep reds, dripping.',            420,
    '["dagger_drip","blood_seal","wound_open","crack_spread","ember_trail"]'::jsonb, 30),
  ('winter',    'Winter''s Grasp',     'Frost and stillness.',            420,
    '["ice_crystal","frost_breath","snowfall","freeze_shatter","aurora_wave"]'::jsonb, 40)
ON CONFLICT (slug) DO NOTHING;