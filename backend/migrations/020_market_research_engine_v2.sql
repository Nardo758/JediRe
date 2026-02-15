-- ============================================================
-- JEDI RE Market Research Engine V2
-- User-Driven Risk Assessment with Real Metrics
--
-- Key Changes:
-- - Real unit counts (not abstract scores)
-- - Per capita metrics (units/1000, rent/income)
-- - Jobs-to-housing analysis (employment impact)
-- - User-configurable thresholds
-- ============================================================

-- Add new fields to market_research_metrics for V2
ALTER TABLE market_research_metrics ADD COLUMN IF NOT EXISTS 
  -- Supply Analysis
  existing_properties INTEGER,
  existing_total_units INTEGER,
  available_units_now INTEGER,
  availability_rate DECIMAL(5,2),
  near_term_pipeline_total INTEGER,
  pipeline_ratio DECIMAL(5,2),
  vacant_parcels INTEGER,
  underutilized_parcels INTEGER,
  developable_acres INTEGER,
  realistic_buildable_units INTEGER,
  future_supply_ratio DECIMAL(6,2),
  estimated_years_to_buildout DECIMAL(5,1),
  annual_absorption_rate INTEGER,
  market_size_multiplier DECIMAL(5,2),
  
  -- Per Capita
  household_count INTEGER,
  avg_household_size DECIMAL(3,1),
  units_per_1000_people DECIMAL(5,1),
  units_per_100_households DECIMAL(5,1),
  units_per_1000_fully_built DECIMAL(5,1),
  units_per_100_hh_fully_built DECIMAL(5,1),
  current_vs_benchmark INTEGER, -- percentage
  future_vs_benchmark INTEGER, -- percentage
  avg_rent_annual INTEGER,
  rent_to_income_ratio DECIMAL(5,2),
  market_affordability VARCHAR(20),
  
  -- Employment Impact
  total_jobs_in_market INTEGER,
  jobs_per_unit DECIMAL(6,1),
  jobs_per_unit_fully_built DECIMAL(6,1),
  jobs_to_units_multiplier DECIMAL(4,2),
  total_jobs_from_news INTEGER,
  total_units_demand_from_news INTEGER,
  demand_absorption_vs_pipeline INTEGER, -- percentage
  demand_absorption_vs_future INTEGER, -- percentage
  employment_verdict TEXT,
  demand_supply_balance VARCHAR(20),
  
  -- Market Capacity
  total_future_supply INTEGER,
  years_to_absorb_all DECIMAL(5,1),
  saturation_year INTEGER,
  capacity_assessment TEXT,
  undersupplied_today BOOLEAN,
  oversupplied_future BOOLEAN;

-- User Risk Preferences Table (NEW)
CREATE TABLE IF NOT EXISTS user_risk_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Supply Thresholds
  max_acceptable_pipeline_ratio DECIMAL(5,2) DEFAULT 30.0,
  max_acceptable_future_supply INTEGER DEFAULT 1000,
  min_years_to_saturation DECIMAL(5,1) DEFAULT 5.0,
  
  -- Density Thresholds
  max_units_per_1000_people DECIMAL(5,1) DEFAULT 45.0,
  min_jobs_per_unit DECIMAL(5,1) DEFAULT 2.0,
  
  -- Employment Thresholds
  jobs_to_units_multiplier DECIMAL(4,2) DEFAULT 0.45,
  min_demand_coverage DECIMAL(5,2) DEFAULT 50.0, -- percentage
  
  -- Market Type (affects multiplier)
  market_type VARCHAR(50) DEFAULT 'suburban',
  -- Options: tech_hub, suburban, university, retirement, industrial
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Deal Risk Alerts Table (NEW)
CREATE TABLE IF NOT EXISTS deal_risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  metric VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,2) NOT NULL,
  user_threshold DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL, -- OK, EXCEEDED, WARNING
  message TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL, -- LOW, MEDIUM, HIGH
  
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  INDEX idx_alerts_deal (deal_id),
  INDEX idx_alerts_user (user_id),
  INDEX idx_alerts_status (status)
);

-- Employment News Events Enhancement
ALTER TABLE news_events ADD COLUMN IF NOT EXISTS 
  jobs_added INTEGER DEFAULT 0,
  jobs_removed INTEGER DEFAULT 0,
  units_demand_generated INTEGER DEFAULT 0,
  jobs_multiplier_used DECIMAL(4,2) DEFAULT 0.45;

