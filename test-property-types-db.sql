-- Quick database test for property types system

-- Test 1: Count property types
SELECT COUNT(*) as total_property_types FROM property_types;

-- Test 2: Count strategies
SELECT COUNT(*) as total_strategies FROM property_type_strategies;

-- Test 3: Sample property type
SELECT id, name, type_key, category FROM property_types LIMIT 1;

-- Test 4: Sample strategy
SELECT pts.id, pt.name as property_type, pts.strategy_name, pts.strength, pts.hold_period_min, pts.hold_period_max
FROM property_type_strategies pts
JOIN property_types pt ON pt.id = pts.type_id
LIMIT 5;

-- Test 5: Check if custom_strategies table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'custom_strategies'
) as custom_strategies_exists;
