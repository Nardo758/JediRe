-- ═════════════════════════════════════════════════════════════
-- Migration 024: Property Records & Comparable Sales System
-- Created: 2026-02-15
-- Purpose: Municipal property scraper data storage
-- ═════════════════════════════════════════════════════════════

-- Enable PostGIS extension for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- ═════════════════════════════════════════════════════════════
-- TABLE: property_records
-- Purpose: Master table for all property data from county assessors
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS property_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifiers
  parcel_id VARCHAR(100) NOT NULL,
  county VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  
  -- Address (normalized)
  address TEXT NOT NULL,
  city VARCHAR(100),
  zip VARCHAR(10),
  geom GEOMETRY(POINT, 4326), -- PostGIS spatial point
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  
  -- Property Details
  property_type VARCHAR(50), -- 'Multifamily', 'Office', 'Retail', 'Industrial', 'Land', 'Mixed-Use'
  year_built INT,
  building_sqft NUMERIC,
  lot_size_sqft NUMERIC,
  lot_size_acres NUMERIC,
  stories INT,
  units INT, -- For multifamily
  bedrooms INT, -- Total across all units
  bathrooms NUMERIC, -- Total across all units
  zoning VARCHAR(50),
  
  -- Classification
  property_class VARCHAR(10), -- 'A', 'B', 'C', 'D' for multifamily
  
  -- Assessment
  land_assessed_value NUMERIC,
  improvement_assessed_value NUMERIC,
  total_assessed_value NUMERIC,
  market_value_estimate NUMERIC,
  assessment_year INT,
  assessment_ratio NUMERIC, -- assessed / market value
  
  -- Taxes
  annual_taxes NUMERIC,
  tax_rate NUMERIC, -- Percentage (e.g., 1.08 for 1.08%)
  county_taxes NUMERIC,
  city_taxes NUMERIC,
  school_taxes NUMERIC,
  special_assessments NUMERIC,
  
  -- Tax burden analysis
  taxes_per_unit NUMERIC,
  taxes_per_sqft NUMERIC,
  
  -- Ownership
  owner_name TEXT,
  owner_type VARCHAR(50), -- 'Individual', 'LLC', 'Corporation', 'REIT', 'Trust', 'Partnership'
  owner_address TEXT,
  owner_city VARCHAR(100),
  owner_state VARCHAR(2),
  owner_zip VARCHAR(10),
  is_out_of_state BOOLEAN DEFAULT FALSE,
  
  -- Current ownership timeline
  ownership_start_date DATE,
  ownership_duration_years NUMERIC,
  
  -- Legal
  legal_description TEXT,
  subdivision VARCHAR(200),
  
  -- Physical characteristics
  parking_spaces INT,
  parking_ratio NUMERIC, -- spaces per unit
  amenities TEXT[], -- Array of amenities
  
  -- Condition
  condition VARCHAR(50), -- 'Excellent', 'Good', 'Fair', 'Poor'
  renovation_year INT,
  
  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  scraper_version VARCHAR(20),
  data_source_url TEXT,
  data_quality_score NUMERIC CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
  
  -- Indexes
  UNIQUE(parcel_id, county, state),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_property_records_geom ON property_records USING GIST(geom);
CREATE INDEX idx_property_records_address ON property_records(address);
CREATE INDEX idx_property_records_city ON property_records(city);
CREATE INDEX idx_property_records_county_state ON property_records(county, state);
CREATE INDEX idx_property_records_owner ON property_records(owner_name);
CREATE INDEX idx_property_records_type ON property_records(property_type);
CREATE INDEX idx_property_records_units ON property_records(units) WHERE units IS NOT NULL;
CREATE INDEX idx_property_records_assessment ON property_records(total_assessed_value) WHERE total_assessed_value IS NOT NULL;
CREATE INDEX idx_property_records_scraped ON property_records(scraped_at DESC);

-- Comment
COMMENT ON TABLE property_records IS 'Master table for property data scraped from county assessor websites';


