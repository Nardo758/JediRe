-- ═══════════════════════════════════════════════════════════════
-- M26 MUNICIPAL TAX INTELLIGENCE + M27 SALE COMP INTELLIGENCE
-- Phase 1 Foundation Schema
-- Migration: 20260304_m26_m27_foundation
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════
-- SHARED: Jurisdictions (if not exists)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('county', 'city', 'special_district', 'school_board', 'water_mgmt')),
  state VARCHAR(2) NOT NULL DEFAULT 'FL',
  fips_code VARCHAR(10),
  parent_jurisdiction_id UUID REFERENCES jurisdictions(id),
  pa_website_url TEXT,
  tax_collector_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jurisdictions_state_type ON jurisdictions(state, type);
CREATE INDEX IF NOT EXISTS idx_jurisdictions_fips ON jurisdictions(fips_code);

-- ═══════════════════════════════════════════
-- M26: MUNICIPAL TAX INTELLIGENCE
-- ═══════════════════════════════════════════

-- Tax Methodology (how counties assess)
CREATE TABLE tax_methodology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID NOT NULL REFERENCES jurisdictions(id),
  jurisdiction_type VARCHAR(20) NOT NULL CHECK (jurisdiction_type IN ('county', 'city', 'special_district')),
  
  -- Assessment methodology
  assessment_approach JSONB NOT NULL,
  homestead_cap_pct DECIMAL(5,4),
  non_homestead_cap_pct DECIMAL(5,4) DEFAULT 0.10,
  cap_exceptions TEXT[],
  
  -- Exemption programs
  exemption_programs JSONB,
  
  -- Non-ad-valorem
  non_ad_valorem_schedule JSONB,
  
  -- Source tracking
  source_url TEXT NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_retrieved_at TIMESTAMPTZ NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  
  -- Versioning
  effective_date DATE NOT NULL,
  superseded_by UUID REFERENCES tax_methodology(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tax_methodology_jurisdiction ON tax_methodology(jurisdiction_id, effective_date DESC);

-- Millage Rates (annual rates per taxing authority)
CREATE TABLE millage_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID NOT NULL REFERENCES jurisdictions(id),
  taxing_authority VARCHAR(255) NOT NULL,
  authority_type VARCHAR(50) NOT NULL,
  tax_year INTEGER NOT NULL,
  millage_rate DECIMAL(8,4) NOT NULL,
  voted_millage DECIMAL(8,4),
  rolled_back_rate DECIMAL(8,4),
  
  source_url TEXT NOT NULL,
  source_document VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(jurisdiction_id, taxing_authority, tax_year)
);

CREATE INDEX idx_millage_jurisdiction_year ON millage_rates(jurisdiction_id, tax_year DESC);

-- Property Tax Records (actual PA records)
CREATE TABLE property_tax_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  parcel_id VARCHAR(50) NOT NULL,
  county_id UUID NOT NULL REFERENCES jurisdictions(id),
  
  tax_year INTEGER NOT NULL,
  
  -- Values
  just_value DECIMAL(14,2),
  assessed_value DECIMAL(14,2),
  taxable_value DECIMAL(14,2),
  land_value DECIMAL(14,2),
  improvement_value DECIMAL(14,2),
  
  -- Exemptions
  exemptions_applied JSONB,
  total_exemption_amount DECIMAL(14,2),
  
  -- Tax amounts
  total_millage DECIMAL(8,4),
  ad_valorem_tax DECIMAL(12,2),
  non_ad_valorem_total DECIMAL(12,2),
  non_ad_valorem_detail JSONB,
  total_tax_amount DECIMAL(12,2),
  
  -- Payment status
  payment_status VARCHAR(20) DEFAULT 'unknown' CHECK (payment_status IN ('paid', 'delinquent', 'partial', 'unknown')),
  delinquent_amount DECIMAL(12,2),
  delinquent_since DATE,
  
  -- Source
  source_url TEXT,
  source_retrieved_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(parcel_id, county_id, tax_year)
);

