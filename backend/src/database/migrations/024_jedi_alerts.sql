-- JEDI Score System & Enhanced Alert System
-- Migration 024: Week 3 - JEDI Score Integration + Alert System
-- Creates tables for JEDI Score calculation, history tracking, and enhanced deal alerts

-- ============================================================================
-- JEDI Score History - Track score changes over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS jedi_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Score breakdown (0-100 scale)
  total_score DECIMAL(5,2) NOT NULL,
  demand_score DECIMAL(5,2) NOT NULL,
  supply_score DECIMAL(5,2) NOT NULL,
  momentum_score DECIMAL(5,2) NOT NULL,
  position_score DECIMAL(5,2) NOT NULL,
  risk_score DECIMAL(5,2) NOT NULL,
  
  -- Weighted contributions (sum to total_score)
  demand_contribution DECIMAL(5,2) NOT NULL,      -- 30% weight
  supply_contribution DECIMAL(5,2) NOT NULL,      -- 25% weight
  momentum_contribution DECIMAL(5,2) NOT NULL,    -- 20% weight
  position_contribution DECIMAL(5,2) NOT NULL,    -- 15% weight
  risk_contribution DECIMAL(5,2) NOT NULL,        -- 10% weight
  
  -- Metadata
  calculation_method VARCHAR(50) DEFAULT 'standard_v1',
  trigger_event_id UUID REFERENCES news_events(id) ON DELETE SET NULL,
  trigger_type VARCHAR(50), -- 'news_event', 'market_update', 'manual_recalc', 'periodic'
  
  -- Change tracking
  previous_score DECIMAL(5,2),
  score_delta DECIMAL(5,2),
  
  -- Snapshot data (JSONB for flexibility)
  market_snapshot JSONB, -- market conditions at calculation time
  demand_factors JSONB, -- employment events, population growth, etc.
  supply_factors JSONB, -- pipeline, absorption, vacancy
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_jedi_score_history_deal ON jedi_score_history(deal_id);
CREATE INDEX idx_jedi_score_history_created ON jedi_score_history(created_at DESC);
CREATE INDEX idx_jedi_score_history_trigger_event ON jedi_score_history(trigger_event_id);
CREATE INDEX idx_jedi_score_history_score ON jedi_score_history(total_score DESC);
CREATE INDEX idx_jedi_score_history_delta ON jedi_score_history(ABS(score_delta) DESC) WHERE score_delta IS NOT NULL;

-- ============================================================================
-- Deal Alerts - Enhanced alert system with JEDI Score integration
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Alert classification
  alert_type VARCHAR(50) NOT NULL, -- 'demand_positive', 'supply_competition', 'demand_negative', 'score_change', 'market_shift'
  severity VARCHAR(20) NOT NULL, -- 'green', 'yellow', 'red'
  
  -- Alert content
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  suggested_action TEXT,
  
  -- JEDI Score context
  jedi_score_before DECIMAL(5,2),
  jedi_score_after DECIMAL(5,2),
  jedi_score_change DECIMAL(5,2),
  primary_signal VARCHAR(50), -- which signal caused the alert (demand, supply, etc.)
  
  -- Linked entities
  linked_event_ids UUID[], -- array of news_event IDs that triggered this alert
  linked_trade_area_id UUID REFERENCES trade_areas(id) ON DELETE SET NULL,
  
  -- Impact quantification
  impact_summary TEXT, -- e.g., "State Farm campus adds +3.2 to JEDI Score"
  impact_data JSONB, -- detailed breakdown
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  snoozed_until TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  archived_at TIMESTAMP
);

CREATE INDEX idx_deal_alerts_user ON deal_alerts(user_id);
CREATE INDEX idx_deal_alerts_deal ON deal_alerts(deal_id);
CREATE INDEX idx_deal_alerts_type ON deal_alerts(alert_type);
CREATE INDEX idx_deal_alerts_severity ON deal_alerts(severity);
CREATE INDEX idx_deal_alerts_unread ON deal_alerts(user_id, is_read) WHERE is_read = FALSE AND is_dismissed = FALSE;
CREATE INDEX idx_deal_alerts_created ON deal_alerts(created_at DESC);
CREATE INDEX idx_deal_alerts_score_change ON deal_alerts(ABS(jedi_score_change) DESC) WHERE jedi_score_change IS NOT NULL;