-- ═════════════════════════════════════════════════════════════
-- TABLE: property_sales
-- Purpose: Transaction history for all properties
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS property_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_record_id UUID REFERENCES property_records(id) ON DELETE CASCADE,
  
  -- Transaction
  sale_date DATE NOT NULL,
  sale_price NUMERIC NOT NULL,
  
  -- Parties
  seller_name TEXT,
  buyer_name TEXT,
  buyer_type VARCHAR(50), -- 'Individual', 'LLC', 'Institutional', 'REIT', etc.
  buyer_address TEXT,
  buyer_city VARCHAR(100),
  buyer_state VARCHAR(2),
  buyer_zip VARCHAR(10),
  
  -- Transaction details
  sale_type VARCHAR(50), -- 'Arms Length', 'Foreclosure', 'Auction', 'REO', 'Family Transfer', 'Corporate Transfer'
  financing_type VARCHAR(50), -- 'Cash', 'Conventional', 'Commercial', 'Seller Financing'
  deed_book VARCHAR(50),
  deed_page VARCHAR(50),
  recording_date DATE,
  
  -- Calculated metrics
  price_per_unit NUMERIC,
  price_per_sqft NUMERIC,
  cap_rate_estimate NUMERIC,
  
  -- Hold period (for previous owner)
  previous_purchase_date DATE,
  previous_purchase_price NUMERIC,
  hold_period_years NUMERIC,
  appreciation_amount NUMERIC,
  appreciation_pct NUMERIC,
  annual_appreciation_pct NUMERIC,
  
  -- Property condition at sale
  units_at_sale INT,
  sqft_at_sale NUMERIC,
  occupancy_at_sale NUMERIC,
  
  -- Market context
  market_conditions TEXT, -- 'Strong seller market', 'Balanced', 'Buyer market'
  days_on_market INT,
  
  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW(),
  data_source_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_property_sales_property ON property_sales(property_record_id);
CREATE INDEX idx_property_sales_date ON property_sales(sale_date DESC);
CREATE INDEX idx_property_sales_price ON property_sales(sale_price);
CREATE INDEX idx_property_sales_buyer ON property_sales(buyer_name);
CREATE INDEX idx_property_sales_type ON property_sales(sale_type);
CREATE INDEX idx_property_sales_price_per_unit ON property_sales(price_per_unit) WHERE price_per_unit IS NOT NULL;

COMMENT ON TABLE property_sales IS 'Transaction history scraped from property records';


-- ═════════════════════════════════════════════════════════════
-- TABLE: property_tax_history
-- Purpose: Annual tax assessment and payment history
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS property_tax_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_record_id UUID REFERENCES property_records(id) ON DELETE CASCADE,
  
  -- Tax year
  tax_year INT NOT NULL,
  
  -- Assessment
  assessed_value NUMERIC,
  land_value NUMERIC,
  improvement_value NUMERIC,
  
  -- Taxes
  taxes_billed NUMERIC,
  taxes_paid NUMERIC,
  tax_rate NUMERIC,
  
  -- Breakdown by jurisdiction
  county_taxes NUMERIC,
  city_taxes NUMERIC,
  school_taxes NUMERIC,
  special_assessments NUMERIC,
  
  -- Payment status
  payment_status VARCHAR(50), -- 'Paid', 'Delinquent', 'Partial', 'Appealed', 'Exempt'
  payment_date DATE,
  delinquent_amount NUMERIC,
  
  -- Changes from prior year
  assessed_value_change_pct NUMERIC,
  taxes_change_pct NUMERIC,
  
  -- Appeals
  appealed BOOLEAN DEFAULT FALSE,
  appeal_result VARCHAR(50), -- 'Granted', 'Denied', 'Partial', 'Pending'
  appeal_savings NUMERIC,
  
  -- Exemptions
  homestead_exemption BOOLEAN DEFAULT FALSE,
  senior_exemption BOOLEAN DEFAULT FALSE,
  veteran_exemption BOOLEAN DEFAULT FALSE,
  other_exemptions TEXT,
  
  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(property_record_id, tax_year)
);

-- Indexes
CREATE INDEX idx_property_tax_history_property ON property_tax_history(property_record_id);
CREATE INDEX idx_property_tax_history_year ON property_tax_history(tax_year DESC);
CREATE INDEX idx_property_tax_history_status ON property_tax_history(payment_status);

