-- Migration: deal_lifecycle_events
-- Append-only log of deal status transitions.
-- Used by the historical_observations corpus to distinguish pre-decision
-- (broker-supplied, lower confidence) vs post-decision (operator-supplied,
-- higher confidence) months per HISTORICAL_OBSERVATIONS_SPEC.md §7.9 Invariant 2.

CREATE TABLE IF NOT EXISTS deal_lifecycle_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_status     VARCHAR(40),
  to_status       VARCHAR(40) NOT NULL,
  transitioned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  transitioned_by UUID,
  note            TEXT,
  metadata        JSONB,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_lifecycle_events_deal_id
  ON deal_lifecycle_events(deal_id, transitioned_at DESC);

CREATE INDEX IF NOT EXISTS idx_deal_lifecycle_events_to_status
  ON deal_lifecycle_events(to_status, transitioned_at DESC);

COMMENT ON TABLE deal_lifecycle_events IS
  'Append-only log of deal status transitions. Used by the
   historical_observations corpus to distinguish pre-decision
   (broker-supplied) vs post-decision (operator-supplied) months
   per HISTORICAL_OBSERVATIONS_SPEC.md §7.9 Invariant 2.';

COMMENT ON COLUMN deal_lifecycle_events.from_status IS
  'Previous deal status, NULL when this is the first recorded transition.';

COMMENT ON COLUMN deal_lifecycle_events.to_status IS
  'Status the deal transitioned into.';

COMMENT ON COLUMN deal_lifecycle_events.transitioned_by IS
  'User ID of the operator who triggered the transition.';