CREATE INDEX idx_property_tax_parcel ON property_tax_records(parcel_id, tax_year DESC);
CREATE INDEX idx_property_tax_property ON property_tax_records(property_id, tax_year DESC);
CREATE INDEX idx_property_tax_delinquent ON property_tax_records(payment_status, county_id) WHERE payment_status = 'delinquent';

-- Tax Certificates (FL distress tracking)
CREATE TABLE tax_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id VARCHAR(50) NOT NULL,
  county_id UUID NOT NULL REFERENCES jurisdictions(id),
  property_id UUID REFERENCES properties(id),
  
  certificate_number VARCHAR(50),
  tax_year INTEGER NOT NULL,
  sale_date DATE NOT NULL,
  face_amount DECIMAL(12,2) NOT NULL,
  bid_rate DECIMAL(5,2),
  certificate_holder VARCHAR(255),
  
  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'tax_deed_applied', 'tax_deed_issued')),
  redeemed_date DATE,
  tax_deed_application_date DATE,
  tax_deed_sale_date DATE,
  
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tax_cert_parcel ON tax_certificates(parcel_id, tax_year DESC);
CREATE INDEX idx_tax_cert_status ON tax_certificates(status, county_id);

-- Tax Projections (calculated for deals)
CREATE TABLE tax_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  property_id UUID REFERENCES properties(id),
  
  -- Inputs
  purchase_price DECIMAL(14,2) NOT NULL,
  total_millage DECIMAL(8,4) NOT NULL,
  non_ad_valorem_per_unit DECIMAL(10,2),
  units INTEGER NOT NULL,
  exemption_reduction_pct DECIMAL(5,4) DEFAULT 0,
  
  -- Outputs (Year 1)
  projected_just_value DECIMAL(14,2),
  projected_assessed_value DECIMAL(14,2),
  projected_taxable_value DECIMAL(14,2),
  projected_ad_valorem DECIMAL(12,2),
  projected_non_ad_valorem DECIMAL(12,2),
  projected_total_tax DECIMAL(12,2),
  projected_tax_per_unit DECIMAL(10,2),
  effective_tax_rate DECIMAL(6,4),
  
  -- Delta from current
  current_annual_tax DECIMAL(12,2),
  delta_amount DECIMAL(12,2),
  delta_pct DECIMAL(6,2),
  
  -- Multi-year projection
  yearly_projections JSONB,
  projection_assumptions JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tax_projection_deal ON tax_projections(deal_id);

-- ═══════════════════════════════════════════
-- M27: SALE COMP INTELLIGENCE
-- ═══════════════════════════════════════════