-- ============================================================================
-- Alert Configurations - User-specific alert thresholds
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Threshold settings
  score_change_threshold DECIMAL(5,2) DEFAULT 2.0, -- Alert if JEDI Score changes by this amount
  demand_sensitivity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
  supply_sensitivity VARCHAR(20) DEFAULT 'medium',
  
  -- Alert preferences
  alert_frequency VARCHAR(20) DEFAULT 'realtime', -- 'realtime', 'daily_digest', 'weekly_digest'
  green_alerts_enabled BOOLEAN DEFAULT TRUE,
  yellow_alerts_enabled BOOLEAN DEFAULT TRUE,
  red_alerts_enabled BOOLEAN DEFAULT TRUE,
  
  -- Delivery preferences
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT FALSE,
  in_app_only BOOLEAN DEFAULT FALSE,
  
  -- Filtering
  min_impact_score DECIMAL(5,2) DEFAULT 50.0, -- Ignore events with impact score below this
  active_deals_only BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- ============================================================================
-- Signal Weights - Dynamic weighting for demand signals
-- ============================================================================

CREATE TABLE IF NOT EXISTS demand_signal_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Signal classification
  event_category VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  
  -- Weighting factors
  base_weight DECIMAL(3,2) DEFAULT 1.0, -- 0.0-1.0
  confidence_multiplier JSONB, -- {high: 1.0, medium: 0.8, low: 0.5}
  
  -- Impact calibration
  max_jedi_impact DECIMAL(5,2) DEFAULT 15.0, -- Maximum JEDI score change
  decay_radius_miles DECIMAL(5,2) DEFAULT 5.0,
  
  -- Conversion factors (employment events)
  housing_conversion_rate DECIMAL(3,2), -- jobs → housing units
  occupancy_factor DECIMAL(3,2), -- % of new residents renting
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(event_category, event_type)
);

-- Seed default signal weights
INSERT INTO demand_signal_weights (event_category, event_type, base_weight, confidence_multiplier, max_jedi_impact, housing_conversion_rate, occupancy_factor)
VALUES 
  -- Employment events (positive demand)
  ('employment', 'company_relocation_inbound', 1.0, '{"high": 1.0, "medium": 0.8, "low": 0.5}'::jsonb, 15.0, 0.65, 0.67),
  ('employment', 'company_expansion', 0.9, '{"high": 1.0, "medium": 0.8, "low": 0.5}'::jsonb, 12.0, 0.65, 0.67),
  ('employment', 'major_hiring_announcement', 0.8, '{"high": 1.0, "medium": 0.8, "low": 0.5}'::jsonb, 10.0, 0.65, 0.67),
  
  -- Employment events (negative demand)
  ('employment', 'company_relocation_outbound', -1.0, '{"high": 1.0, "medium": 0.8, "low": 0.5}'::jsonb, -15.0, 0.65, 0.67),
  ('employment', 'layoff_announcement', -0.9, '{"high": 1.0, "medium": 0.8, "low": 0.5}'::jsonb, -12.0, 0.65, 0.67),
  ('employment', 'company_closure', -1.0, '{"high": 1.0, "medium": 0.8, "low": 0.5}'::jsonb, -15.0, 0.65, 0.67),
  
  -- Development events (supply pressure)
  ('development', 'multifamily_permit_approval', -0.7, '{"high": 1.0, "medium": 0.8, "low": 0.6}'::jsonb, -10.0, NULL, NULL),
  ('development', 'groundbreaking_ceremony', -0.6, '{"high": 1.0, "medium": 0.8, "low": 0.6}'::jsonb, -8.0, NULL, NULL),
  
  -- Amenity events (positive demand)
  ('amenities', 'transit_station_opening', 0.6, '{"high": 1.0, "medium": 0.8, "low": 0.5}'::jsonb, 8.0, NULL, NULL),
  ('amenities', 'major_retail_opening', 0.5, '{"high": 1.0, "medium": 0.8, "low": 0.5}'::jsonb, 6.0, NULL, NULL)
ON CONFLICT (event_category, event_type) DO NOTHING;

-- ============================================================================
-- Functions & Triggers
-- ============================================================================

-- Function: Update timestamps
CREATE OR REPLACE FUNCTION update_alert_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alert_configurations_updated_at
BEFORE UPDATE ON alert_configurations
FOR EACH ROW
EXECUTE FUNCTION update_alert_config_timestamp();

CREATE TRIGGER demand_signal_weights_updated_at
BEFORE UPDATE ON demand_signal_weights
FOR EACH ROW
EXECUTE FUNCTION update_alert_config_timestamp();

