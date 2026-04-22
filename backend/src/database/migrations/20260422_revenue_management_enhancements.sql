-- Revenue Management Enhancements
-- Adds missing revenue line items and balance sheet columns
-- Created: 2026-04-22

-- ═══════════════════════════════════════════════════════════════════════════════
-- REVENUE LINE ITEMS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add missing revenue deduction columns for proper waterfall
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS loss_to_lease NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS vacancy_loss NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS concessions NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS bad_debt NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS other_income NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS net_rental_income NUMERIC;

-- Add missing expense line item
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS contract_services NUMERIC;

-- Add debt service for cash flow
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS debt_service NUMERIC;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS cash_flow_before_tax NUMERIC;

-- Add average market rent for loss-to-lease calculation
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS avg_market_rent NUMERIC;

-- Add leasing activity columns
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS new_leases INTEGER;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS renewals INTEGER;
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS move_outs INTEGER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PROFORMA PROJECTIONS - Add matching columns
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE proforma_projections ADD COLUMN IF NOT EXISTS avg_market_rent NUMERIC;
ALTER TABLE proforma_projections ADD COLUMN IF NOT EXISTS debt_service NUMERIC;
ALTER TABLE proforma_projections ADD COLUMN IF NOT EXISTS cash_flow_before_tax NUMERIC;
ALTER TABLE proforma_projections ADD COLUMN IF NOT EXISTS contract_services NUMERIC;

-- ═══════════════════════════════════════════════════════════════════════════════
-- BALANCE SHEETS - Enhanced for BPI data
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add any missing balance sheet columns (table was created earlier)
ALTER TABLE balance_sheets ADD COLUMN IF NOT EXISTS deferred_charges NUMERIC(14,2);
ALTER TABLE balance_sheets ADD COLUMN IF NOT EXISTS notes_receivable NUMERIC(14,2);
ALTER TABLE balance_sheets ADD COLUMN IF NOT EXISTS intercompany_receivable NUMERIC(14,2);
ALTER TABLE balance_sheets ADD COLUMN IF NOT EXISTS intercompany_payable NUMERIC(14,2);
ALTER TABLE balance_sheets ADD COLUMN IF NOT EXISTS deferred_revenue NUMERIC(14,2);
ALTER TABLE balance_sheets ADD COLUMN IF NOT EXISTS mortgage_payable NUMERIC(14,2);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VARIANCE ITEMS - Enhanced with YTD
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add YTD columns to variance_items if not exists
ALTER TABLE variance_items ADD COLUMN IF NOT EXISTS ytd_actual NUMERIC(14,2);
ALTER TABLE variance_items ADD COLUMN IF NOT EXISTS ytd_budget NUMERIC(14,2);
ALTER TABLE variance_items ADD COLUMN IF NOT EXISTS ytd_variance NUMERIC(14,2);
ALTER TABLE variance_items ADD COLUMN IF NOT EXISTS ytd_variance_pct NUMERIC(8,4);

-- ═══════════════════════════════════════════════════════════════════════════════
-- REVENUE MANAGEMENT SNAPSHOTS
-- Track revenue optimization decisions and outcomes
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS revenue_management_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  
  -- Rent metrics
  total_units INTEGER,
  occupied_units INTEGER,
  avg_in_place_rent NUMERIC(10,2),
  avg_market_rent NUMERIC(10,2),
  loss_to_lease_total NUMERIC(12,2),
  loss_to_lease_pct NUMERIC(6,4),
  
  -- Exposure tracking
  units_expiring_30d INTEGER,
  units_expiring_60d INTEGER,
  units_expiring_90d INTEGER,
  renewal_rate_trailing NUMERIC(6,4),
  
  -- Concessions
  avg_concession_amount NUMERIC(10,2),
  units_with_concessions INTEGER,
  
  -- Pricing recommendations
  recommended_rent_increase_pct NUMERIC(6,4),
  recommended_concession_adjustment NUMERIC(10,2),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rev_mgmt_snapshots_deal ON revenue_management_snapshots(deal_id, snapshot_date DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS: Compute derived revenue metrics
-- ═══════════════════════════════════════════════════════════════════════════════

-- Update the trigger to compute cash flow
CREATE OR REPLACE FUNCTION deal_monthly_actuals_m22_fill_derived()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Occupancy rate
  IF NEW.occupancy_rate IS NULL
     AND NEW.occupied_units IS NOT NULL
     AND NEW.total_units IS NOT NULL
     AND NEW.total_units > 0
  THEN
    NEW.occupancy_rate := NEW.occupied_units::NUMERIC / NEW.total_units;
  END IF;

  -- Expenses from EGI - NOI
  IF NEW.expenses IS NULL
     AND NEW.effective_gross_income IS NOT NULL
     AND NEW.noi IS NOT NULL
  THEN
    NEW.expenses := NEW.effective_gross_income - NEW.noi;
  END IF;

  -- Cash flow before tax
  IF NEW.cash_flow_before_tax IS NULL
     AND NEW.noi IS NOT NULL
  THEN
    NEW.cash_flow_before_tax := COALESCE(NEW.noi, 0) 
                               - COALESCE(NEW.debt_service, 0) 
                               - COALESCE(NEW.capex, 0);
  END IF;

  -- Loss to lease (if we have market rent)
  IF NEW.loss_to_lease IS NULL
     AND NEW.avg_market_rent IS NOT NULL
     AND NEW.avg_effective_rent IS NOT NULL
     AND NEW.occupied_units IS NOT NULL
  THEN
    NEW.loss_to_lease := (NEW.avg_market_rent - NEW.avg_effective_rent) * NEW.occupied_units;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Comments
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE revenue_management_snapshots IS 'Point-in-time snapshots of revenue metrics for trend analysis';
COMMENT ON COLUMN deal_monthly_actuals.loss_to_lease IS 'Total loss-to-lease in dollars (market rent - effective rent * units)';
COMMENT ON COLUMN deal_monthly_actuals.vacancy_loss IS 'Revenue lost due to vacancy';
COMMENT ON COLUMN deal_monthly_actuals.concessions IS 'Total concessions given (rent discounts, free rent)';
COMMENT ON COLUMN deal_monthly_actuals.bad_debt IS 'Uncollected rent written off';
COMMENT ON COLUMN deal_monthly_actuals.other_income IS 'Ancillary income (parking, pets, storage, etc)';