-- Recorded Transactions (ground truth)
CREATE TABLE recorded_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county_id UUID NOT NULL REFERENCES jurisdictions(id),
  
  -- Deed data
  instrument_number VARCHAR(50),
  document_type VARCHAR(50) NOT NULL,
  recording_date DATE NOT NULL,
  consideration_stated DECIMAL(14,2),
  
  -- Parties
  grantor_name VARCHAR(500),
  grantor_entity_type VARCHAR(30),
  grantee_name VARCHAR(500),
  grantee_entity_type VARCHAR(30),
  
  -- Price derivation
  documentary_stamps_paid DECIMAL(12,2),
  stamp_rate DECIMAL(6,4) NOT NULL DEFAULT 0.0070,
  derived_sale_price DECIMAL(14,2) NOT NULL,
  price_derivation_method VARCHAR(30) NOT NULL,
  price_confidence VARCHAR(10) NOT NULL DEFAULT 'high',
  
  -- Property identification
  parcel_id VARCHAR(50) NOT NULL,
  legal_description TEXT,
  property_address TEXT,
  property_id UUID REFERENCES properties(id),
  
  -- Property characteristics
  property_type VARCHAR(50),
  units INTEGER,
  building_sf INTEGER,
  land_sf INTEGER,
  year_built INTEGER,
  property_class VARCHAR(5),
  
  -- Derived metrics
  price_per_unit DECIMAL(12,2),
  price_per_sf DECIMAL(10,2),
  implied_cap_rate DECIMAL(6,4),
  cap_rate_confidence VARCHAR(10),
  cap_rate_method VARCHAR(50),
  
  -- Holding period
  prior_sale_date DATE,
  prior_sale_price DECIMAL(14,2),
  holding_period_months INTEGER,
  appreciation_total_pct DECIMAL(8,4),
  appreciation_annual_pct DECIMAL(8,4),
  
  -- Mortgage
  mortgage_amount DECIMAL(14,2),
  lender_name VARCHAR(255),
  ltv_at_acquisition DECIMAL(5,4),
  
  -- Classification
  is_arms_length BOOLEAN DEFAULT true,
  is_distress BOOLEAN DEFAULT false,
  distress_type VARCHAR(50),
  is_1031_likely BOOLEAN DEFAULT false,
  buyer_type VARCHAR(30),
  
  -- Geography
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  zip_code VARCHAR(10),
  submarket VARCHAR(100),
  
  -- Source
  source VARCHAR(50) NOT NULL,
  source_url TEXT,
  source_retrieved_at TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_recording_date ON recorded_transactions(recording_date DESC);
CREATE INDEX idx_transactions_submarket ON recorded_transactions(submarket, recording_date DESC);
CREATE INDEX idx_transactions_parcel ON recorded_transactions(parcel_id);
CREATE INDEX idx_transactions_property ON recorded_transactions(property_id);
CREATE INDEX idx_transactions_type ON recorded_transactions(property_type, recording_date DESC);
CREATE INDEX idx_transactions_price_unit ON recorded_transactions(price_per_unit) WHERE property_type = 'multifamily';
CREATE INDEX idx_transactions_grantee ON recorded_transactions(grantee_name);
CREATE INDEX idx_transactions_grantor ON recorded_transactions(grantor_name);

-- Spatial index for radius queries
CREATE INDEX idx_transactions_geo ON recorded_transactions USING GIST (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Comp Sets (per deal)
CREATE TABLE sale_comp_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  property_id UUID REFERENCES properties(id),
  
  name VARCHAR(255) DEFAULT 'Primary Comp Set',
  comp_type VARCHAR(30) NOT NULL DEFAULT 'sale',
  
  -- Selection criteria
  selection_criteria JSONB NOT NULL,
  
  -- Aggregated metrics
  comp_count INTEGER NOT NULL,
  median_price_per_unit DECIMAL(12,2),
  avg_price_per_unit DECIMAL(12,2),
  min_price_per_unit DECIMAL(12,2),
  max_price_per_unit DECIMAL(12,2),
  std_dev_price_per_unit DECIMAL(12,2),
  median_price_per_sf DECIMAL(10,2),
  median_implied_cap_rate DECIMAL(6,4),
  avg_implied_cap_rate DECIMAL(6,4),
  
  -- Subject positioning
  subject_price_per_unit DECIMAL(12,2),
  subject_vs_median_pct DECIMAL(8,4),
  subject_percentile INTEGER,
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comp_sets_deal ON sale_comp_sets(deal_id);

-- Comp Set Members (which transactions in which set)
CREATE TABLE sale_comp_set_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_set_id UUID NOT NULL REFERENCES sale_comp_sets(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES recorded_transactions(id),
  
  -- Adjustments
  adjustments JSONB,
  adjusted_price_per_unit DECIMAL(12,2),
  adjustment_total_pct DECIMAL(8,4),
  
  -- User overrides
  manually_included BOOLEAN DEFAULT false,
  manually_excluded BOOLEAN DEFAULT false,
  exclusion_reason TEXT,
  
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(comp_set_id, transaction_id)
);

CREATE INDEX idx_comp_members_set ON sale_comp_set_members(comp_set_id);

-- Transaction Patterns (detected patterns, cached)
CREATE TABLE transaction_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type VARCHAR(30) NOT NULL,
  submarket VARCHAR(100) NOT NULL,
  detection_date DATE NOT NULL,
  
  -- Pattern data
  pattern_data JSONB NOT NULL,
  
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('info', 'notable', 'significant', 'critical')),
  confidence DECIMAL(3,2) NOT NULL,
  
  -- Affected entities
  affected_deal_ids UUID[],
  affected_property_ids UUID[],
  
  -- Lifecycle
  is_active BOOLEAN DEFAULT true,
  superseded_by UUID REFERENCES transaction_patterns(id),
  expires_at DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patterns_submarket ON transaction_patterns(submarket, detection_date DESC);
