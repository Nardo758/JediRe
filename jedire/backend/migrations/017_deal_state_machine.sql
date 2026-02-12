-- Migration 017: Deal State Machine
-- Date: 2026-02-09
-- Description: Add state machine support for deal workflow tracking

-- ============================================================================
-- ADD STATE MACHINE COLUMNS TO DEALS TABLE
-- ============================================================================

-- Add state column with constraint
ALTER TABLE deals ADD COLUMN state VARCHAR(50) DEFAULT 'SIGNAL_INTAKE';

-- Add state-specific data storage
ALTER TABLE deals ADD COLUMN state_data JSONB DEFAULT '{}';

-- Add quality gates tracking
ALTER TABLE deals ADD COLUMN quality_gates JSONB DEFAULT '{}';

-- Add signal confidence score
ALTER TABLE deals ADD COLUMN signal_confidence INTEGER;

-- Add triage score
ALTER TABLE deals ADD COLUMN triage_score INTEGER;

-- Add state constraints
ALTER TABLE deals ADD CONSTRAINT deals_state_check 
  CHECK (state IN (
    'SIGNAL_INTAKE',
    'TRIAGE',
    'INTELLIGENCE_ASSEMBLY',
    'UNDERWRITING',
    'DEAL_PACKAGING',
    'EXECUTION',
    'POST_CLOSE',
    'MARKET_NOTE',
    'STALLED',
    'ARCHIVED'
  ));

ALTER TABLE deals ADD CONSTRAINT deals_signal_confidence_check 
  CHECK (signal_confidence >= 0 AND signal_confidence <= 100);

ALTER TABLE deals ADD CONSTRAINT deals_triage_score_check 
  CHECK (triage_score >= 0 AND triage_score <= 50);

-- Create indexes for state queries
CREATE INDEX idx_deals_state ON deals(state);
CREATE INDEX idx_deals_signal_confidence ON deals(signal_confidence);
CREATE INDEX idx_deals_triage_score ON deals(triage_score);
CREATE INDEX idx_deals_state_data ON deals USING GIN(state_data);
CREATE INDEX idx_deals_quality_gates ON deals USING GIN(quality_gates);

-- Add comments
COMMENT ON COLUMN deals.state IS 'Current state in the deal workflow state machine';
COMMENT ON COLUMN deals.state_data IS 'State-specific data (e.g., triage criteria, underwriting metrics)';
COMMENT ON COLUMN deals.quality_gates IS 'Quality gate status for each state (passed/failed/pending)';
COMMENT ON COLUMN deals.signal_confidence IS 'Confidence score for initial signal (0-100)';
COMMENT ON COLUMN deals.triage_score IS 'Triage priority score (0-50)';

-- ============================================================================
-- STATE TRANSITIONS TABLE
-- ============================================================================

CREATE TABLE state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- State change
  from_state VARCHAR(50),
  to_state VARCHAR(50) NOT NULL,
  
  -- Transition context
  reason TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Metadata (quality gate results, validation data, etc.)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  transitioned_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT state_transitions_to_state_check CHECK (to_state IN (
    'SIGNAL_INTAKE',
    'TRIAGE',
    'INTELLIGENCE_ASSEMBLY',
    'UNDERWRITING',
    'DEAL_PACKAGING',
    'EXECUTION',
    'POST_CLOSE',
    'MARKET_NOTE',
    'STALLED',
    'ARCHIVED'
  ))
);

-- Indexes for transition history
CREATE INDEX idx_state_transitions_deal_id ON state_transitions(deal_id);
CREATE INDEX idx_state_transitions_from_state ON state_transitions(from_state);
CREATE INDEX idx_state_transitions_to_state ON state_transitions(to_state);
CREATE INDEX idx_state_transitions_user_id ON state_transitions(user_id);
CREATE INDEX idx_state_transitions_transitioned_at ON state_transitions(transitioned_at DESC);
CREATE INDEX idx_state_transitions_metadata ON state_transitions USING GIN(metadata);

COMMENT ON TABLE state_transitions IS 'Audit trail of all state changes for deals';
COMMENT ON COLUMN state_transitions.from_state IS 'Previous state (NULL for initial state)';
COMMENT ON COLUMN state_transitions.to_state IS 'New state after transition';
COMMENT ON COLUMN state_transitions.reason IS 'Human-readable reason for transition';
COMMENT ON COLUMN state_transitions.metadata IS 'Additional context (quality gates, scores, validation results)';

-- ============================================================================
-- DEAL NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE deal_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification details
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  
  -- Read status
  read BOOLEAN DEFAULT false,
  
  -- Metadata (link to related entity, action URLs, etc.)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);

