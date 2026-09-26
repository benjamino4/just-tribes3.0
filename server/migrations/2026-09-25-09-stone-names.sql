-- =====================================================================
-- Stone-Era tribe names (curated seed)
-- Locked: one name per tribe, admin can add more.
-- =====================================================================

-- Ensure the names table has the constraints we need
-- (existing table from schema has: id, name, is_seed, claimed_by_tribe_id)

-- Unique on lowercase name to prevent dupes
CREATE UNIQUE INDEX IF NOT EXISTS tribe_names_lower_unique
  ON tribe_names (lower(name));

-- One tribe claims one name at a time (partial unique for speed)
CREATE UNIQUE INDEX IF NOT EXISTS tribe_names_claim_unique
  ON tribe_names (claimed_by_tribe_id)
  WHERE claimed_by_tribe_id IS NOT NULL;

-- Seed 50 curated stone-era names (skip any that already exist)
INSERT INTO tribe_names (name, is_seed) VALUES
  ('Kharuk',   true),
  ('Vorak',    true),
  ('Tumek',    true),
  ('Arnok',    true),
  ('Selun',    true),
  ('Brakar',   true),
  ('Keldis',   true),
  ('Orruk',    true),
  ('Vashkan',  true),
  ('Dreyul',   true),
  ('Noktar',   true),
  ('Selvok',   true),
  ('Karnak',   true),
  ('Tuvak',    true),
  ('Mehru',    true),
  ('Aktur',    true),
  ('Balor',    true),
  ('Vuren',    true),
  ('Kaskal',   true),
  ('Ondrek',   true),
  ('Thalun',   true),
  ('Urmek',    true),
  ('Sartok',   true),
  ('Belkar',   true),
  ('Vhora',    true),
  ('Yntar',    true),
  ('Moluk',    true),
  ('Grendar',  true),
  ('Ashur',    true),
  ('Paltok',   true),
  ('Zarrek',   true),
  ('Rulgar',   true),
  ('Ordun',    true),
  ('Vhalm',    true),
  ('Sarn',     true),
  ('Kaldur',   true),
  ('Erukk',    true),
  ('Narak',    true),
  ('Tolum',    true),
  ('Skarn',    true),
  ('Agra',     true),
  ('Molvar',   true),
  ('Durnak',   true),
  ('Wrakk',    true),
  ('Eldur',    true),
  ('Sorren',   true),
  ('Harnok',   true),
  ('Veyl',     true),
  ('Tarnak',   true),
  ('Urkan',    true)
ON CONFLICT (lower(name)) DO NOTHING;
