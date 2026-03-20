ALTER TABLE properties ADD COLUMN IF NOT EXISTS frontage_type VARCHAR(20) DEFAULT 'main';

CREATE TABLE IF NOT EXISTS dot_temporal_profiles (
  id SERIAL PRIMARY KEY,
  state VARCHAR(2) NOT NULL DEFAULT 'FL',
  region VARCHAR(50) DEFAULT 'statewide',
  road_functional_class VARCHAR(50) NOT NULL,
  profile_type VARCHAR(20) NOT NULL CHECK (profile_type IN ('hourly', 'seasonal', 'dow', 'directional')),
  factors JSONB NOT NULL,
  source_year INTEGER DEFAULT 2024,
  source_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (state, region, road_functional_class, profile_type)
);

CREATE TABLE IF NOT EXISTS property_digital_competitors (
  id SERIAL PRIMARY KEY,
  property_id VARCHAR(255) NOT NULL,
  competitor_domain VARCHAR(255) NOT NULL,
  competitor_organic_clicks INTEGER DEFAULT 0,
  competitor_paid_clicks INTEGER DEFAULT 0,
  overlap_keywords INTEGER DEFAULT 0,
  relevance_score NUMERIC(4,3) DEFAULT 0,
  fetched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (property_id, competitor_domain)
);
