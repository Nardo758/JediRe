/**
 * Migration 030: Scenario Generation System
 * Phase 3, Component 2: Evidence-Based Scenario Generation
 * 
 * Replaces generic stress testing with evidence-based scenarios 
 * derived from actual news events and market intelligence.
 * 
 * Scenarios:
 * - Bull Case: Optimistic (all positive catalysts materialize)
 * - Base Case: Expected (12-month delays, 80% delivery)
 * - Bear Case: Pessimistic (50% demand, 120% supply, 1 risk)
 * - Stress Case: Crisis (demand fails, 150% supply, 2+ risks)
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

-- ============================================================================
-- SCENARIO TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS scenario_templates (
  id SERIAL PRIMARY KEY,
  scenario_type VARCHAR(50) NOT NULL UNIQUE, -- bull, base, bear, stress
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Event inclusion rules
  demand_positive_inclusion DECIMAL(3,2) DEFAULT 1.00, -- 1.00 = include all, 0.50 = include 50%
  demand_negative_inclusion DECIMAL(3,2) DEFAULT 0.00, -- 0.00 = exclude all
  supply_positive_inclusion DECIMAL(3,2) DEFAULT 0.00,
  supply_negative_inclusion DECIMAL(3,2) DEFAULT 1.00,
  risk_event_count INTEGER DEFAULT 0, -- Number of risk events to include
  
  -- Timing adjustments
  demand_delay_months INTEGER DEFAULT 0, -- Delay positive demand catalysts
  supply_acceleration_months INTEGER DEFAULT 0, -- Accelerate supply delivery
  
  -- Multipliers for event impact
  demand_impact_multiplier DECIMAL(3,2) DEFAULT 1.00,
  supply_impact_multiplier DECIMAL(3,2) DEFAULT 1.00,
  
  -- Description template
  assumption_narrative_template TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scenario_templates_type ON scenario_templates(scenario_type);

-- Seed scenario templates
INSERT INTO scenario_templates (
  scenario_type, display_name, description,
  demand_positive_inclusion, demand_negative_inclusion,
  supply_positive_inclusion, supply_negative_inclusion,
  risk_event_count,
  demand_delay_months, supply_acceleration_months,
  demand_impact_multiplier, supply_impact_multiplier,
  assumption_narrative_template
) VALUES
  -- BULL CASE
  (
    'bull', 'Bull Case (Optimistic)', 
    'All positive demand catalysts materialize on schedule. No additional competitive supply beyond announced pipeline. Momentum continues at current trajectory. Risk events don''t materialize.',
    1.00, 0.00,  -- Include all positive demand, exclude negative
    0.00, 1.00,  -- Exclude positive supply, include negative
    0,           -- No risk events
    0, 0,        -- No delays
    1.00, 0.80,  -- Full demand impact, 80% supply impact
    '{demand_catalysts} deliver on schedule. No supply competition beyond pipeline. {risk_statement}'
  ),
  
  -- BASE CASE
  (
    'base', 'Base Case (Expected)',
    'Demand catalysts materialize with 12-month delay. 80% of pipeline supply delivers as scheduled. Momentum reverts to 5-year average. Low-probability risks excluded.',
    0.80, 0.00,  -- Include 80% of positive demand
    0.80, 0.80,  -- Include 80% of both supply types
    0,           -- No major risk events
    12, 0,       -- 12-month demand delay
    0.90, 1.00,  -- 90% demand impact, full supply
    '{demand_catalysts} delayed 12 months. {supply_units} units deliver as scheduled. {risk_statement}'
  ),
  
  -- BEAR CASE
  (
    'bear', 'Bear Case (Pessimistic)',
    'Demand catalysts partially fail (50% of projected jobs). Additional unannounced supply enters pipeline (20% buffer). Momentum turns negative. One identified risk event materializes.',
    0.50, 0.50,  -- Include 50% positive, 50% negative demand
    1.20, 0.50,  -- 120% supply buffer, 50% supply negative
    1,           -- 1 risk event
    18, -6,      -- 18-month demand delay, 6-month supply acceleration
    0.50, 1.20,  -- 50% demand impact, 120% supply
    '{demand_catalysts} reduced by 50%. {supply_units} units + 20% surprise projects. {risk_statement}'
  ),
  
  -- STRESS CASE
  (
    'stress', 'Stress Case (Crisis)',
    'Primary demand catalyst fails entirely. Maximum pipeline supply delivers simultaneously. Two risk events compound (e.g., rent control + recession). Macro shock scenario.',
    0.00, 1.00,  -- Exclude positive, include all negative demand
    1.50, 0.00,  -- 150% supply surge, exclude supply negative
    2,           -- 2+ compounding risk events
    24, -12,     -- 24-month demand delay, 12-month supply acceleration
    0.00, 1.50,  -- Zero demand impact, 150% supply
    '{demand_catalysts} fail entirely. {supply_units} units deliver simultaneously. {risk_statement}'
  )
ON CONFLICT (scenario_type) DO UPDATE SET
  demand_positive_inclusion = EXCLUDED.demand_positive_inclusion,
  demand_negative_inclusion = EXCLUDED.demand_negative_inclusion,
  supply_positive_inclusion = EXCLUDED.supply_positive_inclusion,
  supply_negative_inclusion = EXCLUDED.supply_negative_inclusion,
  risk_event_count = EXCLUDED.risk_event_count,
  demand_delay_months = EXCLUDED.demand_delay_months,
  supply_acceleration_months = EXCLUDED.supply_acceleration_months,
  demand_impact_multiplier = EXCLUDED.demand_impact_multiplier,
  supply_impact_multiplier = EXCLUDED.supply_impact_multiplier,
  assumption_narrative_template = EXCLUDED.assumption_narrative_template,
  updated_at = NOW();

-- ============================================================================
-- DEAL SCENARIOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  scenario_template_id INTEGER NOT NULL REFERENCES scenario_templates(id),
  scenario_type VARCHAR(50) NOT NULL, -- denormalized for quick queries
  
  -- Metadata
  scenario_name VARCHAR(200) NOT NULL,
  description TEXT,
  is_custom BOOLEAN DEFAULT FALSE, -- User-created custom scenario
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Generation metadata
  generated_at TIMESTAMP DEFAULT NOW(),
  generated_by UUID REFERENCES users(id),
  generation_trigger VARCHAR(100), -- auto, manual, event_update
  source_event_count INTEGER DEFAULT 0,
  
  -- Financial results (denormalized for quick comparison)
  irr_pct DECIMAL(6,3), -- e.g., 17.850
  coc_year_5 DECIMAL(6,3), -- e.g., 2.250
  npv DECIMAL(15,2), -- e.g., 2100000.00
  cash_flow_year_5 DECIMAL(15,2),
  
  -- Calculated at
  results_calculated_at TIMESTAMP,
  
  -- Scenario narrative
  key_assumptions_summary TEXT,
  event_summary TEXT,
  risk_summary TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(deal_id, scenario_type, is_custom) -- One standard scenario of each type per deal
);

CREATE INDEX idx_deal_scenarios_deal ON deal_scenarios(deal_id);
CREATE INDEX idx_deal_scenarios_type ON deal_scenarios(scenario_type);
CREATE INDEX idx_deal_scenarios_active ON deal_scenarios(deal_id, is_active);

-- ============================================================================
-- SCENARIO ASSUMPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS scenario_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES deal_scenarios(id) ON DELETE CASCADE,
  
  -- Pro forma assumptions (rental strategy)
  rent_growth_pct DECIMAL(6,3) NOT NULL,
  vacancy_pct DECIMAL(6,3) NOT NULL,
  opex_growth_pct DECIMAL(6,3) NOT NULL,
  exit_cap_pct DECIMAL(6,3) NOT NULL,
  absorption_months INTEGER,
  
  -- Comparison to baseline
  rent_growth_delta DECIMAL(6,3), -- vs baseline
  vacancy_delta DECIMAL(6,3),
  opex_growth_delta DECIMAL(6,3),
  exit_cap_delta DECIMAL(6,3),
  absorption_delta INTEGER,
  
  -- Adjustment reasoning
  adjustment_rationale TEXT,
  source_events_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(scenario_id) -- One set of assumptions per scenario
);

CREATE INDEX idx_scenario_assumptions_scenario ON scenario_assumptions(scenario_id);

-- ============================================================================
-- SCENARIO RESULTS (Full Financial Outputs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS scenario_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES deal_scenarios(id) ON DELETE CASCADE,
  
  -- Returns
  irr_pct DECIMAL(6,3) NOT NULL,
  equity_multiple DECIMAL(6,3),
  coc_year_1 DECIMAL(6,3),
  coc_year_5 DECIMAL(6,3),
  coc_average DECIMAL(6,3),
  
  -- Valuation
  npv DECIMAL(15,2),
  total_return DECIMAL(15,2),
  initial_equity DECIMAL(15,2),
  exit_value DECIMAL(15,2),
  
  -- Cash flows
  cash_flow_year_1 DECIMAL(15,2),
  cash_flow_year_5 DECIMAL(15,2),
  cumulative_cash_flow DECIMAL(15,2),
  
  -- Operating metrics
  stabilized_occupancy_pct DECIMAL(6,3),
  stabilized_noi DECIMAL(15,2),
  average_rent_psf DECIMAL(8,2),
  
  -- Risk-adjusted metrics
  downside_case_irr DECIMAL(6,3),
  probability_of_loss_pct DECIMAL(6,3),
  value_at_risk DECIMAL(15,2), -- 5th percentile loss
  
  -- Calculation metadata
  calculation_method VARCHAR(100), -- deterministic, monte_carlo
  monte_carlo_runs INTEGER,
  calculation_timestamp TIMESTAMP DEFAULT NOW(),
  calculation_duration_ms INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(scenario_id) -- One result set per scenario
);

CREATE INDEX idx_scenario_results_scenario ON scenario_results(scenario_id);
CREATE INDEX idx_scenario_results_irr ON scenario_results(irr_pct);

-- ============================================================================
-- SCENARIO EVENTS (Many-to-Many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS scenario_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES deal_scenarios(id) ON DELETE CASCADE,
  
  -- Event references (one of these will be populated)
  news_event_id UUID REFERENCES news_events(id) ON DELETE SET NULL,
  demand_event_id UUID REFERENCES demand_projections(id) ON DELETE SET NULL,
  supply_event_id UUID REFERENCES supply_pipeline(id) ON DELETE SET NULL,
  risk_event_id UUID, -- Future: references risk_events table
  
  -- Event classification
  event_type VARCHAR(50) NOT NULL, -- demand_positive, demand_negative, supply_positive, supply_negative, risk
  event_category VARCHAR(100), -- employment, university, new_construction, etc.
  
  -- Impact on scenario
  included BOOLEAN DEFAULT TRUE,
  inclusion_reason TEXT,
  impact_weight DECIMAL(3,2) DEFAULT 1.00, -- 0.00 to 1.50
  timing_adjustment_months INTEGER DEFAULT 0, -- Delay or acceleration
  
  -- Event summary
  event_summary TEXT,
  event_date DATE,
  projected_impact_date DATE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scenario_events_scenario ON scenario_events(scenario_id);
CREATE INDEX idx_scenario_events_news ON scenario_events(news_event_id);
CREATE INDEX idx_scenario_events_demand ON scenario_events(demand_event_id);
CREATE INDEX idx_scenario_events_supply ON scenario_events(supply_event_id);
CREATE INDEX idx_scenario_events_type ON scenario_events(event_type);

-- ============================================================================
-- MONTE CARLO DISTRIBUTIONS (Optional Enhancement)
-- ============================================================================

CREATE TABLE IF NOT EXISTS monte_carlo_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES deal_scenarios(id) ON DELETE CASCADE,
  
  -- Variable being modeled
  variable_name VARCHAR(100) NOT NULL, -- rent_growth, vacancy, exit_cap, etc.
  
  -- Distribution type
  distribution_type VARCHAR(50) NOT NULL, -- normal, lognormal, triangular, uniform
  
  -- Distribution parameters
  mean_value DECIMAL(10,4),
  std_dev DECIMAL(10,4),
  min_value DECIMAL(10,4),
  max_value DECIMAL(10,4),
  mode_value DECIMAL(10,4), -- For triangular
  
  -- Correlation
  correlation_matrix JSONB, -- Correlations with other variables
  
  -- Results
  percentile_5 DECIMAL(10,4),
  percentile_25 DECIMAL(10,4),
  percentile_50 DECIMAL(10,4), -- Median
  percentile_75 DECIMAL(10,4),
  percentile_95 DECIMAL(10,4),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(scenario_id, variable_name)
);

CREATE INDEX idx_monte_carlo_scenario ON monte_carlo_distributions(scenario_id);

-- ============================================================================
-- SCENARIO COMPARISON CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS scenario_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Cached comparison data
  comparison_data JSONB NOT NULL, -- Full side-by-side comparison
  
  -- Summary metrics
  irr_range_min DECIMAL(6,3),
  irr_range_max DECIMAL(6,3),
  irr_spread DECIMAL(6,3),
  
  npv_range_min DECIMAL(15,2),
  npv_range_max DECIMAL(15,2),
  
  -- Metadata
  scenario_count INTEGER DEFAULT 4,
  last_updated TIMESTAMP DEFAULT NOW(),
  cache_valid_until TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scenario_comparisons_deal ON scenario_comparisons(deal_id);
CREATE INDEX idx_scenario_comparisons_valid ON scenario_comparisons(cache_valid_until);

-- ============================================================================
-- CUSTOM SCENARIO CONFIGURATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_scenario_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES deal_scenarios(id) ON DELETE CASCADE,
  
  -- User-defined event selections
  selected_event_ids JSONB, -- Array of event IDs to include
  excluded_event_ids JSONB, -- Array of event IDs to explicitly exclude
  
  -- User-defined probability overrides
  event_probability_overrides JSONB, -- {event_id: probability}
  
  -- User-defined assumption overrides
  assumption_overrides JSONB, -- {rent_growth: 0.05, vacancy: 0.08, ...}
  override_rationale TEXT,
  
  -- Sharing and templates
  is_template BOOLEAN DEFAULT FALSE,
  template_name VARCHAR(200),
  shared_with_team BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(scenario_id)
);

CREATE INDEX idx_custom_configs_scenario ON custom_scenario_configs(scenario_id);
CREATE INDEX idx_custom_configs_templates ON custom_scenario_configs(is_template) WHERE is_template = TRUE;

-- ============================================================================
-- AUDIT TRAIL
-- ============================================================================

CREATE TABLE IF NOT EXISTS scenario_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES deal_scenarios(id) ON DELETE CASCADE,
  
  action VARCHAR(100) NOT NULL, -- generated, updated, recalculated, deleted
  performed_by UUID REFERENCES users(id),
  
  -- Change tracking
  changes JSONB, -- Before/after values
  trigger_event VARCHAR(200), -- What caused this action
  
  -- Financial impact
  irr_before DECIMAL(6,3),
  irr_after DECIMAL(6,3),
  irr_delta DECIMAL(6,3),
  
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scenario_audit_scenario ON scenario_audit_log(scenario_id);
CREATE INDEX idx_scenario_audit_timestamp ON scenario_audit_log(timestamp DESC);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Scenario Comparison View
CREATE OR REPLACE VIEW v_scenario_comparison AS
SELECT 
  ds.deal_id,
  d.name AS deal_name,
  ds.scenario_type,
  ds.scenario_name,
  ds.irr_pct,
  ds.coc_year_5,
  ds.npv,
  ds.cash_flow_year_5,
  sa.rent_growth_pct,
  sa.vacancy_pct,
  sa.exit_cap_pct,
  ds.key_assumptions_summary,
  ds.event_summary,
  ds.risk_summary,
  ds.source_event_count,
  ds.generated_at
FROM deal_scenarios ds
JOIN deals d ON d.id = ds.deal_id
LEFT JOIN scenario_assumptions sa ON sa.scenario_id = ds.id
WHERE ds.is_active = TRUE
ORDER BY ds.deal_id, 
  CASE ds.scenario_type 
    WHEN 'bull' THEN 1 
    WHEN 'base' THEN 2 
    WHEN 'bear' THEN 3 
    WHEN 'stress' THEN 4 
    ELSE 5 
  END;

-- Scenario Events Summary
CREATE OR REPLACE VIEW v_scenario_events_summary AS
SELECT 
  se.scenario_id,
  ds.deal_id,
  ds.scenario_type,
  se.event_type,
  COUNT(*) AS event_count,
  SUM(CASE WHEN se.included THEN 1 ELSE 0 END) AS included_count,
  AVG(se.impact_weight) AS avg_impact_weight,
  AVG(se.timing_adjustment_months) AS avg_timing_adjustment
FROM scenario_events se
JOIN deal_scenarios ds ON ds.id = se.scenario_id
GROUP BY se.scenario_id, ds.deal_id, ds.scenario_type, se.event_type;

COMMENT ON TABLE scenario_templates IS 'Defines Bull/Base/Bear/Stress scenario generation rules';
COMMENT ON TABLE deal_scenarios IS 'Generated scenarios for each deal (4 standard + custom)';
COMMENT ON TABLE scenario_assumptions IS 'Pro forma assumptions for each scenario';
COMMENT ON TABLE scenario_results IS 'Financial outcomes (IRR, CoC, NPV) for each scenario';
COMMENT ON TABLE scenario_events IS 'News/demand/supply/risk events included in each scenario';
COMMENT ON TABLE monte_carlo_distributions IS 'Probability distributions for Monte Carlo simulation';
COMMENT ON TABLE scenario_comparisons IS 'Cached side-by-side comparisons';
COMMENT ON TABLE custom_scenario_configs IS 'User-defined custom scenario configurations';
COMMENT ON TABLE scenario_audit_log IS 'Change tracking for scenarios';
