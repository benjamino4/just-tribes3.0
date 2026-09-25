-- =====================================================================
-- Push queue: retry attempts
-- =====================================================================
ALTER TABLE push_queue
  ADD COLUMN IF NOT EXISTS attempts   INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS send_at    TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS push_queue_pending_idx
  ON push_queue (send_at)
  WHERE sent_at IS NULL;
