-- Migration 026: Supply Signal System
-- Track construction pipeline, permits, starts, completions
-- Calculate supply risk for trade areas

-- =====================================================
-- SUPPLY EVENT TYPES
-- =====================================================

CREATE TABLE IF NOT EXISTS supply_event_types (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL, -- permit, construction, completion, demolition, policy
  event_type VARCHAR(100) NOT NULL,
  description TEXT,
  supply_direction VARCHAR(20) NOT NULL, -- positive (adds units), negative (removes units)
  weight_factor DECIMAL(5,2) NOT NULL DEFAULT 1.0, -- probability weight (permit=0.6, under_construction=0.9, delivered=1.0)
  typical_timeline_months INTEGER, -- months until delivery
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(category, event_type)
);

-- Seed supply event types
INSERT INTO supply_event_types (category, event_type, description, supply_direction, weight_factor, typical_timeline_months) VALUES
-- Permits
('permit', 'multifamily_permit_filed', 'Multifamily building permit filed', 'positive', 0.60, 12),
('permit', 'mixed_use_permit_filed', 'Mixed-use development permit', 'positive', 0.55, 18),
('permit', 'condo_permit_filed', 'Condominium permit filed', 'positive', 0.65, 14),

-- Construction
('construction', 'groundbreaking', 'Construction started (groundbreaking)', 'positive', 0.90, 18),
('construction', 'under_construction', 'Project under construction', 'positive', 0.90, 12),
('construction', 'topping_out', 'Building topped out (structure complete)', 'positive', 0.95, 6),

-- Completion
('completion', 'certificate_of_occupancy', 'Certificate of Occupancy issued', 'positive', 1.0, 0),
('completion', 'lease_up_started', 'Lease-up phase started', 'positive', 1.0, 0),
('completion', 'delivery', 'Project delivered', 'positive', 1.0, 0),

-- Demolition
('demolition', 'demolition_permit', 'Demolition permit issued', 'negative', 0.80, 3),
('demolition', 'building_demolished', 'Building demolished', 'negative', 1.0, 0),
('demolition', 'conversion_to_office', 'Residential converted to office', 'negative', 1.0, 6),

-- Policy
('policy', 'moratorium', 'Development moratorium imposed', 'negative', 0.70, 24),
('policy', 'downzone', 'Area downzoned (reduces density)', 'negative', 0.60, 12),
('policy', 'upzone', 'Area upzoned (increases density)', 'positive', 0.40, 18);

-- =====================================================
-- SUPPLY EVENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS supply_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_event_type_id INTEGER NOT NULL REFERENCES supply_event_types(id),
  
  -- Project Information
  project_name VARCHAR(255),
  developer VARCHAR(255),
  address TEXT,
  
  -- Units
  units INTEGER NOT NULL, -- Total units (positive or negative based on direction)
  weighted_units DECIMAL(10,2), -- units × weight_factor
  
  -- Unit Mix (optional)
  studio_units INTEGER DEFAULT 0,
  one_bed_units INTEGER DEFAULT 0,
  two_bed_units INTEGER DEFAULT 0,
  three_bed_units INTEGER DEFAULT 0,
  
  -- Pricing (optional)
  avg_rent DECIMAL(10,2),
  price_tier VARCHAR(50), -- affordable, workforce, market_rate, luxury
  
  -- Timeline
  event_date DATE NOT NULL, -- permit date, groundbreaking date, etc.
  expected_delivery_date DATE, -- estimated completion date
  actual_delivery_date DATE, -- actual completion (for delivered projects)
  
  -- Status
  status VARCHAR(50) NOT NULL, -- permitted, under_construction, delivered, cancelled, demolished
  
  -- Geographic Assignment
  latitude DECIMAL(10,7),
  longitude DECIMAL(11,7),
  msa_id INTEGER,
  submarket_id INTEGER,
  address_components JSONB,
  
  -- Source
  news_event_id UUID, -- optional link to news_events
  source_type VARCHAR(50), -- news, costar, permit_database, manual
  source_url TEXT,
  data_source_confidence DECIMAL(5,2) DEFAULT 70.0, -- 0-100
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_supply_events_status ON supply_events(status);
CREATE INDEX idx_supply_events_msa ON supply_events(msa_id);
CREATE INDEX idx_supply_events_submarket ON supply_events(submarket_id);
CREATE INDEX idx_supply_events_delivery_date ON supply_events(expected_delivery_date);
CREATE INDEX idx_supply_events_location ON supply_events(latitude, longitude);

-- =====================================================
-- SUPPLY PIPELINE (Current State by Trade Area)
-- =====================================================

