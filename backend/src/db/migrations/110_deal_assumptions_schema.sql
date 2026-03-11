-- Migration: 110_deal_assumptions_schema.sql
-- Purpose: Add missing fields for complete deal underwriting
-- Date: 2026-03-10

-- ============================================
-- 1. SITE DATA (Municipal API source)
-- ============================================

-- Add to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS lot_size_acres NUMERIC(10, 4),
ADD COLUMN IF NOT EXISTS lot_size_sqft NUMERIC(14, 2),
ADD COLUMN IF NOT EXISTS parcel_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS zoning_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS zoning_description TEXT,
ADD COLUMN IF NOT EXISTS max_far NUMERIC(4, 2),
ADD COLUMN IF NOT EXISTS max_stories INTEGER,
ADD COLUMN IF NOT EXISTS max_height_ft INTEGER,
ADD COLUMN IF NOT EXISTS max_density_upa NUMERIC(6, 2),  -- units per acre
ADD COLUMN IF NOT EXISTS max_units INTEGER,
ADD COLUMN IF NOT EXISTS parking_required NUMERIC(6, 2),  -- spaces per unit
ADD COLUMN IF NOT EXISTS parking_spaces INTEGER,
ADD COLUMN IF NOT EXISTS front_setback_ft NUMERIC(6, 2),
ADD COLUMN IF NOT EXISTS side_setback_ft NUMERIC(6, 2),
ADD COLUMN IF NOT EXISTS rear_setback_ft NUMERIC(6, 2),
ADD COLUMN IF NOT EXISTS max_lot_coverage NUMERIC(5, 2),  -- percentage
ADD COLUMN IF NOT EXISTS buildable_area_sqft NUMERIC(14, 2),
ADD COLUMN IF NOT EXISTS municipality VARCHAR(100),
ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(100),
ADD COLUMN IF NOT EXISTS zoning_source VARCHAR(50) DEFAULT 'manual',  -- manual, municipal_api, county_gis
ADD COLUMN IF NOT EXISTS zoning_confidence INTEGER DEFAULT 0,  -- 0-100
ADD COLUMN IF NOT EXISTS zoning_updated_at TIMESTAMP;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_properties_zoning_code ON properties(zoning_code);
CREATE INDEX IF NOT EXISTS idx_properties_parcel_id ON properties(parcel_id);

COMMENT ON COLUMN properties.zoning_source IS 'Source of zoning data: manual, municipal_api, county_gis';
COMMENT ON COLUMN properties.zoning_confidence IS 'Confidence score 0-100 for auto-populated data';

