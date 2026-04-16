-- M35 Phase 4: durable forecast regeneration queue
-- Playbook updates enqueue affected events here; a periodic worker drains the queue.

CREATE TABLE IF NOT EXISTS forecast_regen_queue (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id     UUID        NOT NULL REFERENCES key_events(id) ON DELETE CASCADE,
  reason       TEXT        NOT NULL DEFAULT 'playbook_update',
  status       TEXT        NOT NULL DEFAULT 'pending',   -- pending | processing | done | failed
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_msg    TEXT
);

CREATE INDEX IF NOT EXISTS idx_frq_status_created
  ON forecast_regen_queue (status, created_at);
