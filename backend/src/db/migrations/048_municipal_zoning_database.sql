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
  api_key_required BOOLEAN DEFAULT FALSE,
  api_token VARCHAR(255),
  
  -- Municode Information
  municode_url TEXT,
  zoning_chapter_path TEXT,
  
  -- Data Quality
  zoning_data_quality VARCHAR(50), -- excellent, good, fair, poor, none
  last_scraped_at TIMESTAMP,
  scraping_enabled BOOLEAN DEFAULT TRUE,
  
  -- Statistics
  total_zoning_districts INTEGER DEFAULT 0,
  properties_cached INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Zoning Districts Table
CREATE TABLE IF NOT EXISTS zoning_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id VARCHAR(100) NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  
  -- District Identity
  zoning_code VARCHAR(50) NOT NULL, -- e.g., "R-1", "C-2", "I-1"
  district_name TEXT,
  category VARCHAR(50), -- residential, commercial, industrial, mixed-use, special
  
  -- Density & FAR
  max_density_per_acre DECIMAL(10, 2), -- units per acre
  min_density_per_acre DECIMAL(10, 2),
  max_far DECIMAL(10, 2), -- floor area ratio
  
  -- Height Restrictions
  max_height_feet INTEGER,
  max_stories INTEGER,
  
  -- Lot Requirements
  min_lot_size_sqft INTEGER,
  min_lot_width_ft INTEGER,
  max_lot_coverage_percent DECIMAL(5, 2),
  
  -- Setback Requirements
  setback_front_ft INTEGER,
  setback_side_ft INTEGER,
  setback_rear_ft INTEGER,
  
  -- Parking Requirements
  min_parking_per_unit DECIMAL(10, 2),
  parking_notes TEXT,
  
  -- Use Regulations
  permitted_uses TEXT[], -- Array of allowed uses
  conditional_uses TEXT[], -- Array of conditional uses
  prohibited_uses TEXT[],
  
  -- Overlay Districts
  overlay_districts TEXT[],
  special_conditions JSONB,
  
  -- Data Source
  source VARCHAR(50) NOT NULL, -- api, municode_scraped, manual
  source_url TEXT,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,
  verified_by VARCHAR(255),
  
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
  parcel_id VARCHAR(255),
  
  -- Location
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  municipality_id VARCHAR(100) REFERENCES municipalities(id),
  
  -- Zoning
  zoning_district_id UUID REFERENCES zoning_districts(id),
  zoning_code VARCHAR(50),
  
  -- Verification
  verified_at TIMESTAMP,
  verified_by VARCHAR(255),
  verification_method VARCHAR(100), -- api, manual, geocoded
  
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
CREATE INDEX idx_municipalities_api_type ON municipalities(api_type);
CREATE INDEX idx_municipalities_last_scraped ON municipalities(last_scraped_at);

CREATE INDEX idx_zoning_districts_municipality ON zoning_districts(municipality_id);
CREATE INDEX idx_zoning_districts_code ON zoning_districts(zoning_code);
CREATE INDEX idx_zoning_districts_category ON zoning_districts(category);
CREATE INDEX idx_zoning_districts_source ON zoning_districts(source);

CREATE INDEX idx_property_zoning_deal ON property_zoning_cache(deal_id);
CREATE INDEX idx_property_zoning_municipality ON property_zoning_cache(municipality_id);
CREATE INDEX idx_property_zoning_location ON property_zoning_cache(lat, lng);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_municipal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER municipalities_updated_at
  BEFORE UPDATE ON municipalities
  FOR EACH ROW
  EXECUTE FUNCTION update_municipal_timestamp();

CREATE TRIGGER property_zoning_cache_updated_at
  BEFORE UPDATE ON property_zoning_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_municipal_timestamp();

-- Function to lookup zoning by address
CREATE OR REPLACE FUNCTION lookup_zoning_by_address(
  p_address TEXT,
  p_lat DECIMAL,
  p_lng DECIMAL
)
RETURNS TABLE(
  municipality_id VARCHAR(100),
  municipality_name VARCHAR(255),
  zoning_district_id UUID,
  zoning_code VARCHAR(50),
  district_name TEXT,
  max_density DECIMAL,
  max_far DECIMAL,
  max_height_feet INTEGER
) AS $$
BEGIN
  -- Find nearest municipality (within 50 miles)
  -- Then lookup zoning district
  
  -- Simplified version - real implementation would use PostGIS
  RETURN QUERY
  SELECT
    m.id as municipality_id,
    m.name as municipality_name,
    zd.id as zoning_district_id,
    zd.zoning_code,
    zd.district_name,
    zd.max_density_per_acre as max_density,
    zd.max_far,
    zd.max_height_feet
  FROM municipalities m
  LEFT JOIN zoning_districts zd ON zd.municipality_id = m.id
  WHERE m.has_api = TRUE
  ORDER BY m.name
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get municipality statistics
CREATE OR REPLACE FUNCTION get_municipality_stats(p_municipality_id VARCHAR)
RETURNS TABLE(
  total_districts INTEGER,
  residential_districts INTEGER,
  commercial_districts INTEGER,
  industrial_districts INTEGER,
  mixed_use_districts INTEGER,
  properties_cached INTEGER,
  last_scraped TIMESTAMP,
  data_quality VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_districts,
    COUNT(*) FILTER (WHERE category = 'residential')::INTEGER as residential_districts,
    COUNT(*) FILTER (WHERE category = 'commercial')::INTEGER as commercial_districts,
    COUNT(*) FILTER (WHERE category = 'industrial')::INTEGER as industrial_districts,
    COUNT(*) FILTER (WHERE category = 'mixed-use')::INTEGER as mixed_use_districts,
    m.properties_cached,
    m.last_scraped_at,
    m.zoning_data_quality
  FROM zoning_districts zd
  JOIN municipalities m ON m.id = zd.municipality_id
  WHERE zd.municipality_id = p_municipality_id
  GROUP BY m.properties_cached, m.last_scraped_at, m.zoning_data_quality;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE municipalities IS 'Registry of municipalities with API and Municode information';
COMMENT ON TABLE zoning_districts IS 'Zoning district parameters for all municipalities';
COMMENT ON TABLE property_zoning_cache IS 'Cached zoning lookups for properties in deals';
