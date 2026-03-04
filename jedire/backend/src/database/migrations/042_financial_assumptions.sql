-- Migration: Create financial_assumptions table
-- Version: 001
-- Description: Store market-specific financial assumptions for pro forma calculations

-- Create the financial_assumptions table
CREATE TABLE IF NOT EXISTS financial_assumptions (
  id SERIAL PRIMARY KEY,
  market VARCHAR(100) UNIQUE NOT NULL,
  hard_cost_per_sf DECIMAL(10,2) NOT NULL,
  soft_cost_percent DECIMAL(5,4) NOT NULL,
  parking_cost_per_space DECIMAL(10,2) NOT NULL,
  land_cost_per_sf DECIMAL(10,2) NOT NULL,
  operating_expense_percent DECIMAL(5,4) NOT NULL,
  vacancy_rate DECIMAL(5,4) NOT NULL,
  cap_rate DECIMAL(5,3) NOT NULL,
  construction_interest_rate DECIMAL(5,4) NOT NULL,
  
  -- Market-specific adjustments
  studio_rent_premium DECIMAL(5,4) DEFAULT 0.70,
  one_br_rent_premium DECIMAL(5,4) DEFAULT 0.85,
  two_br_rent_premium DECIMAL(5,4) DEFAULT 1.00,
  three_br_rent_premium DECIMAL(5,4) DEFAULT 1.30,
  
  -- Additional market factors
  property_tax_rate DECIMAL(5,4) DEFAULT 0.012,
  insurance_per_unit INTEGER DEFAULT 600,
  management_fee_percent DECIMAL(5,4) DEFAULT 0.03,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100)
);

-- Create index on market for faster lookups
CREATE INDEX idx_financial_assumptions_market ON financial_assumptions(market);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_financial_assumptions_updated_at 
BEFORE UPDATE ON financial_assumptions 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Insert default market assumptions
INSERT INTO financial_assumptions (
  market, 
  hard_cost_per_sf, 
  soft_cost_percent, 
  parking_cost_per_space,
  land_cost_per_sf, 
  operating_expense_percent, 
  vacancy_rate, 
  cap_rate,
  construction_interest_rate,
  notes,
  created_by
) VALUES 
  ('Seattle', 250, 0.25, 50000, 150, 0.35, 0.05, 5.0, 0.065, 
   'High construction costs due to seismic requirements and labor market', 'system'),
  
  ('Portland', 220, 0.22, 35000, 100, 0.35, 0.06, 5.5, 0.065,
   'Moderate costs with inclusionary zoning requirements', 'system'),
  
  ('Denver', 200, 0.20, 30000, 80, 0.33, 0.07, 5.75, 0.06,
   'Growing market with moderate construction costs', 'system'),
  
  ('Phoenix', 180, 0.20, 25000, 60, 0.32, 0.08, 6.0, 0.06,
   'Lower costs but higher vacancy rates in summer', 'system'),
  
  ('Austin', 190, 0.22, 30000, 90, 0.33, 0.06, 5.5, 0.065,
   'Tech hub with rising construction costs', 'system'),
   
  ('San Francisco', 300, 0.30, 60000, 250, 0.38, 0.04, 4.5, 0.07,
   'Highest costs in the nation, strict regulations', 'system'),
   
  ('Los Angeles', 240, 0.25, 45000, 180, 0.35, 0.05, 5.25, 0.065,
   'High land costs, seismic requirements', 'system'),
   
  ('Dallas', 170, 0.18, 20000, 50, 0.32, 0.08, 6.25, 0.055,
   'Lower costs, abundant land', 'system'),
   
  ('Atlanta', 175, 0.20, 22000, 55, 0.33, 0.07, 6.0, 0.06,
   'Growing Southeast market', 'system'),
   
  ('Nashville', 185, 0.20, 25000, 70, 0.33, 0.06, 5.75, 0.06,
   'Music City growth driving costs up', 'system')
ON CONFLICT (market) DO NOTHING;

-- Create table for storing design-financial links
CREATE TABLE IF NOT EXISTS design_financial_links (
  id SERIAL PRIMARY KEY,
  design_id VARCHAR(100) NOT NULL,
  financial_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  
  -- Ensure unique relationships
  UNIQUE(design_id, financial_id)
);

CREATE INDEX idx_design_financial_design_id ON design_financial_links(design_id);
CREATE INDEX idx_design_financial_financial_id ON design_financial_links(financial_id);

-- Create view for easy access to linked models
CREATE VIEW v_design_financial_links AS
SELECT 
  dfl.*,
  'design_to_financial' as link_direction
FROM design_financial_links dfl
UNION ALL
SELECT 
  id,
  financial_id as design_id,
  design_id as financial_id,
  created_at,
  created_by,
  'financial_to_design' as link_direction
FROM design_financial_links;

-- Grant permissions (adjust as needed)
GRANT SELECT, INSERT, UPDATE ON financial_assumptions TO app_user;
GRANT SELECT, INSERT ON design_financial_links TO app_user;
GRANT SELECT ON v_design_financial_links TO app_user;