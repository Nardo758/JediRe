-- Migration 042: User Market Preferences
-- Created: 2026-02-20
-- Purpose: Track which markets users want to monitor

-- User market preferences table
CREATE TABLE IF NOT EXISTS user_market_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id VARCHAR(100) NOT NULL, -- e.g., "atlanta-metro", "austin", "tampa"
  display_name VARCHAR(255) NOT NULL, -- "Atlanta Metro", "Austin"
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1, -- 1 = primary, 2 = secondary, etc.
  notification_settings JSONB DEFAULT '{
    "alerts_enabled": true,
    "new_data_points": true,
    "opportunities": true,
    "market_updates": true
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, market_id)
);

-- Market coverage status table
CREATE TABLE IF NOT EXISTS market_coverage_status (
  id SERIAL PRIMARY KEY,
  market_id VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  state_code VARCHAR(2), -- "GA", "TX", "FL"
  total_parcels INTEGER, -- Total parcels in market
  covered_parcels INTEGER, -- How many we have data for
  coverage_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_parcels > 0 THEN (covered_parcels::DECIMAL / total_parcels * 100)
      ELSE 0 
    END
  ) STORED,
  data_points_count INTEGER DEFAULT 0, -- Research data points (e.g., 1,028 for Atlanta)
  total_units INTEGER DEFAULT 0, -- Total units in data points
  last_import_date TIMESTAMPTZ,
  next_scheduled_import TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'inactive', -- 'active', 'pending', 'inactive'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market vitals table (economic indicators)
CREATE TABLE IF NOT EXISTS market_vitals (
  id SERIAL PRIMARY KEY,
  market_id VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  population INTEGER,
  population_growth_yoy DECIMAL(5,2), -- Year-over-year %
  job_growth_yoy DECIMAL(5,2),
  median_income INTEGER,
  median_home_price INTEGER,
  rent_growth_yoy DECIMAL(5,2),
  avg_rent_per_unit INTEGER,
  occupancy_rate DECIMAL(5,2),
  vacancy_rate DECIMAL(5,2),
  absorption_rate DECIMAL(5,2), -- Units absorbed per month
  new_supply_units INTEGER, -- New units coming online
  jedi_score INTEGER, -- Market score (0-100)
  jedi_rating VARCHAR(50), -- "Strong Buy", "Buy", "Hold", etc.
  source VARCHAR(255), -- Data source attribution
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(market_id, date)
);

-- Indexes for performance
CREATE INDEX idx_user_market_prefs_user_id ON user_market_preferences(user_id);
CREATE INDEX idx_user_market_prefs_market_id ON user_market_preferences(market_id);
CREATE INDEX idx_user_market_prefs_active ON user_market_preferences(is_active) WHERE is_active = true;

CREATE INDEX idx_market_coverage_status ON market_coverage_status(status);
CREATE INDEX idx_market_coverage_market_id ON market_coverage_status(market_id);

CREATE INDEX idx_market_vitals_market_id ON market_vitals(market_id);
CREATE INDEX idx_market_vitals_date ON market_vitals(date DESC);
CREATE INDEX idx_market_vitals_market_date ON market_vitals(market_id, date DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_market_preferences_updated_at
  BEFORE UPDATE ON user_market_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_market_coverage_status_updated_at
  BEFORE UPDATE ON market_coverage_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed initial market coverage data
INSERT INTO market_coverage_status (market_id, display_name, state_code, total_parcels, covered_parcels, data_points_count, total_units, status, last_import_date)
VALUES 
  ('atlanta-metro', 'Atlanta Metro', 'GA', 1033000, 620000, 1028, 249964, 'active', NOW()),
  ('austin', 'Austin', 'TX', 357000, 0, 0, 0, 'pending', NULL),
  ('tampa', 'Tampa', 'FL', 340000, 0, 0, 0, 'pending', NULL)
ON CONFLICT (market_id) DO NOTHING;

-- Seed initial market vitals for Atlanta (from your data)
INSERT INTO market_vitals (market_id, date, population, population_growth_yoy, job_growth_yoy, median_income, rent_growth_yoy, avg_rent_per_unit, occupancy_rate, jedi_score, jedi_rating)
VALUES 
  ('atlanta-metro', '2026-02-01', 6100000, 2.3, 3.8, 72500, 4.2, 2150, 94.5, 87, 'Strong Buy'),
  ('austin', '2026-02-01', 2400000, 3.1, 4.5, 85000, 6.8, 2450, 96.2, 92, 'Strong Buy'),
  ('tampa', '2026-02-01', 3200000, 2.8, 3.2, 68000, 5.1, 2050, 95.3, 84, 'Buy')
ON CONFLICT (market_id, date) DO NOTHING;

COMMENT ON TABLE user_market_preferences IS 'Tracks which markets each user wants to monitor';
COMMENT ON TABLE market_coverage_status IS 'Coverage status and data availability per market';
COMMENT ON TABLE market_vitals IS 'Economic indicators and market performance metrics';