-- Update extract metrics function for V2
CREATE OR REPLACE FUNCTION extract_market_metrics_v2()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO market_research_metrics (
    deal_id,
    report_id,
    -- Existing fields
    properties_count,
    avg_rent_1br,
    avg_rent_2br,
    avg_occupancy_rate,
    rent_growth_12mo,
    competition_intensity,
    population,
    median_income,
    units_under_construction,
    -- V2 Supply Analysis
    existing_properties,
    existing_total_units,
    available_units_now,
    availability_rate,
    near_term_pipeline_total,
    pipeline_ratio,
    vacant_parcels,
    underutilized_parcels,
    developable_acres,
    realistic_buildable_units,
    future_supply_ratio,
    estimated_years_to_buildout,
    annual_absorption_rate,
    market_size_multiplier,
    -- V2 Per Capita
    household_count,
    avg_household_size,
    units_per_1000_people,
    units_per_100_households,
    units_per_1000_fully_built,
    units_per_100_hh_fully_built,
    current_vs_benchmark,
    future_vs_benchmark,
    avg_rent_annual,
    rent_to_income_ratio,
    market_affordability,
    -- V2 Employment Impact
    total_jobs_in_market,
    jobs_per_unit,
    jobs_per_unit_fully_built,
    jobs_to_units_multiplier,
    total_jobs_from_news,
    total_units_demand_from_news,
    demand_absorption_vs_pipeline,
    demand_absorption_vs_future,
    employment_verdict,
    demand_supply_balance,
    -- V2 Market Capacity
    total_future_supply,
    years_to_absorb_all,
    saturation_year,
    capacity_assessment,
    undersupplied_today,
    oversupplied_future,
    -- Legacy scores
    demand_strength_score,
    supply_balance_score,
    overall_opportunity_score
  ) VALUES (
    NEW.deal_id,
    NEW.id,
    -- Existing
    (NEW.report_data->'demand_indicators'->>'properties_in_market')::INTEGER,
    (NEW.report_data->'demand_indicators'->>'avg_rent_1br')::DECIMAL,
    (NEW.report_data->'demand_indicators'->>'avg_rent_2br')::DECIMAL,
    (NEW.report_data->'demand_indicators'->>'avg_occupancy_rate')::DECIMAL,
    (NEW.report_data->'demand_indicators'->>'rent_growth_12mo')::DECIMAL,
    NEW.report_data->'demand_indicators'->>'competitive_pressure',
    (NEW.report_data->'per_capita'->>'population')::INTEGER,
    (NEW.report_data->'per_capita'->>'median_income')::INTEGER,
    (NEW.report_data->'supply_analysis'->>'units_under_construction')::INTEGER,
    -- V2 Supply
    (NEW.report_data->'supply_analysis'->>'existing_properties')::INTEGER,
    (NEW.report_data->'supply_analysis'->>'existing_total_units')::INTEGER,
    (NEW.report_data->'supply_analysis'->>'available_units_now')::INTEGER,
    (NEW.report_data->'supply_analysis'->>'availability_rate')::DECIMAL,
    (NEW.report_data->'supply_analysis'->>'near_term_pipeline_total')::INTEGER,
    (NEW.report_data->'supply_analysis'->>'pipeline_ratio')::DECIMAL,
    (NEW.report_data->'supply_analysis'->>'vacant_parcels')::INTEGER,
    (NEW.report_data->'supply_analysis'->>'underutilized_parcels')::INTEGER,
    (NEW.report_data->'supply_analysis'->>'developable_acres')::INTEGER,
    (NEW.report_data->'supply_analysis'->>'realistic_buildable_units')::INTEGER,
    (NEW.report_data->'supply_analysis'->>'future_supply_ratio')::DECIMAL,
    (NEW.report_data->'supply_analysis'->>'estimated_years_to_buildout')::DECIMAL,
    (NEW.report_data->'supply_analysis'->>'annual_absorption_rate')::INTEGER,
    (NEW.report_data->'supply_analysis'->>'market_size_multiplier')::DECIMAL,
    -- V2 Per Capita
    (NEW.report_data->'per_capita'->>'household_count')::INTEGER,
    (NEW.report_data->'per_capita'->>'avg_household_size')::DECIMAL,
    (NEW.report_data->'per_capita'->>'units_per_1000_people')::DECIMAL,
    (NEW.report_data->'per_capita'->>'units_per_100_households')::DECIMAL,
    (NEW.report_data->'per_capita'->>'units_per_1000_fully_built')::DECIMAL,
    (NEW.report_data->'per_capita'->>'units_per_100_hh_fully_built')::DECIMAL,
    (NEW.report_data->'per_capita'->>'current_vs_benchmark')::INTEGER,
    (NEW.report_data->'per_capita'->>'future_vs_benchmark')::INTEGER,
    (NEW.report_data->'per_capita'->>'avg_rent_annual')::INTEGER,
    (NEW.report_data->'per_capita'->>'rent_to_income_ratio')::DECIMAL,
    NEW.report_data->'per_capita'->>'market_affordability',
    -- V2 Employment
    (NEW.report_data->'employment_impact'->>'total_jobs_in_market')::INTEGER,
    (NEW.report_data->'employment_impact'->>'jobs_per_unit')::DECIMAL,
    (NEW.report_data->'employment_impact'->>'jobs_per_unit_fully_built')::DECIMAL,
    (NEW.report_data->'employment_impact'->>'jobs_to_units_multiplier')::DECIMAL,
    (NEW.report_data->'employment_impact'->>'total_jobs_from_news')::INTEGER,
    (NEW.report_data->'employment_impact'->>'total_units_demand_from_news')::INTEGER,
    (NEW.report_data->'employment_impact'->>'demand_absorption_vs_pipeline')::INTEGER,
    (NEW.report_data->'employment_impact'->>'demand_absorption_vs_future')::INTEGER,
    NEW.report_data->'employment_impact'->>'employment_verdict',
    NEW.report_data->'employment_impact'->>'demand_supply_balance',
    -- V2 Capacity
    (NEW.report_data->'market_capacity'->>'total_future_supply')::INTEGER,
    (NEW.report_data->'market_capacity'->>'years_to_absorb_all')::DECIMAL,
    (NEW.report_data->'market_capacity'->>'saturation_year')::INTEGER,
    NEW.report_data->'market_capacity'->>'capacity_assessment',
    (NEW.report_data->'market_capacity'->>'undersupplied_today')::BOOLEAN,
    (NEW.report_data->'market_capacity'->>'oversupplied_future')::BOOLEAN,
    -- Legacy
    (NEW.report_data->'calculated_insights'->>'demand_strength_score')::INTEGER,
    (NEW.report_data->'calculated_insights'->>'supply_balance_score')::INTEGER,
    (NEW.report_data->'calculated_insights'->>'overall_opportunity_score')::INTEGER
  )
  ON CONFLICT (deal_id) DO UPDATE SET
    report_id = EXCLUDED.report_id,
    -- Update all fields
    properties_count = EXCLUDED.properties_count,
    existing_total_units = EXCLUDED.existing_total_units,
    realistic_buildable_units = EXCLUDED.realistic_buildable_units,
    units_per_1000_people = EXCLUDED.units_per_1000_people,
    jobs_per_unit = EXCLUDED.jobs_per_unit,
    total_units_demand_from_news = EXCLUDED.total_units_demand_from_news,
    created_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace old trigger with V2
