-- Migration 025: Pro Forma Adjustments System
-- Date: 2026-02-11
-- Purpose: Track news-driven adjustments to financial model assumptions
-- Phase 2, Component 1: Pro Forma Integration with News Intelligence

-- ============================================================================
-- Pro Forma Assumptions
-- Tracks baseline and current (news-adjusted) values for key assumptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS proforma_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Strategy Type
  strategy text NOT NULL, -- 'rental', 'build_to_sell', 'flip', 'airbnb'
  
  -- ========================================
  -- Rental Strategy Assumptions
  -- ========================================
  
  -- Rent Growth Rate (annual %)
  rent_growth_baseline numeric(5,2), -- Historical submarket average
  rent_growth_current numeric(5,2), -- News-adjusted rate
  rent_growth_user_override numeric(5,2), -- User manual override
  rent_growth_override_reason text,
  
  -- Vacancy Rate (%)
  vacancy_baseline numeric(5,2), -- Current submarket vacancy
  vacancy_current numeric(5,2), -- News-adjusted vacancy
  vacancy_user_override numeric(5,2),
  vacancy_override_reason text,
  
  -- Operating Expense Growth (annual %)
  opex_growth_baseline numeric(5,2), -- CPI + local trend
  opex_growth_current numeric(5,2), -- News-adjusted (insurance, tax, utilities)
  opex_growth_user_override numeric(5,2),
  opex_growth_override_reason text,
  
  -- Cap Rate at Exit (%)
  exit_cap_baseline numeric(5,2), -- Transaction comp average
  exit_cap_current numeric(5,2), -- News-adjusted (momentum + risk)
  exit_cap_user_override numeric(5,2),
  exit_cap_override_reason text,
  
  -- Absorption Rate (leases/month)
  absorption_baseline numeric(6,2), -- Historical lease velocity
  absorption_current numeric(6,2), -- News-adjusted
  absorption_user_override numeric(6,2),
  absorption_override_reason text,
  
  -- ========================================
  -- Future Strategy Extensions (Phase 2+)
  -- ========================================
  
  -- Build-to-Sell
  construction_timeline_months integer,
  presale_velocity numeric(5,2), -- Sales per month
  
  -- Flip
  rehab_timeline_months integer,
  market_time_days integer,
  
  -- Airbnb
  occupancy_rate numeric(5,2), -- %
  adr numeric(10,2), -- Average Daily Rate
  
  -- Additional fields (extensible JSONB for strategy-specific data)
  strategy_specific_data jsonb DEFAULT '{}',
  
  -- Metadata
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  last_recalculation timestamp,
  
  CONSTRAINT valid_strategy CHECK (strategy IN ('rental', 'build_to_sell', 'flip', 'airbnb')),
  CONSTRAINT rent_growth_range CHECK (rent_growth_baseline BETWEEN -20 AND 50),
  CONSTRAINT vacancy_range CHECK (vacancy_baseline BETWEEN 0 AND 100)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_proforma_assumptions_deal_id ON proforma_assumptions(deal_id);
CREATE INDEX IF NOT EXISTS idx_proforma_assumptions_strategy ON proforma_assumptions(strategy);
CREATE INDEX IF NOT EXISTS idx_proforma_assumptions_updated ON proforma_assumptions(updated_at DESC);

-- One assumption set per deal
CREATE UNIQUE INDEX IF NOT EXISTS idx_proforma_assumptions_deal_unique ON proforma_assumptions(deal_id);

