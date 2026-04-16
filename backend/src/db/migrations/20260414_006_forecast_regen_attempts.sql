-- M35 Phase 4: add attempt tracking to forecast_regen_queue for retry/backoff support

ALTER TABLE forecast_regen_queue
  ADD COLUMN IF NOT EXISTS attempts     INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
