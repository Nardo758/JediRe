-- Migration 048: Municipal Zoning Database
-- Creates municipalities registry, upgrades zoning_districts with FK, adds property_zoning_cache

-- 1. Municipalities Table
CREATE TABLE IF NOT EXISTS municipalities (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  state CHAR(2) NOT NULL,
  county VARCHAR(255),
  population INTEGER,
  has_api BOOLEAN DEFAULT FALSE,
  api_type VARCHAR(50),
  api_url TEXT,
  api_dataset_id VARCHAR(255),
  municode_url TEXT,
  zoning_chapter_path TEXT,
  data_quality VARCHAR(50) DEFAULT 'none',
  total_zoning_districts INTEGER DEFAULT 0,
  priority VARCHAR(10) DEFAULT 'MEDIUM',
  last_scraped_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Upgrade zoning_districts: add municipality_id FK, keep old columns as fallback
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'municipality_id') THEN
    ALTER TABLE zoning_districts ADD COLUMN municipality_id VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'zoning_code') THEN
    ALTER TABLE zoning_districts ADD COLUMN zoning_code VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'category') THEN
    ALTER TABLE zoning_districts ADD COLUMN category VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'max_density_per_acre') THEN
    ALTER TABLE zoning_districts ADD COLUMN max_density_per_acre DECIMAL(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'max_height_feet') THEN
    ALTER TABLE zoning_districts ADD COLUMN max_height_feet INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'setback_front_ft') THEN
    ALTER TABLE zoning_districts ADD COLUMN setback_front_ft INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'setback_side_ft') THEN
    ALTER TABLE zoning_districts ADD COLUMN setback_side_ft INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'setback_rear_ft') THEN
    ALTER TABLE zoning_districts ADD COLUMN setback_rear_ft INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'min_parking_per_unit') THEN
    ALTER TABLE zoning_districts ADD COLUMN min_parking_per_unit DECIMAL(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'parking_notes') THEN
    ALTER TABLE zoning_districts ADD COLUMN parking_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'overlay_districts') THEN
    ALTER TABLE zoning_districts ADD COLUMN overlay_districts TEXT[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'special_conditions') THEN
    ALTER TABLE zoning_districts ADD COLUMN special_conditions JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'source') THEN
    ALTER TABLE zoning_districts ADD COLUMN source VARCHAR(50) DEFAULT 'manual';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'max_lot_coverage_percent') THEN
    ALTER TABLE zoning_districts ADD COLUMN max_lot_coverage_percent DECIMAL(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'min_lot_width_ft') THEN
    ALTER TABLE zoning_districts ADD COLUMN min_lot_width_ft INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zoning_districts' AND column_name = 'verified_at') THEN
    ALTER TABLE zoning_districts ADD COLUMN verified_at TIMESTAMP;
  END IF;
END $$;

-- 3. Property Zoning Cache Table
CREATE TABLE IF NOT EXISTS property_zoning_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  parcel_id VARCHAR(255),
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  municipality_id VARCHAR(100) REFERENCES municipalities(id),
  zoning_district_id UUID,
  zoning_code VARCHAR(50),
  verified_at TIMESTAMP,
  verification_method VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_deal_property_cache UNIQUE (deal_id)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_municipalities_state ON municipalities(state);
CREATE INDEX IF NOT EXISTS idx_municipalities_api_type ON municipalities(api_type);
CREATE INDEX IF NOT EXISTS idx_zoning_districts_municipality_id ON zoning_districts(municipality_id);
CREATE INDEX IF NOT EXISTS idx_zoning_districts_zoning_code ON zoning_districts(zoning_code);
CREATE INDEX IF NOT EXISTS idx_zoning_districts_category ON zoning_districts(category);
CREATE INDEX IF NOT EXISTS idx_property_zoning_deal ON property_zoning_cache(deal_id);
CREATE INDEX IF NOT EXISTS idx_property_zoning_municipality ON property_zoning_cache(municipality_id);

-- 5. Seed Atlanta municipality and backfill existing zoning_districts
INSERT INTO municipalities (id, name, state, county, population, has_api, api_type, api_url, data_quality, total_zoning_districts, priority)
VALUES ('atlanta-ga', 'Atlanta', 'GA', 'Fulton County', 498000, TRUE, 'arcgis', 'https://gis.atlantaga.gov/arcgis/rest/services', 'excellent', 23, 'HIGH')
ON CONFLICT (id) DO NOTHING;

-- Backfill municipality_id and zoning_code from old columns
UPDATE zoning_districts
SET municipality_id = 'atlanta-ga',
    zoning_code = COALESCE(zoning_code, district_code),
    max_density_per_acre = COALESCE(max_density_per_acre, max_units_per_acre),
    max_height_feet = COALESCE(max_height_feet, max_building_height_ft),
    setback_front_ft = COALESCE(setback_front_ft, min_front_setback_ft),
    setback_side_ft = COALESCE(setback_side_ft, min_side_setback_ft),
    setback_rear_ft = COALESCE(setback_rear_ft, min_rear_setback_ft),
    min_parking_per_unit = COALESCE(min_parking_per_unit, parking_per_unit),
    source = COALESCE(source, 'manual')
WHERE municipality = 'Atlanta' AND (municipality_id IS NULL OR municipality_id = '');

-- Austin backfill
INSERT INTO municipalities (id, name, state, county, population, has_api, api_type, api_url, api_dataset_id, data_quality, priority)
VALUES ('austin-tx', 'Austin', 'TX', 'Travis County', 961000, TRUE, 'socrata', 'https://data.austintexas.gov', 'n5kp-f8k4', 'good', 'HIGH')
ON CONFLICT (id) DO NOTHING;

UPDATE zoning_districts
SET municipality_id = 'austin-tx',
    zoning_code = COALESCE(zoning_code, district_code),
    max_density_per_acre = COALESCE(max_density_per_acre, max_units_per_acre),
    max_height_feet = COALESCE(max_height_feet, max_building_height_ft),
    setback_front_ft = COALESCE(setback_front_ft, min_front_setback_ft),
    setback_side_ft = COALESCE(setback_side_ft, min_side_setback_ft),
    setback_rear_ft = COALESCE(setback_rear_ft, min_rear_setback_ft),
    min_parking_per_unit = COALESCE(min_parking_per_unit, parking_per_unit),
    source = COALESCE(source, 'manual')
WHERE municipality = 'Austin' AND (municipality_id IS NULL OR municipality_id = '');

-- Update municipality district counts
UPDATE municipalities SET total_zoning_districts = (
  SELECT COUNT(*) FROM zoning_districts WHERE municipality_id = municipalities.id
);

-- Timestamp trigger for municipalities
CREATE OR REPLACE FUNCTION update_municipal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS municipalities_updated_at ON municipalities;
CREATE TRIGGER municipalities_updated_at
  BEFORE UPDATE ON municipalities
  FOR EACH ROW
  EXECUTE FUNCTION update_municipal_timestamp();

DROP TRIGGER IF EXISTS property_zoning_cache_updated_at ON property_zoning_cache;
CREATE TRIGGER property_zoning_cache_updated_at
  BEFORE UPDATE ON property_zoning_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_municipal_timestamp();
