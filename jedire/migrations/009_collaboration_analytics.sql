-- =====================================================
-- Migration 009: Collaboration & Analytics Tables
-- =====================================================
-- Description: Tables for team collaboration, insights, predictions, and alerts
-- Created: 2026-01-31
-- =====================================================

-- =====================================================
-- Collaboration Sessions
-- =====================================================

CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Session details
    session_name VARCHAR(255),
    description TEXT,
    
    -- Owner/creator
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Participants
    participant_ids UUID[],
    active_user_ids UUID[],
    
    -- Map state
    center_lat DECIMAL(10, 7),
    center_lng DECIMAL(11, 7),
    zoom_level INTEGER,
    active_layers TEXT[],
    
    -- Filters
    active_filters JSONB,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_activity_at TIMESTAMP DEFAULT NOW(),
    
    -- Sharing
    share_token VARCHAR(100) UNIQUE,
    is_public BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_org ON collaboration_sessions(organization_id);
CREATE INDEX idx_sessions_creator ON collaboration_sessions(created_by);
CREATE INDEX idx_sessions_active ON collaboration_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_share ON collaboration_sessions(share_token) WHERE share_token IS NOT NULL;

COMMENT ON TABLE collaboration_sessions IS 'Real-time collaboration sessions for teams';
COMMENT ON COLUMN collaboration_sessions.share_token IS 'Unique token for sharing session with others';

-- =====================================================
-- Property Pins & Annotations
-- =====================================================

CREATE TABLE property_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    session_id UUID REFERENCES collaboration_sessions(id) ON DELETE SET NULL,
    
    -- Pin details
    pin_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'target', 'watch', 'pass'
    pin_color VARCHAR(20),
    pin_icon VARCHAR(50),
    
    -- Notes
    title VARCHAR(255),
    notes TEXT,
    
    -- Tags
    tags TEXT[],
    
    -- Lists
    list_ids UUID[], -- Multiple lists property can belong to
    
    -- Rating
    user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
    
    -- Status
    status VARCHAR(50), -- 'active', 'archived', 'completed', 'passed'
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pins_property ON property_pins(property_id);
CREATE INDEX idx_pins_user ON property_pins(user_id);
CREATE INDEX idx_pins_org ON property_pins(organization_id);
CREATE INDEX idx_pins_session ON property_pins(session_id);
CREATE INDEX idx_pins_status ON property_pins(status);
CREATE INDEX idx_pins_tags ON property_pins USING GIN(tags);

COMMENT ON TABLE property_pins IS 'User pins and annotations on properties';

-- =====================================================
-- Property Lists (Portfolios)
-- =====================================================

CREATE TABLE property_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- List details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    list_type VARCHAR(50), -- 'targets', 'tracking', 'pipeline', 'portfolio', 'archived'
    
    -- Properties
    property_ids UUID[],
    property_count INTEGER DEFAULT 0,
    
    -- Sharing
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with_user_ids UUID[],
    
    -- Visibility
    is_public BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lists_org ON property_lists(organization_id);
CREATE INDEX idx_lists_creator ON property_lists(created_by);
CREATE INDEX idx_lists_type ON property_lists(list_type);
CREATE INDEX idx_lists_shared ON property_lists(is_shared) WHERE is_shared = TRUE;

COMMENT ON TABLE property_lists IS 'User-created lists of properties for tracking and organization';

-- =====================================================
-- Comments & Discussion
-- =====================================================

CREATE TABLE property_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Comment details
    comment_text TEXT NOT NULL,
    
    -- Threading
    parent_comment_id UUID REFERENCES property_comments(id) ON DELETE CASCADE,
    thread_depth INTEGER DEFAULT 0,
    
    -- Mentions
    mentioned_user_ids UUID[],
    
    -- Attachments
    attachment_urls TEXT[],
    
    -- Reactions
    reactions JSONB DEFAULT '{}', -- {thumbs_up: 5, heart: 2, ...}
    
    -- Status
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comments_property ON property_comments(property_id);
CREATE INDEX idx_comments_user ON property_comments(user_id);
CREATE INDEX idx_comments_org ON property_comments(organization_id);
CREATE INDEX idx_comments_parent ON property_comments(parent_comment_id);
CREATE INDEX idx_comments_created ON property_comments(created_at DESC);

