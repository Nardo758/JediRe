/**
 * Migration 029: Additional Risk Categories (Phase 3, Component 1)
 * Regulatory, Market, Execution, and Climate/Physical Risk Implementation
 * 
 * Completes the 6-category risk framework with:
 * - Regulatory Risk (10%): Legislation tracking, policy changes
 * - Market Risk (10%): Interest rate sensitivity, recession indicators
 * - Execution Risk (5%): Construction cost/timeline overruns
 * - Climate/Physical Risk (5%): FEMA zones, natural disasters
 */

-- ============================================================================
-- REGULATORY RISK TABLES
-- ============================================================================

-- Regulatory Risk Events
-- Tracks legislation, policy changes, and government actions affecting RE operations
CREATE TABLE IF NOT EXISTS regulatory_risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  
  -- Legislation details
  legislation_name VARCHAR(255) NOT NULL,
  jurisdiction VARCHAR(100) NOT NULL, -- 'City', 'County', 'State', 'Federal'
  jurisdiction_name VARCHAR(255), -- e.g., 'Fulton County', 'City of Atlanta'
  
  -- Legislation type
  legislation_type VARCHAR(50) NOT NULL, -- rent_control, str_restrictions, zoning_change, tax_policy, inclusionary_zoning
  
  -- Stage tracking (for probability weighting)
  legislation_stage VARCHAR(50) NOT NULL, -- proposed, committee, vote_pending, enacted, rejected
  stage_probability DECIMAL(5,2) NOT NULL, -- proposed=25%, committee=50%, vote=75%, enacted=100%
  
  -- Legislative text and details
  headline TEXT NOT NULL,
  description TEXT,
  summary TEXT, -- AI-generated summary of impact
  
  -- Timeline
  introduced_date DATE,
  hearing_date DATE,
  vote_date DATE,
  effective_date DATE,
  
  -- Impact metrics
  estimated_cost_impact DECIMAL(15,2), -- estimated $ impact on operations
  estimated_rent_impact_pct DECIMAL(5,2), -- % impact on achievable rents
  affected_units_count INTEGER, -- number of units potentially affected
  
  -- Risk scoring
  risk_score_impact DECIMAL(5,2) NOT NULL, -- contribution to regulatory risk score
  severity VARCHAR(20) CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  
  -- Source tracking
  source_type VARCHAR(50), -- council_minutes, news_article, legislative_database, manual
  source_url TEXT,
  source_event_id UUID REFERENCES news_events(id) ON DELETE SET NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  resolved_at TIMESTAMP,
  resolution_outcome VARCHAR(100), -- passed, rejected, amended, expired
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_regulatory_events_trade_area ON regulatory_risk_events(trade_area_id);
CREATE INDEX idx_regulatory_events_type ON regulatory_risk_events(legislation_type);
CREATE INDEX idx_regulatory_events_stage ON regulatory_risk_events(legislation_stage);
CREATE INDEX idx_regulatory_events_jurisdiction ON regulatory_risk_events(jurisdiction, jurisdiction_name);
CREATE INDEX idx_regulatory_events_active ON regulatory_risk_events(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_regulatory_events_effective_date ON regulatory_risk_events(effective_date);

-- Zoning Changes Tracking
CREATE TABLE IF NOT EXISTS zoning_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  
  -- Zoning details
  parcel_id VARCHAR(100),
  address TEXT,
  location GEOGRAPHY(POINT, 4326),
  
  -- Current and proposed zoning
  current_zoning VARCHAR(50),
  proposed_zoning VARCHAR(50),
  zoning_change_type VARCHAR(50), -- upzone, downzone, overlay, use_change
  
  -- Impact classification
  impact_type VARCHAR(20) CHECK (impact_type IN ('opportunity', 'risk', 'neutral')),
  risk_score_impact DECIMAL(5,2), -- positive for downzone (risk), negative for upzone (opportunity)
  
  -- Details
  description TEXT,
  hearing_date DATE,
  approval_date DATE,
  effective_date DATE,
  
  -- Status
  status VARCHAR(50), -- proposed, approved, rejected, appealed
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_zoning_changes_trade_area ON zoning_changes(trade_area_id);
CREATE INDEX idx_zoning_changes_location ON zoning_changes USING GIST(location);
CREATE INDEX idx_zoning_changes_type ON zoning_changes(zoning_change_type);
CREATE INDEX idx_zoning_changes_impact ON zoning_changes(impact_type);

-- Tax Policy Changes
CREATE TABLE IF NOT EXISTS tax_policy_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  
  -- Tax details
  tax_type VARCHAR(50) NOT NULL, -- property_tax, transfer_tax, vacancy_tax, special_assessment
  jurisdiction VARCHAR(100) NOT NULL,
  jurisdiction_name VARCHAR(255),
  
  -- Rate changes
  previous_rate DECIMAL(10,6),
  new_rate DECIMAL(10,6),
  rate_change_pct DECIMAL(5,2), -- % change
  
  -- Assessment changes
  assessment_method_change TEXT,
  assessment_impact_pct DECIMAL(5,2),
  
  -- Timeline
  announcement_date DATE,
  effective_date DATE,
  
  -- Impact
  estimated_annual_cost_impact DECIMAL(15,2),
  risk_score_impact DECIMAL(5,2),
  
  -- Details
  description TEXT,
  source_url TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tax_policy_trade_area ON tax_policy_changes(trade_area_id);
CREATE INDEX idx_tax_policy_type ON tax_policy_changes(tax_type);
CREATE INDEX idx_tax_policy_effective_date ON tax_policy_changes(effective_date);

-- ============================================================================
-- MARKET RISK TABLES
-- ============================================================================

-- Market Risk Indicators
-- Tracks macroeconomic conditions affecting property values and operations
CREATE TABLE IF NOT EXISTS market_risk_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  
  -- Time period
  as_of_date DATE NOT NULL,
  
  -- Interest rate environment
  current_10yr_treasury DECIMAL(5,3), -- e.g., 5.50 = 5.50%
  current_mortgage_rate DECIMAL(5,3),
  interest_rate_trend VARCHAR(20), -- rising, falling, stable
  rate_change_3mo DECIMAL(5,3), -- bps change in 3 months
  rate_change_12mo DECIMAL(5,3), -- bps change in 12 months
  
  -- Cap rate sensitivity
  current_cap_rate DECIMAL(5,3),
  estimated_cap_rate_expansion DECIMAL(5,3), -- bps expansion expected
  cap_rate_sensitivity_factor DECIMAL(3,2), -- +100 bps IR = +X bps cap (typically 50-75)
  
  -- Debt service coverage stress test
  current_dscr DECIMAL(5,2),
  stressed_dscr DECIMAL(5,2), -- DSCR under +200 bps rate scenario
  dscr_buffer DECIMAL(5,2), -- how much DSCR can decline before covenant breach
  
  -- Liquidity and capital markets
  transaction_volume_index DECIMAL(5,2), -- 100 = baseline, <80 = illiquid
  days_on_market_avg INTEGER, -- average days on market for comparable sales
  buyer_pool_depth VARCHAR(20), -- deep, moderate, shallow, distressed
  
  -- Credit availability
  loan_to_value_max DECIMAL(5,2), -- max LTV lenders offering
  debt_yield_requirement DECIMAL(5,2), -- typical debt yield requirement
  lending_standard VARCHAR(20), -- loose, normal, tight, frozen
  
  -- Recession indicators
  recession_probability DECIMAL(5,2), -- 0-100, probability of recession in next 12 months
  yield_curve_spread DECIMAL(5,3), -- 10yr - 2yr spread (negative = inversion)
  unemployment_rate DECIMAL(5,2),
  unemployment_trend VARCHAR(20), -- rising, falling, stable
  
  -- Risk scoring
  base_market_risk_score DECIMAL(5,2) NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_market_indicators_trade_area ON market_risk_indicators(trade_area_id);
CREATE INDEX idx_market_indicators_date ON market_risk_indicators(as_of_date DESC);
CREATE UNIQUE INDEX idx_market_indicators_unique ON market_risk_indicators(trade_area_id, as_of_date);

-- Interest Rate Scenarios
CREATE TABLE IF NOT EXISTS interest_rate_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  
  -- Scenario definition
  scenario_name VARCHAR(100) NOT NULL, -- e.g., '+100bps', '+200bps', 'recession', 'baseline'
  scenario_type VARCHAR(50), -- stress_test, projection, historical
  
  -- Interest rate assumptions
  base_rate DECIMAL(5,3),
  stressed_rate DECIMAL(5,3),
  rate_change_bps DECIMAL(5,1), -- basis points change
  
  -- Impact on property
  cap_rate_impact_bps DECIMAL(5,1),
  noi_impact_pct DECIMAL(5,2), -- % change in NOI
  value_impact_pct DECIMAL(5,2), -- % change in property value
  dscr_impact DECIMAL(5,2), -- resulting DSCR
  
  -- Probability and timeline
  probability DECIMAL(5,2), -- 0-100
  timeframe_months INTEGER, -- expected timeframe for scenario
  
  -- Risk contribution
  risk_score_contribution DECIMAL(5,2),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rate_scenarios_trade_area ON interest_rate_scenarios(trade_area_id);
CREATE INDEX idx_rate_scenarios_type ON interest_rate_scenarios(scenario_type);

-- ============================================================================
-- EXECUTION RISK TABLES
-- ============================================================================

-- Execution Risk Factors
-- Tracks construction/renovation risks (cost overruns, delays)
CREATE TABLE IF NOT EXISTS execution_risk_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Time period
  as_of_date DATE NOT NULL,
  
  -- Project details
  project_type VARCHAR(50), -- new_construction, major_renovation, minor_renovation, conversion
  estimated_project_cost DECIMAL(15,2),
  contingency_budget DECIMAL(15,2),
  contingency_pct DECIMAL(5,2), -- contingency as % of project cost
  
  -- Construction cost trends
  construction_cost_index DECIMAL(7,2), -- indexed to baseline (100 = baseline)
  cost_inflation_yoy DECIMAL(5,2), -- % YoY cost inflation
  cost_inflation_trend VARCHAR(20), -- accelerating, stable, decelerating
  
  -- Labor market
  labor_availability VARCHAR(20), -- abundant, adequate, tight, critical
  contractor_availability VARCHAR(20), -- abundant, adequate, limited, scarce
  wage_inflation_yoy DECIMAL(5,2), -- % YoY wage growth
  skilled_labor_shortage BOOLEAN DEFAULT FALSE,
  
  -- Material supply
  material_lead_times_avg INTEGER, -- average lead time in days
  material_price_volatility VARCHAR(20), -- low, moderate, high, extreme
  supply_chain_disruption_risk VARCHAR(20), -- low, moderate, high
  tariff_exposure BOOLEAN DEFAULT FALSE,
  
  -- Contractor risk
  contractor_failure_rate DECIMAL(5,2), -- % of contractors in area that failed recently
  contractor_bonding_availability VARCHAR(20), -- readily_available, limited, difficult
  
  -- Historical overrun rates (by jurisdiction and type)
  historical_cost_overrun_pct DECIMAL(5,2), -- avg % cost overrun for this type/jurisdiction
  historical_schedule_overrun_days INTEGER, -- avg days of delay for this type/jurisdiction
  
  -- Risk scoring
  base_execution_risk_score DECIMAL(5,2) NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_execution_factors_trade_area ON execution_risk_factors(trade_area_id);
CREATE INDEX idx_execution_factors_deal ON execution_risk_factors(deal_id);
CREATE INDEX idx_execution_factors_date ON execution_risk_factors(as_of_date DESC);

-- Construction Cost Tracking
CREATE TABLE IF NOT EXISTS construction_cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  
  -- Time period
  period_month DATE NOT NULL, -- first day of month
  
  -- Cost indices by category
  labor_cost_index DECIMAL(7,2),
  material_cost_index DECIMAL(7,2),
  equipment_cost_index DECIMAL(7,2),
  overall_cost_index DECIMAL(7,2),
  
  -- Key material prices
  concrete_price_per_cy DECIMAL(10,2),
  steel_price_per_ton DECIMAL(10,2),
  lumber_price_per_mbf DECIMAL(10,2),
  
  -- Lead times
  avg_permit_approval_days INTEGER,
  avg_material_lead_days INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_construction_cost_trade_area ON construction_cost_tracking(trade_area_id);
CREATE INDEX idx_construction_cost_period ON construction_cost_tracking(period_month DESC);
CREATE UNIQUE INDEX idx_construction_cost_unique ON construction_cost_tracking(trade_area_id, period_month);

-- ============================================================================
-- CLIMATE/PHYSICAL RISK TABLES
-- ============================================================================

-- Climate Risk Assessments
-- Tracks physical hazards and climate change impacts
CREATE TABLE IF NOT EXISTS climate_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Location
  address TEXT,
  location GEOGRAPHY(POINT, 4326),
  
  -- Flood risk
  fema_flood_zone VARCHAR(10), -- A, AE, AO, V, VE, X, etc.
  fema_zone_description TEXT,
  base_flood_elevation DECIMAL(8,2), -- feet above sea level
  property_elevation DECIMAL(8,2),
  elevation_buffer DECIMAL(8,2), -- property elevation - BFE
  flood_risk_level VARCHAR(20), -- minimal, low, moderate, high, extreme
  
  -- Historical flood events
  flood_event_count_10yr INTEGER,
  last_flood_event_date DATE,
  
  -- Wildfire risk
  wildfire_hazard_zone VARCHAR(50), -- None, Moderate, High, Very High, Extreme
  wui_classification VARCHAR(50), -- Wildland-Urban Interface classification
  distance_to_fire_perimeter_miles DECIMAL(6,2), -- distance to nearest historical fire
  wildfire_risk_level VARCHAR(20), -- minimal, low, moderate, high, extreme
  
  -- Hurricane/wind risk
  hurricane_zone INTEGER, -- 1, 2, 3, 4, 5 (Saffir-Simpson scale exposure)
  wind_design_speed INTEGER, -- mph for building code
  storm_surge_risk_level VARCHAR(20), -- minimal, low, moderate, high, extreme
  
  -- Earthquake risk
  seismic_zone VARCHAR(10), -- 0, 1, 2, 3, 4
  earthquake_risk_level VARCHAR(20), -- minimal, low, moderate, high, extreme
  
  -- Sea level rise (30-year projection)
  current_distance_to_coast_miles DECIMAL(6,2),
  sea_level_rise_30yr_feet DECIMAL(5,2), -- projected SLR in 30 years
  slr_impact_level VARCHAR(20), -- none, low, moderate, high, extreme
  
  -- Extreme temperature risk
  extreme_heat_days_avg INTEGER, -- avg days >95°F per year
  extreme_cold_days_avg INTEGER, -- avg days <20°F per year
  temperature_trend VARCHAR(20), -- increasing, stable, decreasing
  
  -- Insurance implications
  insurance_availability VARCHAR(50), -- readily_available, limited, difficult, unavailable
  insurance_carrier_withdrawals BOOLEAN DEFAULT FALSE,
  insurance_premium_trend VARCHAR(20), -- stable, increasing_moderate, increasing_high, spiking
  estimated_annual_premium DECIMAL(15,2),
  
  -- Climate projection (30-year)
  climate_projection_summary TEXT, -- AI-generated summary of 30-year risks
  
  -- Risk scoring
  base_climate_risk_score DECIMAL(5,2) NOT NULL,
  
  -- Assessment metadata
  assessment_date DATE NOT NULL,
  data_sources JSONB, -- { fema: {...}, noaa: {...}, cat_models: {...} }
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_climate_assessments_trade_area ON climate_risk_assessments(trade_area_id);
CREATE INDEX idx_climate_assessments_property ON climate_risk_assessments(property_id);
CREATE INDEX idx_climate_assessments_location ON climate_risk_assessments USING GIST(location);
CREATE INDEX idx_climate_assessments_fema_zone ON climate_risk_assessments(fema_flood_zone);
CREATE INDEX idx_climate_assessments_wildfire ON climate_risk_assessments(wildfire_hazard_zone);

-- Historical Natural Disaster Events
CREATE TABLE IF NOT EXISTS natural_disaster_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  
  -- Event details
  event_type VARCHAR(50) NOT NULL, -- flood, hurricane, wildfire, tornado, earthquake, extreme_heat
  event_name VARCHAR(255), -- e.g., 'Hurricane Katrina', 'Camp Fire'
  event_date DATE NOT NULL,
  
  -- Location and impact
  location GEOGRAPHY(POINT, 4326),
  affected_radius_miles DECIMAL(6,2),
  
  -- Severity
  severity VARCHAR(20), -- minor, moderate, major, catastrophic
  category_rating VARCHAR(50), -- e.g., 'Category 5', 'EF4', 'Magnitude 7.0'
  
  -- Damage
  estimated_damage_usd DECIMAL(15,2),
  properties_affected INTEGER,
  properties_destroyed INTEGER,
  
  -- Description
  description TEXT,
  
  -- Insurance impact
  insurance_claims_count INTEGER,
  avg_claim_amount DECIMAL(15,2),
  
  -- Source
  source VARCHAR(100), -- FEMA, NOAA, news, insurance_data
  source_url TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_disaster_events_trade_area ON natural_disaster_events(trade_area_id);
CREATE INDEX idx_disaster_events_type ON natural_disaster_events(event_type);
CREATE INDEX idx_disaster_events_date ON natural_disaster_events(event_date DESC);
CREATE INDEX idx_disaster_events_location ON natural_disaster_events USING GIST(location);

-- ============================================================================
-- UPDATE risk_scores TABLE
-- Add columns for 4 new categories (they already have entries in risk_categories)
-- ============================================================================

-- No schema changes needed - risk_scores is already generic
-- Just confirm risk_categories has the 4 new categories marked as implemented

UPDATE risk_categories
SET is_implemented = TRUE, implementation_phase = 3
WHERE category_name IN ('regulatory', 'market', 'execution', 'climate');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Calculate Regulatory Risk Score
CREATE OR REPLACE FUNCTION calculate_regulatory_risk_score(p_trade_area_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_total_risk_impact DECIMAL(5,2);
  v_base_score DECIMAL(5,2);
BEGIN
  -- Sum weighted risk impacts from active regulatory events
  SELECT COALESCE(SUM(risk_score_impact * stage_probability / 100), 0)
  INTO v_total_risk_impact
  FROM regulatory_risk_events
  WHERE trade_area_id = p_trade_area_id
    AND is_active = TRUE;
  
  -- Base score starts at 50 (neutral), adjusted by active events
  v_base_score := 50.0 + v_total_risk_impact;
  
  -- Cap at 0-100
  v_base_score := GREATEST(0, LEAST(100, v_base_score));
  
  RETURN v_base_score;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate Market Risk Score
CREATE OR REPLACE FUNCTION calculate_market_risk_score(p_trade_area_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_latest_indicators market_risk_indicators%ROWTYPE;
  v_base_score DECIMAL(5,2);
  v_interest_rate_adjustment DECIMAL(5,2);
  v_liquidity_adjustment DECIMAL(5,2);
BEGIN
  -- Get latest market indicators
  SELECT * INTO v_latest_indicators
  FROM market_risk_indicators
  WHERE trade_area_id = p_trade_area_id
  ORDER BY as_of_date DESC
  LIMIT 1;
  
  IF v_latest_indicators IS NULL THEN
    RETURN 50.0; -- Neutral if no data
  END IF;
  
  -- Start with base market risk score from indicators
  v_base_score := v_latest_indicators.base_market_risk_score;
  
  RETURN v_base_score;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate Execution Risk Score
CREATE OR REPLACE FUNCTION calculate_execution_risk_score(p_trade_area_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_latest_factors execution_risk_factors%ROWTYPE;
  v_base_score DECIMAL(5,2);
BEGIN
  -- Get latest execution risk factors
  SELECT * INTO v_latest_factors
  FROM execution_risk_factors
  WHERE trade_area_id = p_trade_area_id
  ORDER BY as_of_date DESC
  LIMIT 1;
  
  IF v_latest_factors IS NULL THEN
    RETURN 50.0; -- Neutral if no data
  END IF;
  
  -- Use base execution risk score from factors
  v_base_score := v_latest_factors.base_execution_risk_score;
  
  RETURN v_base_score;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate Climate Risk Score
CREATE OR REPLACE FUNCTION calculate_climate_risk_score(p_trade_area_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_latest_assessment climate_risk_assessments%ROWTYPE;
  v_base_score DECIMAL(5,2);
BEGIN
  -- Get latest climate risk assessment
  SELECT * INTO v_latest_assessment
  FROM climate_risk_assessments
  WHERE trade_area_id = p_trade_area_id
  ORDER BY assessment_date DESC
  LIMIT 1;
  
  IF v_latest_assessment IS NULL THEN
    RETURN 50.0; -- Neutral if no data
  END IF;
  
  -- Use base climate risk score from assessment
  v_base_score := v_latest_assessment.base_climate_risk_score;
  
  RETURN v_base_score;
END;
$$ LANGUAGE plpgsql;

-- Function: Map FEMA flood zone to risk score component
CREATE OR REPLACE FUNCTION fema_zone_to_risk_score(p_fema_zone VARCHAR)
RETURNS DECIMAL(5,2) AS $$
BEGIN
  RETURN CASE 
    WHEN p_fema_zone IN ('A', 'AE', 'AO', 'AH') THEN 25.0  -- High risk
    WHEN p_fema_zone IN ('V', 'VE') THEN 40.0               -- Very high risk (coastal)
    WHEN p_fema_zone IN ('X', 'C', 'B') THEN 5.0            -- Low risk
    WHEN p_fema_zone = 'D' THEN 15.0                        -- Undetermined (moderate)
    ELSE 10.0                                                -- Unknown/other
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_regulatory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER regulatory_events_updated_at
BEFORE UPDATE ON regulatory_risk_events
FOR EACH ROW
EXECUTE FUNCTION update_regulatory_timestamp();

CREATE TRIGGER zoning_changes_updated_at
BEFORE UPDATE ON zoning_changes
FOR EACH ROW
EXECUTE FUNCTION update_regulatory_timestamp();

CREATE TRIGGER climate_assessments_updated_at
BEFORE UPDATE ON climate_risk_assessments
FOR EACH ROW
EXECUTE FUNCTION update_regulatory_timestamp();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Active Regulatory Risks by Trade Area
CREATE OR REPLACE VIEW active_regulatory_risks AS
SELECT 
  ta.id as trade_area_id,
  ta.name as trade_area_name,
  rre.id as event_id,
  rre.legislation_name,
  rre.legislation_type,
  rre.legislation_stage,
  rre.stage_probability,
  rre.risk_score_impact,
  rre.severity,
  rre.effective_date,
  rre.jurisdiction,
  rre.jurisdiction_name
FROM regulatory_risk_events rre
JOIN trade_areas ta ON ta.id = rre.trade_area_id
WHERE rre.is_active = TRUE
ORDER BY rre.risk_score_impact DESC, rre.effective_date ASC;

-- View: Market Risk Summary
CREATE OR REPLACE VIEW market_risk_summary AS
SELECT 
  ta.id as trade_area_id,
  ta.name as trade_area_name,
  mri.as_of_date,
  mri.current_10yr_treasury,
  mri.current_cap_rate,
  mri.estimated_cap_rate_expansion,
  mri.current_dscr,
  mri.stressed_dscr,
  mri.transaction_volume_index,
  mri.recession_probability,
  mri.base_market_risk_score
FROM market_risk_indicators mri
JOIN trade_areas ta ON ta.id = mri.trade_area_id
WHERE mri.as_of_date = (
  SELECT MAX(as_of_date)
  FROM market_risk_indicators mri2
  WHERE mri2.trade_area_id = mri.trade_area_id
)
ORDER BY ta.name;

-- View: Climate Risk Summary
CREATE OR REPLACE VIEW climate_risk_summary AS
SELECT 
  ta.id as trade_area_id,
  ta.name as trade_area_name,
  cra.fema_flood_zone,
  cra.flood_risk_level,
  cra.wildfire_hazard_zone,
  cra.wildfire_risk_level,
  cra.hurricane_zone,
  cra.insurance_availability,
  cra.insurance_premium_trend,
  cra.base_climate_risk_score,
  cra.assessment_date
FROM climate_risk_assessments cra
JOIN trade_areas ta ON ta.id = cra.trade_area_id
WHERE cra.assessment_date = (
  SELECT MAX(assessment_date)
  FROM climate_risk_assessments cra2
  WHERE cra2.trade_area_id = cra.trade_area_id
)
ORDER BY ta.name;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE regulatory_risk_events IS 'Legislative and policy changes affecting RE operations - rent control, STR restrictions, zoning, taxes';
COMMENT ON TABLE market_risk_indicators IS 'Macroeconomic conditions - interest rates, cap rates, liquidity, recession indicators';
COMMENT ON TABLE execution_risk_factors IS 'Construction/renovation risks - cost overruns, labor availability, material supply';
COMMENT ON TABLE climate_risk_assessments IS 'Physical hazards - flood zones, wildfire, hurricanes, climate projections';

COMMENT ON COLUMN regulatory_risk_events.stage_probability IS 'Probability weighting: proposed=25%, committee=50%, vote=75%, enacted=100%';
COMMENT ON COLUMN market_risk_indicators.cap_rate_sensitivity_factor IS 'Basis points of cap expansion per 100 bps rate increase (typically 50-75)';
COMMENT ON COLUMN execution_risk_factors.contingency_pct IS '10% = low risk, 5% = high risk';
COMMENT ON COLUMN climate_risk_assessments.fema_flood_zone IS 'A/AE/V = high risk, X = low risk';
