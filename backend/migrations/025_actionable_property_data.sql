-- ═════════════════════════════════════════════════════════════
-- Migration 025: Actionable Property Data (Phase 2)
-- Created: 2026-02-15
-- Purpose: Critical municipal data that affects underwriting decisions
-- ═════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════
-- TABLE: property_violations
-- Purpose: Code violations, fines, compliance issues
-- Impact: Deal breakers, repair costs, NOI reduction
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS property_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_record_id UUID REFERENCES property_records(id) ON DELETE CASCADE,
  
  -- Violation details
  violation_number VARCHAR(100),
  violation_type VARCHAR(100), -- 'Building Code', 'Health', 'Fire', 'Zoning', 'Occupancy', 'Environmental'
  violation_category VARCHAR(100), -- 'Safety', 'Structural', 'Electrical', 'Plumbing', 'Life Safety', 'Nuisance'
  violation_description TEXT NOT NULL,
  severity VARCHAR(50), -- 'Critical', 'Major', 'Minor', 'Administrative'
  
  -- Dates
  violation_date DATE NOT NULL,
  notice_date DATE,
  compliance_deadline DATE,
  resolved_date DATE,
  
  -- Status
  status VARCHAR(50) NOT NULL, -- 'Open', 'In Compliance', 'Resolved', 'Appealed', 'In Court', 'Abated'
  is_repeat_violation BOOLEAN DEFAULT FALSE,
  
  -- Financial impact
  fine_amount NUMERIC,
  fine_paid NUMERIC,
  fine_outstanding NUMERIC,
  daily_penalty NUMERIC, -- Per day until resolved
  
  -- Estimated repair cost (if structural)
  estimated_repair_cost NUMERIC,
  repair_cost_basis VARCHAR(100), -- 'Inspector Estimate', 'Contractor Quote', 'System Estimate'
  
  -- Abatement
  abatement_order BOOLEAN DEFAULT FALSE,
  abatement_deadline DATE,
  city_performed_work BOOLEAN DEFAULT FALSE,
  city_lien_placed BOOLEAN DEFAULT FALSE,
  
  -- Inspection details
  inspector_name VARCHAR(200),
  inspector_contact VARCHAR(100),
  reinspection_required BOOLEAN DEFAULT FALSE,
  reinspection_date DATE,
  
  -- Property condition impact
  affects_occupancy BOOLEAN DEFAULT FALSE, -- Does this affect certificate of occupancy?
  units_affected INT, -- How many units can't be rented
  affects_insurance BOOLEAN DEFAULT FALSE,
  
  -- Legal
  court_case_number VARCHAR(100),
  court_hearing_date DATE,
  
  -- Notes
  inspector_notes TEXT,
  compliance_notes TEXT,
  
  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW(),
  data_source_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_property_violations_property ON property_violations(property_record_id);
CREATE INDEX idx_property_violations_status ON property_violations(status);
CREATE INDEX idx_property_violations_severity ON property_violations(severity);
CREATE INDEX idx_property_violations_date ON property_violations(violation_date DESC);
CREATE INDEX idx_property_violations_open ON property_violations(status) WHERE status = 'Open';
CREATE INDEX idx_property_violations_fine ON property_violations(fine_outstanding) WHERE fine_outstanding > 0;

COMMENT ON TABLE property_violations IS 'Code violations, fines, and compliance issues affecting property operations';