-- ============================================
-- 2. DEVELOPMENT ASSUMPTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS deal_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Land & Acquisition
  land_cost NUMERIC(14, 2),
  land_cost_per_acre NUMERIC(14, 2),
  acquisition_costs NUMERIC(14, 2),  -- closing costs, legal, etc.
  
  -- Construction Costs
  hard_cost_psf NUMERIC(8, 2),
  hard_cost_total NUMERIC(14, 2),
  soft_cost_pct NUMERIC(5, 2) DEFAULT 25.00,
  soft_cost_total NUMERIC(14, 2),
  contingency_pct NUMERIC(5, 2) DEFAULT 5.00,
  contingency_total NUMERIC(14, 2),
  developer_fee_pct NUMERIC(5, 2) DEFAULT 4.00,
  developer_fee_total NUMERIC(14, 2),
  
  -- Total Development Cost
  tdc NUMERIC(14, 2),
  tdc_per_unit NUMERIC(10, 2),
  tdc_per_sf NUMERIC(8, 2),
  
  -- Building Design
  total_units INTEGER,
  avg_unit_sf NUMERIC(8, 2) DEFAULT 900,
  gross_sf NUMERIC(14, 2),
  rentable_sf NUMERIC(14, 2),
  efficiency NUMERIC(5, 4) DEFAULT 0.8500,
  stories INTEGER,
  construction_type VARCHAR(50),  -- wood_frame, podium, concrete, steel
  parking_type VARCHAR(50),  -- surface, tuck_under, structured, none
  
  -- Unit Mix (JSON for flexibility)
  unit_mix JSONB DEFAULT '{}',
  -- Example: {"studio": {"count": 30, "sf": 550, "rent": 1600}, "1br": {"count": 120, "sf": 750, "rent": 1900}, ...}
  
  -- Revenue Assumptions
  avg_rent_per_unit NUMERIC(10, 2),
  avg_rent_psf NUMERIC(6, 2),
  other_income_per_unit NUMERIC(8, 2) DEFAULT 50,
  vacancy_pct NUMERIC(5, 2) DEFAULT 5.00,
  concessions_pct NUMERIC(5, 2) DEFAULT 0.00,
  rent_growth_yr1 NUMERIC(5, 2) DEFAULT 3.00,
  rent_growth_stabilized NUMERIC(5, 2) DEFAULT 2.50,
  
  -- Operating Expenses
  opex_ratio NUMERIC(5, 2) DEFAULT 35.00,  -- as % of EGI
  opex_per_unit NUMERIC(10, 2),
  property_tax_rate NUMERIC(6, 4),  -- as decimal
  insurance_per_unit NUMERIC(8, 2),
  management_fee_pct NUMERIC(5, 2) DEFAULT 3.00,
  replacement_reserves_per_unit NUMERIC(8, 2) DEFAULT 250,
  
  -- Financing
  interest_rate NUMERIC(6, 4),  -- as decimal (0.0750 = 7.5%)
  loan_term_years INTEGER DEFAULT 3,
  ltc NUMERIC(5, 4) DEFAULT 0.6500,  -- loan to cost
  ltv NUMERIC(5, 4),  -- loan to value
  debt_yield_min NUMERIC(5, 4),
  dscr_min NUMERIC(5, 2) DEFAULT 1.25,
  amortization_years INTEGER DEFAULT 30,
  io_period_months INTEGER DEFAULT 36,
  origination_fee_pct NUMERIC(5, 2) DEFAULT 1.00,
  
  -- Exit Assumptions
  exit_cap NUMERIC(6, 4) DEFAULT 0.0500,
  hold_period_years INTEGER DEFAULT 5,
  disposition_cost_pct NUMERIC(5, 2) DEFAULT 2.00,
  
  -- Computed Returns (stored for quick access)
  noi_stabilized NUMERIC(14, 2),
  yield_on_cost NUMERIC(6, 4),
  cash_on_cash_yr1 NUMERIC(6, 4),
  irr_levered NUMERIC(6, 4),
  irr_unlevered NUMERIC(6, 4),
  equity_multiple NUMERIC(6, 2),
  profit_margin NUMERIC(6, 4),
  stabilized_value NUMERIC(14, 2),
  
  -- Source tracking
  assumptions_source VARCHAR(50) DEFAULT 'manual',  -- manual, market_comps, template
  last_computed_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_deal_assumptions UNIQUE(deal_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_assumptions_deal_id ON deal_assumptions(deal_id);

COMMENT ON TABLE deal_assumptions IS 'Central table for all deal underwriting assumptions';

-- ============================================
-- 3. MARKET DATA (from Market Intelligence)
-- ============================================

CREATE TABLE IF NOT EXISTS deal_market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Submarket Info
  submarket_name VARCHAR(100),
  submarket_id VARCHAR(50),
  msa VARCHAR(100),
  
  -- Rent Comps
  comp_avg_rent NUMERIC(10, 2),
  comp_avg_rent_psf NUMERIC(6, 2),
  comp_count INTEGER,
  rent_percentile INTEGER,  -- where subject sits vs comps (1-100)
  
  -- By Unit Type (JSON)
  rent_by_type JSONB DEFAULT '{}',
  -- Example: {"studio": {"avg_rent": 1550, "avg_sf": 540, "sample_size": 8}, ...}
  
  -- Occupancy
  submarket_occupancy NUMERIC(5, 2),
  comp_avg_occupancy NUMERIC(5, 2),
  
  -- Supply Pipeline
  pipeline_units INTEGER,
  pipeline_deliveries_12mo INTEGER,
  pipeline_deliveries_24mo INTEGER,
  
  -- Demand
  absorption_12mo INTEGER,
  demand_score INTEGER,  -- 1-100
  
  -- Growth
  rent_growth_trailing_12mo NUMERIC(5, 2),
  rent_growth_forecast_12mo NUMERIC(5, 2),
  
  -- Demographics
  median_hh_income NUMERIC(12, 2),
  population_1mi INTEGER,
  population_3mi INTEGER,
  population_growth_5yr NUMERIC(5, 2),
  
  -- Source tracking
  data_source VARCHAR(50),  -- costar, yardi, apartments_com, manual
  data_as_of DATE,
  confidence INTEGER DEFAULT 0,  -- 0-100
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_deal_market_data UNIQUE(deal_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_market_data_deal_id ON deal_market_data(deal_id);

-- ============================================
-- 4. UPDATE DEALS TABLE
-- ============================================

-- Add missing fields to deals table
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS development_type VARCHAR(30),  -- acquisition, ground_up, redevelopment
ADD COLUMN IF NOT EXISTS land_cost NUMERIC(14, 2),
ADD COLUMN IF NOT EXISTS hold_period_years INTEGER,
ADD COLUMN IF NOT EXISTS target_irr NUMERIC(5, 2),
ADD COLUMN IF NOT EXISTS target_equity_multiple NUMERIC(4, 2),
ADD COLUMN IF NOT EXISTS target_yoc NUMERIC(5, 2);

-- ============================================
-- 5. TRIGGER TO AUTO-UPDATE timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_deal_assumptions_updated_at ON deal_assumptions;
CREATE TRIGGER update_deal_assumptions_updated_at
    BEFORE UPDATE ON deal_assumptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deal_market_data_updated_at ON deal_market_data;
CREATE TRIGGER update_deal_market_data_updated_at
    BEFORE UPDATE ON deal_market_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. HELPFUL VIEWS
-- ============================================

CREATE OR REPLACE VIEW v_deal_summary AS
SELECT 
  d.id,
  d.name,
  d.development_type,
  d.target_units,
  d.budget,
  
  -- Site
  p.lot_size_acres,
  p.zoning_code,
  p.max_units AS zoning_max_units,
  
  -- Assumptions
  a.land_cost,
  a.tdc,
  a.tdc_per_unit,
  a.avg_rent_per_unit,
  a.exit_cap,
  
  -- Returns
  a.yield_on_cost,
  a.irr_levered,
  a.equity_multiple,
  
  -- Market
  m.submarket_name,
  m.comp_avg_rent,
  m.submarket_occupancy
  
FROM deals d
LEFT JOIN properties p ON p.deal_id = d.id
LEFT JOIN deal_assumptions a ON a.deal_id = d.id
LEFT JOIN deal_market_data m ON m.deal_id = d.id;

COMMENT ON VIEW v_deal_summary IS 'Combined view of deal with site, assumptions, and market data';

-- ============================================
-- Done
-- ============================================