-- Function: Get latest JEDI Score for a deal
CREATE OR REPLACE FUNCTION get_latest_jedi_score(p_deal_id UUID)
RETURNS TABLE (
  total_score DECIMAL(5,2),
  demand_score DECIMAL(5,2),
  supply_score DECIMAL(5,2),
  momentum_score DECIMAL(5,2),
  position_score DECIMAL(5,2),
  risk_score DECIMAL(5,2),
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jsh.total_score,
    jsh.demand_score,
    jsh.supply_score,
    jsh.momentum_score,
    jsh.position_score,
    jsh.risk_score,
    jsh.created_at
  FROM jedi_score_history jsh
  WHERE jsh.deal_id = p_deal_id
  ORDER BY jsh.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate JEDI Score trend (7-day, 30-day)
CREATE OR REPLACE FUNCTION get_jedi_score_trend(p_deal_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  avg_score DECIMAL(5,2),
  min_score DECIMAL(5,2),
  max_score DECIMAL(5,2),
  score_volatility DECIMAL(5,2),
  trend_direction VARCHAR(10)
) AS $$
DECLARE
  v_first_score DECIMAL(5,2);
  v_last_score DECIMAL(5,2);
BEGIN
  -- Get first and last scores in the period
  SELECT jsh.total_score INTO v_first_score
  FROM jedi_score_history jsh
  WHERE jsh.deal_id = p_deal_id
    AND jsh.created_at >= NOW() - (p_days || ' days')::INTERVAL
  ORDER BY jsh.created_at ASC
  LIMIT 1;
  
  SELECT jsh.total_score INTO v_last_score
  FROM jedi_score_history jsh
  WHERE jsh.deal_id = p_deal_id
    AND jsh.created_at >= NOW() - (p_days || ' days')::INTERVAL
  ORDER BY jsh.created_at DESC
  LIMIT 1;
  
  RETURN QUERY
  SELECT 
    AVG(jsh.total_score)::DECIMAL(5,2) as avg_score,
    MIN(jsh.total_score)::DECIMAL(5,2) as min_score,
    MAX(jsh.total_score)::DECIMAL(5,2) as max_score,
    STDDEV(jsh.total_score)::DECIMAL(5,2) as score_volatility,
    CASE 
      WHEN v_last_score > v_first_score THEN 'up'::VARCHAR(10)
      WHEN v_last_score < v_first_score THEN 'down'::VARCHAR(10)
      ELSE 'flat'::VARCHAR(10)
    END as trend_direction
  FROM jedi_score_history jsh
  WHERE jsh.deal_id = p_deal_id
    AND jsh.created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- View: Deal JEDI Score Summary (latest score + 30-day trend)
CREATE OR REPLACE VIEW deal_jedi_summary AS
SELECT 
  d.id as deal_id,
  d.name as deal_name,
  d.stage,
  latest.total_score as current_score,
  latest.demand_score,
  latest.supply_score,
  latest.created_at as last_calculated,
  (SELECT COUNT(*) FROM jedi_score_history WHERE deal_id = d.id) as score_history_count,
  (SELECT COUNT(*) FROM deal_alerts WHERE deal_id = d.id AND is_read = FALSE) as unread_alerts_count
FROM deals d
LEFT JOIN LATERAL (
  SELECT * FROM jedi_score_history 
  WHERE deal_id = d.id 
  ORDER BY created_at DESC 
  LIMIT 1
) latest ON true;

-- View: Active Deal Alerts (unread, not dismissed, not snoozed)
CREATE OR REPLACE VIEW active_deal_alerts AS
SELECT 
  da.*,
  d.name as deal_name,
  u.email as user_email
FROM deal_alerts da
JOIN deals d ON d.id = da.deal_id
JOIN users u ON u.id = da.user_id
WHERE da.is_read = FALSE
  AND da.is_dismissed = FALSE
  AND da.is_archived = FALSE
  AND (da.snoozed_until IS NULL OR da.snoozed_until < NOW())
ORDER BY da.created_at DESC;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE jedi_score_history IS 'Historical JEDI Score calculations for deals - tracks score changes over time';
COMMENT ON TABLE deal_alerts IS 'Enhanced alert system for deal notifications triggered by JEDI Score changes and news events';
COMMENT ON TABLE alert_configurations IS 'User-specific alert preferences and thresholds';
COMMENT ON TABLE demand_signal_weights IS 'Configurable weights and impact factors for demand signal events';

COMMENT ON COLUMN jedi_score_history.demand_contribution IS '30% weight: Employment events, population growth, economic indicators';
COMMENT ON COLUMN jedi_score_history.supply_contribution IS '25% weight: Pipeline units, absorption rates, vacancy trends';
COMMENT ON COLUMN jedi_score_history.momentum_contribution IS '20% weight: Rent growth, transaction velocity, market sentiment';
COMMENT ON COLUMN jedi_score_history.position_contribution IS '15% weight: Submarket strength, proximity to amenities, competitive position';
COMMENT ON COLUMN jedi_score_history.risk_contribution IS '10% weight: Market volatility, political/regulatory risk, concentration risk';

COMMENT ON COLUMN deal_alerts.severity IS 'Green = positive catalyst, Yellow = competition/caution, Red = negative impact';
COMMENT ON COLUMN deal_alerts.impact_summary IS 'Human-readable summary like "State Farm campus adds +3.2 to JEDI Score"';