-- ═════════════════════════════════════════════════════════════
-- TABLE: property_liens
-- Purpose: Liens and encumbrances that affect title and NOI
-- Impact: Hidden debt, purchase price adjustment, deal killers
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS property_liens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_record_id UUID REFERENCES property_records(id) ON DELETE CASCADE,
  
  -- Lien details
  lien_number VARCHAR(100),
  lien_type VARCHAR(100) NOT NULL, -- 'Tax Lien', 'Mechanic Lien', 'HOA Lien', 'Utility Lien', 'Judgment Lien', 'Environmental Lien', 'IRS Lien'
  lien_holder VARCHAR(200) NOT NULL,
  lien_holder_type VARCHAR(50), -- 'Government', 'Contractor', 'HOA', 'Utility Company', 'Bank', 'Individual'
  
  -- Financial
  lien_amount NUMERIC NOT NULL,
  interest_rate NUMERIC,
  daily_interest NUMERIC,
  penalties NUMERIC,
  total_amount_due NUMERIC, -- lien_amount + interest + penalties
  
  -- Dates
  lien_filed_date DATE NOT NULL,
  lien_effective_date DATE,
  lien_expiration_date DATE,
  lien_released_date DATE,
  
  -- Status
  status VARCHAR(50) NOT NULL, -- 'Active', 'Released', 'Satisfied', 'Foreclosing', 'Judgment Entered'
  is_tax_lien BOOLEAN DEFAULT FALSE,
  foreclosure_filed BOOLEAN DEFAULT FALSE,
  foreclosure_sale_date DATE,
  
  -- Priority
  lien_priority INT, -- 1 = first position, etc.
  supersedes_mortgage BOOLEAN, -- Does this lien jump ahead of mortgage?
  
  -- Payment
  payment_plan_exists BOOLEAN DEFAULT FALSE,
  payment_plan_amount NUMERIC,
  payment_plan_frequency VARCHAR(50), -- 'Monthly', 'Quarterly'
  
  -- Legal
  case_number VARCHAR(100),
  recording_book VARCHAR(50),
  recording_page VARCHAR(50),
  
  -- Impact analysis
  affects_title BOOLEAN DEFAULT TRUE,
  affects_financing BOOLEAN DEFAULT TRUE,
  requires_payoff_at_closing BOOLEAN DEFAULT TRUE,
  
  -- Notes
  lien_description TEXT,
  resolution_notes TEXT,
  
  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW(),
  data_source_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_property_liens_property ON property_liens(property_record_id);
CREATE INDEX idx_property_liens_type ON property_liens(lien_type);
CREATE INDEX idx_property_liens_status ON property_liens(status);
CREATE INDEX idx_property_liens_amount ON property_liens(lien_amount DESC);
CREATE INDEX idx_property_liens_active ON property_liens(status) WHERE status = 'Active';
CREATE INDEX idx_property_liens_tax ON property_liens(is_tax_lien) WHERE is_tax_lien = TRUE;

COMMENT ON TABLE property_liens IS 'Liens and encumbrances affecting property title and value';


-- ═════════════════════════════════════════════════════════════
-- TABLE: special_districts
-- Purpose: Special assessment districts with ongoing fees
-- Impact: NOI reduction, hidden annual costs
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS special_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_record_id UUID REFERENCES property_records(id) ON DELETE CASCADE,
  
  -- District details
  district_name VARCHAR(200) NOT NULL,
  district_type VARCHAR(100) NOT NULL, -- 'TIF', 'BID', 'CID', 'MELLO-ROOS', 'Special Assessment', 'Community Facilities District'
  district_number VARCHAR(100),
  
  -- Geographic
  district_boundaries TEXT, -- Description or polygon
  jurisdiction VARCHAR(100), -- 'City', 'County', 'State'
  
  -- Financial impact
  annual_assessment NUMERIC NOT NULL,
  assessment_per_unit NUMERIC,
  assessment_per_sqft NUMERIC,
  
  -- Dates
  district_created_date DATE,
  assessment_start_date DATE,
  assessment_end_date DATE, -- When does this sunset?
  years_remaining INT,
  
  -- Status
  status VARCHAR(50) NOT NULL, -- 'Active', 'Expired', 'Proposed', 'Appealed'
  
  -- Purpose
  purpose TEXT, -- What is the money used for?
  improvements_funded TEXT, -- Streets, sewers, parks, infrastructure
  
  -- Payment
  payment_frequency VARCHAR(50), -- 'Annual', 'Semi-Annual', 'Quarterly'
  collected_with_taxes BOOLEAN DEFAULT TRUE,
  separate_billing BOOLEAN DEFAULT FALSE,
  
  -- Escalation
  escalates_annually BOOLEAN DEFAULT FALSE,
  escalation_rate NUMERIC, -- Percentage
  cap_on_increases BOOLEAN,
  max_assessment_amount NUMERIC,
  
  -- Property value impact
  affects_property_value BOOLEAN DEFAULT TRUE,
  typical_discount_pct NUMERIC, -- Buyers typically discount property value by X%
  
  -- Transferability
  transfers_with_property BOOLEAN DEFAULT TRUE,
  can_be_prepaid BOOLEAN,
  prepayment_amount NUMERIC,
  
  -- Voting & governance
  property_owner_vote_required BOOLEAN,
  last_vote_date DATE,
  next_vote_date DATE,
  can_be_dissolved BOOLEAN,
  
  -- District financials
  total_district_debt NUMERIC,
  bond_rating VARCHAR(10),
  
  -- Notes
  district_description TEXT,
  buyer_disclosure_required BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW(),
  data_source_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_special_districts_property ON special_districts(property_record_id);
