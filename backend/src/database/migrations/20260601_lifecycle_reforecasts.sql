-- Migration: lifecycle_reforecasts
-- Lightweight audit table for reforecast events triggered via the
-- LIFECYCLE sub-tab.  Stores a JSONB snapshot of the computed result
-- alongside the trigger reason so history can be shown without joining
-- against the heavier `reforecasts` table columns.

CREATE TABLE IF NOT EXISTS lifecycle_reforecasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id          UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  trigger_reason   TEXT        NOT NULL DEFAULT 'manual',
  snapshot_data    JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_reforecasts_deal_id
  ON lifecycle_reforecasts (deal_id, created_at DESC);
