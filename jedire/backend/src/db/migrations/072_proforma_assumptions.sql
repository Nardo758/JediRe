-- Migration 072: Pro Forma Assumptions
-- Stores editable financial model assumptions per deal
-- Supports the three-layer architecture: Assumptions → Engine → Intelligence

CREATE TABLE IF NOT EXISTS proforma_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  strategy VARCHAR(20) NOT NULL DEFAULT 'rental',
  
  rent_growth_baseline DECIMAL(5,3) DEFAULT 3.0,
  rent_growth_current DECIMAL(5,3) DEFAULT 3.0,
  rent_growth_override DECIMAL(5,3),
  rent_growth_override_reason TEXT,
  
  vacancy_baseline DECIMAL(5,2) DEFAULT 5.0,
  vacancy_current DECIMAL(5,2) DEFAULT 5.0,
  vacancy_override DECIMAL(5,2),
  vacancy_override_reason TEXT,
  
  opex_growth_baseline DECIMAL(5,3) DEFAULT 3.0,
  opex_growth_current DECIMAL(5,3) DEFAULT 3.0,
  opex_growth_override DECIMAL(5,3),
  opex_growth_override_reason TEXT,
  
  exit_cap_baseline DECIMAL(5,3) DEFAULT 5.25,
  exit_cap_current DECIMAL(5,3) DEFAULT 5.25,
  exit_cap_override DECIMAL(5,3),
  exit_cap_override_reason TEXT,
  
  absorption_baseline DECIMAL(5,2) DEFAULT 12.0,
  absorption_current DECIMAL(5,2) DEFAULT 12.0,
  absorption_override DECIMAL(5,2),
  absorption_override_reason TEXT,
  
  last_recalculation TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_deal_proforma UNIQUE(deal_id)
);

CREATE INDEX IF NOT EXISTS idx_proforma_assumptions_deal ON proforma_assumptions(deal_id);

CREATE TABLE IF NOT EXISTS proforma_adjustment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id UUID NOT NULL REFERENCES proforma_assumptions(id) ON DELETE CASCADE,
  news_event_id UUID,
  demand_event_id UUID,
  adjustment_trigger VARCHAR(50) NOT NULL,
  assumption_type VARCHAR(30) NOT NULL,
  previous_value DECIMAL(10,4) NOT NULL,
  new_value DECIMAL(10,4) NOT NULL,
  adjustment_delta DECIMAL(10,4) NOT NULL,
  adjustment_pct DECIMAL(10,4),
  calculation_method TEXT,
  calculation_inputs JSONB,
  confidence_score DECIMAL(3,2) DEFAULT 0.5,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proforma_adj_proforma ON proforma_adjustment_history(proforma_id);
CREATE INDEX IF NOT EXISTS idx_proforma_adj_trigger ON proforma_adjustment_history(adjustment_trigger);

CREATE OR REPLACE FUNCTION update_proforma_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proforma_assumptions_updated ON proforma_assumptions;
CREATE TRIGGER trg_proforma_assumptions_updated
  BEFORE UPDATE ON proforma_assumptions
  FOR EACH ROW EXECUTE FUNCTION update_proforma_updated_at();

COMMENT ON TABLE proforma_assumptions IS 'Pro forma assumptions per deal - Layer 1 of the three-layer financial architecture';
COMMENT ON TABLE proforma_adjustment_history IS 'History of adjustments to pro forma assumptions from news events, demand signals, or manual changes';
