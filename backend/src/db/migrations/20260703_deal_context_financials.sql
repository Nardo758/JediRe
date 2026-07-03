-- Migration: deal_context_financials
-- Date: 2026-07-03
-- Description: Persisted cashflow-distress flag group + intermediates
--              computed by the vintage-debt-estimator service.

CREATE TABLE IF NOT EXISTS deal_context_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ruleset_version TEXT NOT NULL,

  -- Intermediates
  dscr_current NUMERIC(5,2),
  dscr_at_refi NUMERIC(5,2),
  proceeds_gap NUMERIC(14,2),
  est_debt_service NUMERIC(14,2),

  -- Flags: boolean + discriminating value + threshold + provenance
  negative_dscr BOOLEAN DEFAULT FALSE,
  negative_dscr_value NUMERIC(5,2),
  negative_dscr_threshold NUMERIC(5,2) DEFAULT 1.0,
  negative_dscr_provenance TEXT,

  thin_dscr BOOLEAN DEFAULT FALSE,
  thin_dscr_value NUMERIC(5,2),
  thin_dscr_threshold NUMERIC(5,2),
  thin_dscr_provenance TEXT,

  io_expiry_shock BOOLEAN DEFAULT FALSE,
  io_expiry_shock_value NUMERIC(14,2),
  io_expiry_shock_threshold NUMERIC(14,2),
  io_expiry_shock_provenance TEXT,

  underwater_equity BOOLEAN DEFAULT FALSE,
  underwater_equity_value NUMERIC(5,4),
  underwater_equity_threshold NUMERIC(5,4),
  underwater_equity_provenance TEXT,

  cash_in_refi BOOLEAN DEFAULT FALSE,
  cash_in_refi_value NUMERIC(14,2),
  cash_in_refi_threshold NUMERIC(14,2) DEFAULT 0,
  cash_in_refi_provenance TEXT,

  negative_leverage BOOLEAN DEFAULT FALSE,
  negative_leverage_value NUMERIC(5,4),
  negative_leverage_threshold NUMERIC(5,4),
  negative_leverage_provenance TEXT,

  UNIQUE(deal_id, ruleset_version)
);

CREATE INDEX IF NOT EXISTS idx_deal_context_financials_deal_id
  ON deal_context_financials(deal_id);
