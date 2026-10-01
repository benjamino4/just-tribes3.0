-- Arena-specific additions (duel_queue, forgotten-tribe initial data).
-- Most tables are in SCHEMA. This migration is a placeholder for future
-- arena-specific tuning and to hold the migration order.

CREATE INDEX IF NOT EXISTS duels_opener_idx ON duels (opener_id, created_at DESC);
CREATE INDEX IF NOT EXISTS duels_ranked_status_idx ON duels (kind, status);