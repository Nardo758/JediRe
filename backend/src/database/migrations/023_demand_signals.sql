/**
 * Migration 023: Demand Signal System
 * Converts news events into quantified housing demand projections
 * 
 * Tables:
 * - demand_events: Classification of demand-generating events
 * - demand_projections: Quarterly phased demand forecasts
 * - trade_area_demand_forecast: Aggregated demand by trade area
 */

-- ========================================
-- DEMAND EVENT TYPES
-- ========================================

CREATE TABLE IF NOT EXISTS demand_event_types (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL, -- employment, university, military, migration
  event_type VARCHAR(100) NOT NULL,
  demand_direction VARCHAR(20) NOT NULL CHECK (demand_direction IN ('positive', 'negative', 'neutral')),
  default_conversion_rate DECIMAL(5,4) DEFAULT 0.0, -- units per person/job
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_demand_event_types_lookup ON demand_event_types(category, event_type);

-- Seed demand event types
INSERT INTO demand_event_types (category, event_type, demand_direction, default_conversion_rate, description) VALUES
  -- Employment (Positive)
  ('employment', 'corporate_relocation_inbound', 'positive', 0.4000, 'Company relocating TO the area'),
  ('employment', 'job_creation', 'positive', 0.3750, 'New job announcements (standard income)'),
  ('employment', 'job_creation_high_income', 'positive', 0.5500, 'Tech/finance jobs (high income)'),
  ('employment', 'facility_expansion', 'positive', 0.3500, 'Expansion of existing facility'),
  ('employment', 'new_facility', 'positive', 0.4200, 'New facility construction'),
  
  -- Employment (Negative)
  ('employment', 'corporate_relocation_outbound', 'negative', 0.4000, 'Company leaving the area'),
  ('employment', 'layoffs', 'negative', 0.3500, 'Job cuts'),
  ('employment', 'facility_closure', 'negative', 0.4000, 'Facility closing'),
  
  -- University
  ('university', 'enrollment_increase', 'positive', 0.2750, 'Student enrollment growth'),
  ('university', 'new_campus', 'positive', 0.3000, 'New campus opening'),
  ('university', 'program_expansion', 'positive', 0.2500, 'Academic program expansion'),
  
  -- Military
  ('military', 'base_expansion', 'positive', 0.6500, 'Military base growing'),
  ('military', 'base_closure', 'negative', 0.6500, 'Military base closing (BRAC)'),
  ('military', 'troop_deployment', 'negative', 0.5000, 'Troops deploying overseas'),
  ('military', 'troop_arrival', 'positive', 0.6000, 'Troops arriving/returning'),
  
  -- Migration
  ('migration', 'population_inflow', 'positive', 0.8000, 'Net positive migration'),
  ('migration', 'population_outflow', 'negative', 0.8000, 'Net negative migration')
ON CONFLICT (category, event_type) DO NOTHING;

-- ========================================
-- DEMAND EVENTS
-- ========================================

CREATE TABLE IF NOT EXISTS demand_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_event_id UUID NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
  demand_event_type_id INTEGER NOT NULL REFERENCES demand_event_types(id),
  
  -- Event Details
  headline TEXT NOT NULL,
  source_url TEXT,
  published_at TIMESTAMP NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW(),
  
  -- Demand Inputs
  people_count INTEGER DEFAULT 0, -- employees, students, military personnel
  income_tier VARCHAR(20) DEFAULT 'standard' CHECK (income_tier IN ('low', 'standard', 'high', 'luxury')),
  remote_work_pct DECIMAL(5,2) DEFAULT 0.00, -- % of jobs that are remote (reduces demand)
  
  -- Conversion Factors
  conversion_rate DECIMAL(5,4) NOT NULL, -- units per person (adjusted from default)
  geographic_concentration DECIMAL(5,4) DEFAULT 1.0000, -- concentration factor (0-1)
  
  -- Calculated Demand
  total_units DECIMAL(10,2) NOT NULL, -- people × conversion × (1 - remote) × concentration
  
  -- Income Stratification (%)
  affordable_pct DECIMAL(5,2) DEFAULT 0.00,
  workforce_pct DECIMAL(5,2) DEFAULT 0.00,
  luxury_pct DECIMAL(5,2) DEFAULT 0.00,
  
  -- Confidence
  confidence_score DECIMAL(5,2) DEFAULT 50.00, -- 0-100
  confidence_factors JSONB, -- { "source_reliability": 80, "data_completeness": 70, ... }
  
  -- Geographic Assignment (from geographic-assignment.service)
  msa_id INTEGER REFERENCES msas(id),
  submarket_id INTEGER REFERENCES submarkets(id),
  geographic_tier VARCHAR(20) CHECK (geographic_tier IN ('pin_drop', 'area', 'metro')),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_demand_events_news_event ON demand_events(news_event_id);
CREATE INDEX idx_demand_events_type ON demand_events(demand_event_type_id);
CREATE INDEX idx_demand_events_msa ON demand_events(msa_id);
CREATE INDEX idx_demand_events_submarket ON demand_events(submarket_id);
CREATE INDEX idx_demand_events_published ON demand_events(published_at DESC);
CREATE INDEX idx_demand_events_processed ON demand_events(processed_at DESC);

-- ========================================
-- DEMAND PROJECTIONS (Quarterly Phasing)
-- ========================================

CREATE TABLE IF NOT EXISTS demand_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_event_id UUID NOT NULL REFERENCES demand_events(id) ON DELETE CASCADE,
  
  -- Time Period
  quarter VARCHAR(7) NOT NULL, -- Format: "2028-Q1"
  quarter_start DATE NOT NULL,
  quarter_end DATE NOT NULL,
  
  -- Demand Allocation
  units_projected DECIMAL(10,2) NOT NULL, -- portion of total demand in this quarter
  phase_pct DECIMAL(5,2) NOT NULL, -- % of total demand
  
  -- Absorption Validation
  market_capacity_units INTEGER, -- can market absorb this?
  absorption_feasible BOOLEAN DEFAULT true,
  absorption_notes TEXT,
  
  -- Income Breakdown
  affordable_units DECIMAL(10,2) DEFAULT 0.00,
  workforce_units DECIMAL(10,2) DEFAULT 0.00,
  luxury_units DECIMAL(10,2) DEFAULT 0.00,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_demand_projections_event ON demand_projections(demand_event_id);
CREATE INDEX idx_demand_projections_quarter ON demand_projections(quarter);
CREATE INDEX idx_demand_projections_start_date ON demand_projections(quarter_start);
CREATE UNIQUE INDEX idx_demand_projections_event_quarter ON demand_projections(demand_event_id, quarter);

-- ========================================
-- TRADE AREA DEMAND FORECAST (Aggregated)
-- ========================================

CREATE TABLE IF NOT EXISTS trade_area_demand_forecast (
  id SERIAL PRIMARY KEY,
  trade_area_id INTEGER NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  quarter VARCHAR(7) NOT NULL,
  
  -- Aggregated Demand
  total_units_projected DECIMAL(10,2) DEFAULT 0.00,
  event_count INTEGER DEFAULT 0,
  
  -- By Income Tier
  affordable_units DECIMAL(10,2) DEFAULT 0.00,
  workforce_units DECIMAL(10,2) DEFAULT 0.00,
  luxury_units DECIMAL(10,2) DEFAULT 0.00,
  
  -- By Demand Direction
  positive_units DECIMAL(10,2) DEFAULT 0.00,
  negative_units DECIMAL(10,2) DEFAULT 0.00,
  net_units DECIMAL(10,2) DEFAULT 0.00,
  
  -- Market Context
  existing_units INTEGER, -- from trade_area.stats_snapshot
  pipeline_units INTEGER, -- under construction
  current_occupancy DECIMAL(5,2),
  
  -- Absorption Analysis
  supply_pressure_score DECIMAL(5,2), -- net_units / existing_units * 100
  absorption_risk VARCHAR(20) CHECK (absorption_risk IN ('low', 'medium', 'high', 'critical')),
  
  -- Metadata
  calculated_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_trade_area_demand_quarter ON trade_area_demand_forecast(trade_area_id, quarter);
CREATE INDEX idx_trade_area_demand_quarter_lookup ON trade_area_demand_forecast(quarter);

-- ========================================
-- PHASING TEMPLATES
-- ========================================

CREATE TABLE IF NOT EXISTS demand_phasing_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  phase_distribution JSONB NOT NULL, -- { "Q1": 25, "Q2": 40, "Q3": 25, "Q4": 10 }
  applicable_categories TEXT[], -- ['employment', 'university']
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO demand_phasing_templates (name, description, phase_distribution, applicable_categories) VALUES
  ('standard_hiring', 'Standard corporate hiring timeline', 
   '{"Q1": 25, "Q2": 40, "Q3": 25, "Q4": 10}'::jsonb, 
   ARRAY['employment']),
  
  ('aggressive_hiring', 'Accelerated hiring (tech/startup)', 
   '{"Q1": 35, "Q2": 45, "Q3": 15, "Q4": 5}'::jsonb, 
   ARRAY['employment']),
  
  ('slow_rollout', 'Gradual rollout over 2 years', 
   '{"Q1": 15, "Q2": 20, "Q3": 25, "Q4": 15, "Q5": 15, "Q6": 10}'::jsonb, 
   ARRAY['employment', 'university']),
  
  ('academic_calendar', 'University enrollment (August start)', 
   '{"Q3": 80, "Q4": 20}'::jsonb, 
   ARRAY['university']),
  
  ('immediate', 'Immediate impact (base closure, layoffs)', 
   '{"Q1": 100}'::jsonb, 
   ARRAY['employment', 'military'])
ON CONFLICT DO NOTHING;

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Calculate demand from event parameters
CREATE OR REPLACE FUNCTION calculate_housing_demand(
  people_count INTEGER,
  conversion_rate DECIMAL,
  remote_work_pct DECIMAL,
  geographic_concentration DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  RETURN people_count 
         * conversion_rate 
         * (1 - (remote_work_pct / 100.0)) 
         * geographic_concentration;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get demand impact on a deal's trade area
CREATE OR REPLACE FUNCTION get_deal_demand_impact(
  deal_uuid UUID,
  start_quarter VARCHAR(7),
  end_quarter VARCHAR(7)
) RETURNS TABLE (
  quarter VARCHAR(7),
  net_units DECIMAL,
  supply_pressure_score DECIMAL,
  event_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tadf.quarter,
    tadf.net_units,
    tadf.supply_pressure_score,
    tadf.event_count
  FROM trade_area_demand_forecast tadf
  JOIN trade_areas ta ON ta.id = tadf.trade_area_id
  JOIN properties p ON p.id = ta.property_id
  WHERE p.deal_id = deal_uuid
    AND tadf.quarter >= start_quarter
    AND tadf.quarter <= end_quarter
  ORDER BY tadf.quarter;
END;
$$ LANGUAGE plpgsql STABLE;

-- ========================================
-- TRIGGERS
-- ========================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_demand_event_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER demand_events_updated_at
  BEFORE UPDATE ON demand_events
  FOR EACH ROW
  EXECUTE FUNCTION update_demand_event_timestamp();

-- ========================================
-- KAFKA INTEGRATION (Future)
-- ========================================

-- Event topic: signals.demand.updated
-- Payload: { event_id, total_units, quarter, msa_id, submarket_id }

COMMENT ON TABLE demand_events IS 'Demand-generating events extracted from news';
COMMENT ON TABLE demand_projections IS 'Quarterly phased demand forecasts';
COMMENT ON TABLE trade_area_demand_forecast IS 'Aggregated demand by trade area and quarter';
COMMENT ON FUNCTION calculate_housing_demand IS 'Calculate housing units needed from event parameters';
COMMENT ON FUNCTION get_deal_demand_impact IS 'Get demand impact for a specific deal over time';

-- Grant permissions (adjust for your user)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO jedire_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO jedire_user;
