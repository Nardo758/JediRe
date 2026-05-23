-- Intake orchestrator state machine persistence.
-- One row per file-ingest job, tracking the file through the
-- classify → parse → enrich → complete/blocked lifecycle.

CREATE TABLE IF NOT EXISTS intake_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id          uuid REFERENCES data_library_files(id) ON DELETE CASCADE,
  parcel_id        text,  -- resolved parcel, NULL until orchestrator identifies it
  state            text NOT NULL DEFAULT 'pending',
  block_reason     text,  -- populated when state = 'blocked_needs_user' or 'failed'
  user_input       jsonb, -- user-submitted resolution data (property name, address, etc.)
  enrichment_log   jsonb DEFAULT '[]'::jsonb,  -- ordered array of step-level log entries
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  CONSTRAINT intake_jobs_state_ck CHECK (
    state IN ('pending', 'parsing', 'enriching', 'complete', 'blocked_needs_user', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_intake_jobs_parcel ON intake_jobs(parcel_id);
CREATE INDEX IF NOT EXISTS idx_intake_jobs_state   ON intake_jobs(state);
CREATE INDEX IF NOT EXISTS idx_intake_jobs_file_id ON intake_jobs(file_id);
