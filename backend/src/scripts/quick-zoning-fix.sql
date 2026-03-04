-- Quick Zoning Fix for Atlanta Deals
-- Run this to immediately enable zoning module testing

-- 1950 Piedmont Circle (Main Atlanta deal)
-- Zoning: MRC-2-C (Mixed Residential/Commercial - Medium-High Intensity)
-- Lot: 3.59 acres
UPDATE deals 
SET 
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{zoning}',
    jsonb_build_object(
      'code', 'MRC-2-C',
      'name', 'Mixed Residential/Commercial',
      'municipality', 'Atlanta',
      'state', 'GA',
      'parcel_id', '17 00570003024',
      'lot_acres', 3.59,
      'source', 'atlanta_gis_api'
    )
  )
WHERE id = 'e044db04-439b-4442-82df-b36a840f2fd8';

-- Create or update property record linked to this deal
INSERT INTO properties (
  address_line1,
  city,
  state_code,
  latitude,
  longitude,
  current_zoning,
  municipality_id,
  lot_size_sqft,
  analyzed_by
) VALUES (
  '1950 Piedmont Circle NE',
  'Atlanta',
  'GA',
  33.8116,
  -84.3677,
  'MRC-2-C',
  'atlanta-ga',
  156500,  -- 3.59 acres in sqft
  'admin-api-key'
)
ON CONFLICT (address_line1, city, state_code) 
DO UPDATE SET
  current_zoning = EXCLUDED.current_zoning,
  municipality_id = EXCLUDED.municipality_id,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  lot_size_sqft = EXCLUDED.lot_size_sqft;

-- Add a few more Atlanta deals
-- 1245 Flat Shoals Ave
UPDATE deals 
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{zoning}',
    '{"code": "MR-3", "municipality": "Atlanta", "state": "GA"}'::jsonb
  )
WHERE id = '4f6115a8-499f-426b-a3f0-b1c988cf8d02';

-- 680 Cherokee Ave SE
UPDATE deals 
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{zoning}',
    '{"code": "R-4", "municipality": "Atlanta", "state": "GA"}'::jsonb
  )
WHERE id = '5ef5c201-afbb-4c43-9d7b-9c160fb34d18';

-- Verify
SELECT 
  id,
  address,
  metadata->'zoning'->>'code' as zoning_code,
  metadata->'zoning'->>'municipality' as city
FROM deals
WHERE metadata->'zoning' IS NOT NULL;
