-- Task A: intake_jobs schema additions
-- Adds idempotency, retry, and source-tracking columns.
-- Safe to re-run: all additions use IF NOT EXISTS / DO NOTHING guards.
--
-- ── UP ────────────────────────────────────────────────────────────────────────

ALTER TABLE intake_jobs
  ADD COLUMN IF NOT EXISTS raw_input          jsonb,
  ADD COLUMN IF NOT EXISTS source_record_id   text,
  ADD COLUMN IF NOT EXISTS attempts           int          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at    timestamptz,
  ADD COLUMN IF NOT EXISTS last_error         text;

-- Drop and recreate CHECK constraint to add 'ignored' state.
-- The original constraint name was set in 20260605_intake_jobs.sql.
ALTER TABLE intake_jobs
  DROP CONSTRAINT IF EXISTS intake_jobs_state_ck;

ALTER TABLE intake_jobs
  ADD CONSTRAINT intake_jobs_state_ck CHECK (
    state IN (
      'pending',
      'parsing',
      'enriching',
      'complete',
      'blocked_needs_user',
      'failed',
      'ignored'
    )
  );

-- Idempotency: one source record per source_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_jobs_source_record_unique
  ON intake_jobs (source_type, source_record_id)
  WHERE source_type IS NOT NULL AND source_record_id IS NOT NULL;

-- Lookup index
CREATE INDEX IF NOT EXISTS idx_intake_jobs_source_record
  ON intake_jobs (source_type, source_record_id);

-- Retry sweep index: quickly find failed jobs under max-retry threshold
CREATE INDEX IF NOT EXISTS idx_intake_jobs_retry
  ON intake_jobs (state, attempts)
  WHERE state = 'failed';

-- Backfill source_record_id from existing apartment_locator rows.
-- Guard: skip any row whose apartment_locator_id already appears as a
-- source_record_id in another row — the unique index would reject it.
UPDATE intake_jobs
SET source_record_id = source_data->>'apartment_locator_id'
WHERE source_type = 'apartment_locator'
  AND source_data->>'apartment_locator_id' IS NOT NULL
  AND source_record_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM intake_jobs ij2
    WHERE ij2.source_type      = 'apartment_locator'
      AND ij2.source_record_id = intake_jobs.source_data->>'apartment_locator_id'
  );

-- ── DOWN (run manually to reverse) ───────────────────────────────────────────
-- DROP INDEX IF EXISTS idx_intake_jobs_retry;
-- DROP INDEX IF EXISTS idx_intake_jobs_source_record;
-- DROP INDEX IF EXISTS idx_intake_jobs_source_record_unique;
-- ALTER TABLE intake_jobs DROP CONSTRAINT IF EXISTS intake_jobs_state_ck;
-- ALTER TABLE intake_jobs ADD CONSTRAINT intake_jobs_state_ck CHECK (
--   state IN ('pending','parsing','enriching','complete','blocked_needs_user','failed')
-- );
-- ALTER TABLE intake_jobs
--   DROP COLUMN IF EXISTS raw_input,
--   DROP COLUMN IF EXISTS source_record_id,
--   DROP COLUMN IF EXISTS attempts,
--   DROP COLUMN IF EXISTS last_attempt_at,
--   DROP COLUMN IF EXISTS last_error;
