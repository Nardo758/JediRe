-- Agent Settings Table
-- Stores user preferences for AI agent configuration
-- Created: 2026-03-28

-- Create the user_agent_settings table
CREATE TABLE IF NOT EXISTS user_agent_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  setting_type VARCHAR(50) NOT NULL,  -- 'models', 'workforce', 'notifications'
  settings_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint for user + setting type
  UNIQUE(user_id, setting_type)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_agent_settings_user 
  ON user_agent_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_user_agent_settings_type 
  ON user_agent_settings(setting_type);

-- Add comment
COMMENT ON TABLE user_agent_settings IS 'User preferences for AI agent configuration including model selection and autonomy settings';

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL ON user_agent_settings TO jedire_app;
