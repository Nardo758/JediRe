-- ============================================================
-- JEDI RE Market Research Engine
-- Central intelligence hub for market data aggregation
-- 
-- PRIMARY DATA SOURCE: Apartment Locator AI
-- Provides comprehensive apartment market intelligence:
-- - Rent prices, occupancy rates, unit mix
-- - Property inventory, availability, saturation
-- - Amenities, concessions, property classification
-- - Market trends, comparable properties
-- ============================================================

-- Market research reports cache
CREATE TABLE IF NOT EXISTS market_research_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  submarket_name VARCHAR(255),
  
  -- Full report stored as JSONB
  report_data JSONB NOT NULL,
  
  -- Metadata
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  confidence_level VARCHAR(20) CHECK (confidence_level IN ('HIGH', 'MEDIUM', 'LOW')),
  sources_count INTEGER DEFAULT 0,
  
  -- Freshness tracking
  expires_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(deal_id)
);

-- Quick access to key metrics (extracted from report_data)
CREATE TABLE IF NOT EXISTS market_research_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  report_id UUID REFERENCES market_research_reports(id) ON DELETE CASCADE,
  
  -- Rental Market
  properties_count INTEGER,
  avg_rent_1br DECIMAL(10,2),
  avg_rent_2br DECIMAL(10,2),
  avg_occupancy_rate DECIMAL(5,2),
  rent_growth_12mo DECIMAL(5,2),
  competition_intensity VARCHAR(20),
  
  -- Demographics
  population INTEGER,
  median_income INTEGER,
  population_growth_rate DECIMAL(5,2),
  
  -- Supply
  units_under_construction INTEGER,
  units_permitted INTEGER,
  
  -- Scores
  demand_strength_score INTEGER CHECK (demand_strength_score BETWEEN 0 AND 100),
  supply_balance_score INTEGER CHECK (supply_balance_score BETWEEN 0 AND 100),
  overall_opportunity_score INTEGER CHECK (overall_opportunity_score BETWEEN 0 AND 100),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(deal_id)
);

-- Data source sync tracking
CREATE TABLE IF NOT EXISTS market_research_source_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  report_id UUID REFERENCES market_research_reports(id) ON DELETE CASCADE,
  
  source_name VARCHAR(100) NOT NULL,  -- 'Apartment Locator AI', 'Census API', etc.
  status VARCHAR(50) NOT NULL,  -- 'success', 'failed', 'timeout'
  records_fetched INTEGER DEFAULT 0,
  response_time_ms INTEGER,
  error_message TEXT,
  
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auto-trigger configuration
CREATE TABLE IF NOT EXISTS market_research_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_name VARCHAR(100) UNIQUE NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,  -- 'deal_created', 'deal_updated', 'scheduled'
  is_enabled BOOLEAN DEFAULT true,
  
  -- Configuration
  config JSONB DEFAULT '{}'::jsonb,
  
  -- Stats
  total_executions INTEGER DEFAULT 0,
  last_execution TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_market_reports_deal ON market_research_reports(deal_id);
CREATE INDEX idx_market_reports_generated ON market_research_reports(generated_at DESC);
CREATE INDEX idx_market_reports_confidence ON market_research_reports(confidence_level);
CREATE INDEX idx_market_metrics_deal ON market_research_metrics(deal_id);
CREATE INDEX idx_market_metrics_opportunity ON market_research_metrics(overall_opportunity_score DESC);
CREATE INDEX idx_source_log_report ON market_research_source_log(report_id);
CREATE INDEX idx_source_log_source ON market_research_source_log(source_name, status);

-- Views for easy querying
CREATE OR REPLACE VIEW deal_market_intelligence AS
SELECT 
  d.id as deal_id,
  d.property_name as deal_name,
  d.city,
  d.state,
  mrr.submarket_name,
  mrr.confidence_level,
  mrr.generated_at as report_generated_at,
  mrm.properties_count,
  mrm.avg_rent_1br,
  mrm.avg_rent_2br,
  mrm.avg_occupancy_rate,
  mrm.rent_growth_12mo,
  mrm.competition_intensity,
  mrm.population,
  mrm.median_income,
  mrm.demand_strength_score,
  mrm.supply_balance_score,
  mrm.overall_opportunity_score,
  CASE 
    WHEN mrm.overall_opportunity_score >= 80 THEN 'STRONG_OPPORTUNITY'
    WHEN mrm.overall_opportunity_score >= 60 THEN 'MODERATE_OPPORTUNITY'
    WHEN mrm.overall_opportunity_score >= 40 THEN 'NEUTRAL'
    WHEN mrm.overall_opportunity_score >= 20 THEN 'CAUTION'
    ELSE 'AVOID'
  END as market_verdict,
  mrr.sources_count,
  EXTRACT(EPOCH FROM (NOW() - mrr.generated_at)) / 3600 as hours_since_generated
