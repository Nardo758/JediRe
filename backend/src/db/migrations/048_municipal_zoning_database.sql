-- Migration 048: Municipal Zoning Database
-- Stores municipalities, zoning districts, and property-zoning relationships

-- 1. Municipalities Table
CREATE TABLE IF NOT EXISTS municipalities (
  id VARCHAR(100) PRIMARY KEY, -- e.g., "birmingham-al"
  name VARCHAR(255) NOT NULL,
  state CHAR(2) NOT NULL,
  county VARCHAR(255),
  
  -- API Information
  has_api BOOLEAN DEFAULT FALSE,
  api_type VARCHAR(50), -- socrata, arcgis, custom, none
  api_url TEXT,
  
  -- Municode Information
  municode_url TEXT,
  zoning_chapter_path TEXT,
  
  -- Data Quality
  zoning_data_quality VARCHAR(50), -- excellent, good, fair, poor, none
  last_scraped_at TIMESTAMP,
  scraping_enabled BOOLEAN DEFAULT TRUE,
  
  -- Statistics
  total_zoning_districts INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Zoning Districts Table
CREATE TABLE IF NOT EXISTS zoning_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id VARCHAR(100) NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  
  -- District Identity
  zoning_code VARCHAR(50) NOT NULL,
  district_name TEXT,
  
  -- Density & FAR
  max_density_per_acre DECIMAL(10, 2),
  max_far DECIMAL(10, 2),
  
  -- Height Restrictions
  max_height_feet INTEGER,
  max_stories INTEGER,
  
  -- Parking Requirements
  min_parking_per_unit DECIMAL(10, 2),
  
  -- Data Source
  source VARCHAR(50) NOT NULL, -- api, municode_scraped, manual
  source_url TEXT,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_municipality_zoning_code UNIQUE (municipality_id, zoning_code)
);

-- 3. Property Zoning Cache Table
CREATE TABLE IF NOT EXISTS property_zoning_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Property Identification
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  
  -- Location
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  municipality_id VARCHAR(100) REFERENCES municipalities(id),
  
  -- Zoning
  zoning_district_id UUID REFERENCES zoning_districts(id),
  zoning_code VARCHAR(50),
  
  -- Verification
  verified_at TIMESTAMP,
  verification_method VARCHAR(100), -- api, worker, manual
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_deal_property_cache UNIQUE (deal_id)
);

-- Indexes
CREATE INDEX idx_municipalities_state ON municipalities(state);
CREATE INDEX idx_municipalities_has_api ON municipalities(has_api);

CREATE INDEX idx_zoning_districts_municipality ON zoning_districts(municipality_id);
CREATE INDEX idx_zoning_districts_code ON zoning_districts(zoning_code);

CREATE INDEX idx_property_zoning_deal ON property_zoning_cache(deal_id);
CREATE INDEX idx_property_zoning_municipality ON property_zoning_cache(municipality_id);

COMMENT ON TABLE municipalities IS 'Registry of municipalities (API + scraped)';
COMMENT ON TABLE zoning_districts IS 'Zoning district parameters for all municipalities';
COMMENT ON TABLE property_zoning_cache IS 'Cached zoning lookups for properties in deals';
