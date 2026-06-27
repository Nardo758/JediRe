-- Migration: deal_reconciliation_log — variance capture store
-- Phase 4 Part 1 — Reconciliation Engine
-- Date: 2026-06-26

-- Append-only per-field-monthly variance log.
-- This is the calibration substrate for Correlation Engine Phase 1B.

CREATE TABLE IF NOT EXISTS deal_reconciliation_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id               UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  field_name            TEXT        NOT NULL,   -- e.g. 'gpr'
  period_month          DATE        NOT NULL,   -- YYYY-MM-01
  projected_value       NUMERIC,
  actual_value          NUMERIC,
  variance_abs          NUMERIC,                -- actual - projected
  variance_pct          NUMERIC,                -- (actual - projected) / projected
  trigger_path          TEXT        NOT NULL,   -- 'T12_REBUILD' | 'MONTHLY_ACTUAL' | 'BULK_REBASE'
  reconciled_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups by deal + month + trigger
CREATE INDEX IF NOT EXISTS idx_reconciliation_deal_month
  ON deal_reconciliation_log(deal_id, period_month);

CREATE INDEX IF NOT EXISTS idx_reconciliation_trigger
  ON deal_reconciliation_log(deal_id, trigger_path, reconciled_at DESC);

CREATE INDEX IF NOT EXISTS idx_reconciliation_field
  ON deal_reconciliation_log(deal_id, field_name, period_month);

COMMENT ON TABLE deal_reconciliation_log IS
  'Append-only calibration record: per-field projected-vs-actual variance per month. Written by the reconciliation engine on boundary advance. Not derived — immutable once written.';
