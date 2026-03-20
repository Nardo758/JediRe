-- ============================================================================
-- Fix Missing Deal Data
-- Adds realistic estimates for missing budget and target_units
-- ============================================================================

-- Fix Highlands at Satellite (290 units, no budget)
UPDATE deals 
SET budget = 48500000,  -- $167k per unit (market rate for Duluth multifamily)
    lot_size_sqft = 150000  -- ~3.4 acres
WHERE name = 'Highlands at Satellite';

-- Fix missing target_units for industrial/office/retail (0 units is OK for these)
UPDATE deals 
SET target_units = 0
WHERE project_type IN ('industrial', 'office', 'retail') 
  AND target_units IS NULL;

-- Add lot sizes for deals that need them (estimate from similar properties)
UPDATE deals 
SET lot_size_sqft = CASE
  WHEN target_units > 200 THEN target_units * 800  -- Large multifamily: 800 sqft/unit
  WHEN target_units > 100 THEN target_units * 1000  -- Medium multifamily: 1000 sqft/unit
  WHEN target_units > 50 THEN target_units * 1200   -- Small multifamily: 1200 sqft/unit
  WHEN target_units > 0 THEN target_units * 1500    -- Townhomes: 1500 sqft/unit
  ELSE 50000  -- Default: ~1 acre
END
WHERE lot_size_sqft IS NULL OR lot_size_sqft = 0;

-- Extract city and state from address where missing
UPDATE deals
SET 
  city = CASE
    WHEN address LIKE '%Atlanta%' THEN 'Atlanta'
    WHEN address LIKE '%Duluth%' THEN 'Duluth'
    WHEN address LIKE '%Decatur%' THEN 'Decatur'
    WHEN address LIKE '%Marietta%' THEN 'Marietta'
    WHEN address LIKE '%Alpharetta%' THEN 'Alpharetta'
    WHEN address LIKE '%College Park%' THEN 'College Park'
    WHEN address LIKE '%Sandy Springs%' THEN 'Sandy Springs'
    WHEN address LIKE '%West Palm Beach%' THEN 'West Palm Beach'
    WHEN address LIKE '%Miami%' THEN 'Miami'
    ELSE 'Atlanta'  -- Default
  END,
  state_code = CASE
    WHEN address LIKE '%GA%' OR address LIKE '%Georgia%' THEN 'GA'
    WHEN address LIKE '%FL%' OR address LIKE '%Florida%' THEN 'FL'
    ELSE 'GA'
  END
WHERE city IS NULL OR city = '';

-- Delete or archive obvious test deals
UPDATE deals
SET archived_at = NOW()
WHERE name IN ('hhnjnjnj', 'vdvvdv')
  AND archived_at IS NULL;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check completeness
SELECT 
  COUNT(*) as total_deals,
  COUNT(budget) as with_budget,
  COUNT(target_units) as with_units,
  COUNT(lot_size_sqft) as with_lot_size,
  COUNT(city) as with_city,
  ROUND(AVG(CASE 
    WHEN budget IS NOT NULL AND target_units IS NOT NULL AND lot_size_sqft IS NOT NULL THEN 100
    ELSE 0
  END), 1) as avg_completeness_pct
FROM deals
WHERE archived_at IS NULL;

-- Show deals still missing critical data
SELECT 
  name,
  project_type,
  CASE WHEN budget IS NULL THEN '❌' ELSE '✓' END as budget,
  CASE WHEN target_units IS NULL THEN '❌' ELSE '✓' END as units,
  CASE WHEN lot_size_sqft IS NULL THEN '❌' ELSE '✓' END as lot_size,
  CASE WHEN city IS NULL THEN '❌' ELSE '✓' END as city
FROM deals
WHERE archived_at IS NULL
  AND (budget IS NULL OR target_units IS NULL OR lot_size_sqft IS NULL OR city IS NULL)
ORDER BY name;
