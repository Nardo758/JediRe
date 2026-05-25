-- Add 'awaiting_review' to intake_jobs state CHECK constraint.
-- This state is set when Phase 8 enrichment (Research Agent) writes to the
-- pending_web layer for a new asset. The user must open the modal and
-- click Apply or Discard before the job moves to 'complete'.

ALTER TABLE intake_jobs
  DROP CONSTRAINT IF EXISTS intake_jobs_state_ck;

ALTER TABLE intake_jobs
  ADD CONSTRAINT intake_jobs_state_ck CHECK (
    state IN (
      'pending', 'parsing', 'enriching',
      'awaiting_review',
      'complete', 'blocked_needs_user', 'failed'
    )
  );

COMMENT ON COLUMN intake_jobs.state IS
  'State machine: pending → parsing → enriching → awaiting_review | complete | blocked_needs_user | failed.
   awaiting_review: Phase 8 enrichment wrote to pending_web layer; user must Apply or Discard.';