COMMENT ON TABLE property_comments IS 'User comments and discussions on properties';

-- =====================================================
-- Activity Feed
-- =====================================================

CREATE TABLE activity_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Activity details
    activity_type VARCHAR(50), -- 'property_pinned', 'comment_added', 'analysis_completed', etc.
    activity_title VARCHAR(255),
    activity_description TEXT,
    
    -- Related entities
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    session_id UUID REFERENCES collaboration_sessions(id) ON DELETE SET NULL,
    
    -- Activity data
    activity_data JSONB,
    
    -- Visibility
    is_public BOOLEAN DEFAULT TRUE,
    visible_to_user_ids UUID[],
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_org ON activity_feed(organization_id);
CREATE INDEX idx_activity_user ON activity_feed(user_id);
CREATE INDEX idx_activity_property ON activity_feed(property_id);
CREATE INDEX idx_activity_type ON activity_feed(activity_type);
CREATE INDEX idx_activity_created ON activity_feed(created_at DESC);

COMMENT ON TABLE activity_feed IS 'Activity stream for collaboration and team awareness';

-- =====================================================
-- Property Insights (Agent-Generated)
-- =====================================================

CREATE TABLE property_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    
    -- Insight source
    module_type module_type NOT NULL,
    insight_type VARCHAR(100), -- 'opportunity', 'risk', 'trend', 'recommendation'
    
    -- Insight content
    title VARCHAR(255) NOT NULL,
    description TEXT,
    impact_level VARCHAR(20), -- 'high', 'medium', 'low'
    
    -- Score/confidence
    confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
    importance_score INTEGER CHECK (importance_score BETWEEN 0 AND 100),
    
    -- Supporting data
    supporting_data JSONB,
    
    -- Actionability
    is_actionable BOOLEAN DEFAULT FALSE,
    suggested_actions TEXT[],
    
    -- Time relevance
    is_time_sensitive BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP,
    
    -- Status
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    dismissed_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_insights_property ON property_insights(property_id);
CREATE INDEX idx_insights_module ON property_insights(module_type);
CREATE INDEX idx_insights_type ON property_insights(insight_type);
CREATE INDEX idx_insights_importance ON property_insights(importance_score DESC);
CREATE INDEX idx_insights_active ON property_insights(is_dismissed) WHERE is_dismissed = FALSE;

COMMENT ON TABLE property_insights IS 'AI-generated insights from various modules';
COMMENT ON COLUMN property_insights.is_actionable IS 'Whether the insight requires user action';

-- =====================================================
-- Opportunity Scores (Aggregated)
-- =====================================================

CREATE TABLE opportunity_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE UNIQUE,
    
    -- Overall score
    overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
    opportunity_level opportunity_level,
    
    -- Module scores
    zoning_score INTEGER,
    supply_score INTEGER,
    demand_score INTEGER,
    price_score INTEGER,
    cash_flow_score INTEGER,
    development_score INTEGER,
    
    -- Score components
    score_breakdown JSONB,
    
    -- Confidence
    confidence_level DECIMAL(3, 2), -- 0.00 to 1.00
    data_completeness_pct INTEGER,
    
    -- Ranking
    market_percentile INTEGER, -- Percentile within market
    
    -- Last calculation
    calculated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_opp_scores_property ON opportunity_scores(property_id);
CREATE INDEX idx_opp_scores_overall ON opportunity_scores(overall_score DESC);
CREATE INDEX idx_opp_scores_level ON opportunity_scores(opportunity_level);
CREATE INDEX idx_opp_scores_expires ON opportunity_scores(expires_at);

