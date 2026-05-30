-- Migration: Deal Signal Acknowledgements
-- Piece C1 — Deal Completeness Framework
--
-- Stores per-deal, per-signal acknowledgements so operators can suppress
-- completeness indicators they have deliberately chosen to proceed without.
-- A unique constraint on (deal_id, signal_id) ensures one row per signal per
-- deal — re-acknowledging upserts rather than accumulating rows.

CREATE TABLE IF NOT EXISTS deal_signal_acknowledgements (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id          UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  signal_id        TEXT        NOT NULL,
  user_id          UUID        NOT NULL,
  acknowledged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes            TEXT,
  UNIQUE (deal_id, signal_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_signal_ack_deal_id
  ON deal_signal_acknowledgements(deal_id);

COMMENT ON TABLE deal_signal_acknowledgements IS
  'Operator acknowledgements of deal completeness signals (C1). '
  'One row per (deal, signal) pair — unique constraint prevents duplicates.';