CREATE INDEX idx_patterns_type ON transaction_patterns(pattern_type, is_active);

-- Transaction Entities (buyer/seller tracking)
CREATE TABLE transaction_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name VARCHAR(500) NOT NULL,
  normalized_name VARCHAR(500) NOT NULL,
  entity_type VARCHAR(30),
  buyer_classification VARCHAR(30),
  
  -- Aggregated stats
  total_acquisitions INTEGER DEFAULT 0,
  total_dispositions INTEGER DEFAULT 0,
  total_units_owned_current INTEGER DEFAULT 0,
  avg_price_per_unit_paid DECIMAL(12,2),
  avg_holding_period_months INTEGER,
  active_markets TEXT[],
  
  -- Entity research
  registered_agent VARCHAR(255),
  sos_entity_id VARCHAR(50),
  related_entities UUID[],
  
  last_transaction_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(normalized_name)
);

CREATE INDEX idx_entities_name ON transaction_entities(normalized_name);
CREATE INDEX idx_entities_classification ON transaction_entities(buyer_classification);

-- ═══════════════════════════════════════════
-- SEED DATA: P0 Florida Counties
-- ═══════════════════════════════════════════

INSERT INTO jurisdictions (name, type, state, fips_code, pa_website_url, tax_collector_url) VALUES
('Miami-Dade', 'county', 'FL', '12086', 'https://www.miamidade.gov/pa/', 'https://www.miamidade.gov/taxcollector/'),
('Broward', 'county', 'FL', '12011', 'https://www.bcpa.net/', 'https://www.broward.org/RecordsTaxesTreasury/Pages/Default.aspx'),
('Palm Beach', 'county', 'FL', '12099', 'https://www.pbcgov.org/papa/', 'https://www.pbctax.com/'),
('Hillsborough', 'county', 'FL', '12057', 'https://www.hcpafl.org/', 'https://www.hillstax.org/'),
('Orange', 'county', 'FL', '12095', 'https://www.ocpafl.org/', 'https://www.octaxcol.com/'),
('Pinellas', 'county', 'FL', '12103', 'https://www.pcpao.gov/', 'https://www.pinellascounty.org/taxcoll/'),
('Duval', 'county', 'FL', '12031', 'https://paojax.coj.net/', 'https://www.coj.net/departments/tax-collector')
ON CONFLICT DO NOTHING;

-- Add comment for tracking
COMMENT ON TABLE tax_methodology IS 'M26: Municipal tax assessment methodologies';
COMMENT ON TABLE millage_rates IS 'M26: Annual millage rates by taxing authority';
COMMENT ON TABLE property_tax_records IS 'M26: Property Appraiser records';
COMMENT ON TABLE tax_projections IS 'M26: Calculated tax projections for deals';
COMMENT ON TABLE recorded_transactions IS 'M27: Recorded deed transactions with derived prices';
COMMENT ON TABLE sale_comp_sets IS 'M27: Comparable sale sets for deals';
COMMENT ON TABLE transaction_patterns IS 'M27: Detected market patterns';
COMMENT ON TABLE transaction_entities IS 'M27: Buyer/seller entity tracking';