COMMENT ON TABLE opportunity_scores IS 'Aggregated opportunity scores combining all modules';
COMMENT ON COLUMN opportunity_scores.market_percentile IS 'How this property ranks vs others in market';

-- =====================================================
-- Predictions
-- =====================================================

CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    market_id UUID REFERENCES markets(id),
    
    -- Prediction type
    prediction_type VARCHAR(100), -- 'price_appreciation', 'rent_growth', 'demand_increase', etc.
    prediction_category VARCHAR(50), -- 'price', 'demand', 'supply', 'development'
    
    -- Time horizon
    prediction_date DATE NOT NULL, -- When prediction is for
    horizon_months INTEGER, -- How far in future
    
    -- Prediction values
    predicted_value DECIMAL(15, 2),
    predicted_change_pct DECIMAL(5, 2),
    confidence_interval_low DECIMAL(15, 2),
    confidence_interval_high DECIMAL(15, 2),
    
    -- Confidence
    confidence_level DECIMAL(3, 2), -- 0.00 to 1.00
    
    -- Model information
    model_name VARCHAR(100),
    model_version VARCHAR(50),
    
    -- Input features
    input_features JSONB,
    
    -- Explanation
    prediction_explanation TEXT,
    key_factors TEXT[],
    
    -- Validation (after prediction period)
    actual_value DECIMAL(15, 2),
    actual_change_pct DECIMAL(5, 2),
    prediction_error_pct DECIMAL(5, 2),
    was_accurate BOOLEAN,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_predictions_property ON predictions(property_id);
CREATE INDEX idx_predictions_market ON predictions(market_id);
CREATE INDEX idx_predictions_type ON predictions(prediction_type);
CREATE INDEX idx_predictions_date ON predictions(prediction_date);
CREATE INDEX idx_predictions_category ON predictions(prediction_category);

COMMENT ON TABLE predictions IS 'AI/ML predictions for property metrics and market trends';
COMMENT ON COLUMN predictions.was_accurate IS 'Whether prediction was within confidence interval';

-- =====================================================
-- Alerts
-- =====================================================

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Alert details
    alert_type VARCHAR(100), -- 'price_drop', 'new_listing', 'market_shift', 'opportunity'
    alert_priority alert_priority DEFAULT 'medium',
    
    -- Content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Related entities
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    market_id UUID REFERENCES markets(id) ON DELETE SET NULL,
    
    -- Alert data
    alert_data JSONB,
    
    -- Actions
    action_url TEXT,
    action_label VARCHAR(100),
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP,
    
    -- Delivery
    delivered_via TEXT[], -- ['email', 'push', 'sms']
    
    -- Expiry
    expires_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_org ON alerts(organization_id);
CREATE INDEX idx_alerts_property ON alerts(property_id);
CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_priority ON alerts(alert_priority);
CREATE INDEX idx_alerts_unread ON alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

COMMENT ON TABLE alerts IS 'User alerts and notifications from modules';

-- =====================================================
-- User Preferences for Alerts
-- =====================================================

CREATE TABLE alert_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    
    -- Channel preferences
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    
    -- Alert type preferences
    alert_type_settings JSONB DEFAULT '{}', -- Per alert type settings
    
    -- Frequency
    digest_frequency VARCHAR(20), -- 'realtime', 'hourly', 'daily', 'weekly'
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    
    -- Priority filtering
    min_priority alert_priority DEFAULT 'low',
    
    -- Geographic filters
    watched_markets UUID[],
    watched_properties UUID[],
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_prefs_user ON alert_preferences(user_id);

COMMENT ON TABLE alert_preferences IS 'User preferences for alert delivery and filtering';

-- =====================================================
-- Update Timestamps Trigger
-- =====================================================

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON collaboration_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pins_updated_at BEFORE UPDATE ON property_pins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON property_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON property_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opp_scores_updated_at BEFORE UPDATE ON opportunity_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_prefs_updated_at BEFORE UPDATE ON alert_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
