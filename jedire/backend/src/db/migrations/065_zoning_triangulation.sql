-- Migration 065: Zoning Triangulation System
-- Normalizes column names, adds parcel records + county zoning categories,
-- and creates the three-source feedback loop:
--   Source A: County Parcel Records (authoritative designation)
--   Source B: County Zoning Categories (category-level rules)
--   Source C: Municode Ordinance (specific dimensional standards)
--
-- The feedback loop confirms: CODE → PROCESS → TIMELINE → MATH
-- Outcomes feed back to calibrate confidence per jurisdiction.

-- ============================================================================
-- PHASE 1: Fix municipalities table (resolve merge conflict in 048)
-- ============================================================================

ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS population INTEGER;
ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS planning_url TEXT;
ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS scraping_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS data_quality VARCHAR(50) DEFAULT 'none';
ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'MEDIUM';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'municipalities' AND column_name = 'zoning_data_quality') THEN
    UPDATE municipalities SET data_quality = zoning_data_quality 
    WHERE data_quality IS NULL AND zoning_data_quality IS NOT NULL;
  END IF;
END $$;


-- ============================================================================
-- PHASE 2: Normalize zoning_districts column names
-- ============================================================================

ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS zoning_code VARCHAR(50);
ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS max_building_height_ft INTEGER;
ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS max_units_per_acre DECIMAL(10,2);
ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS min_front_setback_ft INTEGER;
ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS min_side_setback_ft INTEGER;
ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS min_rear_setback_ft INTEGER;
ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS max_lot_coverage DECIMAL(5,4);
ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS parking_per_unit DECIMAL(5,2);

UPDATE zoning_districts SET zoning_code = district_code
  WHERE zoning_code IS NULL AND district_code IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'zoning_districts' AND column_name = 'max_height_feet') THEN
    UPDATE zoning_districts SET max_building_height_ft = max_height_feet
      WHERE max_building_height_ft IS NULL AND max_height_feet IS NOT NULL;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'zoning_districts' AND column_name = 'max_density_per_acre') THEN
    UPDATE zoning_districts SET max_units_per_acre = max_density_per_acre
      WHERE max_units_per_acre IS NULL AND max_density_per_acre IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'zoning_districts' AND column_name = 'setback_front_ft') THEN
    UPDATE zoning_districts SET min_front_setback_ft = setback_front_ft
      WHERE min_front_setback_ft IS NULL AND setback_front_ft IS NOT NULL;
    UPDATE zoning_districts SET min_side_setback_ft = setback_side_ft
      WHERE min_side_setback_ft IS NULL AND setback_side_ft IS NOT NULL;
    UPDATE zoning_districts SET min_rear_setback_ft = setback_rear_ft
      WHERE min_rear_setback_ft IS NULL AND setback_rear_ft IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'zoning_districts' AND column_name = 'max_lot_coverage_percent') THEN
    UPDATE zoning_districts SET max_lot_coverage = max_lot_coverage_percent / 100.0
      WHERE max_lot_coverage IS NULL AND max_lot_coverage_percent IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'zoning_districts' AND column_name = 'min_parking_per_unit') THEN
    UPDATE zoning_districts SET parking_per_unit = min_parking_per_unit
      WHERE parking_per_unit IS NULL AND min_parking_per_unit IS NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE VIEW zoning_districts_canonical AS
SELECT
  id,
  municipality_id,
  COALESCE(zoning_code, district_code) AS zoning_code,
  district_code,
  district_name,
  municipality,
  state,
  description,
  category,
  
  COALESCE(max_building_height_ft, max_height_feet) AS max_height_ft,
  max_stories,
  COALESCE(max_units_per_acre, max_density_per_acre) AS max_density_per_acre,
  max_far,
  residential_far,
  nonresidential_far,
  density_method,
  COALESCE(max_lot_coverage, max_lot_coverage_percent / 100.0) AS max_lot_coverage,
  COALESCE(min_front_setback_ft, setback_front_ft) AS setback_front_ft,
  COALESCE(min_side_setback_ft, setback_side_ft) AS setback_side_ft,
  COALESCE(min_rear_setback_ft, setback_rear_ft) AS setback_rear_ft,
  min_lot_size_sqft,
  min_lot_per_unit_sqft,
  height_buffer_ft,
  height_beyond_buffer_ft,
  
  COALESCE(parking_per_unit, min_parking_per_unit) AS parking_per_unit,
  parking_per_1000_sqft,
  
  permitted_uses,
  conditional_uses,
  
  district_profile,
  confidence_score,
  code_section,
  
  created_at,
  updated_at
FROM zoning_districts;


-- ============================================================================
-- PHASE 3: County Parcel Records (Source A - authoritative)
-- ============================================================================

