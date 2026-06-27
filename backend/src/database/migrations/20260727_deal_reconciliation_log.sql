-- Phase 4 — Reconciliation capture table.
-- Append-only log of per-field monthly variances between projected and actual values.
-- Serves as the calibration substrate for Phase 1B (Correlation Engine).
--
-- trigger_path values:
--   T12_REBUILD    — Part 1: new T12 upload covers months that were previously projected.
--   MONTHLY_ACTUAL — Part 2: incremental monthly actual advances the actuals boundary.
--   BULK_REBASE    — Part 3: Highlands-style bulk reconciliation on first portfolio seed.

CREATE TABLE IF NOT EXISTS deal_reconciliation_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  field_name      TEXT        NOT NULL,
  period_month    DATE        NOT NULL,
  projected_value NUMERIC,
  actual_value    NUMERIC,
  variance_abs    NUMERIC,
  variance_pct    NUMERIC,
  material        BOOLEAN     NOT NULL DEFAULT false,
  trigger_path    TEXT        NOT NULL,
  reconciled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drl_deal_id
  ON deal_reconciliation_log (deal_id);

CREATE INDEX IF NOT EXISTS idx_drl_deal_month
  ON deal_reconciliation_log (deal_id, period_month);

CREATE INDEX IF NOT EXISTS idx_drl_trigger_path
  ON deal_reconciliation_log (trigger_path);
