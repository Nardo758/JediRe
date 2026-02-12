-- Seed 5 sample deals for testing
-- These deals are in the Atlanta area with various stages

-- First, get or create a test user (using the first user if exists)
DO $$
DECLARE
  test_user_id UUID;
BEGIN
  -- Get first user or create a test user
  SELECT id INTO test_user_id FROM users LIMIT 1;
  
  IF test_user_id IS NULL THEN
    INSERT INTO users (email, tier) 
    VALUES ('test@jedire.com', 'pro')
    RETURNING id INTO test_user_id;
  END IF;

  -- Insert 5 sample deals
  INSERT INTO deals (
    user_id,
    name,
    boundary,
    project_type,
    status,
    tier,
    budget,
    target_units,
    project_intent
  ) VALUES
  -- Deal 1: Watching stage
  (
    test_user_id,
    'Midtown Mixed-Use Development',
    ST_GeomFromText('POLYGON((-84.385 33.785, -84.380 33.785, -84.380 33.780, -84.385 33.780, -84.385 33.785))', 4326),
    'mixed_use',
    'lead',
    'pro',
    5500000,
    85,
    'High-potential mixed-use project in prime Midtown location'
  ),
  -- Deal 2: Watching stage
  (
    test_user_id,
    'Buckhead Luxury Apartments',
    ST_GeomFromText('POLYGON((-84.388 33.850, -84.383 33.850, -84.383 33.845, -84.388 33.845, -84.388 33.850))', 4326),
    'multifamily',
    'lead',
    'enterprise',
    8200000,
    120,
    'Luxury residential development targeting high-income professionals'
  ),
  -- Deal 3: Analyzing stage
  (
    test_user_id,
    'Downtown Office Conversion',
    ST_GeomFromText('POLYGON((-84.390 33.755, -84.385 33.755, -84.385 33.750, -84.390 33.750, -84.390 33.755))', 4326),
    'office',
    'qualified',
    'pro',
    3800000,
    45,
    'Converting old office building to modern workspace'
  ),
  -- Deal 4: Due Diligence stage
  (
    test_user_id,
    'Inman Park Multifamily',
    ST_GeomFromText('POLYGON((-84.350 33.760, -84.345 33.760, -84.345 33.755, -84.350 33.755, -84.350 33.760))', 4326),
    'multifamily',
    'due_diligence',
    'basic',
    2950000,
    38,
    'Affordable housing project in growing neighborhood'
  ),
  -- Deal 5: Under Contract stage
  (
    test_user_id,
    'Westside Retail Center',
    ST_GeomFromText('POLYGON((-84.410 33.770, -84.405 33.770, -84.405 33.765, -84.410 33.765, -84.410 33.770))', 4326),
    'retail',
    'under_contract',
    'enterprise',
    6750000,
    NULL,
    'Modern retail center with anchor tenant secured'
  );
  
END $$;
