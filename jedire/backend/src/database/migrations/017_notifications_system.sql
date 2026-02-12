-- Migration 017: Notifications & Decision Point System
-- Date: 2026-02-09
-- Description: Notification system for deal decision points and milestones

-- ============================================================================
-- NOTIFICATION TYPES
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    -- Decision points (require user action)
    'decision_triage_complete',
    'decision_intelligence_complete',
    'decision_underwriting_complete',
    'decision_deal_stalled',
    
    -- Milestones (informational)
    'milestone_deal_created',
    'milestone_stage_changed',
    'milestone_analysis_complete',
    'milestone_property_linked',
    
    -- Alerts (warnings/issues)
    'alert_risk_detected',
    'alert_deal_overdue',
    'alert_budget_exceeded',
    'alert_timeline_delayed',
    
    -- System notifications
    'info_collaborator_added',
    'info_comment_mention',
    'info_task_assigned'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_delivery_status AS ENUM (
    'pending',
    'sent',
    'failed',
    'skipped'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Deal
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Notification details
  type notification_type NOT NULL,
  priority notification_priority DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  action_url VARCHAR(500), -- URL to navigate to (e.g., /deals/:id/decide)
  action_label VARCHAR(100), -- Button text (e.g., "Review & Decide")
  
  -- State
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  
  -- Delivery channels
  in_app_status notification_delivery_status DEFAULT 'sent',
  email_status notification_delivery_status DEFAULT 'pending',
  push_status notification_delivery_status DEFAULT 'pending',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- Optional expiry for time-sensitive notifications
  
  -- Constraints
  CONSTRAINT valid_action_url CHECK (action_url IS NULL OR action_url ~* '^/.*')
);

-- Indexes
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_deal ON notifications(deal_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_priority ON notifications(priority, created_at DESC);

-- ============================================================================
-- USER NOTIFICATION PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Channel preferences
  enable_in_app BOOLEAN DEFAULT TRUE,
  enable_email BOOLEAN DEFAULT TRUE,
  enable_push BOOLEAN DEFAULT FALSE,
  
  -- Type preferences (JSONB for flexibility)
  decision_points_enabled BOOLEAN DEFAULT TRUE,
  milestones_enabled BOOLEAN DEFAULT TRUE,
  alerts_enabled BOOLEAN DEFAULT TRUE,
  info_enabled BOOLEAN DEFAULT TRUE,
  
  -- Digest settings
  enable_daily_digest BOOLEAN DEFAULT FALSE,
  daily_digest_time TIME DEFAULT '09:00:00',
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME DEFAULT '22:00:00',
  quiet_hours_end TIME DEFAULT '08:00:00',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);

-- ============================================================================
-- DEAL STATE TRACKING (for stalled deal detection)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_state_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE UNIQUE,
  
  -- Current state
  current_stage VARCHAR(50) NOT NULL,
  stage_entered_at TIMESTAMP DEFAULT NOW(),
  days_in_stage INTEGER GENERATED ALWAYS AS (
    EXTRACT(DAY FROM NOW() - stage_entered_at)::INTEGER
  ) STORED,
  
  -- Activity tracking
  last_activity_at TIMESTAMP DEFAULT NOW(),
  days_since_activity INTEGER GENERATED ALWAYS AS (
    EXTRACT(DAY FROM NOW() - last_activity_at)::INTEGER
  ) STORED,
  
  -- Stall detection
  is_stalled BOOLEAN DEFAULT FALSE,
  stall_threshold_days INTEGER DEFAULT 7,
  stall_notified_at TIMESTAMP,
  
  -- Metadata
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_state_deal ON deal_state_tracking(deal_id);
CREATE INDEX idx_deal_state_stalled ON deal_state_tracking(is_stalled, days_since_activity);

-- ============================================================================
-- DECISION LOG (track what decisions were made)
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  
  -- Decision details
  decision_point VARCHAR(100) NOT NULL, -- e.g., 'triage_complete', 'underwriting_review'
  decision_made VARCHAR(100) NOT NULL, -- e.g., 'approved', 'rejected', 'needs_more_info'
  decision_notes TEXT,
  
  -- Timing
  presented_at TIMESTAMP NOT NULL,
  decided_at TIMESTAMP DEFAULT NOW(),
  response_time_minutes INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (decided_at - presented_at)) / 60
  ) STORED,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_decision_log_deal ON decision_log(deal_id);
