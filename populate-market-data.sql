-- ============================================================================
-- JediRe Market Data Population Script
-- Adds realistic Atlanta multifamily market inventory and trends
-- ============================================================================

-- Create market_inventory table if it doesn't exist
CREATE TABLE IF NOT EXISTS market_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city VARCHAR(100) NOT NULL,
  state_code VARCHAR(2) NOT NULL,
  property_type VARCHAR(50) NOT NULL,
  snapshot_date TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Inventory metrics
  active_listings INTEGER,
  median_price DECIMAL(12,2),
  avg_price DECIMAL(12,2),
  price_per_sqft DECIMAL(10,2),
  
  -- Time on market
  avg_days_on_market INTEGER,
  median_days_on_market INTEGER,
  
  -- Supply metrics
  absorption_rate DECIMAL(5,2), -- units per month
  months_of_supply DECIMAL(5,2),
  vacancy_rate DECIMAL(5,4), -- as decimal (0.05 = 5%)
  
  -- Additional metrics
  new_listings_30d INTEGER,
  closed_sales_30d INTEGER,
  avg_sqft INTEGER,
  avg_year_built INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT market_inventory_unique UNIQUE (city, state_code, property_type, snapshot_date)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_market_inventory_city_state 
  ON market_inventory(city, state_code);
CREATE INDEX IF NOT EXISTS idx_market_inventory_snapshot_date 
  ON market_inventory(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_market_inventory_property_type 
  ON market_inventory(property_type);

-- ============================================================================
-- ATLANTA MULTIFAMILY MARKET DATA (Past 90 days)
-- Based on realistic Q1 2026 Atlanta market conditions
-- ============================================================================

-- Delete existing Atlanta data to avoid duplicates
DELETE FROM market_inventory 
WHERE city ILIKE 'Atlanta' AND state_code = 'GA';

-- Current snapshot (today)
INSERT INTO market_inventory (
  city, state_code, property_type, snapshot_date,
  active_listings, median_price, avg_price, price_per_sqft,
  avg_days_on_market, median_days_on_market,
  absorption_rate, months_of_supply, vacancy_rate,
  new_listings_30d, closed_sales_30d, avg_sqft, avg_year_built
) VALUES 
('Atlanta', 'GA', 'multifamily', NOW(),
 342, 285000, 312000, 245,
 28, 24,
 18.5, 4.2, 0.048,
 89, 76, 1275, 2018);

-- 30 days ago
INSERT INTO market_inventory (
  city, state_code, property_type, snapshot_date,
  active_listings, median_price, avg_price, price_per_sqft,
  avg_days_on_market, median_days_on_market,
  absorption_rate, months_of_supply, vacancy_rate,
  new_listings_30d, closed_sales_30d, avg_sqft, avg_year_built
) VALUES 
('Atlanta', 'GA', 'multifamily', NOW() - INTERVAL '30 days',
 368, 278000, 305000, 242,
 32, 27,
 17.2, 4.8, 0.052,
 94, 68, 1268, 2018);

-- 60 days ago
INSERT INTO market_inventory (
  city, state_code, property_type, snapshot_date,
  active_listings, median_price, avg_price, price_per_sqft,
  avg_days_on_market, median_days_on_market,
  absorption_rate, months_of_supply, vacancy_rate,
  new_listings_30d, closed_sales_30d, avg_sqft, avg_year_built
) VALUES 
('Atlanta', 'GA', 'multifamily', NOW() - INTERVAL '60 days',
 385, 275000, 298000, 238,
 35, 30,
 16.8, 5.1, 0.055,
 88, 71, 1262, 2017);

-- 90 days ago
INSERT INTO market_inventory (
  city, state_code, property_type, snapshot_date,
  active_listings, median_price, avg_price, price_per_sqft,
  avg_days_on_market, median_days_on_market,
  absorption_rate, months_of_supply, vacancy_rate,
  new_listings_30d, closed_sales_30d, avg_sqft, avg_year_built
) VALUES 
('Atlanta', 'GA', 'multifamily', NOW() - INTERVAL '90 days',
 402, 270000, 295000, 235,
 38, 33,
 15.9, 5.5, 0.058,
 82, 65, 1255, 2017);

-- ============================================================================
-- ADDITIONAL ATLANTA NEIGHBORHOODS (Current snapshot)
-- ============================================================================

-- Midtown (premium submarket)
INSERT INTO market_inventory (
  city, state_code, property_type, snapshot_date,
  active_listings, median_price, avg_price, price_per_sqft,
  avg_days_on_market, median_days_on_market,
  absorption_rate, months_of_supply, vacancy_rate,
  new_listings_30d, closed_sales_30d, avg_sqft, avg_year_built
) VALUES 
('Atlanta', 'GA', 'multifamily', NOW(),
 87, 385000, 425000, 315,
 22, 18,
 22.5, 3.2, 0.038,
 24, 28, 1350, 2020);

-- Buckhead (luxury submarket)
INSERT INTO market_inventory (
  city, state_code, property_type, snapshot_date,
  active_listings, median_price, avg_price, price_per_sqft,
  avg_days_on_market, median_days_on_market,
  absorption_rate, months_of_supply, vacancy_rate,
  new_listings_30d, closed_sales_30d, avg_sqft, avg_year_built
) VALUES 
('Atlanta', 'GA', 'multifamily', NOW(),
 124, 475000, 520000, 365,
 19, 15,
 24.8, 2.8, 0.032,
 32, 38, 1425, 2021);

-- ============================================================================
-- OTHER PROPERTY TYPES FOR ATLANTA
-- ============================================================================

-- Retail
INSERT INTO market_inventory (
  city, state_code, property_type, snapshot_date,
  active_listings, median_price, avg_price, price_per_sqft,
  avg_days_on_market, median_days_on_market,
  absorption_rate, months_of_supply, vacancy_rate,
  new_listings_30d, closed_sales_30d, avg_sqft, avg_year_built
) VALUES 
('Atlanta', 'GA', 'retail', NOW(),
 156, 1850000, 2200000, 185,
 68, 58,
 8.2, 7.5, 0.082,
 28, 22, 11500, 2005);

-- Office
INSERT INTO market_inventory (
  city, state_code, property_type, snapshot_date,
  active_listings, median_price, avg_price, price_per_sqft,
  avg_days_on_market, median_days_on_market,
  absorption_rate, months_of_supply, vacancy_rate,
  new_listings_30d, closed_sales_30d, avg_sqft, avg_year_built
) VALUES 
('Atlanta', 'GA', 'office', NOW(),
 203, 3500000, 4200000, 225,
 95, 82,
 6.5, 9.2, 0.118,
 35, 18, 18500, 2008);

-- Industrial
INSERT INTO market_inventory (
  city, state_code, property_type, snapshot_date,
  active_listings, median_price, avg_price, price_per_sqft,
  avg_days_on_market, median_days_on_market,
  absorption_rate, months_of_supply, vacancy_rate,
  new_listings_30d, closed_sales_30d, avg_sqft, avg_year_built
) VALUES 
('Atlanta', 'GA', 'industrial', NOW(),
 89, 2800000, 3350000, 95,
 52, 45,
 12.3, 5.8, 0.045,
 19, 24, 35000, 2010);

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Uncomment to verify data was inserted:
-- SELECT city, state_code, property_type, snapshot_date, 
--        active_listings, median_price, avg_days_on_market, absorption_rate
-- FROM market_inventory
-- WHERE city = 'Atlanta' AND state_code = 'GA'
-- ORDER BY property_type, snapshot_date DESC;
