-- ============================================================================
-- JEDIRE INFLATION ENGINE
-- Migration: 20260424_inflation_engine.sql
-- 
-- Creates tables for the proprietary inflation tracking system.
-- ============================================================================

-- ============================================================================
-- PART 1: INFLATION CACHE
-- Caches external API responses (BLS, FRED) to reduce API calls
-- ============================================================================

CREATE TABLE IF NOT EXISTS inflation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What indicator (CPI, PPI, FRED, etc.)
  indicator VARCHAR(50) NOT NULL,
  
  -- Geography (national, Atlanta, Cobb County, etc.)
  geography VARCHAR(100) NOT NULL,
  
  -- The cached data as JSONB
  data JSONB NOT NULL,
  
  -- When fetched
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint for upserts
  CONSTRAINT uq_inflation_cache_indicator_geo UNIQUE (indicator, geography)
);

CREATE INDEX idx_inflation_cache_indicator ON inflation_cache(indicator);
CREATE INDEX idx_inflation_cache_geography ON inflation_cache(geography);
CREATE INDEX idx_inflation_cache_fetched ON inflation_cache(fetched_at);

-- ============================================================================
-- PART 2: JEDIRE INFLATION SNAPSHOTS
-- Historical snapshots of the JediRe Composite Inflation Score
-- ============================================================================

CREATE TABLE IF NOT EXISTS inflation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Snapshot date
  snapshot_date DATE NOT NULL,
  
  -- Geography
  geography_level VARCHAR(20) NOT NULL, -- national, regional, msa, county
  geography_name VARCHAR(100) NOT NULL,
  geography_fips VARCHAR(10),
  
  -- JediRe Composite Score (0-200, 100 = neutral)
  composite_score NUMERIC(5,2) NOT NULL,
  regime VARCHAR(30), -- deflationary, low_inflation, moderate, elevated, high_inflation
  
  -- Standard indicators
  cpi_all_items NUMERIC(5,2),
  cpi_shelter NUMERIC(5,2),
  cpi_rent_primary NUMERIC(5,2),
  ppi_construction NUMERIC(5,2),
  fed_funds_rate NUMERIC(5,2),
  treasury_10y NUMERIC(5,2),
  breakeven_10y NUMERIC(5,2),
  
  -- JediRe proprietary indices
  rent_inflation_index NUMERIC(5,2),
  operating_cost_index NUMERIC(5,2),
  construction_cost_index NUMERIC(5,2),
  insurance_inflation_index NUMERIC(5,2),
  tax_assessment_index NUMERIC(5,2),
  
  -- Underwriting guidance
  rent_growth_recommendation NUMERIC(4,2),
  expense_escalation_recommendation NUMERIC(4,2),
  cap_rate_spread_vs_treasury INTEGER, -- bps
  construction_contingency NUMERIC(4,2),
  
  -- Full context as JSONB for detailed analysis
  full_context JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT uq_inflation_snapshot_date_geo UNIQUE (snapshot_date, geography_level, geography_name)
);

CREATE INDEX idx_inflation_snapshots_date ON inflation_snapshots(snapshot_date);
CREATE INDEX idx_inflation_snapshots_geography ON inflation_snapshots(geography_name);
CREATE INDEX idx_inflation_snapshots_score ON inflation_snapshots(composite_score);

-- ============================================================================
-- PART 3: RENT INFLATION TRACKING
-- Tracks actual rent changes from our deal data for the Rent Inflation Index
-- ============================================================================