CREATE INDEX idx_special_districts_type ON special_districts(district_type);
CREATE INDEX idx_special_districts_status ON special_districts(status);
CREATE INDEX idx_special_districts_assessment ON special_districts(annual_assessment DESC);
CREATE INDEX idx_special_districts_active ON special_districts(status) WHERE status = 'Active';
CREATE INDEX idx_special_districts_end_date ON special_districts(assessment_end_date);

COMMENT ON TABLE special_districts IS 'Special assessment districts with ongoing fees that reduce NOI';


-- ═════════════════════════════════════════════════════════════
-- TABLE: flood_zones
-- Purpose: FEMA flood zone designation and insurance requirements
-- Impact: Insurance costs, financing requirements, climate risk
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS flood_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_record_id UUID REFERENCES property_records(id) ON DELETE CASCADE,
  
  -- FEMA flood zone
  fema_zone VARCHAR(10) NOT NULL, -- 'A', 'AE', 'AH', 'AO', 'VE', 'X', 'B', 'C', 'D'
  fema_zone_description TEXT,
  
  -- Flood risk level
  risk_level VARCHAR(50), -- 'High Risk', 'Moderate-to-Low Risk', 'Undetermined Risk', 'Minimal Risk'
  in_100_year_floodplain BOOLEAN DEFAULT FALSE,
  in_500_year_floodplain BOOLEAN DEFAULT FALSE,
  
  -- FEMA map details
  fema_map_number VARCHAR(100),
  fema_map_date DATE,
  fema_panel_number VARCHAR(100),
  
  -- Base flood elevation (BFE)
  base_flood_elevation NUMERIC, -- Feet above sea level
  property_elevation NUMERIC, -- Ground elevation
  elevation_difference NUMERIC, -- property_elevation - BFE (positive = above flood level)
  elevation_certificate_required BOOLEAN,
  
  -- Insurance requirements
  flood_insurance_required BOOLEAN DEFAULT FALSE,
  required_by_lender BOOLEAN,
  
  -- Insurance costs (estimated)
  estimated_annual_premium NUMERIC,
  premium_basis VARCHAR(100), -- 'FEMA Rate Table', 'Insurance Quote', 'System Estimate'
  premium_per_unit NUMERIC,
  
  -- Coverage amounts
  required_coverage_amount NUMERIC,
  building_coverage NUMERIC,
  contents_coverage NUMERIC,
  
  -- Historical flooding
  property_flooded_history BOOLEAN DEFAULT FALSE,
  last_flood_date DATE,
  flood_damage_amount NUMERIC,
  number_of_flood_events INT DEFAULT 0,
  
  -- Community participation
  community_nfip_participant BOOLEAN, -- National Flood Insurance Program
  community_rating_system_class INT, -- 1-10 (affects premium discount)
  premium_discount_pct NUMERIC,
  
  -- Climate risk (forward-looking)
  sea_level_rise_risk VARCHAR(50), -- 'Low', 'Medium', 'High'
  projected_risk_change VARCHAR(50), -- 'Improving', 'Stable', 'Worsening'
  
  -- Letters of Map Amendment (LOMA)
  loma_exists BOOLEAN DEFAULT FALSE,
  loma_number VARCHAR(100),
  loma_date DATE,
  loma_removes_property BOOLEAN, -- Does LOMA remove property from flood zone?
  
  -- Mitigation
  flood_mitigation_installed BOOLEAN DEFAULT FALSE,
  mitigation_type VARCHAR(100), -- 'Elevation', 'Flood Walls', 'Drainage Improvements'
  mitigation_cost NUMERIC,
  
  -- Impact on property
  affects_financing BOOLEAN DEFAULT FALSE,
  affects_insurance_costs BOOLEAN DEFAULT FALSE,
  affects_property_value BOOLEAN DEFAULT FALSE,
  typical_value_discount_pct NUMERIC,
  
  -- Notes
  flood_zone_notes TEXT,
  
  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW(),
  last_verified_date DATE,
  data_source_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_flood_zones_property ON flood_zones(property_record_id);
