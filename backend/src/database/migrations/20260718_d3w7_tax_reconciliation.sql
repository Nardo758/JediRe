-- D3-W7: Tax Reconciliation State Tracking
-- Tracks the lifecycle of tax projections vs actual tax bills.

CREATE TABLE IF NOT EXISTS tax_reconciliation_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  projection_id UUID REFERENCES tax_projections(id) ON DELETE SET NULL,

  -- Lifecycle state machine
  status VARCHAR(32) NOT NULL DEFAULT 'projected'
    CHECK (status IN ('projected', 'actual_received', 'reconciled', 'material_variance', 'rebased', 'ignored')),

  -- Values
  projected_annual_tax NUMERIC(14,2),
  actual_annual_tax NUMERIC(14,2),
  variance_amount NUMERIC(14,2),
  variance_pct NUMERIC(8,4),

  -- Materiality (threshold matches reconciliation.service.ts: 5%)
  is_material BOOLEAN NOT NULL DEFAULT FALSE,
  material_threshold_pct NUMERIC(5,4) NOT NULL DEFAULT 0.05,

  -- Source tracking
  tax_bill_source VARCHAR(32), -- 'pdf', 'attom', 'county_adapter', 'manual'
  tax_bill_id UUID,            -- optional FK to uploaded doc/record

  -- Recommendation and action
  recommendation VARCHAR(16) CHECK (recommendation IN ('rebase', 'notify', 'ignore')),
  action_taken VARCHAR(16) CHECK (action_taken IN ('rebase', 'notify', 'ignore')),
  action_taken_at TIMESTAMPTZ,
  action_taken_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Provenance
  projected_provenance JSONB,  -- snapshot of taxService.forecast() provenance
  actual_provenance JSONB,     -- snapshot of actual tax bill data

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reconciled_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tax_recon_deal_id ON tax_reconciliation_states(deal_id);
CREATE INDEX IF NOT EXISTS idx_tax_recon_status ON tax_reconciliation_states(status);
CREATE INDEX IF NOT EXISTS idx_tax_recon_material ON tax_reconciliation_states(is_material) WHERE is_material = TRUE;
CREATE INDEX IF NOT EXISTS idx_tax_recon_created_at ON tax_reconciliation_states(created_at DESC);

-- Unique constraint: one active reconciliation per deal (latest non-rebased/ignored)
-- Partial index ensures we can always find the "current" reconciliation quickly
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_recon_active_deal
  ON tax_reconciliation_states(deal_id)
  WHERE status IN ('projected', 'actual_received', 'reconciled', 'material_variance');

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_tax_recon_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tax_recon_updated_at ON tax_reconciliation_states;
CREATE TRIGGER trg_tax_recon_updated_at
  BEFORE UPDATE ON tax_reconciliation_states
  FOR EACH ROW
  EXECUTE FUNCTION update_tax_recon_updated_at();