CREATE TABLE IF NOT EXISTS rent_inflation_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source deal
  deal_id UUID REFERENCES deals(id),
  property_name VARCHAR(255),
  
  -- Geography
  city VARCHAR(100),
  state VARCHAR(2),
  msa VARCHAR(100),
  county VARCHAR(100),
  
  -- Asset characteristics
  asset_class VARCHAR(10), -- A, B, C
  vintage INTEGER, -- year built
  units INTEGER,
  
  -- Rent observation
  observation_date DATE NOT NULL,
  avg_rent NUMERIC(10,2),
  rent_psf NUMERIC(8,4),
  
  -- Prior period for comparison
  prior_date DATE,
  prior_avg_rent NUMERIC(10,2),
  prior_rent_psf NUMERIC(8,4),
  
  -- Calculated change
  rent_change_pct NUMERIC(6,3),
  rent_psf_change_pct NUMERIC(6,3),
  
  -- Source
  source VARCHAR(50), -- rent_roll, market_survey, costar, apartments_com
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rent_inflation_date ON rent_inflation_observations(observation_date);
CREATE INDEX idx_rent_inflation_msa ON rent_inflation_observations(msa);
CREATE INDEX idx_rent_inflation_deal ON rent_inflation_observations(deal_id);
CREATE INDEX idx_rent_inflation_asset_class ON rent_inflation_observations(asset_class);

-- ============================================================================
-- PART 4: EXPENSE INFLATION TRACKING
-- Tracks operating expense changes for the Operating Cost Index
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_inflation_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source deal
  deal_id UUID REFERENCES deals(id),
  
  -- Geography
  city VARCHAR(100),
  state VARCHAR(2),
  msa VARCHAR(100),
  
  -- Expense category
  category VARCHAR(50) NOT NULL, -- utilities, repairs, management, insurance, taxes, etc.
  
  -- Observation
  observation_date DATE NOT NULL,
  amount NUMERIC(12,2),
  amount_per_unit NUMERIC(10,2),
  
  -- Prior period
  prior_date DATE,
  prior_amount NUMERIC(12,2),
  prior_amount_per_unit NUMERIC(10,2),
  
  -- Calculated change
  change_pct NUMERIC(6,3),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expense_inflation_date ON expense_inflation_observations(observation_date);
CREATE INDEX idx_expense_inflation_category ON expense_inflation_observations(category);
CREATE INDEX idx_expense_inflation_msa ON expense_inflation_observations(msa);

-- ============================================================================
-- PART 5: INSURANCE COST TRACKING
-- Special tracking for insurance inflation (a major pain point)
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_cost_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source deal
  deal_id UUID REFERENCES deals(id),
  property_name VARCHAR(255),
  
  -- Geography
  city VARCHAR(100),
  state VARCHAR(2),
  county VARCHAR(100),
  
  -- Property characteristics
  units INTEGER,
  year_built INTEGER,
  construction_type VARCHAR(50), -- frame, masonry, steel
  stories INTEGER,
  
  -- Insurance details
  observation_date DATE NOT NULL,
  annual_premium NUMERIC(12,2),
  premium_per_unit NUMERIC(10,2),
  coverage_type VARCHAR(50), -- property, liability, umbrella
  carrier VARCHAR(100),
  deductible NUMERIC(12,2),
  
  -- Prior period
  prior_date DATE,
  prior_premium NUMERIC(12,2),
  
  -- Change
  premium_change_pct NUMERIC(6,3),
  
  -- Risk factors
  flood_zone BOOLEAN DEFAULT FALSE,
  hurricane_zone BOOLEAN DEFAULT FALSE,
  wildfire_risk BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insurance_date ON insurance_cost_observations(observation_date);
CREATE INDEX idx_insurance_state ON insurance_cost_observations(state);
CREATE INDEX idx_insurance_deal ON insurance_cost_observations(deal_id);

-- ============================================================================
-- PART 6: TAX ASSESSMENT TRACKING
-- Tracks property tax assessment changes by county
-- ============================================================================

CREATE TABLE IF NOT EXISTS tax_assessment_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Property
  parcel_id VARCHAR(100),
  deal_id UUID REFERENCES deals(id),
  
  -- Geography
  county VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  
  -- Assessment
  assessment_year INTEGER NOT NULL,
  assessed_value NUMERIC(14,2),
  just_value NUMERIC(14,2),
  millage_rate NUMERIC(8,4),
  annual_taxes NUMERIC(12,2),
  
  -- Prior year
  prior_assessed_value NUMERIC(14,2),
  prior_just_value NUMERIC(14,2),
  prior_annual_taxes NUMERIC(12,2),
  
  -- Changes
  assessed_value_change_pct NUMERIC(6,3),
  tax_change_pct NUMERIC(6,3),
  
  -- Reassessment info
  last_sale_date DATE,
  sale_triggered_reassessment BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tax_assessment_county ON tax_assessment_observations(county, state);
