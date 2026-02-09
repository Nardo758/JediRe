-- Migration 015: Pipeline Grid Columns
-- Date: 2026-02-08
-- Description: Add columns to deals table for pipeline grid tracking

-- Add new columns for pipeline grid
ALTER TABLE deals ADD COLUMN IF NOT EXISTS days_in_stage INTEGER DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_opportunity_score INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS jedi_adjusted_price NUMERIC(15,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS jedi_adjusted_noi NUMERIC(15,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS jedi_adjusted_cap_rate NUMERIC(5,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS jedi_adjusted_irr NUMERIC(5,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS broker_projected_irr NUMERIC(5,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS best_strategy VARCHAR(50);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS strategy_confidence INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS supply_risk_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS imbalance_score INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS source VARCHAR(50);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS loi_deadline DATE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS inspection_period_end DATE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS dd_checklist_pct NUMERIC(5,2) DEFAULT 0;

-- Function to automatically update days_in_stage
CREATE OR REPLACE FUNCTION update_days_in_stage()
RETURNS TRIGGER AS $$
BEGIN
  -- Reset days when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.days_in_stage := 0;
  ELSE
    -- Calculate days since last update
    NEW.days_in_stage := EXTRACT(DAY FROM NOW() - NEW.updated_at)::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run on every deal update
DROP TRIGGER IF EXISTS trigger_days_in_stage ON deals;
CREATE TRIGGER trigger_days_in_stage
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_days_in_stage();

-- Indexes for grid performance
CREATE INDEX IF NOT EXISTS idx_deals_days_in_stage ON deals(days_in_stage);
CREATE INDEX IF NOT EXISTS idx_deals_ai_score ON deals(ai_opportunity_score);
CREATE INDEX IF NOT EXISTS idx_deals_supply_risk ON deals(supply_risk_flag);

COMMENT ON COLUMN deals.days_in_stage IS 'Days since deal entered current pipeline stage';
COMMENT ON COLUMN deals.ai_opportunity_score IS 'Strategy Arbitrage confidence score (0-100)';
COMMENT ON COLUMN deals.jedi_adjusted_price IS 'AI-recommended purchase price';
COMMENT ON COLUMN deals.jedi_adjusted_noi IS 'AI-adjusted net operating income';
COMMENT ON COLUMN deals.best_strategy IS 'Recommended investment strategy';
COMMENT ON COLUMN deals.strategy_confidence IS 'Confidence in best strategy (0-100)';
COMMENT ON COLUMN deals.supply_risk_flag IS 'True if high competing supply detected';
COMMENT ON COLUMN deals.imbalance_score IS 'Supply-demand imbalance score (0-100)';
