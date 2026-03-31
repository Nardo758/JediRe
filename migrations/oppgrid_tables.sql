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
-- Comments
-- ============================================================================
COMMENT ON TABLE oppgrid_demand_signals IS 'ApartmentIQ user preference data aggregated by city';
COMMENT ON TABLE oppgrid_market_economics IS 'ApartmentIQ rent and vacancy data by city';
COMMENT ON TABLE oppgrid_location_scores IS 'Cached location scores for OppGrid business analysis';

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
