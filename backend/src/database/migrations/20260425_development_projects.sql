-- ============================================================================
-- DEVELOPMENT PROJECTS TABLE
-- Migration: 20260425_development_projects.sql
-- 
-- Tracks construction pipeline for supply analysis.
-- When user sees "2,400 units under construction", this table has the details.
-- ============================================================================

CREATE TABLE IF NOT EXISTS development_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Location
  name VARCHAR(255),
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  county VARCHAR(100),
  zip VARCHAR(10),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  
  -- Market context
  market_id VARCHAR(100),  -- e.g., 'atlanta'
  submarket VARCHAR(100),  -- e.g., 'midtown'
  
  -- Project specs
  units INTEGER,
  stories INTEGER,
  square_footage INTEGER,
  asset_class VARCHAR(10),  -- A, B, C
  property_type VARCHAR(50) DEFAULT 'multifamily',
  
  -- Status & timing
  construction_status VARCHAR(50) NOT NULL DEFAULT 'planned',
  -- planned | permitted | under_construction | topped_out | lease_up | completed | on_hold | cancelled
  
  permit_date DATE,
  groundbreaking_date DATE,
  expected_delivery DATE,
  actual_delivery DATE,
  
  -- Developer info
  developer VARCHAR(255),
  developer_id UUID,
  general_contractor VARCHAR(255),
  architect VARCHAR(255),
  
  -- Financial
  estimated_cost NUMERIC(14, 2),
  cost_per_unit NUMERIC(12, 2),
  target_rents NUMERIC(10, 2),
  asking_cap_rate NUMERIC(5, 2),
  
  -- Lease-up tracking
  pre_leasing_pct NUMERIC(5, 2),
  pre_leasing_start_date DATE,
  lease_up_velocity NUMERIC(5, 2),  -- units/month
  
  -- Amenities & features
  amenities JSONB DEFAULT '[]',
  -- ["pool", "gym", "rooftop", "coworking", "dog_park", "ev_charging"]
  
  unit_mix JSONB DEFAULT '{}',
  -- {"studio": 50, "1br": 150, "2br": 100, "3br": 50}
  
  -- Data source & quality
  data_source VARCHAR(100),  -- permit_api | costar | manual | scraped
  source_url TEXT,
  confidence NUMERIC(3, 2) DEFAULT 0.5,  -- 0-1
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT chk_status CHECK (construction_status IN (
    'planned', 'permitted', 'under_construction', 'topped_out', 
    'lease_up', 'completed', 'on_hold', 'cancelled'
  ))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dev_projects_market ON development_projects(market_id);
CREATE INDEX IF NOT EXISTS idx_dev_projects_submarket ON development_projects(submarket);
CREATE INDEX IF NOT EXISTS idx_dev_projects_status ON development_projects(construction_status);
CREATE INDEX IF NOT EXISTS idx_dev_projects_delivery ON development_projects(expected_delivery);
CREATE INDEX IF NOT EXISTS idx_dev_projects_units ON development_projects(units);
CREATE INDEX IF NOT EXISTS idx_dev_projects_developer ON development_projects(developer);