CREATE INDEX idx_flood_zones_zone ON flood_zones(fema_zone);
CREATE INDEX idx_flood_zones_risk ON flood_zones(risk_level);
CREATE INDEX idx_flood_zones_required ON flood_zones(flood_insurance_required) WHERE flood_insurance_required = TRUE;
CREATE INDEX idx_flood_zones_100year ON flood_zones(in_100_year_floodplain) WHERE in_100_year_floodplain = TRUE;

COMMENT ON TABLE flood_zones IS 'FEMA flood zone designation and insurance requirements';


-- ═════════════════════════════════════════════════════════════
-- TABLE: planned_developments
-- Purpose: Nearby approved/proposed projects that affect value
-- Impact: Future competition, value drivers, market dynamics
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS planned_developments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Location
  project_name VARCHAR(200) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  county VARCHAR(100),
  state VARCHAR(2),
  geom GEOMETRY(POINT, 4326), -- PostGIS
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  
  -- Project details
  project_type VARCHAR(100) NOT NULL, -- 'Multifamily', 'Office', 'Retail', 'Mixed-Use', 'Infrastructure', 'Transit', 'Public Facility'
  project_subtype VARCHAR(100), -- 'Luxury Apartments', 'Affordable Housing', 'Student Housing', etc.
  development_stage VARCHAR(50) NOT NULL, -- 'Proposed', 'Under Review', 'Approved', 'Permitted', 'Under Construction', 'Completed'
  
  -- Size & scope
  total_units INT, -- For residential
  total_sqft NUMERIC, -- For commercial
  stories INT,
  acres NUMERIC,
  
  -- For multifamily specifically
  affordable_units INT,
  market_rate_units INT,
  
  -- Financial
  project_cost NUMERIC,
  cost_per_unit NUMERIC,
  cost_per_sqft NUMERIC,
  
  -- Timeline
  proposal_date DATE,
  approval_date DATE,
  permit_date DATE,
  construction_start_date DATE,
  estimated_completion_date DATE,
  actual_completion_date DATE,
  
  -- Developer
  developer_name VARCHAR(200),
  developer_contact VARCHAR(200),
  developer_type VARCHAR(100), -- 'Institutional', 'Local', 'National', 'Public-Private'
  
  -- Status
  status VARCHAR(50) NOT NULL, -- 'Active', 'On Hold', 'Cancelled', 'Completed'
  on_schedule BOOLEAN,
  delay_reason TEXT,
  
  -- Impact on subject property
  distance_miles NUMERIC, -- Distance from subject property
  impact_type VARCHAR(50), -- 'Competition', 'Amenity', 'Infrastructure', 'Transit', 'Negative'
  impact_level VARCHAR(50), -- 'High', 'Medium', 'Low', 'Positive', 'Negative', 'Neutral'
  
  -- Competition analysis (for competing projects)
  is_direct_competition BOOLEAN DEFAULT FALSE,
  target_rent_range VARCHAR(100), -- '$1,500-2,000'
  target_demographic VARCHAR(100), -- 'Young Professionals', 'Families', etc.
  unique_features TEXT, -- What makes this project special?
  
  -- Positive impacts (for infrastructure/transit)
  is_value_driver BOOLEAN DEFAULT FALSE,
  estimated_value_lift_pct NUMERIC, -- Property values expected to rise X%
  
  -- Zoning & approvals
  zoning_required VARCHAR(100),
  rezoning_approved BOOLEAN,
  variances_required TEXT[],
  variances_approved BOOLEAN,
  public_hearing_date DATE,
  public_opposition BOOLEAN,
  
  -- Funding & financing
  financing_secured BOOLEAN,
  public_funding BOOLEAN,
  tax_increment_financing BOOLEAN,
  
  -- Amenities (if relevant)
  amenities TEXT[], -- Pool, gym, retail, parking, etc.
  parking_spaces INT,
  
  -- Environmental
  environmental_review_required BOOLEAN,
  environmental_clearance_date DATE,
  
  -- Notes
  project_description TEXT,
  market_impact_notes TEXT,
  risk_notes TEXT,
  
  -- Metadata
  scraped_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP,
  data_source_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_planned_developments_geom ON planned_developments USING GIST(geom);
