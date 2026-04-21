-- M22: Post-Close Actuals Write Path
-- Creates deal_monthly_actuals table used by:
--   - fetch_owned_asset_actuals (Tier 2 agent tool) — reads by property_id
--   - fetch_owned_asset_opex_ratios (Tier 2 agent tool) — reads by property_id
--   - archive-aggregation.function.ts (Step 2) — reads by deal_id + d.status = 'closed_won'

CREATE TABLE IF NOT EXISTS deal_monthly_actuals (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id               UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  -- property_id resolved from deal_properties on write; used by Tier-2 agent tool lookups
  property_id           UUID        REFERENCES properties(id),

  report_month          DATE        NOT NULL,
  is_budget             BOOLEAN     NOT NULL DEFAULT false,

  -- ── Occupancy ─────────────────────────────────────────────────────────────
  occupied_units        INTEGER,
  total_units           INTEGER,
  -- stored as decimal (0.95 = 95%); computed from occupied/total when not supplied
  occupancy_rate        NUMERIC(6,4),

  -- ── Revenue ───────────────────────────────────────────────────────────────
  gross_potential_rent  NUMERIC,    -- monthly gross potential rent ($)
  -- per unit, monthly — used by fetch_owned_asset_actuals avg_effective_rent_per_unit
  avg_effective_rent    NUMERIC,
  -- monthly EGI — used by fetch_owned_asset_opex_ratios egi_per_unit
  effective_gross_income NUMERIC,

  -- ── NOI ───────────────────────────────────────────────────────────────────
  -- monthly NOI — used by archive-aggregation Step 2 deal_achieved_noi
  noi                   NUMERIC,

  -- ── OpEx summary ─────────────────────────────────────────────────────────
  expenses              NUMERIC,    -- total operating expenses, monthly

  -- ── OpEx line items (monthly $) — all used by fetch_owned_asset_opex_ratios ──
  payroll               NUMERIC,
  repairs_maintenance   NUMERIC,
  utilities             NUMERIC,
  marketing             NUMERIC,
  admin_general         NUMERIC,
  management_fee        NUMERIC,
  -- management_fee as % of EGI (decimal) — stored separately per agent tool
  management_fee_pct    NUMERIC(6,4),
  turnover_costs        NUMERIC,
  real_estate_taxes     NUMERIC,
  insurance             NUMERIC,

  -- ── Capital ───────────────────────────────────────────────────────────────
  capex                 NUMERIC,

  -- ── Metadata ──────────────────────────────────────────────────────────────
  source                TEXT        NOT NULL DEFAULT 'manual',
  -- 'manual' | 'yardi' | 'entrata' | 'appfolio' | 'file'
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_deal_monthly_actuals UNIQUE (deal_id, report_month, is_budget)
);

-- Primary access patterns
CREATE INDEX IF NOT EXISTS idx_deal_monthly_actuals_deal
  ON deal_monthly_actuals(deal_id, report_month DESC);

-- Agent tool access — always filtered by property_id + report_month + is_budget
CREATE INDEX IF NOT EXISTS idx_deal_monthly_actuals_property
  ON deal_monthly_actuals(property_id, report_month DESC)
  WHERE property_id IS NOT NULL;

-- Trigger to auto-compute occupancy_rate when not supplied
CREATE OR REPLACE FUNCTION deal_monthly_actuals_fill_derived()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Auto-compute occupancy_rate from occupied/total if not explicitly set
  IF NEW.occupancy_rate IS NULL
     AND NEW.occupied_units IS NOT NULL
     AND NEW.total_units IS NOT NULL
     AND NEW.total_units > 0
  THEN
    NEW.occupancy_rate := NEW.occupied_units::NUMERIC / NEW.total_units;
  END IF;

  -- Auto-compute expenses from NOI and EGI when not supplied
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

DROP TRIGGER IF EXISTS trg_deal_monthly_actuals_fill_derived ON deal_monthly_actuals;
CREATE TRIGGER trg_deal_monthly_actuals_fill_derived
  BEFORE INSERT OR UPDATE ON deal_monthly_actuals
  FOR EACH ROW EXECUTE FUNCTION deal_monthly_actuals_fill_derived();
