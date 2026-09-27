-- =====================================================================
-- 001 — Foundation
-- Seeds the stone-era tribe name pool (curated). Base tables come from
-- db.js SCHEMA and are already idempotent.
-- =====================================================================

INSERT INTO tribe_names (name, is_seed) VALUES
  ('Kharuk',  true), ('Vorak',   true), ('Tumek',   true), ('Arnok',   true),
  ('Selun',   true), ('Brakar',  true), ('Keldis',  true), ('Orruk',   true),
  ('Vashkan', true), ('Dreyul',  true), ('Noktar',  true), ('Selvok',  true),
  ('Karnak',  true), ('Tuvak',   true), ('Mehru',   true), ('Aktur',   true),
  ('Balor',   true), ('Vuren',   true), ('Kaskal',  true), ('Ondrek',  true),
  ('Thalun',  true), ('Urmek',   true), ('Sartok',  true), ('Belkar',  true),
  ('Vhora',   true), ('Yntar',   true), ('Moluk',   true), ('Grendar', true),
  ('Ashur',   true), ('Paltok',  true), ('Zarrek',  true), ('Rulgar',  true),
  ('Ordun',   true), ('Vhalm',   true), ('Sarn',    true), ('Kaldur',  true),
  ('Erukk',   true), ('Narak',   true), ('Tolum',   true), ('Skarn',   true),
  ('Agra',    true), ('Molvar',  true), ('Durnak',  true), ('Wrakk',   true),
  ('Eldur',   true), ('Sorren',  true), ('Harnok',  true), ('Veyl',    true),
  ('Tarnak',  true), ('Urkan',   true)
ON CONFLICT (lower(name)) DO NOTHING;