CREATE TABLE IF NOT EXISTS supply_pipeline (
  id SERIAL PRIMARY KEY,
  trade_area_id INTEGER NOT NULL,
  
  -- Pipeline Counts (by status)
  permitted_projects INTEGER DEFAULT 0,
  permitted_units INTEGER DEFAULT 0,
  permitted_weighted_units DECIMAL(10,2) DEFAULT 0,
  
  construction_projects INTEGER DEFAULT 0,
  construction_units INTEGER DEFAULT 0,
  construction_weighted_units DECIMAL(10,2) DEFAULT 0,
  
  delivered_12mo_projects INTEGER DEFAULT 0, -- delivered in last 12 months
  delivered_12mo_units INTEGER DEFAULT 0,
  
  -- Total Pipeline
  total_pipeline_projects INTEGER DEFAULT 0,
  total_pipeline_units INTEGER DEFAULT 0,
  total_weighted_units DECIMAL(10,2) DEFAULT 0,
  
  -- Existing Inventory
  existing_units INTEGER DEFAULT 10000, -- from trade area stats
  
  -- Last Updated
  last_updated TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(trade_area_id)
);

CREATE INDEX idx_supply_pipeline_trade_area ON supply_pipeline(trade_area_id);

-- =====================================================
-- SUPPLY RISK SCORES (Time-Series)
-- =====================================================

CREATE TABLE IF NOT EXISTS supply_risk_scores (
  id SERIAL PRIMARY KEY,
  trade_area_id INTEGER NOT NULL,
  quarter VARCHAR(10) NOT NULL, -- "2028-Q1"
  
  -- Supply Metrics
  pipeline_units DECIMAL(10,2) NOT NULL,
  weighted_pipeline_units DECIMAL(10,2) NOT NULL,
  existing_units INTEGER NOT NULL,
  
  -- Risk Score (0-100)
  supply_risk_score DECIMAL(5,2) NOT NULL, -- (pipeline ÷ existing) × 100
  risk_level VARCHAR(20) NOT NULL, -- low, medium, high, critical
  
  -- Absorption Analysis
  historical_monthly_absorption DECIMAL(10,2), -- units absorbed per month historically
  months_to_absorb DECIMAL(10,2), -- pipeline ÷ monthly absorption
  absorption_risk VARCHAR(20), -- low, medium, high, critical
  
  -- Demand Integration (from demand_signal)
  demand_units DECIMAL(10,2) DEFAULT 0,
  demand_supply_gap DECIMAL(10,2), -- demand - supply
  net_market_pressure DECIMAL(5,2), -- gap / existing × 100
  
  -- Metadata
  calculated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(trade_area_id, quarter)
);

CREATE INDEX idx_supply_risk_trade_area_quarter ON supply_risk_scores(trade_area_id, quarter);
CREATE INDEX idx_supply_risk_level ON supply_risk_scores(risk_level);

-- =====================================================
-- COMPETITIVE PROJECTS (Project Proximity Analysis)
-- =====================================================

CREATE TABLE IF NOT EXISTS competitive_projects (
  id SERIAL PRIMARY KEY,
  deal_id UUID NOT NULL, -- reference to deals table
  supply_event_id UUID NOT NULL REFERENCES supply_events(id),
  
  -- Distance Calculation
  distance_miles DECIMAL(5,2) NOT NULL,
  competitive_impact VARCHAR(20) NOT NULL, -- direct (< 1mi), moderate (1-2mi), weak (2-3mi)
  impact_weight DECIMAL(5,2) NOT NULL, -- 1.0 (direct), 0.5 (moderate), 0.25 (weak)
  
  -- Project Comparison
  unit_count_difference INTEGER, -- competitive project units - deal units
  price_tier_match BOOLEAN, -- same price tier?
  
  -- Timing
  delivery_timing VARCHAR(50), -- before_acquisition, concurrent, after_stabilization
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(deal_id, supply_event_id)
);

CREATE INDEX idx_competitive_projects_deal ON competitive_projects(deal_id);
CREATE INDEX idx_competitive_projects_distance ON competitive_projects(distance_miles);

-- =====================================================
-- SUPPLY DELIVERY TIMELINE (Quarterly Phasing)
-- =====================================================

CREATE TABLE IF NOT EXISTS supply_delivery_timeline (
  id SERIAL PRIMARY KEY,
  supply_event_id UUID NOT NULL REFERENCES supply_events(id),
  quarter VARCHAR(10) NOT NULL, -- "2028-Q1"
  quarter_start DATE NOT NULL,
  quarter_end DATE NOT NULL,
  
  -- Phased Delivery
  units_delivered DECIMAL(10,2) NOT NULL, -- portion delivered this quarter
  weighted_units_delivered DECIMAL(10,2) NOT NULL, -- units × weight
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(supply_event_id, quarter)
);

