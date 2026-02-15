-- Migration 027: User Market & Property Type Preferences
-- Purpose: Store user's market coverage and property type focus
-- Created: 2026-02-15

-- Add preferences to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS 
  preferred_markets TEXT[] DEFAULT '{}',
  property_types TEXT[] DEFAULT '{}',
  primary_market VARCHAR(100),
  primary_use_case VARCHAR(50),
  onboarding_completed BOOLEAN DEFAULT false,
  preferences_set_at TIMESTAMP;

-- Create index for market queries
CREATE INDEX IF NOT EXISTS idx_users_preferred_markets ON users USING GIN (preferred_markets);
CREATE INDEX IF NOT EXISTS idx_users_property_types ON users USING GIN (property_types);

-- Available markets (for reference)
CREATE TABLE IF NOT EXISTS available_markets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(150) NOT NULL,
  state VARCHAR(2),
  metro_area VARCHAR(100),
  coverage_status VARCHAR(20) DEFAULT 'coming_soon', -- active, beta, coming_soon
  property_count INTEGER DEFAULT 0,
  data_freshness VARCHAR(20), -- real_time, daily, weekly
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed available markets
INSERT INTO available_markets (name, display_name, state, metro_area, coverage_status, property_count, data_freshness) VALUES
  ('atlanta', 'Atlanta Metro', 'GA', 'Atlanta-Sandy Springs-Roswell', 'active', 620000, 'real_time'),
  ('austin', 'Austin Metro', 'TX', 'Austin-Round Rock', 'beta', 0, 'daily'),
  ('dallas', 'Dallas-Fort Worth', 'TX', 'Dallas-Fort Worth-Arlington', 'coming_soon', 0, 'weekly'),
  ('houston', 'Houston Metro', 'TX', 'Houston-The Woodlands-Sugar Land', 'coming_soon', 0, 'weekly'),
  ('phoenix', 'Phoenix Metro', 'AZ', 'Phoenix-Mesa-Scottsdale', 'coming_soon', 0, 'weekly'),
  ('tampa', 'Tampa Bay', 'FL', 'Tampa-St. Petersburg-Clearwater', 'coming_soon', 0, 'weekly')
ON CONFLICT (name) DO NOTHING;

-- Property type definitions
CREATE TABLE IF NOT EXISTS property_types (
  id SERIAL PRIMARY KEY,
  type_key VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(10),
  enabled BOOLEAN DEFAULT true
);

-- Seed property types
INSERT INTO property_types (type_key, display_name, description, icon) VALUES
  ('multifamily', 'Multifamily', 'Apartment buildings, multifamily communities (5+ units)', '🏢'),
  ('single_family', 'Single Family', 'Single family homes, duplexes, triplexes, fourplexes', '🏠'),
  ('retail', 'Retail', 'Retail spaces, shopping centers, strip malls', '🏪'),
  ('industrial', 'Industrial', 'Warehouses, manufacturing, logistics facilities', '🏭'),
  ('office', 'Office', 'Office buildings, coworking spaces', '🏢'),
  ('mixed_use', 'Mixed Use', 'Combined residential/commercial developments', '🏗️')
ON CONFLICT (type_key) DO NOTHING;

-- User preferences history (track changes)
CREATE TABLE IF NOT EXISTS user_preference_history (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  field_changed VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments
COMMENT ON COLUMN users.preferred_markets IS 'Array of market keys user wants to track (e.g., {atlanta, austin})';
COMMENT ON COLUMN users.property_types IS 'Array of property type keys user focuses on (e.g., {multifamily, single_family})';
COMMENT ON COLUMN users.primary_market IS 'User''s main market of operation';
COMMENT ON COLUMN users.primary_use_case IS 'Primary use: investor, developer, broker, lender, etc.';
COMMENT ON COLUMN users.onboarding_completed IS 'Whether user completed initial setup';

-- Grant permissions
GRANT SELECT ON available_markets TO PUBLIC;
GRANT SELECT ON property_types TO PUBLIC;