CREATE INDEX idx_planned_developments_type ON planned_developments(project_type);
CREATE INDEX idx_planned_developments_stage ON planned_developments(development_stage);
CREATE INDEX idx_planned_developments_status ON planned_developments(status);
CREATE INDEX idx_planned_developments_completion ON planned_developments(estimated_completion_date);
CREATE INDEX idx_planned_developments_city ON planned_developments(city, county, state);
CREATE INDEX idx_planned_developments_competition ON planned_developments(is_direct_competition) WHERE is_direct_competition = TRUE;
CREATE INDEX idx_planned_developments_active ON planned_developments(status) WHERE status = 'Active';

COMMENT ON TABLE planned_developments IS 'Nearby approved/proposed projects affecting property value and competition';


-- ═════════════════════════════════════════════════════════════
-- VIEWS: Actionable insights
-- ═════════════════════════════════════════════════════════════

-- Critical violations requiring immediate attention
CREATE OR REPLACE VIEW critical_violations AS
SELECT 
  pr.parcel_id,
  pr.address,
  pr.city,
  pr.county,
  pv.violation_number,
  pv.violation_type,
  pv.violation_description,
  pv.severity,
  pv.status,
  pv.fine_outstanding,
  pv.estimated_repair_cost,
  pv.compliance_deadline,
  pv.affects_occupancy,
  pv.units_affected
FROM property_violations pv
JOIN property_records pr ON pv.property_record_id = pr.id
WHERE 
  pv.status = 'Open'
  AND (
    pv.severity IN ('Critical', 'Major')
    OR pv.affects_occupancy = TRUE
    OR pv.abatement_order = TRUE
  )
ORDER BY 
  CASE pv.severity
    WHEN 'Critical' THEN 1
    WHEN 'Major' THEN 2
    ELSE 3
  END,
  pv.compliance_deadline ASC;

COMMENT ON VIEW critical_violations IS 'Open violations requiring immediate attention';


