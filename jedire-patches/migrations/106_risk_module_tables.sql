CREATE TABLE IF NOT EXISTS risk_categories (
  id SERIAL PRIMARY KEY,
  category_name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  weight NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  implementation_phase INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO risk_categories (category_name, display_name, description, weight, implementation_phase)
VALUES
  ('supply',     'Supply Risk',     'Pipeline units and absorption rates',          35.00, 2),
  ('demand',     'Demand Risk',     'Employer concentration and demand drivers',    35.00, 2),
  ('regulatory', 'Regulatory Risk', 'Zoning, tax policy, and legislative changes',  10.00, 3),
  ('market',     'Market Risk',     'Interest rates, cap rates, recession risk',     10.00, 3),
  ('execution',  'Execution Risk',  'Construction costs, labor, materials',           5.00, 3),
  ('climate',    'Climate Risk',    'Flood, wildfire, hurricane, insurance',           5.00, 3)
ON CONFLICT (category_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  risk_category_id INT NOT NULL REFERENCES risk_categories(id),
  event_type VARCHAR(50) NOT NULL,
  headline VARCHAR(500),
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  risk_impact_type VARCHAR(20) NOT NULL DEFAULT 'neutral',
  risk_score_change NUMERIC(6,2) NOT NULL DEFAULT 0,
  severity VARCHAR(20) NOT NULL DEFAULT 'low',
  probability NUMERIC(5,4) NOT NULL DEFAULT 1.0000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  auto_resolve_days INT,
  event_source VARCHAR(100),
  event_data JSONB DEFAULT '{}',
  resolved_at TIMESTAMPTZ,
  resolution_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_events_trade_area ON risk_events(trade_area_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_category ON risk_events(risk_category_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_active ON risk_events(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS risk_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  risk_category_id INT REFERENCES risk_categories(id),
  category_name VARCHAR(50),
  base_score NUMERIC(6,2) NOT NULL,
  escalation_adjustment NUMERIC(6,2) NOT NULL DEFAULT 0,
  de_escalation_adjustment NUMERIC(6,2) NOT NULL DEFAULT 0,
  final_score NUMERIC(6,2) NOT NULL,
  risk_level VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_score_history_ta ON risk_score_history(trade_area_id, calculated_at DESC);

CREATE TABLE IF NOT EXISTS risk_alert_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  risk_category_id INT REFERENCES risk_categories(id),
  score_threshold NUMERIC(5,2) NOT NULL DEFAULT 70.00,
  change_threshold NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  alert_on_escalation BOOLEAN NOT NULL DEFAULT TRUE,
  alert_on_critical_only BOOLEAN NOT NULL DEFAULT FALSE,
  notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notification_channel VARCHAR(20) NOT NULL DEFAULT 'email',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, risk_category_id)
);

CREATE TABLE IF NOT EXISTS supply_pipeline_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  project_name VARCHAR(300),
  developer VARCHAR(300),
  total_units INT NOT NULL DEFAULT 0,
  project_status VARCHAR(50) NOT NULL DEFAULT 'announced',
  probability NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  expected_delivery_date DATE,
  risk_contribution NUMERIC(6,2) NOT NULL DEFAULT 0,
  address TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supply_pipeline_ta ON supply_pipeline_projects(trade_area_id);

CREATE TABLE IF NOT EXISTS supply_absorption_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  units_absorbed INT NOT NULL DEFAULT 0,
  units_delivered INT NOT NULL DEFAULT 0,
  absorption_rate NUMERIC(6,4),
  months_to_absorb NUMERIC(8,2),
  absorption_factor NUMERIC(6,4) DEFAULT 1.0,
  vacancy_rate NUMERIC(5,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supply_absorption_ta ON supply_absorption_tracking(trade_area_id, period_start DESC);

CREATE TABLE IF NOT EXISTS employer_concentration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  employer_name VARCHAR(300) NOT NULL,
  industry VARCHAR(100),
  employee_count INT NOT NULL DEFAULT 0,
  concentration_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  employer_stability VARCHAR(20) DEFAULT 'stable',
  relocation_history VARCHAR(20) DEFAULT 'none',
  remote_work_policy VARCHAR(50) DEFAULT 'hybrid',
  risk_contribution NUMERIC(6,2) NOT NULL DEFAULT 0,
  dependency_factor NUMERIC(5,4) NOT NULL DEFAULT 0,
  as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employer_concentration_ta ON employer_concentration(trade_area_id, as_of_date DESC);

CREATE TABLE IF NOT EXISTS demand_driver_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  headline VARCHAR(500),
  description TEXT,
  affected_employees INT DEFAULT 0,
  impact_pct NUMERIC(5,2) DEFAULT 0,
  risk_score_change NUMERIC(6,2) DEFAULT 0,
  escalation_severity VARCHAR(20) DEFAULT 'low',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_demand_driver_events_ta ON demand_driver_events(trade_area_id, event_date DESC);

CREATE TABLE IF NOT EXISTS regulatory_risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  legislation_name VARCHAR(500) NOT NULL,
  legislation_type VARCHAR(100),
  legislation_stage VARCHAR(50) DEFAULT 'proposed',
  stage_probability NUMERIC(5,2) DEFAULT 50.00,
  risk_score_impact NUMERIC(6,2) DEFAULT 0,
  severity VARCHAR(20) DEFAULT 'moderate',
  effective_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_regulatory_risk_events_ta ON regulatory_risk_events(trade_area_id);

CREATE TABLE IF NOT EXISTS zoning_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  address TEXT,
  current_zoning VARCHAR(50),
  proposed_zoning VARCHAR(50),
  zoning_change_type VARCHAR(50),
  impact_type VARCHAR(50),
  risk_score_impact NUMERIC(6,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'proposed',
  hearing_date DATE,
  effective_date DATE,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_zoning_changes_ta ON zoning_changes(trade_area_id);

CREATE TABLE IF NOT EXISTS tax_policy_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  tax_type VARCHAR(100) NOT NULL,
  jurisdiction_name VARCHAR(200),
  previous_rate NUMERIC(8,4),
  new_rate NUMERIC(8,4),
  rate_change_pct NUMERIC(6,2),
  estimated_annual_cost_impact NUMERIC(14,2),
  effective_date DATE,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tax_policy_changes_ta ON tax_policy_changes(trade_area_id);

CREATE TABLE IF NOT EXISTS market_risk_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_10yr_treasury NUMERIC(6,4) DEFAULT 4.2500,
  current_cap_rate NUMERIC(6,4) DEFAULT 5.5000,
  estimated_cap_rate_expansion NUMERIC(6,2) DEFAULT 50.00,
  current_dscr NUMERIC(6,4) DEFAULT 1.3500,
  stressed_dscr NUMERIC(6,4) DEFAULT 1.1500,
  dscr_buffer NUMERIC(6,4) DEFAULT 0.2000,
  transaction_volume_index NUMERIC(6,2) DEFAULT 95.00,
  days_on_market_avg INT DEFAULT 90,
  recession_probability NUMERIC(5,2) DEFAULT 25.00,
  yield_curve_spread NUMERIC(8,4) DEFAULT 0.5000,
  unemployment_rate NUMERIC(5,2) DEFAULT 3.80,
  base_market_risk_score NUMERIC(6,2) DEFAULT 50.00,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_market_risk_indicators_ta ON market_risk_indicators(trade_area_id, as_of_date DESC);

CREATE TABLE IF NOT EXISTS interest_rate_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  scenario_name VARCHAR(200) NOT NULL,
  rate_change_bps INT NOT NULL DEFAULT 0,
  cap_rate_impact_bps INT NOT NULL DEFAULT 0,
  value_impact_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  dscr_impact NUMERIC(6,4) NOT NULL DEFAULT 0,
  probability NUMERIC(5,2) NOT NULL DEFAULT 0,
  risk_score_contribution NUMERIC(6,2) NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interest_rate_scenarios_ta ON interest_rate_scenarios(trade_area_id);

CREATE TABLE IF NOT EXISTS execution_risk_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
  project_type VARCHAR(50) DEFAULT 'value_add',
  estimated_project_cost NUMERIC(14,2) DEFAULT 0,
  contingency_pct NUMERIC(5,2) DEFAULT 10.00,
  cost_inflation_yoy NUMERIC(5,2) DEFAULT 5.00,
  labor_availability VARCHAR(20) DEFAULT 'moderate',
  contractor_availability VARCHAR(20) DEFAULT 'moderate',
  wage_inflation_yoy NUMERIC(5,2) DEFAULT 4.00,
  skilled_labor_shortage BOOLEAN DEFAULT FALSE,
  material_lead_times_avg INT DEFAULT 30,
  material_price_volatility VARCHAR(20) DEFAULT 'moderate',
  tariff_exposure BOOLEAN DEFAULT FALSE,
  contractor_failure_rate NUMERIC(5,2) DEFAULT 2.00,
  historical_cost_overrun_pct NUMERIC(5,2) DEFAULT 8.00,
  historical_schedule_overrun_days INT DEFAULT 30,
  base_execution_risk_score NUMERIC(6,2) DEFAULT 50.00,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_execution_risk_factors_ta ON execution_risk_factors(trade_area_id, as_of_date DESC);

CREATE TABLE IF NOT EXISTS construction_cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  overall_cost_index NUMERIC(8,2) DEFAULT 100.00,
  labor_cost_index NUMERIC(8,2) DEFAULT 100.00,
  material_cost_index NUMERIC(8,2) DEFAULT 100.00,
  avg_permit_approval_days INT DEFAULT 60,
  avg_material_lead_days INT DEFAULT 30,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_construction_cost_ta ON construction_cost_tracking(trade_area_id, period_month DESC);

CREATE TABLE IF NOT EXISTS climate_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  base_climate_risk_score NUMERIC(6,2) DEFAULT 50.00,
  fema_flood_zone VARCHAR(10) DEFAULT 'X',
  fema_zone_description TEXT DEFAULT 'Minimal flood hazard area',
  base_flood_elevation NUMERIC(8,2) DEFAULT 0,
  property_elevation NUMERIC(8,2) DEFAULT 0,
  elevation_buffer NUMERIC(8,2) DEFAULT 0,
  flood_risk_level VARCHAR(20) DEFAULT 'minimal',
  flood_event_count_10yr INT DEFAULT 0,
  wildfire_hazard_zone VARCHAR(50) DEFAULT 'None',
  wui_classification VARCHAR(50) DEFAULT 'Non-WUI',
  distance_to_fire_perimeter_miles NUMERIC(8,2) DEFAULT 100.00,
  wildfire_risk_level VARCHAR(20) DEFAULT 'minimal',
  hurricane_zone INT DEFAULT 0,
  wind_design_speed INT DEFAULT 90,
  storm_surge_risk_level VARCHAR(20) DEFAULT 'minimal',
  seismic_zone VARCHAR(10) DEFAULT '0',
  earthquake_risk_level VARCHAR(20) DEFAULT 'minimal',
  current_distance_to_coast_miles NUMERIC(8,2) DEFAULT 100.00,
  sea_level_rise_30yr_feet NUMERIC(6,2) DEFAULT 0.50,
  slr_impact_level VARCHAR(20) DEFAULT 'minimal',
  insurance_availability VARCHAR(50) DEFAULT 'readily_available',
  insurance_carrier_withdrawals BOOLEAN DEFAULT FALSE,
  insurance_premium_trend VARCHAR(50) DEFAULT 'stable',
  estimated_annual_premium NUMERIC(14,2) DEFAULT 15000.00,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_climate_risk_ta ON climate_risk_assessments(trade_area_id, assessment_date DESC);

CREATE TABLE IF NOT EXISTS natural_disaster_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_name VARCHAR(300),
  event_date DATE NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'low',
  estimated_damage_usd NUMERIC(14,2) DEFAULT 0,
  properties_affected INT DEFAULT 0,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_natural_disaster_ta ON natural_disaster_events(trade_area_id, event_date DESC);

CREATE TABLE IF NOT EXISTS risk_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_event_id UUID NOT NULL REFERENCES risk_events(id) ON DELETE CASCADE,
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  risk_category_id INT NOT NULL REFERENCES risk_categories(id),
  escalation_type VARCHAR(20) NOT NULL DEFAULT 'escalation',
  severity VARCHAR(20) NOT NULL DEFAULT 'low',
  score_impact NUMERIC(6,2) NOT NULL DEFAULT 0,
  trigger_description TEXT,
  trigger_rule VARCHAR(100),
  action_required TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_escalations_ta ON risk_escalations(trade_area_id);
CREATE INDEX IF NOT EXISTS idx_risk_escalations_event ON risk_escalations(risk_event_id);

CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  risk_category_id INT NOT NULL REFERENCES risk_categories(id),
  risk_score NUMERIC(6,2) NOT NULL,
  base_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  escalation_adjustment NUMERIC(6,2) NOT NULL DEFAULT 0,
  de_escalation_adjustment NUMERIC(6,2) NOT NULL DEFAULT 0,
  risk_level VARCHAR(20) NOT NULL DEFAULT 'moderate',
  data_snapshot JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_risk_scores_ta ON risk_scores(trade_area_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_scores_valid ON risk_scores(trade_area_id, risk_category_id) WHERE valid_until IS NULL;

CREATE TABLE IF NOT EXISTS composite_risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  supply_risk NUMERIC(6,2) NOT NULL DEFAULT 50,
  demand_risk NUMERIC(6,2) NOT NULL DEFAULT 50,
  regulatory_risk NUMERIC(6,2) NOT NULL DEFAULT 50,
  market_risk NUMERIC(6,2) NOT NULL DEFAULT 50,
  execution_risk NUMERIC(6,2) NOT NULL DEFAULT 50,
  climate_risk NUMERIC(6,2) NOT NULL DEFAULT 50,
  composite_score NUMERIC(6,2) NOT NULL DEFAULT 50,
  highest_category VARCHAR(50),
  highest_category_score NUMERIC(6,2),
  second_highest_category VARCHAR(50),
  second_highest_category_score NUMERIC(6,2),
  risk_level VARCHAR(20) NOT NULL DEFAULT 'moderate',
  methodology JSONB DEFAULT '{}',
  composite_calculation JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_composite_risk_ta ON composite_risk_profiles(trade_area_id, calculated_at DESC);