COMMENT ON TABLE property_tax_history IS 'Annual tax assessment and payment history';


-- ═════════════════════════════════════════════════════════════
-- TABLE: property_permits
-- Purpose: Building permits, renovations, violations
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS property_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_record_id UUID REFERENCES property_records(id) ON DELETE CASCADE,
  
  -- Permit details
  permit_number VARCHAR(100),
  permit_type VARCHAR(100), -- 'Building', 'Electrical', 'Plumbing', 'Mechanical', 'Demolition', 'Fire', 'Zoning'
  permit_subtype VARCHAR(100), -- 'New Construction', 'Addition', 'Renovation', 'Repair', 'Change of Use'
  permit_description TEXT,
  work_description TEXT,
  
  -- Dates
  application_date DATE,
  issued_date DATE,
  started_date DATE,
  completed_date DATE,
  expires_date DATE,
  
  -- Valuation
  estimated_cost NUMERIC,
  permit_fee NUMERIC,
  
  -- Status
  status VARCHAR(50), -- 'Applied', 'Issued', 'In Progress', 'Completed', 'Expired', 'Revoked', 'Cancelled'
  
  -- Parties
  contractor_name TEXT,
  contractor_license VARCHAR(100),
  contractor_phone VARCHAR(20),
  architect_name TEXT,
  engineer_name TEXT,
  
  -- Construction details
  square_footage NUMERIC,
  stories_added INT,
  units_added INT,
  
  -- Inspections
  inspections_required INT,
  inspections_completed INT,
  final_inspection_date DATE,
  final_inspection_passed BOOLEAN,
  
  -- Violations (if permit-related)
  violations TEXT[],
  fines_assessed NUMERIC,
  
  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW(),
  data_source_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_property_permits_property ON property_permits(property_record_id);
CREATE INDEX idx_property_permits_date ON property_permits(issued_date DESC);
CREATE INDEX idx_property_permits_type ON property_permits(permit_type);
CREATE INDEX idx_property_permits_status ON property_permits(status);
CREATE INDEX idx_property_permits_contractor ON property_permits(contractor_name);

COMMENT ON TABLE property_permits IS 'Building permits and construction history';


-- ═════════════════════════════════════════════════════════════
-- TABLE: scraper_runs
-- Purpose: Track scraping performance and errors
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scraper_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Run details
  county VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  scraper_version VARCHAR(20),
  run_type VARCHAR(50), -- 'Manual', 'Scheduled', 'Batch', 'Individual'
  
  -- Timestamps
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  duration_seconds INT,
  
  -- Scope
  properties_attempted INT DEFAULT 0,
  properties_successful INT DEFAULT 0,
  properties_failed INT DEFAULT 0,
  properties_skipped INT DEFAULT 0, -- Already up-to-date
  
  -- Results
  success_rate NUMERIC,
  
  -- Data collected
  new_properties INT DEFAULT 0,
  updated_properties INT DEFAULT 0,
  sales_collected INT DEFAULT 0,
  permits_collected INT DEFAULT 0,
  
  -- Errors
  error_count INT DEFAULT 0,
  error_details JSONB, -- Array of error objects
  
  -- Performance
  avg_time_per_property_ms INT,
  rate_limit_hits INT DEFAULT 0,
  retries INT DEFAULT 0,
  
  -- Quality
  data_quality_avg NUMERIC,
  incomplete_records INT DEFAULT 0,
  
  -- Metadata
  trigger_source VARCHAR(100), -- 'Cron', 'API', 'User', 'System'
  triggered_by VARCHAR(100), -- User ID or system name
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scraper_runs_county ON scraper_runs(county, state);
CREATE INDEX idx_scraper_runs_date ON scraper_runs(started_at DESC);
CREATE INDEX idx_scraper_runs_type ON scraper_runs(run_type);
CREATE INDEX idx_scraper_runs_success ON scraper_runs(success_rate);

COMMENT ON TABLE scraper_runs IS 'Scraper performance tracking and error logging';


-- ═════════════════════════════════════════════════════════════
-- VIEWS: Helpful queries
-- ═════════════════════════════════════════════════════════════

