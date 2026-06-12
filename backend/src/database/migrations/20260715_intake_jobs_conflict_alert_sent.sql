-- Add durable parcel-conflict alert tracking columns to intake_jobs.
--
-- Purpose: persist the alert state across enrichment_log resets.
-- Both PATCH and POST /intake-jobs/:id/user-input reset enrichment_log to '[]'
-- when requeuing, so any log-based marker is lost and the alert re-sends on
-- the next re-block.  These two columns survive requeue by design.
--
-- conflict_alert_sent_at    — when the last successful alert was dispatched
-- conflict_alert_fingerprint — canonical fingerprint of the conflict pair that
--   triggered that alert (sorted join of the two parcel IDs).
--   When the current conflict pair produces a DIFFERENT fingerprint the worker
--   sends a fresh alert and updates both columns.  Same fingerprint = same
--   conflict event = skip (no duplicate alert).
--
-- ── UP ──────────────────────────────────────────────────────────────────────

ALTER TABLE intake_jobs
  ADD COLUMN IF NOT EXISTS conflict_alert_sent_at    timestamptz;

ALTER TABLE intake_jobs
  ADD COLUMN IF NOT EXISTS conflict_alert_fingerprint text;

COMMENT ON COLUMN intake_jobs.conflict_alert_sent_at IS
  'Timestamp when the parcel-ID conflict alert email was last successfully dispatched. '
  'NULL means no alert has been sent. Survives enrichment_log resets on requeue.';

COMMENT ON COLUMN intake_jobs.conflict_alert_fingerprint IS
  'Canonical fingerprint of the conflict pair that triggered the last alert '
  '(sorted join of value_a and value_b). A new conflict pair = new fingerprint = '
  'fresh alert allowed even if conflict_alert_sent_at is set.';

-- ── DOWN (run manually to reverse) ──────────────────────────────────────────
-- ALTER TABLE intake_jobs DROP COLUMN IF EXISTS conflict_alert_fingerprint;
-- ALTER TABLE intake_jobs DROP COLUMN IF EXISTS conflict_alert_sent_at;