FROM deals d
LEFT JOIN market_research_reports mrr ON mrr.deal_id = d.id
LEFT JOIN market_research_metrics mrm ON mrm.deal_id = d.id;

-- Function to auto-extract metrics from report
CREATE OR REPLACE FUNCTION extract_market_metrics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO market_research_metrics (
    deal_id,
    report_id,
    properties_count,
    avg_rent_1br,
    avg_rent_2br,
    avg_occupancy_rate,
    rent_growth_12mo,
    competition_intensity,
    population,
    median_income,
    units_under_construction,
    demand_strength_score,
    supply_balance_score,
    overall_opportunity_score
  ) VALUES (
    NEW.deal_id,
    NEW.id,
    (NEW.report_data->'apartment_market'->>'properties_count')::INTEGER,
    (NEW.report_data->'apartment_market'->>'avg_rent_1br')::DECIMAL,
    (NEW.report_data->'apartment_market'->>'avg_rent_2br')::DECIMAL,
    (NEW.report_data->'apartment_market'->>'avg_occupancy_rate')::DECIMAL,
    (NEW.report_data->'apartment_market'->>'rent_growth_12mo')::DECIMAL,
    NEW.report_data->'apartment_market'->>'competition_intensity',
    (NEW.report_data->'demographics'->>'population')::INTEGER,
    (NEW.report_data->'demographics'->>'median_income')::INTEGER,
    (NEW.report_data->'supply_pipeline'->>'units_under_construction')::INTEGER,
    (NEW.report_data->'market_score'->>'demand_strength')::INTEGER,
    (NEW.report_data->'market_score'->>'supply_balance')::INTEGER,
    (NEW.report_data->'market_score'->>'overall_opportunity')::INTEGER
  )
  ON CONFLICT (deal_id) DO UPDATE SET
    report_id = EXCLUDED.report_id,
    properties_count = EXCLUDED.properties_count,
    avg_rent_1br = EXCLUDED.avg_rent_1br,
    avg_rent_2br = EXCLUDED.avg_rent_2br,
    avg_occupancy_rate = EXCLUDED.avg_occupancy_rate,
    rent_growth_12mo = EXCLUDED.rent_growth_12mo,
    competition_intensity = EXCLUDED.competition_intensity,
    population = EXCLUDED.population,
    median_income = EXCLUDED.median_income,
    units_under_construction = EXCLUDED.units_under_construction,
    demand_strength_score = EXCLUDED.demand_strength_score,
    supply_balance_score = EXCLUDED.supply_balance_score,
    overall_opportunity_score = EXCLUDED.overall_opportunity_score,
    created_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to extract metrics when report is saved
CREATE TRIGGER extract_metrics_on_report_insert
AFTER INSERT OR UPDATE ON market_research_reports
FOR EACH ROW EXECUTE FUNCTION extract_market_metrics();

-- Seed default triggers
INSERT INTO market_research_triggers (trigger_name, trigger_type, config) VALUES
  ('deal_created_trigger', 'deal_created', '{"auto_generate": true, "cache_hours": 24}'::jsonb),
  ('deal_location_updated', 'deal_updated', '{"auto_generate": true, "fields": ["latitude", "longitude"]}'::jsonb)
ON CONFLICT (trigger_name) DO NOTHING;

COMMENT ON TABLE market_research_reports IS 'Cached market research reports from Market Research Engine';
COMMENT ON TABLE market_research_metrics IS 'Extracted key metrics for quick access';
COMMENT ON TABLE market_research_source_log IS 'Tracks data fetching from external sources';
COMMENT ON TABLE market_research_triggers IS 'Configuration for automatic market research generation';