-- Recent sales with property details
CREATE OR REPLACE VIEW recent_property_sales AS
SELECT 
  ps.id,
  ps.sale_date,
  ps.sale_price,
  ps.price_per_unit,
  ps.buyer_name,
  ps.sale_type,
  pr.parcel_id,
  pr.address,
  pr.city,
  pr.county,
  pr.state,
  pr.property_type,
  pr.units,
  pr.building_sqft,
  pr.year_built,
  pr.latitude,
  pr.longitude
FROM property_sales ps
JOIN property_records pr ON ps.property_record_id = pr.id
WHERE ps.sale_date >= CURRENT_DATE - INTERVAL '24 months'
ORDER BY ps.sale_date DESC;

COMMENT ON VIEW recent_property_sales IS 'Properties sold in the last 24 months with full details';


-- Properties with high tax burden
CREATE OR REPLACE VIEW high_tax_properties AS
SELECT 
  pr.id,
  pr.parcel_id,
  pr.address,
  pr.city,
  pr.county,
  pr.state,
  pr.property_type,
  pr.units,
  pr.annual_taxes,
  pr.taxes_per_unit,
  pr.total_assessed_value,
  pr.owner_name,
  (pr.taxes_per_unit - submarket_avg.avg_tax_per_unit) AS tax_premium_per_unit,
  ((pr.taxes_per_unit - submarket_avg.avg_tax_per_unit) / submarket_avg.avg_tax_per_unit * 100) AS tax_premium_pct
FROM property_records pr
JOIN (
  SELECT 
    city,
    county,
    state,
    property_type,
    AVG(taxes_per_unit) AS avg_tax_per_unit
  FROM property_records
  WHERE taxes_per_unit IS NOT NULL AND units > 0
  GROUP BY city, county, state, property_type
) submarket_avg 
  ON pr.city = submarket_avg.city 
  AND pr.county = submarket_avg.county 
  AND pr.state = submarket_avg.state
  AND pr.property_type = submarket_avg.property_type
WHERE pr.taxes_per_unit > submarket_avg.avg_tax_per_unit * 1.2 -- 20% above average
ORDER BY tax_premium_pct DESC;

COMMENT ON VIEW high_tax_properties IS 'Properties with tax burden >20% above submarket average';


-- Scraper performance summary
CREATE OR REPLACE VIEW scraper_performance AS
SELECT 
  county,
  state,
  COUNT(*) AS total_runs,
  AVG(success_rate) AS avg_success_rate,
  SUM(properties_successful) AS total_properties_scraped,
  AVG(avg_time_per_property_ms) AS avg_time_ms,
  MAX(started_at) AS last_run,
  AVG(duration_seconds) AS avg_duration_seconds
FROM scraper_runs
WHERE started_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY county, state
ORDER BY total_properties_scraped DESC;

COMMENT ON VIEW scraper_performance IS 'Scraper performance metrics by county (last 30 days)';


-- ═════════════════════════════════════════════════════════════
-- FUNCTIONS: Utility functions
-- ═════════════════════════════════════════════════════════════

