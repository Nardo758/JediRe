-- Part 3: Create Sample Deal with Three-Layer Capsule Structure

-- First, get or create a test user
INSERT INTO users (email, full_name, role, subscription_tier, enabled_modules)
VALUES (
  'test-capsule@jedire.com',
  'Capsule Test User',
  'user',
  'pro',
  ARRAY['financial', 'supply', 'demand', 'traffic']
)
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
RETURNING id;

-- Store the user ID (you'll need to capture this from the output)
-- For now, let's assume user_id = 1 or use a known test user ID

-- Create a sample deal capsule with three-layer data
INSERT INTO deal_capsules (
  user_id,
  property_address,
  deal_data,
  platform_intel,
  user_adjustments,
  asset_class,
  status
) VALUES (
  1,  -- Replace with actual user ID if different
  '3500 Peachtree Rd NE, Atlanta, GA 30326',
  '{
    "broker_rent": 2200,
    "broker_noi": 2700000,
    "broker_cap": 6.0,
    "asking_price": 45000000,
    "units": 280,
    "year_built": 2018,
    "occupancy": 94.5,
    "avg_rent_1br": 1850,
    "avg_rent_2br": 2450,
    "parking_ratio": 1.2
  }'::jsonb,
  '{
    "market_rent_1br": 1825,
    "market_rent_2br": 2400,
    "submarket_vacancy": 5.8,
    "supply_risk_score": 42,
    "nearby_developments": 3,
    "units_under_construction": 1200,
    "employment_growth": 3.2
  }'::jsonb,
  '{
    "adjusted_rent_1br": 1800,
    "adjusted_rent_2br": 2400,
    "adjusted_occupancy": 95,
    "preferred_hold_period": 7,
    "target_irr": 18,
    "max_ltv": 70,
    "exit_cap_assumption": 6.5
  }'::jsonb,
  'Multifamily',
  'DISCOVER'
) RETURNING id, property_address, created_at;

-- Note: Capture the returned capsule ID for endpoint testing