CREATE INDEX idx_supply_timeline_quarter ON supply_delivery_timeline(quarter);
CREATE INDEX idx_supply_timeline_event ON supply_delivery_timeline(supply_event_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update supply pipeline for a trade area
CREATE OR REPLACE FUNCTION update_supply_pipeline(p_trade_area_id INTEGER)
RETURNS VOID AS $$
BEGIN
  INSERT INTO supply_pipeline (
    trade_area_id,
    permitted_projects,
    permitted_units,
    permitted_weighted_units,
    construction_projects,
    construction_units,
    construction_weighted_units,
    delivered_12mo_projects,
    delivered_12mo_units,
    total_pipeline_projects,
    total_pipeline_units,
    total_weighted_units,
    last_updated
  )
  SELECT
    p_trade_area_id,
    COUNT(*) FILTER (WHERE status = 'permitted'),
    COALESCE(SUM(units) FILTER (WHERE status = 'permitted'), 0),
    COALESCE(SUM(weighted_units) FILTER (WHERE status = 'permitted'), 0),
    COUNT(*) FILTER (WHERE status = 'under_construction'),
    COALESCE(SUM(units) FILTER (WHERE status = 'under_construction'), 0),
    COALESCE(SUM(weighted_units) FILTER (WHERE status = 'under_construction'), 0),
    COUNT(*) FILTER (WHERE status = 'delivered' AND actual_delivery_date > NOW() - INTERVAL '12 months'),
    COALESCE(SUM(units) FILTER (WHERE status = 'delivered' AND actual_delivery_date > NOW() - INTERVAL '12 months'), 0),
    COUNT(*),
    COALESCE(SUM(units), 0),
    COALESCE(SUM(weighted_units), 0),
    NOW()
  FROM supply_events se
  JOIN trade_area_event_impacts taei ON taei.event_id = se.news_event_id
  WHERE taei.trade_area_id = p_trade_area_id
    AND status IN ('permitted', 'under_construction', 'delivered')
  ON CONFLICT (trade_area_id) DO UPDATE SET
    permitted_projects = EXCLUDED.permitted_projects,
    permitted_units = EXCLUDED.permitted_units,
    permitted_weighted_units = EXCLUDED.permitted_weighted_units,
    construction_projects = EXCLUDED.construction_projects,
    construction_units = EXCLUDED.construction_units,
    construction_weighted_units = EXCLUDED.construction_weighted_units,
    delivered_12mo_projects = EXCLUDED.delivered_12mo_projects,
    delivered_12mo_units = EXCLUDED.delivered_12mo_units,
    total_pipeline_projects = EXCLUDED.total_pipeline_projects,
    total_pipeline_units = EXCLUDED.total_pipeline_units,
    total_weighted_units = EXCLUDED.total_weighted_units,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS
-- =====================================================

-- View: Active Supply Pipeline
CREATE OR REPLACE VIEW v_active_supply_pipeline AS
SELECT 
  se.*,
  set.category,
  set.event_type,
  set.supply_direction,
  set.weight_factor,
  CASE 
    WHEN se.expected_delivery_date IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (se.expected_delivery_date - CURRENT_DATE)) / (30.44 * 24 * 60 * 60)
    ELSE NULL
  END AS months_until_delivery
FROM supply_events se
JOIN supply_event_types set ON set.id = se.supply_event_type_id
WHERE se.status IN ('permitted', 'under_construction')
ORDER BY se.expected_delivery_date;

-- View: Supply Risk Summary
CREATE OR REPLACE VIEW v_supply_risk_summary AS
SELECT 
  srs.trade_area_id,
  ta.name as trade_area_name,
  srs.quarter,
  srs.pipeline_units,
  srs.weighted_pipeline_units,
  srs.supply_risk_score,
  srs.risk_level,
  srs.months_to_absorb,
  srs.absorption_risk,
  srs.demand_units,
  srs.demand_supply_gap,
  srs.net_market_pressure
FROM supply_risk_scores srs
LEFT JOIN trade_areas ta ON ta.id = srs.trade_area_id
ORDER BY srs.quarter, srs.supply_risk_score DESC;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE supply_events IS 'Construction pipeline events (permits, starts, completions, demolitions)';
COMMENT ON TABLE supply_pipeline IS 'Current supply pipeline state by trade area';
COMMENT ON TABLE supply_risk_scores IS 'Time-series supply risk scoring by trade area and quarter';
COMMENT ON TABLE competitive_projects IS 'Competitive project analysis for deals';
COMMENT ON TABLE supply_delivery_timeline IS 'Quarterly phasing of supply deliveries';

COMMENT ON COLUMN supply_events.weighted_units IS 'Units adjusted by probability weight (permit=60%, construction=90%, delivered=100%)';
COMMENT ON COLUMN supply_risk_scores.supply_risk_score IS 'Formula: (pipeline_units ÷ existing_units) × 100';
COMMENT ON COLUMN supply_risk_scores.months_to_absorb IS 'Pipeline units ÷ historical monthly absorption rate';
COMMENT ON COLUMN competitive_projects.impact_weight IS 'Distance-based weight: <1mi=1.0, 1-2mi=0.5, 2-3mi=0.25';
