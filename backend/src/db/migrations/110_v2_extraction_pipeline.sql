CREATE TABLE IF NOT EXISTS deal_assumptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  land_cost NUMERIC(14,2),
  land_cost_per_acre NUMERIC(14,2),
  acquisition_costs NUMERIC(14,2),
  hard_cost_psf NUMERIC(8,2),
  hard_cost_total NUMERIC(14,2),
  soft_cost_pct NUMERIC(5,2) DEFAULT 25.00,
  soft_cost_total NUMERIC(14,2),
  contingency_pct NUMERIC(5,2) DEFAULT 5.00,
  contingency_total NUMERIC(14,2),
  developer_fee_pct NUMERIC(5,2) DEFAULT 4.00,
  developer_fee_total NUMERIC(14,2),
  tdc NUMERIC(14,2),
  tdc_per_unit NUMERIC(10,2),
  tdc_per_sf NUMERIC(8,2),
  total_units INTEGER,
  avg_unit_sf NUMERIC(8,2) DEFAULT 900,
  gross_sf NUMERIC(14,2),
  rentable_sf NUMERIC(14,2),
  efficiency NUMERIC(5,4) DEFAULT 0.8500,
  stories INTEGER,
  construction_type VARCHAR(50),
  parking_type VARCHAR(50),
  unit_mix JSONB DEFAULT '{}'::jsonb,
  avg_rent_per_unit NUMERIC(10,2),
  avg_rent_psf NUMERIC(6,2),
  other_income_per_unit NUMERIC(8,2) DEFAULT 50,
  vacancy_pct NUMERIC(5,2) DEFAULT 5.00,
  concessions_pct NUMERIC(5,2) DEFAULT 0.00,
  rent_growth_yr1 NUMERIC(5,2) DEFAULT 3.00,
  rent_growth_stabilized NUMERIC(5,2) DEFAULT 2.50,
  opex_ratio NUMERIC(5,2) DEFAULT 35.00,
  opex_per_unit NUMERIC(8,2),
  property_tax_rate NUMERIC(6,4),
  insurance_per_unit NUMERIC(8,2),
  management_fee_pct NUMERIC(5,2) DEFAULT 3.00,
  replacement_reserves_per_unit NUMERIC(8,2) DEFAULT 250,
  interest_rate NUMERIC(6,4),
  loan_term_years INTEGER DEFAULT 3,
  ltc NUMERIC(5,4) DEFAULT 0.6500,
  ltv NUMERIC(5,4),
  debt_yield_min NUMERIC(5,4),
  dscr_min NUMERIC(5,2) DEFAULT 1.25,
  amortization_years INTEGER DEFAULT 30,
  io_period_months INTEGER DEFAULT 36,
  origination_fee_pct NUMERIC(5,2) DEFAULT 1.00,
  exit_cap NUMERIC(6,4) DEFAULT 0.0500,
  hold_period_years INTEGER DEFAULT 5,
  disposition_cost_pct NUMERIC(5,2) DEFAULT 2.00,
  noi_stabilized NUMERIC(14,2),
  yield_on_cost NUMERIC(6,4),
  cash_on_cash_yr1 NUMERIC(6,4),
  irr_levered NUMERIC(6,4),
  irr_unlevered NUMERIC(6,4),
  equity_multiple NUMERIC(6,2),
  profit_margin NUMERIC(6,4),
  stabilized_value NUMERIC(14,2),
  assumptions_source VARCHAR(50) DEFAULT 'manual',
  last_computed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  source_type VARCHAR(30) DEFAULT 'manual',
  source_ref VARCHAR(500),
  source_date DATE,
  year1 JSONB,
  PRIMARY KEY (id),
  UNIQUE (deal_id)
);

CREATE TABLE IF NOT EXISTS platform_intel (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  title VARCHAR(500) NOT NULL,
  detail JSONB DEFAULT '{}'::jsonb,
  source_document_type VARCHAR(50),
  source_ref VARCHAR(500),
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_platform_intel_deal ON platform_intel (deal_id);
CREATE INDEX IF NOT EXISTS idx_platform_intel_type ON platform_intel (alert_type);

CREATE TABLE IF NOT EXISTS deal_properties (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  property_id UUID NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  notes TEXT,
  linked_by VARCHAR(20) DEFAULT 'auto',
  confidence_score NUMERIC(3,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE (deal_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_properties_deal ON deal_properties (deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_properties_property ON deal_properties (property_id);

ALTER TABLE deal_assumptions ADD COLUMN IF NOT EXISTS year1 JSONB;

CREATE INDEX IF NOT EXISTS idx_deal_assumptions_year1_gin
  ON deal_assumptions USING GIN (year1);

CREATE UNIQUE INDEX IF NOT EXISTS platform_intel_xdoc_unique
  ON platform_intel (deal_id, alert_type)
  WHERE alert_type LIKE 'cross_doc_%';

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS year_built INTEGER,
  ADD COLUMN IF NOT EXISTS year_renovated INTEGER,
  ADD COLUMN IF NOT EXISTS gross_area_sqft NUMERIC,
  ADD COLUMN IF NOT EXISTS land_area_acres NUMERIC;

ALTER TABLE deals ADD COLUMN IF NOT EXISTS legal_owner VARCHAR(500);
