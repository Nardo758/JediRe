-- Migration 016: Deal Performance Table
-- Date: 2026-02-08
-- Description: Create table for tracking actual vs pro forma performance on owned assets

CREATE TABLE IF NOT EXISTS deal_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Actuals
  actual_noi NUMERIC(15,2),
  actual_occupancy NUMERIC(5,2),
  actual_avg_rent NUMERIC(10,2),
  actual_concessions NUMERIC(10,2),
  actual_opex_ratio NUMERIC(5,2),
  actual_capex NUMERIC(15,2),
  lease_renewal_rate NUMERIC(5,2),
  
  -- Pro Forma (from acquisition underwriting)
  proforma_noi NUMERIC(15,2),
  proforma_occupancy NUMERIC(5,2),
  proforma_rent NUMERIC(10,2),
  proforma_concessions NUMERIC(10,2),
  proforma_opex_ratio NUMERIC(5,2),
  proforma_capex NUMERIC(15,2),
  
  -- Returns
  current_irr NUMERIC(5,2),
  projected_irr NUMERIC(5,2),
  coc_return NUMERIC(5,2),
  equity_multiple NUMERIC(5,2),
  total_distributions NUMERIC(15,2),
  unrealized_gain_loss NUMERIC(15,2),
  
  -- Market Position
  current_ai_score INTEGER,
  competing_supply INTEGER,
  comp_rent_position VARCHAR(20), -- 'above', 'at', 'below'
  property_concessions NUMERIC(10,2),
  comp_concessions NUMERIC(10,2),
  
  -- Value-Add (if applicable)
  renovation_pct_complete NUMERIC(5,2),
  renovation_budget_variance NUMERIC(5,2),
  renovated_unit_rent NUMERIC(10,2),
  unrenovated_unit_rent NUMERIC(10,2),
  timeline_variance_days INTEGER,
  
  -- Risk Monitoring
  loan_maturity_date DATE,
  months_to_maturity INTEGER,
  refi_risk_flag BOOLEAN DEFAULT FALSE,
  interest_rate_sensitivity NUMERIC(5,2),
  market_risk_signals INTEGER DEFAULT 0,
  portfolio_concentration_pct NUMERIC(5,2),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT check_period CHECK (period_end > period_start),
  CONSTRAINT check_occupancy CHECK (actual_occupancy >= 0 AND actual_occupancy <= 100),
  CONSTRAINT check_irr CHECK (current_irr >= -100 AND current_irr <= 500)
);

-- Indexes for performance
CREATE INDEX idx_deal_performance_deal ON deal_performance(deal_id);
CREATE INDEX idx_deal_performance_period ON deal_performance(period_start, period_end);
CREATE INDEX idx_deal_performance_created ON deal_performance(created_at DESC);
CREATE INDEX idx_deal_performance_refi_risk ON deal_performance(refi_risk_flag) WHERE refi_risk_flag = true;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_deal_performance_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  
  -- Auto-calculate months to maturity
  IF NEW.loan_maturity_date IS NOT NULL THEN
    NEW.months_to_maturity := EXTRACT(MONTH FROM AGE(NEW.loan_maturity_date, NOW()))::INTEGER;
    -- Set refi risk flag if <12 months
    NEW.refi_risk_flag := (NEW.months_to_maturity < 12);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deal_performance_updated ON deal_performance;
CREATE TRIGGER trigger_deal_performance_updated
  BEFORE INSERT OR UPDATE ON deal_performance
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_performance_updated();

-- Helper function to get latest performance for a deal
CREATE OR REPLACE FUNCTION get_latest_performance(p_deal_id UUID)
RETURNS deal_performance AS $$
BEGIN
  RETURN (
    SELECT *
    FROM deal_performance
    WHERE deal_id = p_deal_id
    ORDER BY period_end DESC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE deal_performance IS 'Tracks actual vs proforma performance for owned assets';
COMMENT ON COLUMN deal_performance.actual_noi IS 'Trailing 12-month net operating income';
COMMENT ON COLUMN deal_performance.noi_variance IS 'Calculated: (actual - proforma) / proforma';
COMMENT ON COLUMN deal_performance.refi_risk_flag IS 'Auto-set to true if loan matures in <12 months';
COMMENT ON COLUMN deal_performance.comp_rent_position IS 'Position vs market: above, at, or below';
