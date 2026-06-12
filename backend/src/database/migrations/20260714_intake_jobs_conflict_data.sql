-- Add conflict_data JSONB column to intake_jobs for parcel ID conflict resolution.
--
-- When two enrichment sources disagree on a parcel ID, the worker stores an
-- array of conflict descriptors here and blocks the job in state
-- 'blocked_needs_user' with block_reason = 'parcel_id_conflict'.
--
-- Each element in the array has the shape:
--   { step, field, value_a, source_a, value_b, source_b, detected_at }
--
-- ── UP ──────────────────────────────────────────────────────────────────────

ALTER TABLE intake_jobs
  ADD COLUMN IF NOT EXISTS conflict_data jsonb;

COMMENT ON COLUMN intake_jobs.conflict_data IS
  'Array of conflict descriptors when enrichment sources disagree on an identifier field. '
  'Cleared when the analyst resolves the conflict via PATCH /intake-jobs/:id/resolve-conflict. '
  'Shape: [{ step, field, value_a, source_a, value_b, source_b, detected_at }]';

-- ── DOWN (run manually to reverse) ──────────────────────────────────────────
-- ALTER TABLE intake_jobs DROP COLUMN IF EXISTS conflict_data;