-- ============================================================================
-- Assumption Adjustments
-- Tracks individual news events that changed assumptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS assumption_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id uuid NOT NULL REFERENCES proforma_assumptions(id) ON DELETE CASCADE,
  
  -- Source Event
  news_event_id uuid REFERENCES news_events(id) ON DELETE SET NULL,
  demand_event_id uuid REFERENCES demand_events(id) ON DELETE SET NULL,
  adjustment_trigger text NOT NULL, -- 'news_event', 'demand_signal', 'manual', 'periodic_update'
  
  -- Which assumption was adjusted
  assumption_type text NOT NULL, -- 'rent_growth', 'vacancy', 'opex_growth', 'exit_cap', 'absorption'
  
  -- Adjustment details
  previous_value numeric(10,2) NOT NULL,
  new_value numeric(10,2) NOT NULL,
  adjustment_delta numeric(10,2) GENERATED ALWAYS AS (new_value - previous_value) STORED,
  adjustment_pct numeric(5,2), -- Percentage change
  
  -- Calculation methodology
  calculation_method text NOT NULL, -- 'demand_supply_elasticity', 'employment_conversion', 'direct_passthrough', etc.
  calculation_inputs jsonb, -- Store the inputs used
  
  -- Example:
  -- For rent growth: { "demand_delta_pct": 1.2, "elasticity": 0.8, "result": +0.96 }
  -- For vacancy: { "employee_count": 2200, "conversion_rate": 0.4, "total_inventory": 10000, "result": -8.8 }
  
  -- Confidence
  confidence_score numeric(5,2), -- 0-100, derived from news event confidence
  confidence_factors jsonb,
  
  -- Metadata
  created_at timestamp DEFAULT now(),
  applied_by uuid REFERENCES users(id), -- User who approved/applied (for manual adjustments)
  notes text,
  
  CONSTRAINT valid_trigger CHECK (adjustment_trigger IN ('news_event', 'demand_signal', 'manual', 'periodic_update')),
  CONSTRAINT valid_assumption_type CHECK (assumption_type IN ('rent_growth', 'vacancy', 'opex_growth', 'exit_cap', 'absorption'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_adjustments_proforma_id ON assumption_adjustments(proforma_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_news_event_id ON assumption_adjustments(news_event_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_demand_event_id ON assumption_adjustments(demand_event_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_assumption_type ON assumption_adjustments(assumption_type);
CREATE INDEX IF NOT EXISTS idx_adjustments_created_at ON assumption_adjustments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_adjustments_trigger ON assumption_adjustments(adjustment_trigger);

-- GIN index for searching calculation inputs
CREATE INDEX IF NOT EXISTS idx_adjustments_inputs ON assumption_adjustments USING GIN(calculation_inputs);

-- ============================================================================
-- Adjustment History (Time Series)
-- Point-in-time snapshots of all assumptions for historical comparison
-- ============================================================================

CREATE TABLE IF NOT EXISTS adjustment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id uuid NOT NULL REFERENCES proforma_assumptions(id) ON DELETE CASCADE,
  
  -- Snapshot of all assumption values at this point in time
  snapshot_data jsonb NOT NULL,
  /* Structure:
  {
    "rent_growth": { "baseline": 3.5, "current": 4.7, "user_override": null },
    "vacancy": { "baseline": 5.0, "current": 4.2, "user_override": null },
    "opex_growth": { "baseline": 2.8, "current": 2.8, "user_override": null },
    "exit_cap": { "baseline": 5.5, "current": 5.3, "user_override": null },
    "absorption": { "baseline": 8.0, "current": 10.5, "user_override": null }
  }
  */
  
  -- What triggered this snapshot
  trigger_type text NOT NULL, -- 'calculation', 'user_override', 'baseline_update', 'export'
  trigger_adjustment_id uuid REFERENCES assumption_adjustments(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at timestamp DEFAULT now(),
  created_by uuid REFERENCES users(id),
  snapshot_label text, -- Optional: "Pre-Amazon Announcement", "Q4 2025 Baseline"
  
  CONSTRAINT valid_trigger_type CHECK (trigger_type IN ('calculation', 'user_override', 'baseline_update', 'export'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_history_proforma_id ON adjustment_history(proforma_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON adjustment_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_trigger_adjustment ON adjustment_history(trigger_adjustment_id);

-- GIN index for querying snapshot data
CREATE INDEX IF NOT EXISTS idx_history_snapshot ON adjustment_history USING GIN(snapshot_data);

-- ============================================================================
-- Adjustment Formulas (Configuration)
-- Define the calculation formulas and parameters
-- ============================================================================

CREATE TABLE IF NOT EXISTS adjustment_formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Formula identification
  formula_name text NOT NULL UNIQUE,
  assumption_type text NOT NULL,
  description text,
  
  -- Formula parameters
  formula_expression text NOT NULL, -- Math expression or algorithm name
  parameters jsonb NOT NULL, -- Parameter definitions and defaults
  
  -- Thresholds
  trigger_thresholds jsonb, -- When to apply this formula
  /* Example for rent growth:
  {
    "demand_signal_change_pct": 5,
    "supply_pipeline_units": 200
  }
  */
  
  -- Constraints
  min_adjustment numeric(10,2),
  max_adjustment numeric(10,2),
  
  -- Metadata
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  active boolean DEFAULT true,
  
  CONSTRAINT valid_assumption_type_formula CHECK (assumption_type IN ('rent_growth', 'vacancy', 'opex_growth', 'exit_cap', 'absorption'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_formulas_assumption_type ON adjustment_formulas(assumption_type);
CREATE INDEX IF NOT EXISTS idx_formulas_active ON adjustment_formulas(active);

-- ============================================================================
-- Seed Adjustment Formulas
-- ============================================================================

INSERT INTO adjustment_formulas (formula_name, assumption_type, description, formula_expression, parameters, trigger_thresholds, min_adjustment, max_adjustment) VALUES

-- Rent Growth: Demand-Supply Elasticity
('demand_supply_elasticity', 'rent_growth', 'Adjust rent growth based on demand-supply ratio changes', 
 'demand_supply_delta_pct * rent_elasticity',
 '{"rent_elasticity_min": 0.5, "rent_elasticity_max": 1.2, "rent_elasticity_default": 0.8}',
 '{"demand_signal_change_pct": 5, "supply_pipeline_units": 200}',
 -5.0, 5.0),

-- Vacancy: Employment Conversion
('employment_vacancy_impact', 'vacancy', 'Adjust vacancy based on employment changes', 
 '(employee_count * housing_conversion_rate) / total_inventory * 100',
 '{"housing_conversion_rate": 0.40, "occupancy_factor": 0.95}',
 '{"min_employee_count": 500}',
 -15.0, 15.0),

-- Operating Expense: Direct Passthrough
('opex_direct_passthrough', 'opex_growth', 'Apply announced expense changes directly', 
 'announced_change_pct',
 '{}',
 '{"min_change_pct": 0.5}',
 -10.0, 20.0),

-- Cap Rate: Momentum Compression
('momentum_cap_compression', 'exit_cap', 'Adjust cap rate based on market momentum', 
 'baseline + momentum_adjustment + risk_premium',
 '{"momentum_compression_min_bps": -25, "momentum_compression_max_bps": -10, "risk_premium_range": 0.5}',
 '{"momentum_threshold": 55}',
 -0.5, 0.5),

-- Absorption: Demand-Supply Impact
('absorption_demand_adjustment', 'absorption', 'Adjust absorption rate based on demand and supply', 
 'baseline * (1 + demand_delta) * (1 - competitive_supply_factor)',
 '{"competitive_radius_miles": 3, "supply_impact_factor": 0.15}',
 '{"min_demand_change": 50}',
 -50.0, 100.0)

ON CONFLICT (formula_name) DO NOTHING;

-- ============================================================================
-- Views for Easy Querying
-- ============================================================================

-- Current Pro Forma Summary (with adjustments)
CREATE OR REPLACE VIEW proforma_summary AS
SELECT 
  pa.id,
  pa.deal_id,
  d.name as deal_name,
  d.stage as deal_stage,
  pa.strategy,
  
  -- Rent Growth
  COALESCE(pa.rent_growth_user_override, pa.rent_growth_current, pa.rent_growth_baseline) as rent_growth,
  pa.rent_growth_baseline,
  pa.rent_growth_current,
  pa.rent_growth_user_override,
  
  -- Vacancy
  COALESCE(pa.vacancy_user_override, pa.vacancy_current, pa.vacancy_baseline) as vacancy,
  pa.vacancy_baseline,
  pa.vacancy_current,
  pa.vacancy_user_override,
  
  -- OpEx Growth
  COALESCE(pa.opex_growth_user_override, pa.opex_growth_current, pa.opex_growth_baseline) as opex_growth,
  pa.opex_growth_baseline,
  pa.opex_growth_current,
  pa.opex_growth_user_override,
  
  -- Exit Cap
  COALESCE(pa.exit_cap_user_override, pa.exit_cap_current, pa.exit_cap_baseline) as exit_cap,
  pa.exit_cap_baseline,
  pa.exit_cap_current,
  pa.exit_cap_user_override,
  
  -- Absorption
  COALESCE(pa.absorption_user_override, pa.absorption_current, pa.absorption_baseline) as absorption,
  pa.absorption_baseline,
  pa.absorption_current,
  pa.absorption_user_override,
  
  pa.last_recalculation,
  pa.updated_at
FROM proforma_assumptions pa
JOIN deals d ON d.id = pa.deal_id;

-- Recent Adjustments with Event Details
CREATE OR REPLACE VIEW recent_adjustments AS
SELECT 
  aa.id,
  aa.proforma_id,
  pa.deal_id,
  d.name as deal_name,
  aa.assumption_type,
  aa.previous_value,
  aa.new_value,
  aa.adjustment_delta,
  aa.adjustment_pct,
  aa.calculation_method,
  aa.confidence_score,
  aa.adjustment_trigger,
  ne.headline as news_headline,
  ne.event_category as news_category,
  ne.published_at as news_published_at,
  de.total_units as demand_units,
  de.people_count as demand_people_count,
  aa.created_at
FROM assumption_adjustments aa
JOIN proforma_assumptions pa ON pa.id = aa.proforma_id
JOIN deals d ON d.id = pa.deal_id
LEFT JOIN news_events ne ON ne.id = aa.news_event_id
LEFT JOIN demand_events de ON de.id = aa.demand_event_id
ORDER BY aa.created_at DESC;

-- ============================================================================
-- Trigger: Auto-update timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_proforma_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proforma_update_timestamp
  BEFORE UPDATE ON proforma_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION update_proforma_timestamp();

-- ============================================================================
-- Trigger: Create history snapshot on adjustment
-- ============================================================================

CREATE OR REPLACE FUNCTION create_adjustment_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  -- Create snapshot of current state
  INSERT INTO adjustment_history (proforma_id, snapshot_data, trigger_type, trigger_adjustment_id)
  SELECT 
    pa.id,
    jsonb_build_object(
      'rent_growth', jsonb_build_object('baseline', pa.rent_growth_baseline, 'current', pa.rent_growth_current, 'user_override', pa.rent_growth_user_override),
      'vacancy', jsonb_build_object('baseline', pa.vacancy_baseline, 'current', pa.vacancy_current, 'user_override', pa.vacancy_user_override),
      'opex_growth', jsonb_build_object('baseline', pa.opex_growth_baseline, 'current', pa.opex_growth_current, 'user_override', pa.opex_growth_user_override),
      'exit_cap', jsonb_build_object('baseline', pa.exit_cap_baseline, 'current', pa.exit_cap_current, 'user_override', pa.exit_cap_user_override),
      'absorption', jsonb_build_object('baseline', pa.absorption_baseline, 'current', pa.absorption_current, 'user_override', pa.absorption_user_override)
    ),
    'calculation',
    NEW.id
  FROM proforma_assumptions pa
  WHERE pa.id = NEW.proforma_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER adjustment_create_snapshot
  AFTER INSERT ON assumption_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION create_adjustment_snapshot();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE proforma_assumptions IS 'Financial model assumptions with baseline and news-adjusted values';
COMMENT ON TABLE assumption_adjustments IS 'Individual adjustments to assumptions triggered by news events';
COMMENT ON TABLE adjustment_history IS 'Time-series snapshots of assumption values for historical analysis';
COMMENT ON TABLE adjustment_formulas IS 'Calculation formulas and thresholds for automatic adjustments';

COMMENT ON COLUMN proforma_assumptions.rent_growth_baseline IS 'Historical submarket average rent growth';
COMMENT ON COLUMN proforma_assumptions.rent_growth_current IS 'News-adjusted rent growth rate';
COMMENT ON COLUMN proforma_assumptions.rent_growth_user_override IS 'User manual override (takes precedence)';

COMMENT ON COLUMN assumption_adjustments.calculation_method IS 'Formula used: demand_supply_elasticity, employment_vacancy_impact, etc.';
COMMENT ON COLUMN assumption_adjustments.calculation_inputs IS 'JSONB storing all inputs used in the calculation';

-- ============================================================================
-- Grants (adjust based on your user roles)
-- ============================================================================

-- GRANT SELECT, INSERT, UPDATE ON proforma_assumptions TO authenticated_users;
-- GRANT SELECT ON proforma_summary TO authenticated_users;
