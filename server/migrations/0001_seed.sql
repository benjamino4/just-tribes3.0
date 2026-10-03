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

INSERT INTO relics (slug, name, description, tier, category, effect_key, effect_value, sort_order) VALUES
('firestone', 'Firestone', 'Your check-in gives +20% Sparks.', 'common', 'flame', 'checkin_sparks', 0.20, 10),
('moon_shard', 'Moon Shard', 'Streak rewards are doubled.', 'rare', 'flame', 'streak_mult', 2.00, 20),
('warpaint', 'Warpaint', 'Your reaction-game score is +10%.', 'common', 'blade', 'reaction_boost', 0.10, 30),
('bone_charm', 'Bone Charm', '+15% Kinship from any win.', 'common', 'voice', 'kinship_win', 0.15, 40)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO game_defs (slug, name, description, archetype, engine, material, terrain_pool, sort_order) VALUES
('rune_match', 'Rune Match', 'Swap two runes. Match three to clear them.', 'match3', 'match3', 'stone', '["plains","hills"]'::jsonb, 10),
('stone_stack', 'Stone Stack', 'Stack stones. Do not miss the timing.', 'stacker', 'stacker', 'stone', '["plains","ashlands"]'::jsonb, 20),
('fireflies', 'Fireflies', 'Catch every firefly before it escapes.', 'catch', 'catch', 'ember', '["forest"]'::jsonb, 30),
('ember_reflex', 'Ember Reflex', 'Tap the fire as soon as it lights.', 'reaction', 'reaction', 'ember', '["ashlands"]'::jsonb, 40),
('rite_of_hands', 'Rite of Hands', 'Read their pattern, beat their throw.', 'choice', 'choice', 'metal', '["swamp"]'::jsonb, 50),
('three_masks', 'Three Masks', 'Guess their mask.', 'deduction', 'deduction', 'bone', '["swamp"]'::jsonb, 60),
('ember_cascade', 'Ember Cascade', 'Rotate falling runes. Complete lines.', 'cascade', 'cascade', 'ember', '["ruins"]'::jsonb, 70),
('stone_sort', 'Stone Sort', 'Sort stones into matching piles.', 'sort', 'sort', 'clay', '["hills"]'::jsonb, 80),
('ember_flow', 'Ember Flow', 'Rotate tiles to guide the fire.', 'flow', 'flow', 'ember', '["ruins"]'::jsonb, 90),
('rune_flip', 'Rune Flip', 'Flip stones. Find matching pairs.', 'memory', 'memory', 'bone', '["forest"]'::jsonb, 100)
ON CONFLICT (slug) DO NOTHING;