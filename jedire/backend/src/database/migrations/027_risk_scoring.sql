/**
 * Migration 027: Risk Scoring System
 * Phase 2, Component 3: Supply Risk + Demand Risk Implementation
 * 
 * Creates comprehensive risk assessment infrastructure for JEDI Score
 * - 6 risk categories (2 implemented, 4 placeholders)
 * - Dynamic escalation/de-escalation rules
 * - Time-series risk tracking
 * - User-configurable alert thresholds
 */

-- ============================================================================
-- RISK CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS risk_categories (
  id SERIAL PRIMARY KEY,
  category_name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_implemented BOOLEAN DEFAULT FALSE,
  jedi_weight DECIMAL(3,2) DEFAULT 0.10, -- % contribution to JEDI Risk Score
  implementation_phase INTEGER, -- 2 = current, 3 = future
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO risk_categories (category_name, display_name, description, is_implemented, jedi_weight, implementation_phase) VALUES
  ('supply', 'Supply Risk', 'Probability that new supply erodes occupancy and rent growth beyond underwriting', TRUE, 0.35, 2),
  ('demand', 'Demand Risk', 'Probability that demand drivers weaken or fail to materialize', TRUE, 0.35, 2),
  ('regulatory', 'Regulatory Risk', 'Exposure to rent control, zoning changes, or policy shifts', FALSE, 0.10, 3),
  ('market', 'Market Risk', 'Volatility and cyclical risk in the broader market', FALSE, 0.10, 3),
  ('execution', 'Execution Risk', 'Risk of construction delays, budget overruns, or operational issues', FALSE, 0.05, 3),
  ('climate', 'Climate/Physical Risk', 'Exposure to natural disasters, flooding, or climate change impacts', FALSE, 0.05, 3)
ON CONFLICT (category_name) DO NOTHING;

-- ============================================================================
-- RISK SCORES (Time-Series)
-- ============================================================================

CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  risk_category_id INTEGER NOT NULL REFERENCES risk_categories(id),
  
  -- Score (0-100 scale)
  risk_score DECIMAL(5,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  
  -- Score components (for transparency)
  base_score DECIMAL(5,2) NOT NULL, -- calculated from market data
  escalation_adjustment DECIMAL(5,2) DEFAULT 0.00, -- sum of active escalations
  de_escalation_adjustment DECIMAL(5,2) DEFAULT 0.00, -- sum of de-escalations
  
  -- Calculation metadata
  calculation_method VARCHAR(50) DEFAULT 'standard_v1',
  data_snapshot JSONB, -- raw data used in calculation
  
  -- Severity classification
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  
  -- Timestamps
  calculated_at TIMESTAMP DEFAULT NOW(),
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP, -- NULL = current score
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_risk_scores_trade_area ON risk_scores(trade_area_id);
CREATE INDEX idx_risk_scores_category ON risk_scores(risk_category_id);
CREATE INDEX idx_risk_scores_valid ON risk_scores(valid_from DESC, valid_until) WHERE valid_until IS NULL;
CREATE INDEX idx_risk_scores_level ON risk_scores(risk_level);
CREATE INDEX idx_risk_scores_calculated ON risk_scores(calculated_at DESC);
CREATE UNIQUE INDEX idx_risk_scores_current ON risk_scores(trade_area_id, risk_category_id) WHERE valid_until IS NULL;

-- ============================================================================
-- RISK EVENTS (Triggers for score changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  risk_category_id INTEGER NOT NULL REFERENCES risk_categories(id),
  
  -- Event classification
  event_type VARCHAR(100) NOT NULL, -- e.g., 'pipeline_unit_confirmed', 'employer_exit', 'project_cancelled'
  event_source VARCHAR(50) NOT NULL, -- 'news_event', 'market_data', 'manual_input', 'scheduled_recalc'
  source_event_id UUID, -- link to news_events or other source
  
  -- Event details
  headline TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP NOT NULL,
  
  -- Impact on risk
  risk_impact_type VARCHAR(20) NOT NULL CHECK (risk_impact_type IN ('escalation', 'de_escalation', 'neutral')),
  risk_score_change DECIMAL(5,2), -- positive = increased risk, negative = decreased risk
  
  -- Escalation/De-escalation classification
  severity VARCHAR(20) CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  probability DECIMAL(5,2), -- 0-100, probability event will materialize
  
  -- Event-specific data
  event_data JSONB, -- flexible storage for event details
  
  -- Status tracking
  is_active BOOLEAN DEFAULT TRUE, -- FALSE if event resolved or expired
  resolved_at TIMESTAMP,
  resolution_reason TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_risk_events_trade_area ON risk_events(trade_area_id);
CREATE INDEX idx_risk_events_category ON risk_events(risk_category_id);
CREATE INDEX idx_risk_events_type ON risk_events(event_type);
CREATE INDEX idx_risk_events_source_event ON risk_events(source_event_id);
CREATE INDEX idx_risk_events_active ON risk_events(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_risk_events_date ON risk_events(event_date DESC);

-- ============================================================================
-- RISK ESCALATIONS (Detailed escalation/de-escalation log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS risk_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_event_id UUID NOT NULL REFERENCES risk_events(id) ON DELETE CASCADE,
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  risk_category_id INTEGER NOT NULL REFERENCES risk_categories(id),
  
  -- Escalation details
  escalation_type VARCHAR(20) NOT NULL CHECK (escalation_type IN ('escalation', 'de_escalation')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  
  -- Score impact
  score_impact DECIMAL(5,2) NOT NULL, -- +/- adjustment to risk score
  score_before DECIMAL(5,2),
  score_after DECIMAL(5,2),
  
  -- Trigger details
  trigger_description TEXT NOT NULL,
  trigger_rule VARCHAR(100), -- reference to escalation rule applied
  
  -- Action taken
  action_required TEXT, -- e.g., "Immediate alert, forced reunderwriting"
  action_status VARCHAR(20) DEFAULT 'pending', -- pending, completed, dismissed
  
  -- Decay/expiration
  decay_rate DECIMAL(5,4), -- rate at which escalation decays over time (0-1 per month)
  expires_at TIMESTAMP, -- when escalation automatically expires
  
  -- Metadata
  applied_at TIMESTAMP DEFAULT NOW(),
  applied_by UUID REFERENCES users(id) ON DELETE SET NULL, -- if manual
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_risk_escalations_event ON risk_escalations(risk_event_id);
CREATE INDEX idx_risk_escalations_trade_area ON risk_escalations(trade_area_id);
CREATE INDEX idx_risk_escalations_category ON risk_escalations(risk_category_id);
CREATE INDEX idx_risk_escalations_type ON risk_escalations(escalation_type);
CREATE INDEX idx_risk_escalations_severity ON risk_escalations(severity);
CREATE INDEX idx_risk_escalations_applied ON risk_escalations(applied_at DESC);

-- ============================================================================
-- RISK ALERT THRESHOLDS (User-configurable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS risk_alert_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  risk_category_id INTEGER REFERENCES risk_categories(id) ON DELETE CASCADE, -- NULL = applies to all
  
  -- Threshold settings
  score_threshold DECIMAL(5,2) DEFAULT 70.0, -- alert if risk score exceeds this
  change_threshold DECIMAL(5,2) DEFAULT 5.0, -- alert if score changes by this amount
  
  -- Alert preferences
  alert_on_escalation BOOLEAN DEFAULT TRUE,
  alert_on_critical_only BOOLEAN DEFAULT FALSE,
  
  -- Notification settings
  notification_enabled BOOLEAN DEFAULT TRUE,
  notification_channel VARCHAR(50) DEFAULT 'email', -- email, sms, push, in_app
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, risk_category_id)
);

CREATE INDEX idx_risk_alert_thresholds_user ON risk_alert_thresholds(user_id);
CREATE INDEX idx_risk_alert_thresholds_category ON risk_alert_thresholds(risk_category_id);

-- ============================================================================
-- SUPPLY RISK SPECIFIC TABLES
-- ============================================================================

-- Supply Pipeline Projects
CREATE TABLE IF NOT EXISTS supply_pipeline_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  
  -- Project details
  project_name VARCHAR(255) NOT NULL,
  developer VARCHAR(255),
  address TEXT,
  location GEOGRAPHY(POINT, 4326),
  
  -- Units
  total_units INTEGER NOT NULL,
  affordable_units INTEGER DEFAULT 0,
  market_rate_units INTEGER DEFAULT 0,
  
  -- Status
  project_status VARCHAR(50) NOT NULL, -- rumored, permitted, announced, under_construction, delivered
  probability DECIMAL(5,2) DEFAULT 50.0, -- 0-100, probability of delivery
  
  -- Timeline
  expected_delivery_date DATE,
  groundbreaking_date DATE,
  completion_date DATE,
  
  -- Impact on risk
  risk_contribution DECIMAL(5,2) DEFAULT 0.0, -- contribution to supply risk score
  
  -- Tracking
  source_event_id UUID REFERENCES news_events(id) ON DELETE SET NULL,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Status history
  status_history JSONB -- array of {status, date, source}
);

CREATE INDEX idx_supply_pipeline_trade_area ON supply_pipeline_projects(trade_area_id);
CREATE INDEX idx_supply_pipeline_status ON supply_pipeline_projects(project_status);
CREATE INDEX idx_supply_pipeline_delivery ON supply_pipeline_projects(expected_delivery_date);
CREATE INDEX idx_supply_pipeline_location ON supply_pipeline_projects USING GIST(location);

-- Supply Absorption Tracking
CREATE TABLE IF NOT EXISTS supply_absorption_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  
  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Supply metrics
  existing_units INTEGER NOT NULL,
  pipeline_units INTEGER NOT NULL,
  delivered_units INTEGER, -- units delivered in period
  absorbed_units INTEGER, -- units leased in period
  
  -- Absorption calculation
  absorption_rate DECIMAL(5,2), -- units absorbed per month
  months_to_absorb DECIMAL(5,2), -- pipeline_units / absorption_rate
  absorption_factor DECIMAL(3,2), -- risk multiplier based on absorption timeframe
  
  -- Market conditions
  avg_occupancy DECIMAL(5,2), -- average occupancy in trade area
  avg_rent_psf DECIMAL(10,2), -- average rent per sq ft
  
  calculated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_supply_absorption_trade_area ON supply_absorption_tracking(trade_area_id);
CREATE INDEX idx_supply_absorption_period ON supply_absorption_tracking(period_start DESC);

-- ============================================================================
-- DEMAND RISK SPECIFIC TABLES
-- ============================================================================

-- Employer Concentration Tracking
CREATE TABLE IF NOT EXISTS employer_concentration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  
  -- Employer details
  employer_name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  
  -- Employment metrics
  employee_count INTEGER NOT NULL,
  total_employment_in_area INTEGER NOT NULL, -- for concentration calculation
  concentration_pct DECIMAL(5,2) NOT NULL, -- employee_count / total_employment × 100
  
  -- Risk factors
  employer_stability VARCHAR(20), -- stable, growth, volatile, declining
  relocation_history BOOLEAN DEFAULT FALSE, -- has history of relocations
  remote_work_policy VARCHAR(50), -- full_onsite, hybrid, full_remote
  
  -- Impact on demand risk
  risk_contribution DECIMAL(5,2) DEFAULT 0.0,
  dependency_factor DECIMAL(3,2) DEFAULT 1.0, -- risk multiplier
  
  -- Tracking
  as_of_date DATE NOT NULL,
  source VARCHAR(100),
  source_event_id UUID REFERENCES news_events(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_employer_concentration_trade_area ON employer_concentration(trade_area_id);
CREATE INDEX idx_employer_concentration_pct ON employer_concentration(concentration_pct DESC);
CREATE INDEX idx_employer_concentration_date ON employer_concentration(as_of_date DESC);
CREATE UNIQUE INDEX idx_employer_concentration_unique ON employer_concentration(trade_area_id, employer_name, as_of_date);

-- Demand Driver Events
CREATE TABLE IF NOT EXISTS demand_driver_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  employer_id UUID REFERENCES employer_concentration(id) ON DELETE SET NULL,
  
  -- Event details
  event_type VARCHAR(100) NOT NULL, -- employer_exit, layoff, remote_policy_shift, new_employer, commitment
  event_date DATE NOT NULL,
  headline TEXT NOT NULL,
  description TEXT,
  
  -- Impact metrics
  affected_employees INTEGER,
  impact_pct DECIMAL(5,2), -- % impact on total employment
  
  -- Risk impact
  risk_score_change DECIMAL(5,2), -- impact on demand risk score
  escalation_severity VARCHAR(20), -- low, moderate, high, critical
  
  -- Source
  source_event_id UUID REFERENCES news_events(id) ON DELETE SET NULL,
  confidence DECIMAL(5,2) DEFAULT 50.0,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_demand_driver_events_trade_area ON demand_driver_events(trade_area_id);
CREATE INDEX idx_demand_driver_events_employer ON demand_driver_events(employer_id);
CREATE INDEX idx_demand_driver_events_type ON demand_driver_events(event_type);
CREATE INDEX idx_demand_driver_events_date ON demand_driver_events(event_date DESC);

-- ============================================================================
-- COMPOSITE RISK PROFILE (Pre-computed for performance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS composite_risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id UUID NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
  
  -- Individual category scores (0-100)
  supply_risk DECIMAL(5,2),
  demand_risk DECIMAL(5,2),
  regulatory_risk DECIMAL(5,2),
  market_risk DECIMAL(5,2),
  execution_risk DECIMAL(5,2),
  climate_risk DECIMAL(5,2),
  
  -- Composite calculation
  composite_score DECIMAL(5,2) NOT NULL, -- weighted composite
  highest_category VARCHAR(50),
  highest_category_score DECIMAL(5,2),
  second_highest_category VARCHAR(50),
  second_highest_category_score DECIMAL(5,2),
  
  -- Formula: (Highest × 0.40) + (Second Highest × 0.25) + (Avg of Remaining × 0.35)
  composite_calculation JSONB, -- detailed breakdown
  
  -- Risk classification
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  
  -- Timestamps
  calculated_at TIMESTAMP DEFAULT NOW(),
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP, -- NULL = current
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_composite_risk_trade_area ON composite_risk_profiles(trade_area_id);
CREATE INDEX idx_composite_risk_score ON composite_risk_profiles(composite_score DESC);
CREATE INDEX idx_composite_risk_level ON composite_risk_profiles(risk_level);
CREATE INDEX idx_composite_risk_valid ON composite_risk_profiles(valid_from DESC, valid_until) WHERE valid_until IS NULL;
CREATE UNIQUE INDEX idx_composite_risk_current ON composite_risk_profiles(trade_area_id) WHERE valid_until IS NULL;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Get current risk score for a trade area and category
CREATE OR REPLACE FUNCTION get_current_risk_score(
  p_trade_area_id UUID,
  p_category_name VARCHAR(50)
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_score DECIMAL(5,2);
BEGIN
  SELECT rs.risk_score INTO v_score
  FROM risk_scores rs
  JOIN risk_categories rc ON rc.id = rs.risk_category_id
  WHERE rs.trade_area_id = p_trade_area_id
    AND rc.category_name = p_category_name
    AND rs.valid_until IS NULL
  ORDER BY rs.calculated_at DESC
  LIMIT 1;
  
  RETURN COALESCE(v_score, 50.0); -- Default neutral score
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate absorption factor for supply risk
CREATE OR REPLACE FUNCTION calculate_absorption_factor(p_months_to_absorb DECIMAL)
RETURNS DECIMAL(3,2) AS $$
BEGIN
  RETURN CASE
    WHEN p_months_to_absorb < 12 THEN 0.5  -- Healthy
    WHEN p_months_to_absorb < 24 THEN 1.0  -- Normal
    WHEN p_months_to_absorb < 36 THEN 1.5  -- Concerning
    ELSE 2.0                                -- Critical
  END;
END;
$$ LANGUAGE plpgsql;

-- Function: Classify risk level from score
CREATE OR REPLACE FUNCTION classify_risk_level(p_score DECIMAL)
RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN CASE
    WHEN p_score < 40 THEN 'low'
    WHEN p_score < 60 THEN 'moderate'
    WHEN p_score < 80 THEN 'high'
    ELSE 'critical'
  END;
END;
$$ LANGUAGE plpgsql;

-- Function: Update risk score timestamps on update
CREATE OR REPLACE FUNCTION update_risk_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER risk_events_updated_at
BEFORE UPDATE ON risk_events
FOR EACH ROW
EXECUTE FUNCTION update_risk_timestamp();

CREATE TRIGGER employer_concentration_updated_at
BEFORE UPDATE ON employer_concentration
FOR EACH ROW
EXECUTE FUNCTION update_risk_timestamp();

CREATE TRIGGER risk_alert_thresholds_updated_at
BEFORE UPDATE ON risk_alert_thresholds
FOR EACH ROW
EXECUTE FUNCTION update_risk_timestamp();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Current Risk Scores by Trade Area
CREATE OR REPLACE VIEW current_risk_scores AS
SELECT 
  ta.id as trade_area_id,
  ta.name as trade_area_name,
  rc.category_name,
  rc.display_name as category_display_name,
  rs.risk_score,
  rs.base_score,
  rs.escalation_adjustment,
  rs.de_escalation_adjustment,
  rs.risk_level,
  rs.calculated_at,
  rc.is_implemented
FROM risk_scores rs
JOIN trade_areas ta ON ta.id = rs.trade_area_id
JOIN risk_categories rc ON rc.id = rs.risk_category_id
WHERE rs.valid_until IS NULL
ORDER BY ta.name, rc.category_name;

-- View: Active Risk Events by Trade Area
CREATE OR REPLACE VIEW active_risk_events AS
SELECT 
  re.*,
  ta.name as trade_area_name,
  rc.category_name,
  rc.display_name as category_display_name
FROM risk_events re
JOIN trade_areas ta ON ta.id = re.trade_area_id
JOIN risk_categories rc ON rc.id = re.risk_category_id
WHERE re.is_active = TRUE
ORDER BY re.event_date DESC, re.severity DESC;

-- View: Supply Pipeline Summary
CREATE OR REPLACE VIEW supply_pipeline_summary AS
SELECT 
  ta.id as trade_area_id,
  ta.name as trade_area_name,
  COUNT(*) as project_count,
  SUM(spp.total_units) as total_pipeline_units,
  SUM(CASE WHEN spp.project_status = 'under_construction' THEN spp.total_units ELSE 0 END) as under_construction_units,
  SUM(CASE WHEN spp.expected_delivery_date < NOW() + INTERVAL '6 months' THEN spp.total_units ELSE 0 END) as next_6mo_units,
  SUM(spp.risk_contribution) as total_risk_contribution,
  AVG(spp.probability) as avg_probability
FROM supply_pipeline_projects spp
JOIN trade_areas ta ON ta.id = spp.trade_area_id
WHERE spp.project_status IN ('permitted', 'announced', 'under_construction')
GROUP BY ta.id, ta.name
ORDER BY total_pipeline_units DESC;

-- View: Employer Concentration Summary
CREATE OR REPLACE VIEW employer_concentration_summary AS
SELECT 
  ta.id as trade_area_id,
  ta.name as trade_area_name,
  COUNT(*) as employer_count,
  MAX(ec.concentration_pct) as top_employer_pct,
  SUM(CASE WHEN ec.concentration_pct >= 20 THEN 1 ELSE 0 END) as high_concentration_count,
  SUM(ec.risk_contribution) as total_risk_contribution,
  MAX(ec.as_of_date) as latest_data_date
FROM employer_concentration ec
JOIN trade_areas ta ON ta.id = ec.trade_area_id
WHERE ec.as_of_date = (
  SELECT MAX(as_of_date) 
  FROM employer_concentration ec2 
  WHERE ec2.trade_area_id = ec.trade_area_id
)
GROUP BY ta.id, ta.name
ORDER BY top_employer_pct DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE risk_categories IS 'Risk categories for JEDI Score - 2 implemented (supply, demand), 4 future (regulatory, market, execution, climate)';
COMMENT ON TABLE risk_scores IS 'Time-series risk scores (0-100) for each category per trade area';
COMMENT ON TABLE risk_events IS 'Events that trigger risk score changes (escalations/de-escalations)';
COMMENT ON TABLE risk_escalations IS 'Detailed log of escalation and de-escalation adjustments';
COMMENT ON TABLE risk_alert_thresholds IS 'User-configurable thresholds for risk alerts';
COMMENT ON TABLE supply_pipeline_projects IS 'Tracking of new supply projects and their impact on supply risk';
COMMENT ON TABLE supply_absorption_tracking IS 'Historical absorption rates and market capacity analysis';
COMMENT ON TABLE employer_concentration IS 'Employer concentration metrics for demand risk calculation';
COMMENT ON TABLE demand_driver_events IS 'Events affecting demand drivers (employer changes, policy shifts)';
COMMENT ON TABLE composite_risk_profiles IS 'Pre-computed composite risk scores using weighted formula';

COMMENT ON COLUMN risk_scores.escalation_adjustment IS 'Sum of active escalation impacts (+risk)';
COMMENT ON COLUMN risk_scores.de_escalation_adjustment IS 'Sum of active de-escalation impacts (-risk)';
COMMENT ON COLUMN supply_pipeline_projects.probability IS 'Probability (0-100) that project will be delivered';
COMMENT ON COLUMN employer_concentration.concentration_pct IS 'Employer % of total trade area employment';
COMMENT ON COLUMN composite_risk_profiles.composite_score IS 'Formula: (Highest × 0.40) + (Second × 0.25) + (Avg Remaining × 0.35)';