-- Indexes for notifications
CREATE INDEX idx_deal_notifications_deal_id ON deal_notifications(deal_id);
CREATE INDEX idx_deal_notifications_user_id ON deal_notifications(user_id);
CREATE INDEX idx_deal_notifications_read ON deal_notifications(read);
CREATE INDEX idx_deal_notifications_type ON deal_notifications(type);
CREATE INDEX idx_deal_notifications_created_at ON deal_notifications(created_at DESC);

COMMENT ON TABLE deal_notifications IS 'User notifications for deal state changes and important events';
COMMENT ON COLUMN deal_notifications.type IS 'Notification type (state_change, quality_gate_failed, task_due, etc.)';
COMMENT ON COLUMN deal_notifications.message IS 'Human-readable notification message';
COMMENT ON COLUMN deal_notifications.metadata IS 'Additional data (links, related entity IDs, action context)';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Transition deal to new state
CREATE OR REPLACE FUNCTION transition_deal_state(
  p_deal_id UUID,
  p_to_state VARCHAR(50),
  p_reason TEXT,
  p_user_id UUID,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_from_state VARCHAR(50);
  v_deal_name VARCHAR(255);
  v_deal_user_id UUID;
BEGIN
  -- Get current state and deal info
  SELECT state, name, user_id 
  INTO v_from_state, v_deal_name, v_deal_user_id
  FROM deals 
  WHERE id = p_deal_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;
  
  -- Update deal state
  UPDATE deals 
  SET state = p_to_state,
      updated_at = NOW()
  WHERE id = p_deal_id;
  
  -- Log transition
  INSERT INTO state_transitions (
    deal_id,
    from_state,
    to_state,
    reason,
    user_id,
    metadata
  ) VALUES (
    p_deal_id,
    v_from_state,
    p_to_state,
    p_reason,
    p_user_id,
    p_metadata
  );
  
  -- Create notification
  INSERT INTO deal_notifications (
    deal_id,
    user_id,
    type,
    message,
    metadata
  ) VALUES (
    p_deal_id,
    v_deal_user_id,
    'state_change',
    'Deal "' || v_deal_name || '" moved from ' || 
      COALESCE(v_from_state, 'none') || ' to ' || p_to_state,
    jsonb_build_object(
      'from_state', v_from_state,
      'to_state', p_to_state,
      'reason', p_reason
    )
  );
  
  -- Log activity
  INSERT INTO deal_activity (
    deal_id,
    user_id,
    action_type,
    description,
    metadata
  ) VALUES (
    p_deal_id,
    p_user_id,
    'state_change',
    'State changed: ' || COALESCE(v_from_state, 'none') || ' → ' || p_to_state,
    jsonb_build_object(
      'from_state', v_from_state,
      'to_state', p_to_state,
      'reason', p_reason
    )
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION transition_deal_state IS 'Transition a deal to a new state with audit trail and notifications';

-- Function: Get deal state history
CREATE OR REPLACE FUNCTION get_deal_state_history(p_deal_id UUID)
RETURNS TABLE (
  from_state VARCHAR(50),
  to_state VARCHAR(50),
  reason TEXT,
  user_id UUID,
  transitioned_at TIMESTAMP,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.from_state,
    st.to_state,
    st.reason,
    st.user_id,
    st.transitioned_at,
    st.metadata
  FROM state_transitions st
  WHERE st.deal_id = p_deal_id
  ORDER BY st.transitioned_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_deal_state_history IS 'Get complete state transition history for a deal';

-- Function: Get unread notifications for user
CREATE OR REPLACE FUNCTION get_unread_notifications(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  deal_id UUID,
  deal_name VARCHAR(255),
  type VARCHAR(50),
  message TEXT,
  created_at TIMESTAMP,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dn.id,
    dn.deal_id,
    d.name,
    dn.type,
    dn.message,
    dn.created_at,
    dn.metadata
  FROM deal_notifications dn
  JOIN deals d ON d.id = dn.deal_id
  WHERE dn.user_id = p_user_id
    AND dn.read = false
  ORDER BY dn.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_unread_notifications IS 'Get all unread notifications for a user';

-- Function: Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE deal_notifications
  SET read = true,
      read_at = NOW()
  WHERE id = p_notification_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_notification_read IS 'Mark a notification as read';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Auto-log state changes via UPDATE on deals table
CREATE OR REPLACE FUNCTION auto_log_state_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if state actually changed
  IF OLD.state IS DISTINCT FROM NEW.state THEN
    INSERT INTO state_transitions (
      deal_id,
      from_state,
      to_state,
      reason,
      metadata
    ) VALUES (
      NEW.id,
      OLD.state,
      NEW.state,
      'Direct update',
      jsonb_build_object(
        'updated_at', NOW(),
        'old_state_data', OLD.state_data,
        'new_state_data', NEW.state_data
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_log_state_change 
  AFTER UPDATE ON deals
  FOR EACH ROW 
  WHEN (OLD.state IS DISTINCT FROM NEW.state)
  EXECUTE FUNCTION auto_log_state_change();

COMMENT ON FUNCTION auto_log_state_change IS 'Automatically log state changes when deals.state is updated directly';

-- ============================================================================
-- MIGRATE EXISTING DEALS
-- ============================================================================

-- Set initial state for existing deals
-- Assuming deals created from scratch start at SIGNAL_INTAKE
-- But existing deals in the system have already passed intake, so set to TRIAGE
UPDATE deals 
SET 
  state = 'TRIAGE',
  signal_confidence = 50, -- Default mid-range confidence
  state_data = jsonb_build_object(
    'migrated', true,
    'migration_date', NOW()
  )
WHERE state IS NULL;

-- Log initial state transition for existing deals
INSERT INTO state_transitions (
  deal_id,
  from_state,
  to_state,
  reason,
  metadata
)
SELECT 
  id,
  NULL,
  'TRIAGE',
  'Migrated from legacy system',
  jsonb_build_object(
    'migration_date', NOW(),
    'legacy_status', status
  )
FROM deals
WHERE state = 'TRIAGE';

-- ============================================================================
-- SEED STATE MACHINE METADATA
-- ============================================================================

-- Create a reference table for state machine configuration (optional)
CREATE TABLE state_machine_config (
  state VARCHAR(50) PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(20), -- Hex color for UI
  icon VARCHAR(50), -- Icon name
  quality_gates TEXT[], -- Array of required quality gates
  next_states TEXT[], -- Allowed transitions
  sort_order INTEGER
);

-- Insert state definitions
INSERT INTO state_machine_config (state, display_name, description, color, quality_gates, next_states, sort_order) VALUES
('SIGNAL_INTAKE', 'Signal Intake', 'Initial signal received, basic validation pending', '#94a3b8', ARRAY['basic_validation'], ARRAY['TRIAGE', 'ARCHIVED'], 1),
('TRIAGE', 'Triage', 'Evaluating signal priority and fit', '#3b82f6', ARRAY['priority_score', 'fit_assessment'], ARRAY['INTELLIGENCE_ASSEMBLY', 'MARKET_NOTE', 'ARCHIVED'], 2),
('INTELLIGENCE_ASSEMBLY', 'Intelligence Assembly', 'Gathering market data, comps, and context', '#8b5cf6', ARRAY['comp_data', 'market_context'], ARRAY['UNDERWRITING', 'STALLED'], 3),
('UNDERWRITING', 'Underwriting', 'Financial analysis and risk assessment', '#f59e0b', ARRAY['financial_model', 'risk_assessment'], ARRAY['DEAL_PACKAGING', 'STALLED'], 4),
('DEAL_PACKAGING', 'Deal Packaging', 'Preparing investment memo and materials', '#ec4899', ARRAY['investment_memo', 'materials_complete'], ARRAY['EXECUTION', 'STALLED'], 5),
('EXECUTION', 'Execution', 'Active deal pursuit and closing', '#10b981', ARRAY['loi_submitted', 'due_diligence_complete'], ARRAY['POST_CLOSE', 'ARCHIVED'], 6),
('POST_CLOSE', 'Post-Close', 'Deal closed, ongoing management', '#14b8a6', ARRAY[]::TEXT[], ARRAY['ARCHIVED'], 7),
('MARKET_NOTE', 'Market Note', 'Tracked as market intelligence only', '#6366f1', ARRAY[]::TEXT[], ARRAY['TRIAGE', 'ARCHIVED'], 8),
('STALLED', 'Stalled', 'Deal paused, may resume later', '#ef4444', ARRAY[]::TEXT[], ARRAY['TRIAGE', 'INTELLIGENCE_ASSEMBLY', 'UNDERWRITING', 'ARCHIVED'], 9),
('ARCHIVED', 'Archived', 'Deal no longer active', '#64748b', ARRAY[]::TEXT[], ARRAY[]::TEXT[], 10);

CREATE INDEX idx_state_machine_config_sort_order ON state_machine_config(sort_order);

COMMENT ON TABLE state_machine_config IS 'Reference table defining state machine states and transitions';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON state_transitions TO jedire_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON deal_notifications TO jedire_app;
GRANT SELECT ON state_machine_config TO jedire_app;

-- Vacuum analyze
VACUUM ANALYZE deals;
VACUUM ANALYZE state_transitions;
VACUUM ANALYZE deal_notifications;
VACUUM ANALYZE state_machine_config;

COMMENT ON SCHEMA public IS 'JEDI RE deal state machine - Migration 017 applied 2026-02-09';
