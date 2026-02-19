-- Migration 036: Create available_markets and property_types tables for onboarding

CREATE TABLE IF NOT EXISTS available_markets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(150) NOT NULL,
  state VARCHAR(2) NOT NULL,
  metro_area VARCHAR(150),
  coverage_status VARCHAR(20) DEFAULT 'active',
  property_count INTEGER DEFAULT 0,
  data_freshness VARCHAR(50) DEFAULT 'weekly',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_types (
  id SERIAL PRIMARY KEY,
  type_key VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO available_markets (name, display_name, state, metro_area, coverage_status, property_count, data_freshness) VALUES
  ('atlanta', 'Atlanta', 'GA', 'Atlanta-Sandy Springs-Roswell', 'active', 3240, 'daily'),
  ('dallas', 'Dallas-Fort Worth', 'TX', 'Dallas-Fort Worth-Arlington', 'active', 4150, 'daily'),
  ('houston', 'Houston', 'TX', 'Houston-The Woodlands-Sugar Land', 'active', 3890, 'daily'),
  ('charlotte', 'Charlotte', 'NC', 'Charlotte-Concord-Gastonia', 'active', 1820, 'weekly'),
  ('nashville', 'Nashville', 'TN', 'Nashville-Davidson-Murfreesboro', 'active', 1650, 'weekly'),
  ('tampa', 'Tampa Bay', 'FL', 'Tampa-St. Petersburg-Clearwater', 'active', 2310, 'weekly'),
  ('phoenix', 'Phoenix', 'AZ', 'Phoenix-Mesa-Chandler', 'beta', 2780, 'weekly'),
  ('denver', 'Denver', 'CO', 'Denver-Aurora-Lakewood', 'beta', 1920, 'weekly'),
  ('austin', 'Austin', 'TX', 'Austin-Round Rock-Georgetown', 'beta', 1540, 'weekly'),
  ('raleigh', 'Raleigh-Durham', 'NC', 'Raleigh-Cary', 'beta', 1280, 'weekly')
ON CONFLICT (name) DO NOTHING;

INSERT INTO property_types (type_key, display_name, description, icon) VALUES
  ('multifamily', 'Multifamily', 'Apartment complexes and multi-unit residential', 'building'),
  ('office', 'Office', 'Office buildings and business parks', 'briefcase'),
  ('retail', 'Retail', 'Shopping centers, strip malls, and standalone retail', 'shopping-cart'),
  ('industrial', 'Industrial', 'Warehouses, distribution centers, and flex space', 'warehouse'),
  ('mixed_use', 'Mixed Use', 'Combined residential, retail, and office properties', 'layers'),
  ('hospitality', 'Hospitality', 'Hotels, motels, and extended stay properties', 'bed'),
  ('self_storage', 'Self Storage', 'Self-storage facilities', 'archive'),
  ('medical', 'Medical Office', 'Medical office buildings and healthcare facilities', 'activity'),
  ('land', 'Land', 'Development sites and raw land', 'map')
ON CONFLICT (type_key) DO NOTHING;