CREATE TABLE IF NOT EXISTS county_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  parcel_id VARCHAR(100) NOT NULL,
  county VARCHAR(255) NOT NULL,
  state CHAR(2) NOT NULL,
  municipality VARCHAR(255),
  
  county_zoning_code VARCHAR(50),
  county_zoning_desc VARCHAR(500),
  land_use_code VARCHAR(50),
  
  geometry JSONB,
  lot_area_sf DECIMAL(12,2),
  lot_width_ft DECIMAL(8,2),
  lot_depth_ft DECIMAL(8,2),
  frontage_ft DECIMAL(8,2),
  is_corner_lot BOOLEAN DEFAULT FALSE,
  
  site_address TEXT,
  
  centroid_lat DECIMAL(12,8),
  centroid_lng DECIMAL(12,8),
  
  county_last_updated DATE,
  county_source_url TEXT,
  
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  ingestion_batch_id VARCHAR(100),
  raw_record JSONB,
  
  CONSTRAINT uq_county_parcel UNIQUE (parcel_id, county, state),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_county_parcels_zoning ON county_parcels(county_zoning_code);
CREATE INDEX IF NOT EXISTS idx_county_parcels_municipality ON county_parcels(municipality);
CREATE INDEX IF NOT EXISTS idx_county_parcels_location ON county_parcels(centroid_lat, centroid_lng);
CREATE INDEX IF NOT EXISTS idx_county_parcels_county_state ON county_parcels(county, state);


-- ============================================================================
-- PHASE 4: County Zoning Categories (Source B - category-level rules)
-- ============================================================================

CREATE TABLE IF NOT EXISTS county_zoning_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  county VARCHAR(255) NOT NULL,
  state CHAR(2) NOT NULL,
  municipality VARCHAR(255),
  
  category_code VARCHAR(50) NOT NULL,
  category_name VARCHAR(500),
  description TEXT,
  
  county_max_density_per_acre DECIMAL(10,2),
  county_max_height_ft INTEGER,
  county_max_far DECIMAL(10,2),
  county_max_lot_coverage DECIMAL(5,4),
  county_min_lot_size_sf INTEGER,
  county_parking_per_unit DECIMAL(5,2),
  county_setback_front_ft INTEGER,
  county_setback_side_ft INTEGER,
  county_setback_rear_ft INTEGER,
  
  permitted_use_categories TEXT[],
  requires_special_permit BOOLEAN DEFAULT FALSE,
  
  source_url TEXT,
  source_document TEXT,
  last_verified DATE,
  
  CONSTRAINT uq_county_zoning_cat UNIQUE (county, state, category_code, municipality),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_county_zoning_cat_code ON county_zoning_categories(category_code);
CREATE INDEX IF NOT EXISTS idx_county_zoning_cat_county ON county_zoning_categories(county, state);


-- ============================================================================
-- PHASE 5: Triangulation Records
-- ============================================================================

