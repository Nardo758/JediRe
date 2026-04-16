-- Orchestrator Logs Table
-- Tracks all orchestrator interactions for analytics and debugging
-- Created: 2026-03-28

CREATE TABLE IF NOT EXISTS orchestrator_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,  -- 'web', 'telegram', 'whatsapp', 'sms', 'mobile'
  session_id VARCHAR(255),
  message TEXT NOT NULL,
  intent_type VARCHAR(50),
  intent_confidence DECIMAL(3,2),
  specialists_called TEXT[],      -- Array of specialist agent codes
  analysts_called TEXT[],         -- Array of analyst agent codes
  jedi_score INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orchestrator_logs_user 
  ON orchestrator_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_orchestrator_logs_platform 
  ON orchestrator_logs(platform);

CREATE INDEX IF NOT EXISTS idx_orchestrator_logs_created 
  ON orchestrator_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orchestrator_logs_intent 
  ON orchestrator_logs(intent_type);

-- Add comment
COMMENT ON TABLE orchestrator_logs IS 'Tracks all unified orchestrator interactions across all channels';
