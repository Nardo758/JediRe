-- Migration: deal_epoch_events
-- W1-10: Epoch flag event emission table.
-- Records mode mismatches detected by the Lease-Velocity epoch guard.
-- Consumers: bust M08 cache, trigger re-derivation.

CREATE TABLE IF NOT EXISTS deal_epoch_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  expected_mode VARCHAR(40) NOT NULL,   -- e.g. 'lease_up'
  observed_mode VARCHAR(40) NOT NULL,   -- e.g. 'stabilized'
  detected_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata      JSONB                   -- { occupancyPct, t12Months, source }
);

CREATE INDEX IF NOT EXISTS idx_deal_epoch_events_deal_id
  ON deal_epoch_events(deal_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_deal_epoch_events_detected_at
  ON deal_epoch_events(detected_at DESC);

COMMENT ON TABLE deal_epoch_events IS
  'W1-10: Epoch flag events — emitted when a deal''s observed operating mode
   diverges from its classified mode (e.g. lease_up deal hitting ≥95% occupancy).
   Consumers bust M08 cache and trigger re-derivation.';