-- Function: Get comparable sales within radius
CREATE OR REPLACE FUNCTION get_comparable_sales(
  target_lat NUMERIC,
  target_lng NUMERIC,
  radius_miles NUMERIC DEFAULT 3,
  months_back INT DEFAULT 12,
  property_type_filter VARCHAR DEFAULT NULL,
  min_units INT DEFAULT NULL,
  max_units INT DEFAULT NULL
)
RETURNS TABLE (
  property_record_id UUID,
  sale_id UUID,
  address TEXT,
  sale_date DATE,
  sale_price NUMERIC,
  price_per_unit NUMERIC,
  units INT,
  distance_miles NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id AS property_record_id,
    ps.id AS sale_id,
    pr.address,
    ps.sale_date,
    ps.sale_price,
    ps.price_per_unit,
    pr.units,
    ST_Distance(
      pr.geom::geography,
      ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
    ) / 1609.34 AS distance_miles
  FROM property_records pr
  JOIN property_sales ps ON pr.id = ps.property_record_id
  WHERE 
    pr.geom IS NOT NULL
    AND ST_DWithin(
      pr.geom::geography,
      ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
      radius_miles * 1609.34
    )
    AND ps.sale_date >= CURRENT_DATE - (months_back || ' months')::INTERVAL
    AND (property_type_filter IS NULL OR pr.property_type = property_type_filter)
    AND (min_units IS NULL OR pr.units >= min_units)
    AND (max_units IS NULL OR pr.units <= max_units)
  ORDER BY distance_miles ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_comparable_sales IS 'Find comparable sales within radius of target coordinates';


-- Function: Calculate tax burden vs market
CREATE OR REPLACE FUNCTION calculate_tax_burden(
  target_property_id UUID
)
RETURNS TABLE (
  subject_tax_per_unit NUMERIC,
  market_avg_tax_per_unit NUMERIC,
  market_median_tax_per_unit NUMERIC,
  difference_from_avg NUMERIC,
  difference_pct NUMERIC,
  percentile NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH subject AS (
    SELECT 
      pr.taxes_per_unit,
      pr.city,
      pr.county,
      pr.state,
      pr.property_type
    FROM property_records pr
    WHERE pr.id = target_property_id
  ),
  market AS (
    SELECT 
      AVG(pr.taxes_per_unit) AS avg_tax,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pr.taxes_per_unit) AS median_tax
    FROM property_records pr, subject s
    WHERE 
      pr.city = s.city
      AND pr.county = s.county
      AND pr.state = s.state
      AND pr.property_type = s.property_type
      AND pr.taxes_per_unit IS NOT NULL
      AND pr.units > 0
  ),
  percentile_calc AS (
    SELECT 
      PERCENT_RANK() OVER (ORDER BY pr.taxes_per_unit) AS pct_rank
    FROM property_records pr, subject s
    WHERE 
      pr.city = s.city
      AND pr.county = s.county
      AND pr.state = s.state
      AND pr.property_type = s.property_type
      AND pr.taxes_per_unit IS NOT NULL
      AND pr.taxes_per_unit <= s.taxes_per_unit
    ORDER BY pr.taxes_per_unit DESC
    LIMIT 1
  )
  SELECT 
    s.taxes_per_unit,
    m.avg_tax,
    m.median_tax,
    s.taxes_per_unit - m.avg_tax AS difference,
    ((s.taxes_per_unit - m.avg_tax) / m.avg_tax * 100) AS difference_pct,
    p.pct_rank * 100 AS percentile
  FROM subject s, market m, percentile_calc p;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_tax_burden IS 'Calculate property tax burden relative to market';


-- ═════════════════════════════════════════════════════════════
-- TRIGGERS: Auto-update timestamps
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_property_records_updated_at
  BEFORE UPDATE ON property_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ═════════════════════════════════════════════════════════════
-- SAMPLE DATA: Seed for testing (optional)
-- ═════════════════════════════════════════════════════════════

-- Uncomment to seed sample data for testing
/*
INSERT INTO property_records (
  parcel_id, county, state, address, city, zip,
  latitude, longitude,
  property_type, year_built, building_sqft, units,
  total_assessed_value, annual_taxes, taxes_per_unit,
  owner_name, owner_type
) VALUES 
(
  '14-0089-0001-067-3',
  'Fulton',
  'GA',
  '3500 Peachtree Road NE',
  'Atlanta',
  '30326',
  33.8490,
  -84.3880,
  'Multifamily',
  2010,
  196000,
  171,
  45200000,
  486720,
  2846,
  'ABC Properties LLC',
  'LLC'
);
*/

-- ═════════════════════════════════════════════════════════════
-- Migration complete
-- ═════════════════════════════════════════════════════════════

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 024: Property Records Schema - COMPLETE';
  RAISE NOTICE 'Tables created: 5 (property_records, property_sales, property_tax_history, property_permits, scraper_runs)';
  RAISE NOTICE 'Views created: 3 (recent_property_sales, high_tax_properties, scraper_performance)';
  RAISE NOTICE 'Functions created: 2 (get_comparable_sales, calculate_tax_burden)';
  RAISE NOTICE 'Ready for municipal scraper integration';
END $$;
