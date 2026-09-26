-- =====================================================================
-- Seed default Trials so the Trials screen has content out of the box.
-- One trial per client minigame: hold, stoke, feed, cry, sift.
-- Idempotent: ON CONFLICT (slug) DO NOTHING lets admins edit/delete later
-- without this migration re-inserting on the next MIGRATE=1 boot.
-- =====================================================================

INSERT INTO trial_defs
  (slug,     name,               glyph, hint,                                       reward_ember, reward_loyalty, cooldown_hours, max_per_window, window_hours, window_start_utc, active, sort_order, kind,       minigame)
VALUES
  ('kindle', 'Kindle the Ember', '🔥', 'Hold to breathe life back into the coals.',       150,          2,              8,              1,              0,            0,                true,   10,         'standard', 'hold'),
  ('stoke',  'Stoke the Blaze',  '🌬️', 'Fan the flames — keep the rhythm going.',         200,          3,              12,             1,              0,            0,                true,   20,         'standard', 'stoke'),
  ('feed',   'Feed the Fire',    '🪵', 'Toss fuel on the fire before it dies down.',      120,          2,              6,              1,              0,            0,                true,   30,         'standard', 'feed'),
  ('warcry', 'Rally Cry',        '📣', 'Raise a cry that echoes across the tribe.',       180,          4,              10,             1,              0,            0,                true,   40,         'standard', 'cry'),
  ('sift',   'Sift the Ashes',   '🌀', 'Sift the embers — pick the true spark.',          250,          3,              16,             1,              0,            0,                true,   50,         'standard', 'sift')
ON CONFLICT (slug) DO NOTHING;
