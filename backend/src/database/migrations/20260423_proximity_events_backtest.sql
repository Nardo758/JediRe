-- Proximity, Events & Backtest Infrastructure
-- Completes the neural network with spatial context and historical validation

-- ============================================================================
-- PROPERTY PROXIMITY
-- Spatial context for every property (transit, grocery, employers, schools, crime)
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_proximity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Property identity (can link to property_info_cache or data_library_assets)
  parcel_id TEXT,
  property_id UUID,
  
  -- Location
  address TEXT,
  city TEXT,
  county TEXT,
  state TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  
  -- Transit proximity
  nearest_rail_station_name TEXT,
  nearest_rail_station_type TEXT, -- 'heavy_rail', 'light_rail', 'commuter', 'brt'
  nearest_rail_station_miles DECIMAL(5, 2),
  nearest_bus_stop_miles DECIMAL(5, 2),
  transit_routes_within_quarter_mile INT,
  
  -- Grocery proximity
  nearest_grocery_name TEXT,
  nearest_grocery_type TEXT, -- 'premium' (WF, TJ), 'standard', 'discount'
  nearest_grocery_miles DECIMAL(5, 2),
  groceries_within_1_mile INT,
  premium_groceries_within_2_miles INT,
  
  -- Employer proximity
  major_employers_within_3_miles INT,
  major_employers_within_5_miles INT,
  nearest_major_employer_name TEXT,
  nearest_major_employer_miles DECIMAL(5, 2),
  total_jobs_within_5_miles INT,
  
  -- Retail / Lifestyle
  restaurants_within_half_mile INT,
  retail_sqft_within_1_mile INT,
  nearest_mall_miles DECIMAL(5, 2),
  
  -- Healthcare
  nearest_hospital_name TEXT,
  nearest_hospital_miles DECIMAL(5, 2),
  urgent_cares_within_3_miles INT,
  
  -- Education
  nearest_elementary_school TEXT,
  nearest_elementary_rating INT, -- 1-10
  nearest_middle_school TEXT,
  nearest_middle_rating INT,
  nearest_high_school TEXT,
  nearest_high_rating INT,
  school_district TEXT,
  school_district_rating INT,
  universities_within_5_miles INT,
  
  -- Parks / Recreation
  nearest_park_miles DECIMAL(5, 2),
  parks_within_1_mile INT,
  greenspace_acres_within_1_mile DECIMAL(8, 2),
  beltline_miles DECIMAL(5, 2), -- Atlanta specific
  
  -- Safety
  crime_index DECIMAL(5, 2), -- 100 = city average
  violent_crime_index DECIMAL(5, 2),
  property_crime_index DECIMAL(5, 2),
  crime_trend TEXT, -- 'improving', 'stable', 'worsening'
  
  -- Scores (external APIs)
  walk_score INT,
  transit_score INT,
  bike_score INT,
  
  -- Computed premium estimates
  estimated_transit_premium_pct DECIMAL(5, 2),
  estimated_amenity_premium_pct DECIMAL(5, 2),
  estimated_school_premium_pct DECIMAL(5, 2),
  
  -- Metadata
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  data_sources TEXT[], -- ['osm', 'walkscore', 'greatschools', 'census']
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proximity_parcel ON property_proximity(parcel_id, county, state);
CREATE INDEX idx_proximity_property ON property_proximity(property_id);
CREATE INDEX idx_proximity_location ON property_proximity USING GIST (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX idx_proximity_city ON property_proximity(city, state);

-- ============================================================================
-- MARKET EVENTS
-- Historical and upcoming events that impact property values
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identity
  event_type TEXT NOT NULL CHECK (event_type IN (
    'employer_move', 'employer_expansion', 'employer_layoff', 'employer_closure',
    'transit_opening', 'transit_expansion', 'transit_planned',
    'supply_delivery', 'supply_announced', 'supply_groundbreaking',
    'grocery_opening', 'retail_opening', 'retail_closure',
    'infrastructure', 'rezoning', 'policy_change',
    'economic_shock', 'natural_disaster',
    'acquisition', 'disposition'
  )),
  event_name TEXT NOT NULL,
  event_description TEXT,
  
  -- Location
  geography_type TEXT NOT NULL, -- 'msa', 'county', 'submarket', 'zip', 'point'
  geography_id TEXT NOT NULL,
  geography_name TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  impact_radius_miles DECIMAL(5, 2), -- How far the impact extends
  
  -- Entity (for employer/retail events)
  entity_name TEXT, -- 'Microsoft', 'Whole Foods', 'MARTA'
  entity_type TEXT, -- 'tech', 'finance', 'healthcare', 'retail', 'transit'
  
  -- Scale
  jobs_affected INT, -- Positive for expansion, negative for closure
  units_affected INT, -- For supply events
  sqft_affected INT, -- For retail/office
  investment_amount DECIMAL(15, 2),
  
  -- Timing
  announced_date DATE,
  groundbreaking_date DATE,
  effective_date DATE NOT NULL, -- When impact starts
  completion_date DATE,
  
  -- Impact expectations
  expected_impact_direction TEXT CHECK (expected_impact_direction IN ('positive', 'negative', 'neutral', 'mixed')),
  expected_impact_magnitude TEXT CHECK (expected_impact_magnitude IN ('minor', 'moderate', 'major', 'transformative')),
  expected_impact_duration TEXT, -- 'temporary', 'medium_term', 'permanent'
  
  -- Metrics affected
  affected_metrics TEXT[], -- ['rent_growth', 'occupancy', 'cap_rate', 'absorption']
  
  -- Source
  source_url TEXT,
  source_type TEXT, -- 'news', 'sec_filing', 'government', 'press_release', 'manual'
  source_date DATE,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('rumored', 'announced', 'confirmed', 'active', 'completed', 'cancelled')),
  
  -- Metadata
  confidence_score DECIMAL(3, 2), -- 0.0 to 1.0
  tags TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_type ON market_events(event_type);