-- Spatial index if location known
CREATE INDEX IF NOT EXISTS idx_dev_projects_location ON development_projects(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Composite for supply queries
CREATE INDEX IF NOT EXISTS idx_dev_projects_supply_query ON development_projects(
  market_id, construction_status, expected_delivery
);

-- ============================================================================
-- DEVELOPER DIRECTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS developers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  
  -- Contact
  website VARCHAR(255),
  headquarters_city VARCHAR(100),
  headquarters_state VARCHAR(2),
  
  -- Track record
  total_units_delivered INTEGER DEFAULT 0,
  total_projects_completed INTEGER DEFAULT 0,
  active_projects INTEGER DEFAULT 0,
  units_under_construction INTEGER DEFAULT 0,
  
  -- Ratings
  on_time_delivery_pct NUMERIC(5, 2),  -- % of projects delivered on time
  avg_lease_up_months NUMERIC(5, 1),   -- Average months to stabilize
  
  -- Focus
  primary_markets TEXT[],  -- ['atlanta', 'charlotte', 'nashville']
  asset_class_focus TEXT[],  -- ['A', 'B']
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_developers_name ON developers(LOWER(name));

-- ============================================================================
-- SUPPLY PIPELINE AGGREGATES (for fast queries)
-- ============================================================================

CREATE TABLE IF NOT EXISTS supply_pipeline_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  market_id VARCHAR(100) NOT NULL,
  submarket VARCHAR(100),  -- NULL = market-level aggregate
  
  -- Period
  as_of_date DATE NOT NULL,
  
  -- Counts
  total_projects INTEGER DEFAULT 0,
  total_units INTEGER DEFAULT 0,
  
  -- By status
  planned_units INTEGER DEFAULT 0,
  permitted_units INTEGER DEFAULT 0,
  under_construction_units INTEGER DEFAULT 0,
  lease_up_units INTEGER DEFAULT 0,
  
  -- By delivery quarter
  units_by_quarter JSONB DEFAULT '{}',
  -- {"Q1 2026": 500, "Q2 2026": 800, ...}
  
  -- By class
  class_a_units INTEGER DEFAULT 0,
  class_b_units INTEGER DEFAULT 0,
  class_c_units INTEGER DEFAULT 0,
  
  -- By developer (top 10)
  units_by_developer JSONB DEFAULT '{}',
  -- {"Greystar": 650, "AvalonBay": 480, ...}
  
  -- Computed at
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT uq_supply_agg UNIQUE (market_id, submarket, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_supply_agg_market ON supply_pipeline_aggregates(market_id);
CREATE INDEX IF NOT EXISTS idx_supply_agg_date ON supply_pipeline_aggregates(as_of_date);

-- ============================================================================
-- FUNCTION: Refresh supply aggregates for a market
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_supply_aggregates(p_market_id VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_today DATE := CURRENT_DATE;
  v_row_count INTEGER;
BEGIN
  -- Delete existing aggregates for this market/date
  DELETE FROM supply_pipeline_aggregates 
  WHERE market_id = p_market_id AND as_of_date = v_today;
  
  -- Insert market-level aggregate
  INSERT INTO supply_pipeline_aggregates (
    market_id, submarket, as_of_date,
    total_projects, total_units,
    planned_units, permitted_units, under_construction_units, lease_up_units,
    class_a_units, class_b_units, class_c_units
  )
  SELECT 
    p_market_id,
    NULL,  -- market-level
    v_today,
    COUNT(*),
    COALESCE(SUM(units), 0),
    COALESCE(SUM(units) FILTER (WHERE construction_status = 'planned'), 0),
    COALESCE(SUM(units) FILTER (WHERE construction_status = 'permitted'), 0),
    COALESCE(SUM(units) FILTER (WHERE construction_status = 'under_construction'), 0),
    COALESCE(SUM(units) FILTER (WHERE construction_status = 'lease_up'), 0),
    COALESCE(SUM(units) FILTER (WHERE asset_class = 'A'), 0),
    COALESCE(SUM(units) FILTER (WHERE asset_class = 'B'), 0),
    COALESCE(SUM(units) FILTER (WHERE asset_class = 'C'), 0)
  FROM development_projects
  WHERE market_id = p_market_id
    AND construction_status IN ('planned', 'permitted', 'under_construction', 'lease_up');
  
  v_count := v_count + 1;
  
  -- Insert submarket-level aggregates
  INSERT INTO supply_pipeline_aggregates (
    market_id, submarket, as_of_date,
    total_projects, total_units,
    planned_units, permitted_units, under_construction_units, lease_up_units,
    class_a_units, class_b_units, class_c_units
  )
  SELECT 
    p_market_id,
    submarket,
    v_today,
    COUNT(*),
    COALESCE(SUM(units), 0),
    COALESCE(SUM(units) FILTER (WHERE construction_status = 'planned'), 0),
    COALESCE(SUM(units) FILTER (WHERE construction_status = 'permitted'), 0),
    COALESCE(SUM(units) FILTER (WHERE construction_status = 'under_construction'), 0),
    COALESCE(SUM(units) FILTER (WHERE construction_status = 'lease_up'), 0),
    COALESCE(SUM(units) FILTER (WHERE asset_class = 'A'), 0),
    COALESCE(SUM(units) FILTER (WHERE asset_class = 'B'), 0),
    COALESCE(SUM(units) FILTER (WHERE asset_class = 'C'), 0)
  FROM development_projects
  WHERE market_id = p_market_id
    AND construction_status IN ('planned', 'permitted', 'under_construction', 'lease_up')
    AND submarket IS NOT NULL
  GROUP BY submarket;
  
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_count := v_count + v_row_count;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED SAMPLE ATLANTA PROJECTS
-- ============================================================================

INSERT INTO development_projects (
  name, address, city, state, market_id, submarket,
  units, stories, asset_class, construction_status,
  expected_delivery, developer, target_rents, data_source
) VALUES
  -- Midtown
  ('Midtown Towers', '1100 Peachtree St NE', 'Atlanta', 'GA', 'atlanta', 'Midtown',
   350, 28, 'A', 'under_construction', '2026-09-01', 'Greystar', 2450, 'manual'),
  ('Peachtree Residences', '925 Peachtree St NE', 'Atlanta', 'GA', 'atlanta', 'Midtown',
   280, 22, 'A', 'under_construction', '2026-06-01', 'AvalonBay', 2380, 'manual'),
  ('West Peachtree Lofts', '1000 W Peachtree St NW', 'Atlanta', 'GA', 'atlanta', 'Midtown',
   190, 12, 'B', 'permitted', '2027-03-01', 'Wood Partners', 1850, 'manual'),
   
  -- Buckhead
  ('Buckhead Grand', '3340 Peachtree Rd NE', 'Atlanta', 'GA', 'atlanta', 'Buckhead',
   420, 35, 'A', 'under_construction', '2026-12-01', 'Hines', 3200, 'manual'),
  ('Lenox Place', '3400 Lenox Rd NE', 'Atlanta', 'GA', 'atlanta', 'Buckhead',
   310, 24, 'A', 'planned', '2027-06-01', 'Mill Creek', 2950, 'manual'),
   
  -- West Midtown
  ('Westside Provisions II', '1200 Howell Mill Rd NW', 'Atlanta', 'GA', 'atlanta', 'West Midtown',
   240, 8, 'A', 'under_construction', '2026-08-01', 'Jamestown', 2600, 'manual'),
  ('The Interlock Residences', '1115 Howell Mill Rd NW', 'Atlanta', 'GA', 'atlanta', 'West Midtown',
   180, 6, 'B', 'lease_up', '2026-04-01', 'Selig Development', 2100, 'manual'),
   
  -- Downtown
  ('Centennial Tower', '250 Spring St NW', 'Atlanta', 'GA', 'atlanta', 'Downtown Atlanta',
   380, 30, 'A', 'under_construction', '2026-10-01', 'Related', 2200, 'manual'),
  ('Marietta Street Lofts', '500 Marietta St NW', 'Atlanta', 'GA', 'atlanta', 'Downtown Atlanta',
   150, 6, 'B', 'permitted', '2027-01-01', 'Carter', 1650, 'manual'),
   
  -- Sandy Springs
  ('Perimeter Summit', '5700 Roswell Rd', 'Sandy Springs', 'GA', 'atlanta', 'Sandy Springs',
   290, 15, 'A', 'planned', '2027-09-01', 'Pope & Land', 2350, 'manual'),
  
  -- Decatur
  ('Decatur Square', '125 E Ponce de Leon Ave', 'Decatur', 'GA', 'atlanta', 'Decatur',
   165, 5, 'B', 'under_construction', '2026-07-01', 'Prestwick', 1750, 'manual'),
  
  -- East Atlanta
  ('Glenwood Place', '1200 Glenwood Ave SE', 'Atlanta', 'GA', 'atlanta', 'East Atlanta',
   120, 4, 'B', 'permitted', '2027-02-01', 'Local Developer LLC', 1550, 'manual')
ON CONFLICT DO NOTHING;

-- Refresh aggregates for Atlanta
SELECT refresh_supply_aggregates('atlanta');

-- ============================================================================
-- SEED DEVELOPERS
-- ============================================================================

INSERT INTO developers (name, headquarters_city, headquarters_state, primary_markets, asset_class_focus)
VALUES
  ('Greystar', 'Charleston', 'SC', ARRAY['atlanta', 'dallas', 'charlotte', 'nashville'], ARRAY['A', 'B']),
  ('AvalonBay', 'Arlington', 'VA', ARRAY['atlanta', 'boston', 'dc', 'seattle'], ARRAY['A']),
  ('Wood Partners', 'Atlanta', 'GA', ARRAY['atlanta', 'austin', 'denver', 'nashville'], ARRAY['A', 'B']),
  ('Hines', 'Houston', 'TX', ARRAY['atlanta', 'houston', 'dallas', 'phoenix'], ARRAY['A']),
  ('Mill Creek', 'Dallas', 'TX', ARRAY['atlanta', 'dallas', 'denver', 'phoenix'], ARRAY['A', 'B']),
  ('Related', 'New York', 'NY', ARRAY['atlanta', 'miami', 'chicago', 'la'], ARRAY['A']),
  ('Jamestown', 'Atlanta', 'GA', ARRAY['atlanta', 'new_york'], ARRAY['A']),
  ('Carter', 'Atlanta', 'GA', ARRAY['atlanta', 'charlotte', 'nashville'], ARRAY['A', 'B', 'C']),
  ('Selig Development', 'Atlanta', 'GA', ARRAY['atlanta'], ARRAY['A', 'B']),
  ('Pope & Land', 'Atlanta', 'GA', ARRAY['atlanta'], ARRAY['A', 'B'])
ON CONFLICT DO NOTHING;
