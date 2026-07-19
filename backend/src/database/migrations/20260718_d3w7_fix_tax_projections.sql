-- D3-W7-FIX: Resurrect tax_projections — bring table to the 19-column shape
-- that taxProjectionService already writes (service was coded ahead of DDL).
--
-- PRE-FLIGHT CHECK (run first):
--   SELECT count(*) FROM tax_projections;
--
-- If count = 0 (expected — writer never worked): this migration applies cleanly.
-- If count > 0: halt and report — id serial→uuid conversion needs data migration.

BEGIN;

-- Step 0: Only proceed if table is empty (writer never worked → no rows expected).
-- If rows exist, the id serial→uuid conversion is non-trivial and needs a
-- separate data-migration plan. The application code hasn't successfully
-- written a row since the schema mismatch, so count(*) should be 0.
DO $$
DECLARE
  row_count INT;
BEGIN
  SELECT count(*) INTO row_count FROM tax_projections;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'tax_projections has % rows — halting. id serial→uuid conversion requires data migration. Report row count and abort.', row_count;
  END IF;
END $$;

-- Step 1: Drop the old minimal table (no rows, so safe) and recreate with full schema.
-- The service at taxProjection.service.ts:117 is the spec — it INSERTs 19 columns.
DROP TABLE IF EXISTS tax_projections CASCADE;

CREATE TABLE tax_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

  -- Inputs
  purchase_price NUMERIC(16,2) NOT NULL,
  total_millage NUMERIC(10,4),
  non_ad_valorem_per_unit NUMERIC(10,2),
  units INTEGER NOT NULL,
  exemption_reduction_pct NUMERIC(5,4) DEFAULT 0,

  -- Year 1 Outputs (F40)
  projected_just_value NUMERIC(16,2),
  projected_assessed_value NUMERIC(16,2),
  projected_taxable_value NUMERIC(16,2),
  projected_ad_valorem NUMERIC(14,2),
  projected_non_ad_valorem NUMERIC(14,2),
  projected_total_tax NUMERIC(14,2) NOT NULL,
  projected_tax_per_unit NUMERIC(10,2),
  effective_tax_rate NUMERIC(8,6),

  -- Delta
  current_annual_tax NUMERIC(14,2),
  delta_amount NUMERIC(14,2),
  delta_pct NUMERIC(8,4),

  -- Multi-year (F41)
  yearly_projections JSONB DEFAULT '[]',
  projection_assumptions JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tax_projections_deal_id ON tax_projections(deal_id);
CREATE INDEX idx_tax_projections_created_at ON tax_projections(created_at DESC);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_tax_projections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tax_projections_updated_at ON tax_projections;
CREATE TRIGGER trg_tax_projections_updated_at
  BEFORE UPDATE ON tax_projections
  FOR EACH ROW
  EXECUTE FUNCTION update_tax_projections_updated_at();

COMMIT;
