-- Migration: Add user AI model preferences
-- Run this in Replit's PostgreSQL console or via migration runner

-- Table for storing user AI preferences
CREATE TABLE IF NOT EXISTS user_ai_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Model preferences
    default_model VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514',
    risk_analysis_model VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514',
    strategy_model VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514',
    chat_model VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514',
    
    -- Feature flags
    enable_streaming BOOLEAN DEFAULT true,
    enable_thinking BOOLEAN DEFAULT false,
    max_tokens INTEGER DEFAULT 4096,
    temperature NUMERIC(3,2) DEFAULT 0.7,
    
    -- Usage tracking
    monthly_token_limit INTEGER DEFAULT NULL,
    tokens_used_this_month INTEGER DEFAULT 0,
    last_token_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_ai_prefs UNIQUE(user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_ai_preferences_user_id ON user_ai_preferences(user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_ai_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_preferences_updated_at ON user_ai_preferences;
CREATE TRIGGER ai_preferences_updated_at
    BEFORE UPDATE ON user_ai_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_preferences_timestamp();

-- Available models reference table
CREATE TABLE IF NOT EXISTS ai_models (
    id VARCHAR(100) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'anthropic',
    description TEXT,
    max_tokens INTEGER DEFAULT 4096,
    supports_streaming BOOLEAN DEFAULT true,
    supports_thinking BOOLEAN DEFAULT false,
    cost_per_1k_input NUMERIC(10,6) DEFAULT 0,
    cost_per_1k_output NUMERIC(10,6) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed available models
INSERT INTO ai_models (id, display_name, provider, description, max_tokens, supports_thinking, cost_per_1k_input, cost_per_1k_output, sort_order) VALUES
('claude-opus-4-20250514', 'Claude Opus 4', 'anthropic', 'Most capable model. Best for complex analysis and nuanced reasoning.', 8192, true, 0.015, 0.075, 1),
('claude-sonnet-4-20250514', 'Claude Sonnet 4', 'anthropic', 'Balanced performance and speed. Great for most tasks.', 8192, false, 0.003, 0.015, 2),
('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'anthropic', 'Previous generation. Fast and reliable.', 8192, false, 0.003, 0.015, 3),
('claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', 'anthropic', 'Fastest model. Best for simple queries and high volume.', 4096, false, 0.0008, 0.004, 4)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    cost_per_1k_input = EXCLUDED.cost_per_1k_input,
    cost_per_1k_output = EXCLUDED.cost_per_1k_output;

-- Function to get user's preferred model for a specific use case
CREATE OR REPLACE FUNCTION get_user_ai_model(p_user_id UUID, p_use_case VARCHAR DEFAULT 'default')
RETURNS VARCHAR AS $$
DECLARE
    v_model VARCHAR(100);
BEGIN
    SELECT 
        CASE p_use_case
            WHEN 'risk' THEN COALESCE(risk_analysis_model, default_model)
            WHEN 'strategy' THEN COALESCE(strategy_model, default_model)
            WHEN 'chat' THEN COALESCE(chat_model, default_model)
            ELSE default_model
        END
    INTO v_model
    FROM user_ai_preferences
    WHERE user_id = p_user_id;
    
    -- Return default if no preferences found
    RETURN COALESCE(v_model, 'claude-sonnet-4-20250514');
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust role name as needed)
-- GRANT ALL ON user_ai_preferences TO jedire_app;
-- GRANT ALL ON ai_models TO jedire_app;

COMMENT ON TABLE user_ai_preferences IS 'Stores per-user AI model preferences and settings';
COMMENT ON TABLE ai_models IS 'Reference table of available AI models with pricing info';
