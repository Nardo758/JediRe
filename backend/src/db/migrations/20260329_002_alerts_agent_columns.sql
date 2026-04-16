-- ALERTS TABLE MIGRATION
-- Add columns for agent integration and metadata
--
-- Run in Replit: psql $DATABASE_URL < this_file.sql

-- ============================================================================
-- Deal Alerts Table Updates
-- ============================================================================

-- Add source tracking columns
ALTER TABLE deal_alerts 
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS source_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- Add title column if missing (some alerts use title + message)
ALTER TABLE deal_alerts
  ADD COLUMN IF NOT EXISTS title VARCHAR(500);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_alerts_source ON deal_alerts(source_type, source_ref);
CREATE INDEX IF NOT EXISTS idx_deal_alerts_expires ON deal_alerts(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deal_alerts_user_unread ON deal_alerts(user_id, is_read) WHERE is_dismissed = FALSE;

-- ============================================================================
-- Tasks Table Updates (for email/agent integration)
-- ============================================================================

-- Add metadata column for flexible data storage
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add index for email thread queries
CREATE INDEX IF NOT EXISTS idx_tasks_email_thread 
  ON tasks((metadata->>'emailThreadId')) 
  WHERE metadata->>'emailThreadId' IS NOT NULL;

-- ============================================================================
-- Agent Activity Log (optional - for debugging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_code VARCHAR(20) NOT NULL,
  activity_type VARCHAR(50) NOT NULL, -- 'alert_created', 'task_created', 'analysis_run', etc.
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_agent ON agent_activity_log(agent_code);
CREATE INDEX IF NOT EXISTS idx_agent_activity_deal ON agent_activity_log(deal_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_time ON agent_activity_log(created_at DESC);

-- ============================================================================
-- Function: Log Agent Activity
-- ============================================================================

CREATE OR REPLACE FUNCTION log_agent_activity(
  p_agent_code VARCHAR(20),
  p_activity_type VARCHAR(50),
  p_deal_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO agent_activity_log (agent_code, activity_type, deal_id, user_id, payload)
  VALUES (p_agent_code, p_activity_type, p_deal_id, p_user_id, p_payload)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;
