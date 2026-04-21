-- M22: Post-Close Actuals Write Path
--
-- Creates deal_monthly_actuals (or fills in any missing columns if it already exists).
-- This table is read by three consumers:
--   1. fetch_owned_asset_actuals  — by property_id + report_month + is_budget
--   2. fetch_owned_asset_opex_ratios — by property_id + report_month + is_budget
--   3. archive-aggregation Step 2  — by deal_id JOIN deals WHERE status='closed_won'
--
-- Schema is compatible with the existing populated table in all environments.

CREATE TABLE IF NOT EXISTS deal_monthly_actuals (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id               UUID        REFERENCES deals(id) ON DELETE CASCADE,
  property_id           UUID        REFERENCES properties(id) ON DELETE CASCADE,

  report_month          DATE        NOT NULL,
  is_budget             BOOLEAN     NOT NULL DEFAULT false,
  is_proforma           BOOLEAN     NOT NULL DEFAULT false,

  -- ── Occupancy ─────────────────────────────────────────────────────────────
  occupied_units        INTEGER,
  total_units           INTEGER,
  occupancy_rate        NUMERIC(6,4),

  -- ── Revenue ───────────────────────────────────────────────────────────────
  gross_potential_rent  NUMERIC,
  avg_effective_rent    NUMERIC,
  effective_gross_income NUMERIC,

  -- ── NOI ───────────────────────────────────────────────────────────────────
  noi                   NUMERIC,

  -- ── OpEx summary ─────────────────────────────────────────────────────────
  expenses              NUMERIC,

  -- ── OpEx line items (monthly $) — required by fetch_owned_asset_opex_ratios ──
  payroll               NUMERIC,
  repairs_maintenance   NUMERIC,
  utilities             NUMERIC,
  marketing             NUMERIC,
  admin_general         NUMERIC,
  management_fee        NUMERIC,
  management_fee_pct    NUMERIC(6,4),
  turnover_costs        NUMERIC,
  real_estate_taxes     NUMERIC,
  insurance             NUMERIC,

  -- ── Capital ───────────────────────────────────────────────────────────────
  capex                 NUMERIC,

  -- ── Metadata ──────────────────────────────────────────────────────────────
  -- "data_source" matches the column name used in existing rows and all queries
  data_source           VARCHAR(50) NOT NULL DEFAULT 'manual',
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The unique constraint must be on (property_id, report_month, is_budget, is_proforma)
  -- because both the API's ON CONFLICT clause and existing rows depend on this key.
  CONSTRAINT uq_deal_monthly_actuals_property_month
    UNIQUE (property_id, report_month, is_budget, is_proforma)
);

-- Ensure any missing columns are added in environments where the table pre-existed.
-- These are safe no-ops if the columns already exist.
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS deal_id           UUID        REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS is_proforma       BOOLEAN     NOT NULL DEFAULT false;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS occupied_units    INTEGER;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS total_units       INTEGER;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS occupancy_rate    NUMERIC(6,4);
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS gross_potential_rent NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS avg_effective_rent   NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS effective_gross_income NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS noi               NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS expenses          NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS payroll           NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS repairs_maintenance NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS utilities         NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS marketing         NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS admin_general     NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS management_fee    NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS management_fee_pct NUMERIC(6,4);
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS turnover_costs    NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS real_estate_taxes NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS insurance         NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS capex             NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS data_source       VARCHAR(50) NOT NULL DEFAULT 'manual';
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS notes             TEXT;

-- Indexes for the three access patterns
CREATE INDEX IF NOT EXISTS idx_deal_monthly_actuals_deal
  ON deal_monthly_actuals(deal_id, report_month DESC)
  WHERE deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deal_monthly_actuals_property
  ON deal_monthly_actuals(property_id, report_month DESC)
  WHERE property_id IS NOT NULL;

-- Trigger: auto-fill occupancy_rate and expenses when not supplied
CREATE OR REPLACE FUNCTION deal_monthly_actuals_m22_fill_derived()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.occupancy_rate IS NULL
     AND NEW.occupied_units IS NOT NULL
     AND NEW.total_units IS NOT NULL
     AND NEW.total_units > 0
  THEN
    NEW.occupancy_rate := NEW.occupied_units::NUMERIC / NEW.total_units;
  END IF;

  IF NEW.expenses IS NULL
     AND NEW.effective_gross_income IS NOT NULL
     AND NEW.noi IS NOT NULL
  THEN
    NEW.expenses := NEW.effective_gross_income - NEW.noi;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_monthly_actuals_m22 ON deal_monthly_actuals;
CREATE TRIGGER trg_deal_monthly_actuals_m22
  BEFORE INSERT OR UPDATE ON deal_monthly_actuals
  FOR EACH ROW EXECUTE FUNCTION deal_monthly_actuals_m22_fill_derived();
