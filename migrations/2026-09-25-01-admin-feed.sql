-- =====================================================================
-- Unified admin feed
-- =====================================================================
CREATE TABLE IF NOT EXISTS admin_feed (
  id         BIGSERIAL PRIMARY KEY,
  ts         TIMESTAMPTZ DEFAULT now(),
  type       TEXT NOT NULL,
  icon       TEXT,
  severity   TEXT DEFAULT 'info',
  text       TEXT NOT NULL,
  detail     JSONB,
  actor      TEXT
);

CREATE INDEX IF NOT EXISTS admin_feed_id_desc  ON admin_feed (id DESC);
CREATE INDEX IF NOT EXISTS admin_feed_ts_desc  ON admin_feed (ts DESC);
CREATE INDEX IF NOT EXISTS admin_feed_type     ON admin_feed (type, id DESC);