CREATE INDEX idx_decision_log_user ON decision_log(user_id);
CREATE INDEX idx_decision_log_point ON decision_log(decision_point);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to create a decision notification
CREATE OR REPLACE FUNCTION create_decision_notification(
  p_user_id UUID,
  p_deal_id UUID,
  p_type notification_type,
  p_title VARCHAR,
  p_message TEXT,
  p_action_url VARCHAR DEFAULT NULL,
  p_action_label VARCHAR DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    deal_id,
    type,
    priority,
    title,
    message,
    action_url,
    action_label,
    metadata
  ) VALUES (
    p_user_id,
    p_deal_id,
    p_type,
    CASE 
      WHEN p_type::text LIKE 'decision_%' THEN 'high'::notification_priority
      WHEN p_type::text LIKE 'alert_%' THEN 'high'::notification_priority
      ELSE 'medium'::notification_priority
    END,
    p_title,
    p_message,
    p_action_url,
    p_action_label,
    p_metadata
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark deal as stalled
CREATE OR REPLACE FUNCTION check_and_mark_stalled_deals()
RETURNS TABLE(deal_id UUID, days_stalled INTEGER) AS $$
BEGIN
  RETURN QUERY
  UPDATE deal_state_tracking dst
  SET 
    is_stalled = TRUE,
    updated_at = NOW()
  FROM deals d
  WHERE dst.deal_id = d.id
    AND dst.days_since_activity >= dst.stall_threshold_days
    AND dst.is_stalled = FALSE
    AND d.status = 'active'
    AND (dst.stall_notified_at IS NULL OR dst.stall_notified_at < NOW() - INTERVAL '3 days')
  RETURNING dst.deal_id, dst.days_since_activity;
END;
$$ LANGUAGE plpgsql;

-- Function to update deal activity timestamp
CREATE OR REPLACE FUNCTION update_deal_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Update deal state tracking
  INSERT INTO deal_state_tracking (deal_id, last_activity_at)
  VALUES (NEW.deal_id, NOW())
  ON CONFLICT (deal_id) DO UPDATE
  SET 
    last_activity_at = NOW(),
    is_stalled = FALSE,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get unread notification count by type
CREATE OR REPLACE FUNCTION get_notification_counts(p_user_id UUID)
RETURNS TABLE(
  total_unread BIGINT,
  decisions_unread BIGINT,
  alerts_unread BIGINT,
  milestones_unread BIGINT,
  info_unread BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE is_read = FALSE) as total_unread,
    COUNT(*) FILTER (WHERE is_read = FALSE AND type::text LIKE 'decision_%') as decisions_unread,
    COUNT(*) FILTER (WHERE is_read = FALSE AND type::text LIKE 'alert_%') as alerts_unread,
    COUNT(*) FILTER (WHERE is_read = FALSE AND type::text LIKE 'milestone_%') as milestones_unread,
    COUNT(*) FILTER (WHERE is_read = FALSE AND type::text LIKE 'info_%') as info_unread
  FROM notifications
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW());
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_preferences_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notification_prefs_updated ON notification_preferences;
CREATE TRIGGER trigger_notification_prefs_updated
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated();

-- Trigger to track deal activity from deal_activity table
DROP TRIGGER IF EXISTS trigger_deal_activity_update ON deal_activity;
CREATE TRIGGER trigger_deal_activity_update
  AFTER INSERT ON deal_activity
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_activity();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Unread notifications view
CREATE OR REPLACE VIEW unread_notifications_view AS
SELECT 
  n.*,
  d.name as deal_name,
  d.project_type,
  u.email as user_email
FROM notifications n
LEFT JOIN deals d ON n.deal_id = d.id
LEFT JOIN users u ON n.user_id = u.id
WHERE n.is_read = FALSE
  AND (n.expires_at IS NULL OR n.expires_at > NOW())
ORDER BY n.priority DESC, n.created_at DESC;

-- Stalled deals view
CREATE OR REPLACE VIEW stalled_deals_view AS
SELECT 
  d.id as deal_id,
  d.name as deal_name,
  d.user_id,
  dst.days_since_activity,
  dst.current_stage,
  dst.stage_entered_at,
  dst.stall_notified_at,
  u.email as user_email
FROM deal_state_tracking dst
JOIN deals d ON dst.deal_id = d.id
JOIN users u ON d.user_id = u.id
WHERE dst.is_stalled = TRUE
  AND d.status = 'active'
ORDER BY dst.days_since_activity DESC;

-- ============================================================================
-- DEFAULT PREFERENCES FOR EXISTING USERS
-- ============================================================================

INSERT INTO notification_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE notifications IS 'User notifications for deal decision points and milestones';
COMMENT ON TABLE notification_preferences IS 'User-specific notification channel and timing preferences';
COMMENT ON TABLE deal_state_tracking IS 'Tracks deal state for stall detection and activity monitoring';
COMMENT ON TABLE decision_log IS 'Audit log of all decisions made by users';
COMMENT ON FUNCTION create_decision_notification IS 'Helper function to create high-priority decision notifications';
COMMENT ON FUNCTION check_and_mark_stalled_deals IS 'Identifies deals that have been inactive beyond threshold';

COMMIT;
