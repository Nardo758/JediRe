-- OppGrid Integration Tables
-- Created: 2026-03-30
-- Purpose: Store ApartmentIQ data for OppGrid consumption

-- ============================================================================
-- Demand Signals Table
-- Stores aggregated user preference data from ApartmentIQ
-- ============================================================================
CREATE TABLE IF NOT EXISTS oppgrid_demand_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  amenity_type TEXT NOT NULL,  -- 'coffee_shop', 'gym', 'grocery', etc.
  demand_pct DECIMAL(5,2),      -- % of users wanting this nearby (0-100)
  avg_frequency DECIMAL(3,1),   -- average trips per week
  priority_weight DECIMAL(3,2), -- weight from high/medium/low priorities
  sample_size INT,              -- number of users in sample
  trend TEXT DEFAULT 'stable',  -- 'rising', 'stable', 'declining'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city, state, amenity_type)
);

-- Indexes for demand_signals
CREATE INDEX IF NOT EXISTS idx_oppgrid_demand_signals_city_state 
  ON oppgrid_demand_signals(city, state);
CREATE INDEX IF NOT EXISTS idx_oppgrid_demand_signals_amenity 
  ON oppgrid_demand_signals(amenity_type);

-- ============================================================================
-- Market Economics Table
-- Stores rent and vacancy data from ApartmentIQ
-- ============================================================================
CREATE TABLE IF NOT EXISTS oppgrid_market_economics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  avg_rent_1br INT,             -- average 1BR rent
  avg_rent_2br INT,             -- average 2BR rent
  avg_rent_3br INT,             -- average 3BR rent
  median_rent INT,              -- median rent across all unit types
  vacancy_rate DECIMAL(4,2),    -- vacancy rate as percentage
  rent_trend TEXT DEFAULT 'stable',  -- 'increasing', 'stable', 'decreasing'
  yoy_change DECIMAL(5,2),      -- year-over-year rent change %
  sample_size INT,              -- number of properties in sample
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city, state)
);

-- Indexes for market_economics
CREATE INDEX IF NOT EXISTS idx_oppgrid_market_economics_city_state 
  ON oppgrid_market_economics(city, state);

-- ============================================================================
-- Location Scores Cache (optional - for caching scored locations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS oppgrid_location_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  business_type TEXT NOT NULL,
  overall_score INT,
  demand_score INT,
  competition_score INT,
  accessibility_score INT,
  demographics_score INT,
  insights JSONB,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  UNIQUE(address, business_type)
);

-- Index for location_scores
CREATE INDEX IF NOT EXISTS idx_oppgrid_location_scores_city_state 
  ON oppgrid_location_scores(city, state);
CREATE INDEX IF NOT EXISTS idx_oppgrid_location_scores_business_type 
  ON oppgrid_location_scores(business_type);
CREATE INDEX IF NOT EXISTS idx_oppgrid_location_scores_expires 
  ON oppgrid_location_scores(expires_at);

-- ============================================================================
-- OppGrid Opportunity Signals Table (OppGrid → JediRE)
-- Stores opportunity signals from OppGrid for Strategy Builder
-- ============================================================================
CREATE TABLE IF NOT EXISTS oppgrid_opportunity_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'oppgrid',
  signal_type TEXT NOT NULL,           -- 'coffee_shop_demand', 'gym_demand', etc.
  score DECIMAL(5,2),                   -- 0-100 opportunity score
  confidence DECIMAL(3,2),              -- 0-1 confidence level
  category TEXT,                        -- business category
  trend TEXT DEFAULT 'stable',          -- 'rising', 'stable', 'declining'
  metadata JSONB,                       -- additional signal data
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city, state, signal_type, source)
);

-- Indexes for opportunity_signals
CREATE INDEX IF NOT EXISTS idx_oppgrid_opportunity_signals_city_state 
  ON oppgrid_opportunity_signals(city, state);
CREATE INDEX IF NOT EXISTS idx_oppgrid_opportunity_signals_category 
  ON oppgrid_opportunity_signals(category);
CREATE INDEX IF NOT EXISTS idx_oppgrid_opportunity_signals_score 
  ON oppgrid_opportunity_signals(score DESC);

-- ============================================================================
-- OppGrid Growth Trajectories Table (OppGrid → JediRE)
-- Stores market growth data from OppGrid
-- ============================================================================
CREATE TABLE IF NOT EXISTS oppgrid_growth_trajectories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'oppgrid',
  growth_score DECIMAL(5,2),            -- 0-100 overall growth score
  growth_category TEXT,                 -- 'booming', 'growing', 'stable', 'declining'
  population_growth_rate DECIMAL(5,2),  -- % annual growth
  job_growth_rate DECIMAL(5,2),         -- % annual growth
  income_growth_rate DECIMAL(5,2),      -- % annual growth
  business_formation_rate DECIMAL(5,2), -- new business rate
  net_migration_rate DECIMAL(5,2),      -- % net migration
  opportunity_signal_count INT,         -- number of signals in area
  avg_opportunity_score DECIMAL(5,2),   -- average opp score
  signal_density_percentile DECIMAL(5,2), -- signal concentration percentile
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city, state, source)
);

-- Indexes for growth_trajectories
CREATE INDEX IF NOT EXISTS idx_oppgrid_growth_trajectories_city_state 
  ON oppgrid_growth_trajectories(city, state);
CREATE INDEX IF NOT EXISTS idx_oppgrid_growth_trajectories_growth_score 
  ON oppgrid_growth_trajectories(growth_score DESC);

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE oppgrid_demand_signals IS 'ApartmentIQ user preference data aggregated by city';
COMMENT ON TABLE oppgrid_market_economics IS 'ApartmentIQ rent and vacancy data by city';
COMMENT ON TABLE oppgrid_location_scores IS 'Cached location scores for OppGrid business analysis';
COMMENT ON TABLE oppgrid_opportunity_signals IS 'OppGrid opportunity signals for JediRE Strategy Builder';
COMMENT ON TABLE oppgrid_growth_trajectories IS 'OppGrid market growth trajectories for JediRE';

-- ============================================================================
-- Sample data for testing (can be removed in production)
-- ============================================================================
-- INSERT INTO oppgrid_demand_signals (city, state, amenity_type, demand_pct, avg_frequency, priority_weight, sample_size, trend)
-- VALUES 
--   ('atlanta', 'GA', 'coffee_shop', 42.5, 2.3, 1.2, 1250, 'rising'),
--   ('atlanta', 'GA', 'gym', 38.0, 3.0, 1.0, 1250, 'stable'),
--   ('atlanta', 'GA', 'grocery', 65.0, 2.0, 1.5, 1250, 'stable')
-- ON CONFLICT DO NOTHING;

-- INSERT INTO oppgrid_market_economics (city, state, avg_rent_1br, avg_rent_2br, avg_rent_3br, median_rent, vacancy_rate, rent_trend, yoy_change, sample_size)
-- VALUES 
--   ('atlanta', 'GA', 1850, 2400, 3100, 2100, 5.2, 'increasing', 8.5, 3400)
-- ON CONFLICT DO NOTHING;
