-- ============================================================================
-- JediRe Zoning Districts Population Script
-- Adds common Atlanta zoning districts and rules
-- ============================================================================

-- Note: This script adds additional zoning coverage for Atlanta
-- The database already has some districts (like MRC-2-C from our test)

-- ============================================================================
-- RESIDENTIAL ZONING DISTRICTS
-- ============================================================================

-- R-5 (High-Density Residential)
INSERT INTO zoning_district_boundaries (id, district_code, district_name, municipality, state_code, boundary, boundary_geojson)
VALUES (
  gen_random_uuid(),
  'R-5',
  'High-Density Residential',
  'Atlanta',
  'GA',
  ST_MakeEnvelope(-84.42, 33.70, -84.32, 33.85, 4326), -- Covers central/north Atlanta
  ST_AsGeoJSON(ST_MakeEnvelope(-84.42, 33.70, -84.32, 33.85, 4326))::json
)
ON CONFLICT DO NOTHING;

-- R-4 (Medium-Density Residential)
INSERT INTO zoning_district_boundaries (id, district_code, district_name, municipality, state_code, boundary, boundary_geojson)
VALUES (
  gen_random_uuid(),
  'R-4',
  'Medium-Density Residential',
  'Atlanta',
  'GA',
  ST_MakeEnvelope(-84.45, 33.68, -84.35, 33.78, 4326),
  ST_AsGeoJSON(ST_MakeEnvelope(-84.45, 33.68, -84.35, 33.78, 4326))::json
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMERCIAL ZONING DISTRICTS
-- ============================================================================

-- C-1 (Community Business)
INSERT INTO zoning_district_boundaries (id, district_code, district_name, municipality, state_code, boundary, boundary_geojson)
VALUES (
  gen_random_uuid(),
  'C-1',
  'Community Business',
  'Atlanta',
  'GA',
  ST_MakeEnvelope(-84.40, 33.75, -84.35, 33.82, 4326),
  ST_AsGeoJSON(ST_MakeEnvelope(-84.40, 33.75, -84.35, 33.82, 4326))::json
)
ON CONFLICT DO NOTHING;

-- C-2 (Commercial Service)
INSERT INTO zoning_district_boundaries (id, district_code, district_name, municipality, state_code, boundary, boundary_geojson)
VALUES (
  gen_random_uuid(),
  'C-2',
  'Commercial Service',
  'Atlanta',
  'GA',
  ST_MakeEnvelope(-84.38, 33.72, -84.33, 33.80, 4326),
  ST_AsGeoJSON(ST_MakeEnvelope(-84.38, 33.72, -84.33, 33.80, 4326))::json
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIXED-USE ZONING DISTRICTS
-- ============================================================================

-- MU-1 (Mixed-Use Low Intensity)
INSERT INTO zoning_district_boundaries (id, district_code, district_name, municipality, state_code, boundary, boundary_geojson)
VALUES (
  gen_random_uuid(),
  'MU-1',
  'Mixed-Use Low Intensity',
  'Atlanta',
  'GA',
  ST_MakeEnvelope(-84.39, 33.76, -84.34, 33.83, 4326),
  ST_AsGeoJSON(ST_MakeEnvelope(-84.39, 33.76, -84.34, 33.83, 4326))::json
)
ON CONFLICT DO NOTHING;

-- MU-2 (Mixed-Use Medium Intensity)
INSERT INTO zoning_district_boundaries (id, district_code, district_name, municipality, state_code, boundary, boundary_geojson)
VALUES (
  gen_random_uuid(),
  'MU-2',
  'Mixed-Use Medium Intensity',
  'Atlanta',
  'GA',
  ST_MakeEnvelope(-84.41, 33.74, -84.36, 33.81, 4326),
  ST_AsGeoJSON(ST_MakeEnvelope(-84.41, 33.74, -84.36, 33.81, 4326))::json
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ZONING RULES FOR NEW DISTRICTS
-- ============================================================================

-- R-5 Rules (High-Density Residential)
INSERT INTO zoning_rules (id, district_id, permitted_uses, prohibited_uses, conditional_uses,
  max_units_per_acre, max_building_height_ft, max_stories, max_lot_coverage,
  min_lot_size_sqft, min_front_setback_ft, min_side_setback_ft, min_rear_setback_ft)
SELECT 
  gen_random_uuid(),
  id,
  ARRAY['multifamily_residential', 'townhome', 'duplex', 'apartment', 'senior_living'],
  ARRAY['single_family_detached', 'industrial', 'manufacturing', 'heavy_commercial'],
  ARRAY['mixed_use_development', 'retail_ground_floor', 'place_of_worship', 'school'],
  35,
  55,
  5,
  0.70,
  5000,
  10,
  5,
  15
FROM zoning_district_boundaries
WHERE district_code = 'R-5' AND municipality = 'Atlanta'
ON CONFLICT DO NOTHING;

-- R-4 Rules (Medium-Density Residential)
INSERT INTO zoning_rules (id, district_id, permitted_uses, prohibited_uses, conditional_uses,
  max_units_per_acre, max_building_height_ft, max_stories, max_lot_coverage,
  min_lot_size_sqft, min_front_setback_ft, min_side_setback_ft, min_rear_setback_ft)
SELECT 
  gen_random_uuid(),
  id,
  ARRAY['multifamily_residential', 'townhome', 'duplex', 'triplex'],
  ARRAY['single_family_detached', 'industrial', 'manufacturing', 'retail'],
  ARRAY['place_of_worship', 'school', 'daycare_center'],
  22,
  45,
  4,
  0.60,
  7500,
  15,
  7,
  20
FROM zoning_district_boundaries
WHERE district_code = 'R-4' AND municipality = 'Atlanta'
ON CONFLICT DO NOTHING;

-- C-1 Rules (Community Business)
INSERT INTO zoning_rules (id, district_id, permitted_uses, prohibited_uses, conditional_uses,
  max_units_per_acre, max_building_height_ft, max_stories, max_lot_coverage,
  min_lot_size_sqft, min_front_setback_ft, min_side_setback_ft, min_rear_setback_ft)
SELECT 
  gen_random_uuid(),
  id,
  ARRAY['retail', 'restaurant', 'office', 'personal_services', 'financial_institutions', 
        'grocery_store', 'pharmacy', 'fitness_center'],
  ARRAY['heavy_industrial', 'manufacturing', 'warehousing', 'residential'],
  ARRAY['drive_through_facility', 'automotive_service', 'bar', 'nightclub'],
  NULL,
  45,
  3,
  0.75,
  10000,
  5,
  0,
  10
FROM zoning_district_boundaries
WHERE district_code = 'C-1' AND municipality = 'Atlanta'
ON CONFLICT DO NOTHING;

-- C-2 Rules (Commercial Service)
INSERT INTO zoning_rules (id, district_id, permitted_uses, prohibited_uses, conditional_uses,
  max_units_per_acre, max_building_height_ft, max_stories, max_lot_coverage,
  min_lot_size_sqft, min_front_setback_ft, min_side_setback_ft, min_rear_setback_ft)
SELECT 
  gen_random_uuid(),
  id,
  ARRAY['retail', 'restaurant', 'office', 'hotel', 'automotive_service', 'car_wash',
        'fitness_center', 'entertainment_venue', 'storage_facility'],
  ARRAY['heavy_industrial', 'manufacturing', 'residential'],
  ARRAY['drive_through_facility', 'gas_station', 'adult_entertainment'],
  NULL,
  55,
  4,
  0.80,
  15000,
  10,
  0,
  15
FROM zoning_district_boundaries
WHERE district_code = 'C-2' AND municipality = 'Atlanta'
ON CONFLICT DO NOTHING;

-- MU-1 Rules (Mixed-Use Low Intensity)
INSERT INTO zoning_rules (id, district_id, permitted_uses, prohibited_uses, conditional_uses,
  max_units_per_acre, max_building_height_ft, max_stories, max_lot_coverage,
  min_lot_size_sqft, min_front_setback_ft, min_side_setback_ft, min_rear_setback_ft)
SELECT 
  gen_random_uuid(),
  id,
  ARRAY['mixed_use_development', 'multifamily_residential', 'retail', 'restaurant', 'office',
        'live_work_units', 'art_gallery', 'cafe', 'personal_services'],
  ARRAY['heavy_industrial', 'manufacturing', 'warehousing', 'single_family_detached'],
  ARRAY['hotel', 'bar', 'nightclub', 'fitness_center'],
  28,
  50,
  4,
  0.75,
  8000,
  10,
  5,
  15
FROM zoning_district_boundaries
WHERE district_code = 'MU-1' AND municipality = 'Atlanta'
ON CONFLICT DO NOTHING;

-- MU-2 Rules (Mixed-Use Medium Intensity)
INSERT INTO zoning_rules (id, district_id, permitted_uses, prohibited_uses, conditional_uses,
  max_units_per_acre, max_building_height_ft, max_stories, max_lot_coverage,
  min_lot_size_sqft, min_front_setback_ft, min_side_setback_ft, min_rear_setback_ft)
SELECT 
  gen_random_uuid(),
  id,
  ARRAY['mixed_use_development', 'multifamily_residential', 'retail', 'restaurant', 'office',
        'hotel', 'live_work_units', 'entertainment_venue', 'fitness_center', 'grocery_store'],
  ARRAY['heavy_industrial', 'manufacturing', 'warehousing', 'single_family_detached'],
  ARRAY['bar', 'nightclub', 'parking_structure', 'gas_station'],
  45,
  65,
  6,
  0.85,
  10000,
  5,
  0,
  10
FROM zoning_district_boundaries
WHERE district_code = 'MU-2' AND municipality = 'Atlanta'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- SELECT 
--   zdb.district_code,
--   zdb.district_name,
--   zdb.municipality,
--   zr.max_units_per_acre,
--   zr.max_building_height_ft,
--   zr.max_stories,
--   array_length(zr.permitted_uses, 1) as num_permitted_uses
-- FROM zoning_district_boundaries zdb
-- LEFT JOIN zoning_rules zr ON zr.district_id = zdb.id
-- WHERE zdb.municipality = 'Atlanta'
-- ORDER BY zdb.district_code;