CREATE INDEX idx_events_geography ON market_events(geography_type, geography_id);
CREATE INDEX idx_events_effective_date ON market_events(effective_date);
CREATE INDEX idx_events_status ON market_events(status);
CREATE INDEX idx_events_entity ON market_events(entity_name);
CREATE INDEX idx_events_location ON market_events USING GIST (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================================================
-- EVENT OUTCOMES
-- Track what actually happened after events (for backtesting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES market_events(id) ON DELETE CASCADE,
  
  -- Measurement window
  measurement_period TEXT NOT NULL, -- '3mo', '6mo', '12mo', '24mo'
  measurement_start_date DATE NOT NULL,
  measurement_end_date DATE NOT NULL,
  
  -- Geography (can be different from event if measuring spillover)
  geography_type TEXT NOT NULL,
  geography_id TEXT NOT NULL,
  distance_from_event_miles DECIMAL(5, 2),
  
  -- Observed impacts
  rent_change_pct DECIMAL(6, 3),
  occupancy_change_pct DECIMAL(6, 3),
  absorption_units INT,
  cap_rate_change_bps INT,
  price_per_unit_change_pct DECIMAL(6, 3),
  concession_change_pct DECIMAL(6, 3),
  
  -- Traffic / demand
  search_volume_change_pct DECIMAL(6, 3),
  tour_volume_change_pct DECIMAL(6, 3),
  application_volume_change_pct DECIMAL(6, 3),
  
  -- Attribution
  attribution_confidence DECIMAL(3, 2), -- 0.0 to 1.0
  confounding_factors TEXT[],
  methodology_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outcomes_event ON event_outcomes(event_id);
CREATE INDEX idx_outcomes_period ON event_outcomes(measurement_period);
CREATE INDEX idx_outcomes_geography ON event_outcomes(geography_type, geography_id);

-- ============================================================================
-- MARKET SNAPSHOTS
-- Point-in-time market state for backtesting
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Geography
  geography_type TEXT NOT NULL, -- 'msa', 'county', 'submarket', 'zip'
  geography_id TEXT NOT NULL,
  geography_name TEXT,
  
  -- Snapshot timing
  snapshot_date DATE NOT NULL,
  snapshot_type TEXT DEFAULT 'monthly', -- 'daily', 'weekly', 'monthly', 'quarterly'
  
  -- Inventory
  total_properties INT,
  total_units INT,
  
  -- Rent metrics
  avg_asking_rent DECIMAL(10, 2),
  avg_effective_rent DECIMAL(10, 2),
  avg_rent_psf DECIMAL(10, 4),
  rent_growth_mom DECIMAL(6, 3),
  rent_growth_yoy DECIMAL(6, 3),
  
  -- Occupancy
  avg_occupancy_pct DECIMAL(5, 2),
  available_units INT,
  vacancy_rate DECIMAL(5, 2),
  
  -- Absorption
  net_absorption_units INT,
  gross_move_ins INT,
  gross_move_outs INT,
  avg_days_to_lease INT,
  
  -- Concessions
  properties_offering_concessions_pct DECIMAL(5, 2),
  avg_concession_weeks DECIMAL(4, 2),
  avg_concession_value DECIMAL(10, 2),
  
  -- Supply
  units_under_construction INT,
  units_permitted_trailing_12mo INT,
  units_delivered_trailing_12mo INT,
  planned_units_24mo INT,
  
  -- Sales / Valuations
  transaction_count_trailing_12mo INT,
  avg_price_per_unit DECIMAL(12, 2),
  avg_price_psf DECIMAL(10, 2),
  avg_cap_rate DECIMAL(5, 3),
  total_transaction_volume DECIMAL(15, 2),
  
  -- Economic context
  unemployment_rate DECIMAL(5, 2),
  job_growth_yoy DECIMAL(6, 3),
  population_growth_yoy DECIMAL(6, 3),
  median_household_income DECIMAL(12, 2),
  
  -- Demand signals
  search_interest_index DECIMAL(6, 2), -- 100 = baseline
  application_volume_index DECIMAL(6, 2),
  
  -- Aggregated proximity scores (for submarket)
  avg_walk_score DECIMAL(5, 2),
  avg_transit_score DECIMAL(5, 2),
  
  -- Quality tier breakdown (if available)
  class_a_avg_rent DECIMAL(10, 2),
  class_a_occupancy DECIMAL(5, 2),
  class_b_avg_rent DECIMAL(10, 2),
  class_b_occupancy DECIMAL(5, 2),
  class_c_avg_rent DECIMAL(10, 2),
  class_c_occupancy DECIMAL(5, 2),
  
  -- Metadata
  data_completeness_score DECIMAL(3, 2), -- 0.0 to 1.0
  data_sources TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(geography_type, geography_id, snapshot_date)
);

CREATE INDEX idx_snapshots_geography ON market_snapshots(geography_type, geography_id);
CREATE INDEX idx_snapshots_date ON market_snapshots(snapshot_date DESC);
CREATE INDEX idx_snapshots_type ON market_snapshots(snapshot_type);

-- ============================================================================
-- POINTS OF INTEREST (POI)
-- Amenities and landmarks for proximity calculations
-- ============================================================================

CREATE TABLE IF NOT EXISTS points_of_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  poi_type TEXT NOT NULL CHECK (poi_type IN (
    'transit_station', 'bus_stop', 'transit_hub',
    'grocery_premium', 'grocery_standard', 'grocery_discount',
    'employer_major', 'employer_tech', 'employer_healthcare', 'employer_finance',
    'hospital', 'urgent_care', 'medical_campus',
    'school_elementary', 'school_middle', 'school_high', 'university',
    'park', 'trail', 'beltline', 'greenspace',
    'mall', 'retail_center', 'restaurant_cluster',
    'airport', 'highway_access'
  )),
  poi_name TEXT NOT NULL,
  poi_subtype TEXT, -- More specific categorization
  
  -- Location
  address TEXT,
  city TEXT,
  county TEXT,
  state TEXT,
  zip TEXT,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  
  -- Attributes
  size_metric INT, -- employees, sqft, students, daily ridership, etc.
  size_metric_type TEXT, -- 'employees', 'sqft', 'enrollment', 'ridership'
  quality_rating INT, -- 1-10 scale
  
  -- For transit
  transit_lines TEXT[],
  transit_agency TEXT,
  daily_ridership INT,
  
  -- For schools
  school_rating INT, -- 1-10 (GreatSchools)
  school_district TEXT,
  
  -- For employers
  employer_industry TEXT,
  employee_count INT,
  
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'planned', 'under_construction', 'closed'
  opened_date DATE,
  closed_date DATE,
  
  -- Source
  source TEXT, -- 'osm', 'google', 'manual', 'marta', 'greatschools'
  source_id TEXT,
  
  -- Metadata
  last_verified DATE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_poi_type ON points_of_interest(poi_type);
CREATE INDEX idx_poi_location ON points_of_interest USING GIST (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
CREATE INDEX idx_poi_city ON points_of_interest(city, state);
CREATE INDEX idx_poi_status ON points_of_interest(status);

-- ============================================================================
-- CORRELATION SUPPLEMENTS
-- Additional correlations for the engine
-- ============================================================================

-- Add new correlation types
CREATE TABLE IF NOT EXISTS spatial_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What we're correlating
  proximity_factor TEXT NOT NULL, -- 'transit_distance', 'grocery_distance', 'crime_index'
  outcome_metric TEXT NOT NULL, -- 'rent_premium', 'occupancy', 'turnover'
  
  -- Geography
  geography_type TEXT NOT NULL,
  geography_id TEXT NOT NULL,
  
  -- Correlation results
  correlation_r DECIMAL(5, 4),
  regression_coefficient DECIMAL(10, 4),
  regression_intercept DECIMAL(10, 4),
  r_squared DECIMAL(5, 4),
  p_value DECIMAL(10, 8),
  sample_size INT,
  
  -- Interpretation
  interpretation TEXT, -- 'Each 0.1mi closer to transit = +$15/mo rent'
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  
  -- Computed
  observation_start DATE,
  observation_end DATE,
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spatial_corr_factor ON spatial_correlations(proximity_factor);
CREATE INDEX idx_spatial_corr_geography ON spatial_correlations(geography_type, geography_id);

-- ============================================================================
-- BACKTEST RUNS
-- Track backtest executions and results
-- ============================================================================

CREATE TABLE IF NOT EXISTS backtest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Configuration
  backtest_name TEXT,
  backtest_type TEXT NOT NULL, -- 'rent_growth', 'occupancy', 'irr', 'event_impact'
  
  -- Time window
  training_start DATE NOT NULL,
  training_end DATE NOT NULL,
  validation_start DATE NOT NULL,
  validation_end DATE NOT NULL,
  
  -- Scope
  geography_type TEXT,
  geography_ids TEXT[],
  property_filter JSONB, -- Additional filters
  
  -- Model parameters
  model_type TEXT, -- 'linear', 'random_forest', 'neural_net', 'ensemble'
  features_used TEXT[],
  hyperparameters JSONB,
  
  -- Results
  sample_size INT,
  
  -- Accuracy metrics
  mae DECIMAL(10, 4), -- Mean Absolute Error
  rmse DECIMAL(10, 4), -- Root Mean Square Error
  mape DECIMAL(6, 3), -- Mean Absolute Percentage Error
  r_squared DECIMAL(5, 4),
  
  -- Directional accuracy
  direction_accuracy_pct DECIMAL(5, 2), -- % of times we got direction right
  within_1pct_accuracy DECIMAL(5, 2),
  within_5pct_accuracy DECIMAL(5, 2),
  
  -- Feature importance
  feature_importance JSONB, -- {'transit_score': 0.15, 'job_growth': 0.22, ...}
  
  -- Status
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_by UUID
);

CREATE INDEX idx_backtest_type ON backtest_runs(backtest_type);
CREATE INDEX idx_backtest_status ON backtest_runs(status);

-- ============================================================================
-- SEED ATLANTA MARKET EVENTS (2015-2026)
-- ============================================================================

INSERT INTO market_events (
  event_type, event_name, event_description,
  geography_type, geography_id, geography_name,
  latitude, longitude, impact_radius_miles,
  entity_name, entity_type, jobs_affected,
  announced_date, effective_date, completion_date,
  expected_impact_direction, expected_impact_magnitude,
  affected_metrics, source_type, status
) VALUES
-- EMPLOYER MOVES
('employer_move', 'NCR HQ Relocation to Midtown', 'NCR moved HQ from Duluth to Midtown Atlanta, bringing 3,000+ jobs',
 'submarket', 'midtown', 'Midtown',
 33.7866, -84.3830, 2.0,
 'NCR Corporation', 'tech', 3400,
 '2017-06-01', '2019-01-15', '2019-06-01',
 'positive', 'major',
 ARRAY['rent_growth', 'occupancy', 'absorption'], 'news', 'completed'),

('employer_expansion', 'Microsoft Midtown Campus', 'Microsoft leased 500K SF for new Atlanta hub',
 'submarket', 'midtown', 'Midtown',
 33.7870, -84.3845, 2.0,
 'Microsoft', 'tech', 1500,
 '2021-08-17', '2023-01-01', '2024-06-01',
 'positive', 'major',
 ARRAY['rent_growth', 'absorption', 'property_values'], 'press_release', 'completed'),

('employer_expansion', 'Google Midtown Expansion', 'Google expanding Midtown presence to 1M+ SF',
 'submarket', 'midtown', 'Midtown',
 33.7856, -84.3832, 2.0,
 'Google', 'tech', 3000,
 '2021-03-01', '2022-01-01', NULL,
 'positive', 'major',
 ARRAY['rent_growth', 'absorption'], 'news', 'active'),

('employer_move', 'Honeywell HQ to Charlotte', 'Honeywell announced move from Atlanta to Charlotte',
 'submarket', 'buckhead', 'Buckhead',
 33.8463, -84.3621, 3.0,
 'Honeywell', 'industrial', -800,
 '2019-10-01', '2020-06-01', '2020-12-01',
 'negative', 'moderate',
 ARRAY['absorption'], 'sec_filing', 'completed'),

('employer_expansion', 'Anthem/Elevance Hub', 'Anthem (now Elevance) expanding Atlanta operations',
 'submarket', 'midtown', 'Midtown',
 33.7890, -84.3870, 1.5,
 'Elevance Health', 'healthcare', 2000,
 '2022-01-01', '2023-06-01', NULL,
 'positive', 'moderate',
 ARRAY['rent_growth', 'absorption'], 'news', 'active'),

-- TRANSIT OPENINGS
('transit_opening', 'BeltLine Eastside Trail Opening', 'First major BeltLine segment connecting Piedmont Park to Inman Park',
 'submarket', 'old_fourth_ward', 'Old Fourth Ward / Inman Park',
 33.7632, -84.3550, 0.5,
 'Atlanta BeltLine', 'transit', NULL,
 '2012-06-01', '2012-10-01', '2012-10-01',
 'positive', 'transformative',
 ARRAY['rent_growth', 'property_values', 'cap_rate'], 'government', 'completed'),

('transit_opening', 'BeltLine Westside Trail Opening', 'Westside Trail connecting West End to Adair Park',
 'submarket', 'west_end', 'West End / Adair Park',
 33.7383, -84.4122, 0.5,
 'Atlanta BeltLine', 'transit', NULL,
 '2016-01-01', '2017-09-01', '2017-09-01',
 'positive', 'major',
 ARRAY['rent_growth', 'property_values'], 'government', 'completed'),

('transit_opening', 'BeltLine Southside Trail', 'Southside Trail Phase 1',
 'submarket', 'pittsburgh', 'Pittsburgh / Capitol View',
 33.7180, -84.4050, 0.5,
 'Atlanta BeltLine', 'transit', NULL,
 '2022-01-01', '2024-06-01', NULL,
 'positive', 'major',
 ARRAY['rent_growth', 'property_values'], 'government', 'active'),

-- SUPPLY DELIVERIES (Major projects 500+ units)
('supply_delivery', 'Alexan Buckhead Village', '350 luxury units in Buckhead',
 'submarket', 'buckhead', 'Buckhead',
 33.8385, -84.3640, 1.0,
 'Trammell Crow', 'developer', NULL,
 '2021-01-01', '2023-06-01', '2023-06-01',
 'negative', 'moderate',
 ARRAY['occupancy', 'concessions'], 'news', 'completed'),

('supply_delivery', 'Modera Vinings', '300+ units in Vinings',
 'submarket', 'vinings', 'Vinings',
 33.8650, -84.4680, 1.5,
 'Mill Creek Residential', 'developer', NULL,
 '2022-01-01', '2024-01-01', '2024-01-01',
 'negative', 'moderate',
 ARRAY['occupancy', 'concessions'], 'news', 'completed'),

('supply_announced', 'Centennial Yards Phase 1', '1,000+ units in downtown development',
 'submarket', 'downtown', 'Downtown',
 33.7545, -84.3920, 1.0,
 'CIM Group', 'developer', NULL,
 '2020-01-01', '2026-01-01', NULL,
 'negative', 'major',
 ARRAY['occupancy', 'rent_growth'], 'news', 'active'),

-- GROCERY OPENINGS
('grocery_opening', 'Whole Foods Ponce City Market', 'Flagship Whole Foods in PCM',
 'submarket', 'old_fourth_ward', 'Old Fourth Ward',
 33.7726, -84.3654, 1.0,
 'Whole Foods', 'retail', NULL,
 '2014-06-01', '2014-09-01', '2014-09-01',
 'positive', 'major',
 ARRAY['rent_growth', 'property_values'], 'news', 'completed'),

('grocery_opening', 'Kroger on the BeltLine', 'First grocery store directly on BeltLine',
 'submarket', 'reynoldstown', 'Reynoldstown',
 33.7490, -84.3420, 0.75,
 'Kroger', 'retail', NULL,
 '2019-01-01', '2019-11-01', '2019-11-01',
 'positive', 'moderate',
 ARRAY['rent_growth'], 'news', 'completed'),

-- ECONOMIC SHOCKS
('economic_shock', 'COVID-19 Lockdown', 'Georgia stay-at-home order and pandemic impact',
 'msa', 'atlanta', 'Atlanta MSA',
 33.7490, -84.3880, 50.0,
 NULL, NULL, -200000,
 '2020-03-15', '2020-03-23', '2020-06-01',
 'negative', 'major',
 ARRAY['rent_growth', 'occupancy', 'collections', 'concessions'], 'government', 'completed'),

('economic_shock', 'COVID Recovery / Remote Work Shift', 'Return to work and suburban migration',
 'msa', 'atlanta', 'Atlanta MSA',
 33.7490, -84.3880, 50.0,
 NULL, NULL, 150000,
 '2021-06-01', '2021-06-01', NULL,
 'mixed', 'major',
 ARRAY['rent_growth', 'occupancy', 'suburban_demand'], 'news', 'completed'),

-- INFRASTRUCTURE
('infrastructure', 'Georgia 400 Toll Removal', 'Removal of GA 400 toll booths',
 'submarket', 'north_fulton', 'North Fulton',
 33.9800, -84.3400, 5.0,
 'GDOT', 'government', NULL,
 '2013-01-01', '2013-11-22', '2013-11-22',
 'positive', 'moderate',
 ARRAY['accessibility', 'rent_growth'], 'government', 'completed')

ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED ATLANTA POINTS OF INTEREST
-- ============================================================================

-- MARTA Stations
INSERT INTO points_of_interest (poi_type, poi_name, latitude, longitude, city, state, transit_agency, transit_lines, status, source)
VALUES
('transit_station', 'Five Points Station', 33.7539, -84.3916, 'Atlanta', 'GA', 'MARTA', ARRAY['Red', 'Gold', 'Blue', 'Green'], 'active', 'marta'),
('transit_station', 'Peachtree Center Station', 33.7590, -84.3875, 'Atlanta', 'GA', 'MARTA', ARRAY['Red', 'Gold'], 'active', 'marta'),
('transit_station', 'Civic Center Station', 33.7667, -84.3875, 'Atlanta', 'GA', 'MARTA', ARRAY['Red', 'Gold'], 'active', 'marta'),
('transit_station', 'North Avenue Station', 33.7716, -84.3875, 'Atlanta', 'GA', 'MARTA', ARRAY['Red', 'Gold'], 'active', 'marta'),
('transit_station', 'Midtown Station', 33.7809, -84.3861, 'Atlanta', 'GA', 'MARTA', ARRAY['Red', 'Gold'], 'active', 'marta'),
('transit_station', 'Arts Center Station', 33.7893, -84.3874, 'Atlanta', 'GA', 'MARTA', ARRAY['Red', 'Gold'], 'active', 'marta'),
('transit_station', 'Buckhead Station', 33.8476, -84.3675, 'Atlanta', 'GA', 'MARTA', ARRAY['Red'], 'active', 'marta'),
('transit_station', 'Lenox Station', 33.8455, -84.3577, 'Atlanta', 'GA', 'MARTA', ARRAY['Red'], 'active', 'marta'),
('transit_station', 'Lindbergh Center Station', 33.8230, -84.3694, 'Atlanta', 'GA', 'MARTA', ARRAY['Red', 'Gold'], 'active', 'marta'),
('transit_station', 'Inman Park Station', 33.7569, -84.3526, 'Atlanta', 'GA', 'MARTA', ARRAY['Blue', 'Green'], 'active', 'marta'),
('transit_station', 'King Memorial Station', 33.7499, -84.3760, 'Atlanta', 'GA', 'MARTA', ARRAY['Blue', 'Green'], 'active', 'marta'),
('transit_station', 'West End Station', 33.7358, -84.4129, 'Atlanta', 'GA', 'MARTA', ARRAY['Blue', 'Green'], 'active', 'marta'),
('transit_station', 'Hartsfield-Jackson Airport', 33.6407, -84.4467, 'Atlanta', 'GA', 'MARTA', ARRAY['Red', 'Gold'], 'active', 'marta')
ON CONFLICT DO NOTHING;

-- Premium Groceries
INSERT INTO points_of_interest (poi_type, poi_name, address, latitude, longitude, city, state, status, source)
VALUES
('grocery_premium', 'Whole Foods - Midtown', '650 Ponce De Leon Ave', 33.7726, -84.3654, 'Atlanta', 'GA', 'active', 'manual'),
('grocery_premium', 'Whole Foods - Buckhead', '77 W Paces Ferry Rd', 33.8413, -84.3813, 'Atlanta', 'GA', 'active', 'manual'),
('grocery_premium', 'Whole Foods - Brookhaven', '1750 Dresden Dr', 33.8741, -84.3389, 'Atlanta', 'GA', 'active', 'manual'),
('grocery_premium', 'Trader Joes - Midtown', '931 Monroe Dr', 33.7821, -84.3668, 'Atlanta', 'GA', 'active', 'manual'),
('grocery_premium', 'Trader Joes - Buckhead', '3183 Peachtree Rd', 33.8445, -84.3627, 'Atlanta', 'GA', 'active', 'manual'),
('grocery_standard', 'Kroger - Ponce', '725 Ponce De Leon Ave', 33.7728, -84.3612, 'Atlanta', 'GA', 'active', 'manual'),
('grocery_standard', 'Kroger - Edgewood', '1425 DeKalb Ave', 33.7490, -84.3420, 'Atlanta', 'GA', 'active', 'manual'),
('grocery_standard', 'Publix - Midtown', '1100 Peachtree St', 33.7824, -84.3838, 'Atlanta', 'GA', 'active', 'manual')
ON CONFLICT DO NOTHING;

-- Major Employers
INSERT INTO points_of_interest (poi_type, poi_name, address, latitude, longitude, city, state, employer_industry, employee_count, status, source)
VALUES
('employer_tech', 'Microsoft Atlanta', '715 Peachtree St', 33.7870, -84.3845, 'Atlanta', 'GA', 'technology', 1500, 'active', 'manual'),
('employer_tech', 'Google Atlanta', '10 10th St NW', 33.7820, -84.3890, 'Atlanta', 'GA', 'technology', 1000, 'active', 'manual'),
('employer_tech', 'NCR HQ', '864 Spring St NW', 33.7866, -84.3830, 'Atlanta', 'GA', 'technology', 3400, 'active', 'manual'),
('employer_finance', 'Invesco', '1331 Spring St NW', 33.7915, -84.3880, 'Atlanta', 'GA', 'finance', 1000, 'active', 'manual'),
('employer_major', 'Coca-Cola HQ', '1 Coca-Cola Plaza', 33.7626, -84.3930, 'Atlanta', 'GA', 'consumer_goods', 3500, 'active', 'manual'),
('employer_major', 'Home Depot HQ', '2455 Paces Ferry Rd', 33.8840, -84.4650, 'Atlanta', 'GA', 'retail', 10000, 'active', 'manual'),
('employer_major', 'Delta Air Lines HQ', '1030 Delta Blvd', 33.6540, -84.4310, 'Atlanta', 'GA', 'transportation', 8000, 'active', 'manual'),
('employer_healthcare', 'Emory Healthcare', '1364 Clifton Rd', 33.7912, -84.3245, 'Atlanta', 'GA', 'healthcare', 24000, 'active', 'manual'),
('employer_healthcare', 'CDC', '1600 Clifton Rd', 33.7989, -84.3249, 'Atlanta', 'GA', 'government', 15000, 'active', 'manual')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_proximity_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_property_proximity_updated
  BEFORE UPDATE ON property_proximity
  FOR EACH ROW EXECUTE FUNCTION update_proximity_timestamp();

CREATE TRIGGER tr_market_events_updated
  BEFORE UPDATE ON market_events
  FOR EACH ROW EXECUTE FUNCTION update_proximity_timestamp();

CREATE TRIGGER tr_poi_updated
  BEFORE UPDATE ON points_of_interest
  FOR EACH ROW EXECUTE FUNCTION update_proximity_timestamp();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Upcoming events that may impact properties
CREATE OR REPLACE VIEW upcoming_market_events AS
SELECT 
  me.*,
  CASE 
    WHEN me.effective_date > CURRENT_DATE THEN 'upcoming'
    WHEN me.effective_date > CURRENT_DATE - INTERVAL '3 months' THEN 'recent'
    ELSE 'historical'
  END AS timing_category,
  me.effective_date - CURRENT_DATE AS days_until_effective
FROM market_events me
WHERE me.status NOT IN ('cancelled', 'rumored')
ORDER BY me.effective_date DESC;

-- Event impact summary
CREATE OR REPLACE VIEW event_impact_summary AS
SELECT 
  me.id AS event_id,
  me.event_type,
  me.event_name,
  me.geography_name,
  me.effective_date,
  me.expected_impact_direction,
  me.expected_impact_magnitude,
  eo.measurement_period,
  eo.rent_change_pct AS actual_rent_impact,
  eo.occupancy_change_pct AS actual_occupancy_impact,
  eo.attribution_confidence,
  CASE 
    WHEN me.expected_impact_direction = 'positive' AND eo.rent_change_pct > 0 THEN 'correct'
    WHEN me.expected_impact_direction = 'negative' AND eo.rent_change_pct < 0 THEN 'correct'
    WHEN me.expected_impact_direction = 'neutral' AND ABS(eo.rent_change_pct) < 1 THEN 'correct'
    ELSE 'incorrect'
  END AS prediction_accuracy
FROM market_events me
LEFT JOIN event_outcomes eo ON eo.event_id = me.id
WHERE me.status IN ('completed', 'active')
ORDER BY me.effective_date DESC;

-- Property proximity scorecard
CREATE OR REPLACE VIEW property_proximity_scorecard AS
SELECT 
  pp.*,
  CASE 
    WHEN pp.nearest_rail_station_miles <= 0.25 THEN 'excellent'
    WHEN pp.nearest_rail_station_miles <= 0.5 THEN 'good'
    WHEN pp.nearest_rail_station_miles <= 1.0 THEN 'fair'
    ELSE 'poor'
  END AS transit_grade,
  CASE 
    WHEN pp.nearest_grocery_miles <= 0.25 THEN 'excellent'
    WHEN pp.nearest_grocery_miles <= 0.5 THEN 'good'
    WHEN pp.nearest_grocery_miles <= 1.0 THEN 'fair'
    ELSE 'poor'
  END AS grocery_grade,
  CASE 
    WHEN pp.crime_index <= 80 THEN 'excellent'
    WHEN pp.crime_index <= 100 THEN 'good'
    WHEN pp.crime_index <= 120 THEN 'fair'
    ELSE 'poor'
  END AS safety_grade,
  CASE 
    WHEN COALESCE(pp.nearest_elementary_rating, 0) >= 8 THEN 'excellent'
    WHEN COALESCE(pp.nearest_elementary_rating, 0) >= 6 THEN 'good'
    WHEN COALESCE(pp.nearest_elementary_rating, 0) >= 4 THEN 'fair'
    ELSE 'poor'
  END AS school_grade
FROM property_proximity pp;
