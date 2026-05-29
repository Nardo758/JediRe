-- Phase 2: Property Plumbing — Dual-Write Failure Log
-- Idempotent (IF NOT EXISTS guards throughout).
-- Every dual-write failure from old → new tables is logged here.
-- The nightly reconciliation job queries this table for its daily alert.

CREATE TABLE IF NOT EXISTS property_dual_write_failures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  write_path      TEXT NOT NULL,    -- e.g. 'cobb_ingestion.saveProperty'
  old_table       TEXT NOT NULL,    -- source table (property_info_cache, georgia_property_sales, etc.)
  new_table       TEXT NOT NULL,    -- target table (property_characteristics, property_sales, etc.)
  parcel_id       TEXT,             -- for correlation with source data
  county          TEXT,
  deal_id         UUID,             -- for deal-link failures
  error_message   TEXT NOT NULL,
  context         JSONB,            -- additional diagnostic fields
  resolved_at     TIMESTAMPTZ,      -- NULL = still open
  resolution_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_dw_failures_occurred_at
  ON property_dual_write_failures(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_dw_failures_unresolved
  ON property_dual_write_failures(occurred_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dw_failures_write_path
  ON property_dual_write_failures(write_path);

COMMENT ON TABLE property_dual_write_failures IS
  'Phase 2 dual-write monitoring. One row per dual-write failure '
  '(old table write succeeded, new table write failed). '
  'Alert fires when any row is unresolved for > 24h. '
  'Resolved manually or by nightly reconciliation once backfill corrects the gap.';