DROP TRIGGER IF EXISTS extract_metrics_on_report_insert ON market_research_reports;
CREATE TRIGGER extract_metrics_on_report_insert_v2
AFTER INSERT OR UPDATE ON market_research_reports
FOR EACH ROW EXECUTE FUNCTION extract_market_metrics_v2();

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS idx_metrics_units_per_1000 ON market_research_metrics(units_per_1000_fully_built);
CREATE INDEX IF NOT EXISTS idx_metrics_jobs_per_unit ON market_research_metrics(jobs_per_unit);
CREATE INDEX IF NOT EXISTS idx_metrics_future_supply ON market_research_metrics(realistic_buildable_units);
CREATE INDEX IF NOT EXISTS idx_metrics_demand_coverage ON market_research_metrics(demand_absorption_vs_future);

-- View for V2 metrics
CREATE OR REPLACE VIEW deal_market_intelligence_v2 AS
SELECT 
  d.id as deal_id,
  d.property_name as deal_name,
  d.city,
  d.state,
  mrr.submarket_name,
  mrr.confidence_level,
  mrr.generated_at as report_generated_at,
  
  -- Supply Metrics
  mrm.existing_total_units,
  mrm.realistic_buildable_units,
  mrm.future_supply_ratio,
  mrm.pipeline_ratio,
  
  -- Per Capita
  mrm.units_per_1000_people,
  mrm.units_per_1000_fully_built,
  mrm.current_vs_benchmark,
  mrm.future_vs_benchmark,
  mrm.rent_to_income_ratio,
  mrm.market_affordability,
  
  -- Employment
  mrm.jobs_per_unit,
  mrm.jobs_per_unit_fully_built,
  mrm.total_jobs_from_news,
  mrm.total_units_demand_from_news,
  mrm.demand_absorption_vs_future,
  mrm.employment_verdict,
  
  -- Capacity
  mrm.total_future_supply,
  mrm.years_to_absorb_all,
  mrm.saturation_year,
  mrm.capacity_assessment,
  mrm.undersupplied_today,
  mrm.oversupplied_future,
  
  -- Legacy Scores (optional)
  mrm.overall_opportunity_score,
  
  EXTRACT(EPOCH FROM (NOW() - mrr.generated_at)) / 3600 as hours_since_generated
FROM deals d
LEFT JOIN market_research_reports mrr ON mrr.deal_id = d.id
LEFT JOIN market_research_metrics mrm ON mrm.deal_id = d.id;

COMMENT ON TABLE user_risk_preferences IS 'User-defined risk thresholds for market analysis';
COMMENT ON TABLE deal_risk_alerts IS 'Generated alerts when deals exceed user thresholds';
COMMENT ON VIEW deal_market_intelligence_v2 IS 'V2 market intelligence with real metrics (not scores)';
