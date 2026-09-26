-- =====================================================================
-- Relic admin art + post-war spoils / relic-drop log
--   * relic inline art (SVG stored in DB, or PNG data URL) so the Warden
--     can create/modify relics with their own card images
--   * sort_order so relic cards order predictably
--   * war_spoils_log records who won relics / warband ember each war
-- =====================================================================

-- ---- inline art + ordering for relics ----
ALTER TABLE relics
  ADD COLUMN IF NOT EXISTS svg        TEXT,        -- sanitised inline SVG art
  ADD COLUMN IF NOT EXISTS image_url  TEXT,        -- data: URL (png/webp) OR /assets path
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 100;

-- ---- spoils / relic-drop ledger ----
CREATE TABLE IF NOT EXISTS war_spoils_log (
  id         BIGSERIAL PRIMARY KEY,
  war_id     BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  tribe_id   BIGINT,
  kind       TEXT NOT NULL,          -- 'relic' | 'warband_ember' | 'mvp_ember'
  relic_id   BIGINT,
  relic_slug TEXT,
  amount     BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS war_spoils_log_war_idx  ON war_spoils_log(war_id);
CREATE INDEX IF NOT EXISTS war_spoils_log_user_idx ON war_spoils_log(user_id, created_at);