CREATE INDEX idx_tax_assessment_year ON tax_assessment_observations(assessment_year);
CREATE INDEX idx_tax_assessment_deal ON tax_assessment_observations(deal_id);

-- ============================================================================
-- PART 7: INFLATION ALERTS
-- Alerts when inflation metrics hit thresholds
-- ============================================================================

CREATE TABLE IF NOT EXISTS inflation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Alert type
  alert_type VARCHAR(50) NOT NULL, -- composite_score, rent_inflation, insurance_spike, etc.
  severity VARCHAR(20) NOT NULL, -- info, warning, critical
  
  -- Geography
  geography_level VARCHAR(20),
  geography_name VARCHAR(100),
  
  -- Threshold
  metric_name VARCHAR(100),
  threshold_value NUMERIC(10,2),
  actual_value NUMERIC(10,2),
  
  -- Message
  title VARCHAR(255),
  message TEXT,
  
  -- Recommendations
  recommendations JSONB,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inflation_alerts_active ON inflation_alerts(is_active, created_at);
CREATE INDEX idx_inflation_alerts_type ON inflation_alerts(alert_type);
CREATE INDEX idx_inflation_alerts_severity ON inflation_alerts(severity);

-- ============================================================================
-- PART 8: SEED DATA FOR NATIONAL BASELINE
-- ============================================================================

-- Insert current baseline (April 2026)
INSERT INTO inflation_snapshots (
  snapshot_date,
  geography_level,
  geography_name,
  composite_score,
  regime,
  cpi_all_items,
  cpi_shelter,
  cpi_rent_primary,
  ppi_construction,
  fed_funds_rate,
  treasury_10y,
  breakeven_10y,
  rent_inflation_index,
  operating_cost_index,
  construction_cost_index,
  insurance_inflation_index,
  tax_assessment_index,
  rent_growth_recommendation,
  expense_escalation_recommendation,
  cap_rate_spread_vs_treasury,
  construction_contingency
) VALUES (
  '2026-04-24',
  'national',
  'United States',
  108, -- Slightly elevated
  'moderate',
  3.0,  -- CPI All Items YoY
  5.5,  -- CPI Shelter
  5.2,  -- CPI Rent Primary
  3.8,  -- PPI Construction
  5.33, -- Fed Funds
  4.25, -- 10Y Treasury
  2.25, -- 10Y Breakeven
  3.5,  -- Rent Inflation Index
  4.2,  -- Operating Cost Index
  4.5,  -- Construction Cost Index
  12.0, -- Insurance Inflation Index
  5.0,  -- Tax Assessment Index
  3.5,  -- Rent growth recommendation
  4.0,  -- Expense escalation recommendation
  220,  -- Cap rate spread vs Treasury (bps)
  7.5   -- Construction contingency %
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE inflation_cache IS 'Caches external API responses (BLS, FRED) to reduce API calls and costs';
COMMENT ON TABLE inflation_snapshots IS 'Historical snapshots of JediRe Composite Inflation Score and all components';
COMMENT ON TABLE rent_inflation_observations IS 'Tracks actual rent changes from platform deals for Rent Inflation Index';
COMMENT ON TABLE expense_inflation_observations IS 'Tracks operating expense changes for Operating Cost Index';
COMMENT ON TABLE insurance_cost_observations IS 'Special tracking for insurance costs - a major MF expense driver';
COMMENT ON TABLE tax_assessment_observations IS 'Tracks property tax assessment changes by county';
COMMENT ON TABLE inflation_alerts IS 'Alerts when inflation metrics hit critical thresholds';

COMMENT ON COLUMN inflation_snapshots.composite_score IS '0-200 scale, 100 = neutral (2% target), >100 = inflationary';
COMMENT ON COLUMN inflation_snapshots.regime IS 'Inflation regime: deflationary (<60), low (<85), moderate (<115), elevated (<140), high (>=140)';
