-- ============================================================================
-- Analysis Logs Table
-- Tracks all agent analysis runs with performance metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS analysis_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  deal_name VARCHAR(200),
  agent_type VARCHAR(50) NOT NULL, -- zoning_analysis, supply_analysis, cashflow_analysis
  task_id UUID NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL, -- started, completed, failed
  
  -- Performance metrics
  execution_time_ms INTEGER,
  
  -- Data
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT analysis_logs_status_check CHECK (status IN ('started', 'completed', 'failed'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analysis_logs_deal_id ON analysis_logs(deal_id);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_agent_type ON analysis_logs(agent_type);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_status ON analysis_logs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_created_at ON analysis_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_task_id ON analysis_logs(task_id);

-- Composite index for performance queries
CREATE INDEX IF NOT EXISTS idx_analysis_logs_agent_status 
  ON analysis_logs(agent_type, status, created_at DESC);

COMMENT ON TABLE analysis_logs IS 'Tracks all agent analysis runs with performance metrics and results';
COMMENT ON COLUMN analysis_logs.execution_time_ms IS 'Time taken for agent to complete analysis in milliseconds';
COMMENT ON COLUMN analysis_logs.input_data IS 'Input parameters passed to the agent';
COMMENT ON COLUMN analysis_logs.output_data IS 'Agent output/results';
COMMENT ON COLUMN analysis_logs.metadata IS 'Additional context (API versions, flags, etc.)';