-- Active liens affecting title
CREATE OR REPLACE VIEW active_liens_summary AS
SELECT 
  pr.parcel_id,
  pr.address,
  pr.city,
  pr.county,
  COUNT(*) AS total_liens,
  SUM(pl.total_amount_due) AS total_lien_amount,
  SUM(CASE WHEN pl.is_tax_lien THEN pl.total_amount_due ELSE 0 END) AS tax_lien_amount,
  SUM(CASE WHEN pl.foreclosure_filed THEN pl.total_amount_due ELSE 0 END) AS foreclosure_risk_amount,
  MAX(CASE WHEN pl.foreclosure_filed THEN pl.foreclosure_sale_date ELSE NULL END) AS earliest_foreclosure_date
FROM property_liens pl
JOIN property_records pr ON pl.property_record_id = pr.id
WHERE pl.status = 'Active'
GROUP BY pr.id, pr.parcel_id, pr.address, pr.city, pr.county
ORDER BY total_lien_amount DESC;

COMMENT ON VIEW active_liens_summary IS 'Properties with active liens affecting title';


-- Special district NOI impact
CREATE OR REPLACE VIEW special_district_impact AS
SELECT 
  pr.parcel_id,
  pr.address,
  pr.city,
  pr.county,
  pr.units,
  sd.district_name,
  sd.district_type,
  sd.annual_assessment,
  sd.assessment_per_unit,
  sd.years_remaining,
  sd.annual_assessment * sd.years_remaining AS total_remaining_assessments,
  sd.assessment_end_date,
  CASE 
    WHEN pr.units > 0 THEN sd.annual_assessment / pr.units
    ELSE sd.annual_assessment
  END AS impact_per_unit
FROM special_districts sd
JOIN property_records pr ON sd.property_record_id = pr.id
WHERE sd.status = 'Active'
ORDER BY sd.annual_assessment DESC;

COMMENT ON VIEW special_district_impact IS 'Special assessments with NOI impact';


-- High flood risk properties
CREATE OR REPLACE VIEW high_flood_risk_properties AS
SELECT 
  pr.parcel_id,
  pr.address,
  pr.city,
  pr.county,
  pr.units,
  fz.fema_zone,
  fz.risk_level,
  fz.in_100_year_floodplain,
  fz.flood_insurance_required,
  fz.estimated_annual_premium,
  fz.premium_per_unit,
  fz.number_of_flood_events,
  fz.sea_level_rise_risk
FROM flood_zones fz
JOIN property_records pr ON fz.property_record_id = pr.id
WHERE 
  fz.in_100_year_floodplain = TRUE
  OR fz.risk_level = 'High Risk'
  OR fz.number_of_flood_events > 0
ORDER BY fz.estimated_annual_premium DESC;

COMMENT ON VIEW high_flood_risk_properties IS 'Properties with significant flood risk';


-- Nearby competing developments
CREATE OR REPLACE VIEW competing_developments AS
SELECT 
  pd.project_name,
  pd.address,
  pd.city,
  pd.development_stage,
  pd.total_units,
  pd.estimated_completion_date,
  pd.distance_miles,
  pd.target_rent_range,
  pd.is_direct_competition,
  pd.impact_level,
  pd.developer_name
FROM planned_developments pd
WHERE 
  pd.is_direct_competition = TRUE
  AND pd.status = 'Active'
  AND pd.development_stage IN ('Approved', 'Permitted', 'Under Construction')
ORDER BY pd.estimated_completion_date ASC, pd.distance_miles ASC;

COMMENT ON VIEW competing_developments IS 'Active competing developments by delivery date';


-- ═════════════════════════════════════════════════════════════
-- FUNCTIONS: Actionable analysis
-- ═════════════════════════════════════════════════════════════

