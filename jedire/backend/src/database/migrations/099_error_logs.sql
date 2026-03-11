-- Migration: Error Logging System
-- Description: Create table for storing frontend error logs
-- Date: 2024-02-22

-- Create error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  component_stack TEXT,
  error_context VARCHAR(50) DEFAULT 'GENERAL',
  url TEXT,
  user_agent TEXT,
  deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
  form_name VARCHAR(100),
  is_network_error BOOLEAN DEFAULT FALSE,
  is_webgl_error BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);

-- Create indexes for common queries
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_error_context ON error_logs(error_context);
CREATE INDEX idx_error_logs_deal_id ON error_logs(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_error_logs_is_network_error ON error_logs(is_network_error) WHERE is_network_error = TRUE;
CREATE INDEX idx_error_logs_is_webgl_error ON error_logs(is_webgl_error) WHERE is_webgl_error = TRUE;
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved_at) WHERE resolved_at IS NULL;

-- Create GIN index for metadata JSONB queries
CREATE INDEX idx_error_logs_metadata ON error_logs USING GIN (metadata);

-- Create a view for error statistics
CREATE OR REPLACE VIEW error_stats AS
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  error_context,
  COUNT(*) AS error_count,
  COUNT(DISTINCT user_id) AS affected_users,
  COUNT(CASE WHEN is_network_error THEN 1 END) AS network_errors,
  COUNT(CASE WHEN is_webgl_error THEN 1 END) AS webgl_errors,
  COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END) AS resolved_count
FROM error_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY hour, error_context
ORDER BY hour DESC, error_count DESC;

-- Create a view for top recurring errors
CREATE OR REPLACE VIEW top_recurring_errors AS
SELECT
  error_message,
  error_context,
  COUNT(*) AS occurrence_count,
  COUNT(DISTINCT user_id) AS affected_users,
  MAX(created_at) AS last_occurrence,
  MIN(created_at) AS first_occurrence,
  COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END) AS resolved_count
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY error_message, error_context
HAVING COUNT(*) > 1
ORDER BY occurrence_count DESC
LIMIT 50;

-- Add comment to table
COMMENT ON TABLE error_logs IS 'Stores frontend error logs for monitoring and debugging';
COMMENT ON COLUMN error_logs.error_context IS 'Error context: GENERAL, API, FORM, 3D_VIEWER, etc.';
COMMENT ON COLUMN error_logs.metadata IS 'Additional error metadata (WebGL info, form data status, etc.)';
COMMENT ON COLUMN error_logs.resolved_at IS 'When the error was marked as resolved';
COMMENT ON COLUMN error_logs.resolved_by IS 'User who marked the error as resolved';