CREATE TABLE IF NOT EXISTS zoning_triangulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  parcel_id VARCHAR(100),
  county_parcel_uuid UUID REFERENCES county_parcels(id),
  
  source_a_zoning_code VARCHAR(50),
  source_a_available BOOLEAN DEFAULT FALSE,
  source_a_retrieved_at TIMESTAMPTZ,
  
  source_b_category_code VARCHAR(50),
  source_b_category_uuid UUID REFERENCES county_zoning_categories(id),
  source_b_available BOOLEAN DEFAULT FALSE,
  source_b_retrieved_at TIMESTAMPTZ,
  
  source_c_district_uuid UUID,
  source_c_available BOOLEAN DEFAULT FALSE,
  source_c_retrieved_at TIMESTAMPTZ,
  source_c_municode_url TEXT,
  
  reconciled_zoning_code VARCHAR(50),
  code_agreement BOOLEAN,
  code_discrepancy_detail TEXT,
  
  reconciled_max_density DECIMAL(10,2),
  reconciled_max_height_ft INTEGER,
  reconciled_max_far DECIMAL(10,2),
  reconciled_max_lot_coverage DECIMAL(5,4),
  reconciled_setback_front_ft INTEGER,
  reconciled_setback_side_ft INTEGER,
  reconciled_setback_rear_ft INTEGER,
  reconciled_parking_per_unit DECIMAL(5,2),
  
  field_reconciliation JSONB DEFAULT '{}'::jsonb,
  
  entitlement_path_confirmed VARCHAR(30),
  process_source VARCHAR(30),
  process_confidence DECIMAL(3,2),
  
  predicted_timeline_months DECIMAL(5,1),
  timeline_source VARCHAR(30),
  timeline_confidence DECIMAL(3,2),
  
  triangulation_status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (triangulation_status IN (
      'pending',
      'partial',
      'complete',
      'confirmed',
      'conflict',
      'stale'
    )),
  
  overall_confidence DECIMAL(3,2) DEFAULT 0.00,
  
  user_confirmed BOOLEAN DEFAULT FALSE,
  user_confirmed_at TIMESTAMPTZ,
  user_override_fields JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  triangulated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_zoning_tri_deal ON zoning_triangulations(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoning_tri_parcel ON zoning_triangulations(parcel_id);
CREATE INDEX IF NOT EXISTS idx_zoning_tri_status ON zoning_triangulations(triangulation_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zoning_tri_deal_parcel 
  ON zoning_triangulations(deal_id, parcel_id) WHERE deal_id IS NOT NULL;


-- ============================================================================
-- PHASE 6: Outcome Feedback Loop
-- ============================================================================

CREATE TABLE IF NOT EXISTS triangulation_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  triangulation_id UUID NOT NULL REFERENCES zoning_triangulations(id),
  deal_id UUID REFERENCES deals(id),
  
  predicted_zoning_code VARCHAR(50),
  predicted_entitlement_path VARCHAR(30),
  predicted_timeline_months DECIMAL(5,1),
  predicted_max_units INTEGER,
  predicted_max_far DECIMAL(10,2),
  
  actual_zoning_code VARCHAR(50),
  actual_entitlement_path VARCHAR(30),
  actual_timeline_months DECIMAL(5,1),
  actual_approved_units INTEGER,
  actual_approved_far DECIMAL(10,2),
  actual_outcome VARCHAR(30) NOT NULL
    CHECK (actual_outcome IN (
      'approved_as_predicted',
      'approved_with_conditions',
      'approved_different_path',
      'denied',
      'withdrawn',
      'pending'
    )),
  
  delta_timeline_months DECIMAL(5,1),
  delta_units INTEGER,
  delta_far DECIMAL(10,2),
  
  most_accurate_source VARCHAR(30),
  source_accuracy_scores JSONB DEFAULT '{}'::jsonb,
  
  reported_by VARCHAR(100),
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  approval_document_url TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tri_outcomes_tri ON triangulation_outcomes(triangulation_id);
CREATE INDEX IF NOT EXISTS idx_tri_outcomes_deal ON triangulation_outcomes(deal_id);
CREATE INDEX IF NOT EXISTS idx_tri_outcomes_outcome ON triangulation_outcomes(actual_outcome);


-- ============================================================================
-- PHASE 7: Per-jurisdiction calibration cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS jurisdiction_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  municipality VARCHAR(255) NOT NULL,
  county VARCHAR(255),
  state CHAR(2) NOT NULL,
  
  total_triangulations INTEGER DEFAULT 0,
  total_outcomes INTEGER DEFAULT 0,
  
  code_match_rate DECIMAL(5,2) DEFAULT 0,
  county_parcel_accuracy DECIMAL(5,2) DEFAULT 0,
  county_category_accuracy DECIMAL(5,2) DEFAULT 0,
  municode_accuracy DECIMAL(5,2) DEFAULT 0,
  
  avg_timeline_bias_months DECIMAL(5,1) DEFAULT 0,
  timeline_std_dev_months DECIMAL(5,1),
  
  avg_density_bias DECIMAL(5,1) DEFAULT 0,
  avg_far_bias DECIMAL(5,2) DEFAULT 0,
  
  weight_county_parcel DECIMAL(3,2) DEFAULT 0.40,
  weight_county_category DECIMAL(3,2) DEFAULT 0.25,
  weight_municode DECIMAL(3,2) DEFAULT 0.35,
  
  maturity_level VARCHAR(20) DEFAULT 'novice',
  confidence_cap DECIMAL(3,2) DEFAULT 0.75,
  
  last_calibrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT uq_jurisdiction_cal UNIQUE (municipality, state)
);

CREATE INDEX IF NOT EXISTS idx_jurisdiction_cal_muni ON jurisdiction_calibration(municipality, state);


-- ============================================================================
-- Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp_065()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'county_parcels_updated_at') THEN
    CREATE TRIGGER county_parcels_updated_at
      BEFORE UPDATE ON county_parcels FOR EACH ROW EXECUTE FUNCTION update_timestamp_065();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'county_zoning_cat_updated_at') THEN
    CREATE TRIGGER county_zoning_cat_updated_at
      BEFORE UPDATE ON county_zoning_categories FOR EACH ROW EXECUTE FUNCTION update_timestamp_065();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'zoning_triangulations_updated_at') THEN
    CREATE TRIGGER zoning_triangulations_updated_at
      BEFORE UPDATE ON zoning_triangulations FOR EACH ROW EXECUTE FUNCTION update_timestamp_065();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'jurisdiction_calibration_updated_at') THEN
    CREATE TRIGGER jurisdiction_calibration_updated_at
      BEFORE UPDATE ON jurisdiction_calibration FOR EACH ROW EXECUTE FUNCTION update_timestamp_065();
  END IF;
END $$;


-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE county_parcels IS 'Source A: County parcel records with authoritative zoning designations';
COMMENT ON TABLE county_zoning_categories IS 'Source B: County-published zoning category definitions and base rules';
COMMENT ON VIEW zoning_districts_canonical IS 'Unified view over zoning_districts normalizing all column name variants to canonical names';
COMMENT ON TABLE zoning_triangulations IS 'Cross-references all 3 sources (parcel, county category, municode) per deal/parcel';
COMMENT ON TABLE triangulation_outcomes IS 'Actual entitlement outcomes that feed back into source accuracy calibration';
COMMENT ON TABLE jurisdiction_calibration IS 'Aggregated accuracy stats per jurisdiction, drives dynamic source weighting';
