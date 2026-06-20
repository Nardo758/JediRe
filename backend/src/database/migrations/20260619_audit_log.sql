-- Operational audit log for compliance and governance
-- P1-18: Complete audit trail connecting every decision to model version, inputs, timestamp, and configuration
-- Required by FINRA 24-09, SEC, SOX, EU AI Act

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  agent_id TEXT, -- NULL for human actions, e.g. 'research-agent', 'underwriting-agent'
  action_type TEXT NOT NULL, -- 'assumption_change', 'document_upload', 'share_mint', 'override_set', 'scenario_branch', 'model_save', 'stage_transition', 'task_assignment', 'approval_granted', 'approval_denied'
  entity_type TEXT NOT NULL, -- 'assumption', 'document', 'share', 'scenario', 'model', 'stage', 'task', 'approval'
  entity_id TEXT, -- specific ID within the entity type
  old_value JSONB, -- previous state (for assumption changes, scenario diffs, etc.)
  new_value JSONB, -- new state
  metadata JSONB, -- extra context: prompt logs, model version, tool calls, confidence scores
  source_ip TEXT, -- client IP for security tracing
  timestamp TIMESTAMP DEFAULT NOW(),
  session_id TEXT -- groups related actions in a single user session
);

-- Indexes for fast compliance queries
CREATE INDEX IF NOT EXISTS idx_audit_log_deal_id ON audit_log(deal_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_agent_id ON audit_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_deal_timestamp ON audit_log(deal_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_session_id ON audit_log(session_id);

COMMENT ON TABLE audit_log IS
  'Immutable audit trail for every change to deal data, assumptions, models, shares, and approvals. Required by FINRA 24-09, SEC, SOX, EU AI Act. Never delete rows; mark as superseded if needed.';
