ALTER TABLE user_column_preferences ADD COLUMN IF NOT EXISTS column_config JSONB DEFAULT '{}'::jsonb;
