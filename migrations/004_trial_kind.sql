-- ===========================================================================
-- TRIBES — Batch: trial kinds
-- Adds a `kind` column to trials so a trial can be 'standard' (hold to
-- confirm) or 'rewarded_ad' (opens an ad flow; not yet configured).
-- Idempotent. Non-destructive.
-- ===========================================================================

BEGIN;

ALTER TABLE trials ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'standard';

UPDATE trials SET kind = 'standard' WHERE kind IS NULL;

COMMIT;