-- Function: Calculate total NOI impact from all sources
CREATE OR REPLACE FUNCTION calculate_noi_impact(
  target_property_id UUID
)
RETURNS TABLE (
  violations_repair_cost NUMERIC,
  violations_fines NUMERIC,
  active_liens_total NUMERIC,
  special_assessments_annual NUMERIC,
  flood_insurance_annual NUMERIC,
  total_one_time_cost NUMERIC,
  total_annual_cost NUMERIC,
  noi_impact_5yr NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH violations AS (
    SELECT 
      COALESCE(SUM(estimated_repair_cost), 0) AS repair_cost,
      COALESCE(SUM(fine_outstanding), 0) AS fines
    FROM property_violations
    WHERE property_record_id = target_property_id
    AND status = 'Open'
  ),
  liens AS (
    SELECT COALESCE(SUM(total_amount_due), 0) AS total
    FROM property_liens
    WHERE property_record_id = target_property_id
    AND status = 'Active'
  ),
  districts AS (
    SELECT COALESCE(SUM(annual_assessment), 0) AS annual
    FROM special_districts
    WHERE property_record_id = target_property_id
    AND status = 'Active'
  ),
  flood AS (
    SELECT COALESCE(MAX(estimated_annual_premium), 0) AS annual
    FROM flood_zones
    WHERE property_record_id = target_property_id
    AND flood_insurance_required = TRUE
  )
  SELECT 
    v.repair_cost,
    v.fines,
    l.total,
    d.annual,
    f.annual,
    v.repair_cost + v.fines + l.total AS one_time,
    d.annual + f.annual AS annual,
    (d.annual + f.annual) * 5 AS noi_5yr
  FROM violations v, liens l, districts d, flood f;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_noi_impact IS 'Calculate total NOI impact from violations, liens, assessments, and insurance';


-- Function: Find nearby planned developments
CREATE OR REPLACE FUNCTION get_nearby_developments(
  target_lat NUMERIC,
  target_lng NUMERIC,
  radius_miles NUMERIC DEFAULT 2,
  project_type_filter VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  project_id UUID,
  project_name VARCHAR,
  address TEXT,
  project_type VARCHAR,
  development_stage VARCHAR,
  total_units INT,
  estimated_completion_date DATE,
  distance_miles NUMERIC,
  impact_type VARCHAR,
  impact_level VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pd.id,
    pd.project_name,
    pd.address,
    pd.project_type,
    pd.development_stage,
    pd.total_units,
    pd.estimated_completion_date,
    ST_Distance(
      pd.geom::geography,
      ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography
    ) / 1609.34 AS dist_miles,
    pd.impact_type,
    pd.impact_level
  FROM planned_developments pd
  WHERE 
    pd.geom IS NOT NULL
    AND pd.status = 'Active'
    AND ST_DWithin(
      pd.geom::geography,
      ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
      radius_miles * 1609.34
    )
    AND (project_type_filter IS NULL OR pd.project_type = project_type_filter)
  ORDER BY dist_miles ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_nearby_developments IS 'Find planned developments within radius that may affect property';


-- ═════════════════════════════════════════════════════════════
-- TRIGGERS: Auto-update timestamps
-- ═════════════════════════════════════════════════════════════

CREATE TRIGGER update_property_violations_updated_at
  BEFORE UPDATE ON property_violations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_liens_updated_at
  BEFORE UPDATE ON property_liens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_special_districts_updated_at
  BEFORE UPDATE ON special_districts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flood_zones_updated_at
  BEFORE UPDATE ON flood_zones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planned_developments_updated_at
  BEFORE UPDATE ON planned_developments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ═════════════════════════════════════════════════════════════
-- Migration complete
-- ═════════════════════════════════════════════════════════════

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 025: Actionable Property Data - COMPLETE';
  RAISE NOTICE 'Tables created: 5 (property_violations, property_liens, special_districts, flood_zones, planned_developments)';
  RAISE NOTICE 'Views created: 5 (critical_violations, active_liens_summary, special_district_impact, high_flood_risk_properties, competing_developments)';
  RAISE NOTICE 'Functions created: 2 (calculate_noi_impact, get_nearby_developments)';
  RAISE NOTICE 'Focus: Actionable data that affects underwriting decisions';
END $$;
