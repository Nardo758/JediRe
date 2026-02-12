-- ========================================
-- Migration 011: LLM Integration
-- ========================================
-- Adds support for AI-powered property analysis
-- Stores LLM-generated insights and analysis history

-- ========================================
-- Property Analyses Table
-- ========================================
-- Stores AI-generated insights for properties

CREATE TABLE IF NOT EXISTS property_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    analyzed_by UUID NOT NULL REFERENCES users(id),
    analysis_type VARCHAR(50) NOT NULL, -- 'ai_insights', 'market_analysis', 'development_potential', etc.
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- Store additional context (model used, tokens, etc.)
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one analysis per property per type
CREATE UNIQUE INDEX idx_property_analyses_unique ON property_analyses(property_id, analysis_type);

-- Index for querying by user
CREATE INDEX idx_property_analyses_user ON property_analyses(analyzed_by, analyzed_at DESC);

-- Index for querying by property
CREATE INDEX idx_property_analyses_property ON property_analyses(property_id, analyzed_at DESC);

-- Index for querying by type
CREATE INDEX idx_property_analyses_type ON property_analyses(analysis_type);

-- ========================================
-- Market Analyses Table
-- ========================================
-- Stores AI-generated market-level insights

CREATE TABLE IF NOT EXISTS market_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city VARCHAR(100) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    analyzed_by UUID NOT NULL REFERENCES users(id),
    analysis_type VARCHAR(50) NOT NULL, -- 'market_trends', 'investment_opportunities', etc.
    content TEXT NOT NULL,
    market_data JSONB DEFAULT '{}'::jsonb, -- Store market metrics used in analysis
    metadata JSONB DEFAULT '{}'::jsonb, -- Store model info, tokens, etc.
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by market
CREATE INDEX idx_market_analyses_location ON market_analyses(city, state_code, analyzed_at DESC);

-- Index for querying by user
CREATE INDEX idx_market_analyses_user ON market_analyses(analyzed_by, analyzed_at DESC);

-- Index for querying by type
CREATE INDEX idx_market_analyses_type ON market_analyses(analysis_type);

-- ========================================
-- LLM Usage Tracking
-- ========================================
-- Track LLM API usage for cost monitoring and rate limiting

CREATE TABLE IF NOT EXISTS llm_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    endpoint VARCHAR(100) NOT NULL, -- Which API endpoint was called
    provider VARCHAR(50) NOT NULL, -- 'anthropic', 'openai', 'openrouter'
    model VARCHAR(100) NOT NULL, -- Model name used
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    request_data JSONB DEFAULT '{}'::jsonb, -- Store request details
    response_data JSONB DEFAULT '{}'::jsonb, -- Store response metadata
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by user
CREATE INDEX idx_llm_usage_user ON llm_usage(user_id, created_at DESC);

-- Index for querying by provider
CREATE INDEX idx_llm_usage_provider ON llm_usage(provider, created_at DESC);

-- Index for usage analytics
CREATE INDEX idx_llm_usage_analytics ON llm_usage(created_at, provider, success);

-- ========================================
-- Views
-- ========================================

-- View: Property analyses with property details
CREATE OR REPLACE VIEW properties_with_analyses AS
SELECT 
    p.*,
    pa.analysis_type,
    pa.content as analysis_content,
    pa.analyzed_at,
    pa.analyzed_by as analyst_id,
    u.email as analyst_email,
    u.full_name as analyst_name
FROM properties p
LEFT JOIN property_analyses pa ON p.id = pa.property_id
LEFT JOIN users u ON pa.analyzed_by = u.id;

-- View: LLM usage statistics by user
CREATE OR REPLACE VIEW llm_usage_by_user AS
SELECT 
    user_id,
    u.email,
    u.full_name,
    COUNT(*) as total_requests,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
    SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_requests,
    SUM(total_tokens) as total_tokens_used,
    SUM(prompt_tokens) as total_prompt_tokens,
    SUM(completion_tokens) as total_completion_tokens,
    DATE_TRUNC('day', created_at) as date
FROM llm_usage lu
JOIN users u ON lu.user_id = u.id
GROUP BY user_id, u.email, u.full_name, DATE_TRUNC('day', created_at);

-- ========================================
-- Functions
-- ========================================

-- Function: Update analysis timestamp
CREATE OR REPLACE FUNCTION update_analysis_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update timestamp on property_analyses
CREATE TRIGGER update_property_analyses_timestamp
    BEFORE UPDATE ON property_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_analysis_timestamp();

-- Trigger: Auto-update timestamp on market_analyses
CREATE TRIGGER update_market_analyses_timestamp
    BEFORE UPDATE ON market_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_analysis_timestamp();

-- ========================================
-- Comments
-- ========================================

COMMENT ON TABLE property_analyses IS 'Stores AI-generated property analysis and insights';
COMMENT ON TABLE market_analyses IS 'Stores AI-generated market-level analysis';
COMMENT ON TABLE llm_usage IS 'Tracks LLM API usage for cost monitoring and rate limiting';

COMMENT ON COLUMN property_analyses.analysis_type IS 'Type of analysis performed (ai_insights, market_analysis, development_potential, etc.)';
COMMENT ON COLUMN property_analyses.metadata IS 'Additional context like model used, token count, cost, etc.';

COMMENT ON COLUMN market_analyses.market_data IS 'Market metrics used in the analysis';
COMMENT ON COLUMN market_analyses.metadata IS 'Model info, tokens, cost, etc.';

COMMENT ON COLUMN llm_usage.request_data IS 'Request parameters (prompt length, max tokens, etc.)';
COMMENT ON COLUMN llm_usage.response_data IS 'Response metadata (latency, finish reason, etc.)';

-- ========================================
-- Seed Data (Optional)
-- ========================================

-- Add example analysis types as reference
-- You can use these for filtering and categorization

-- Property analysis types:
-- 'ai_insights' - General AI-powered property insights
-- 'development_potential' - Analysis of development opportunities
-- 'market_positioning' - How property fits in market
-- 'investment_analysis' - Investment potential and ROI
-- 'risk_assessment' - Risk factors and mitigation

-- Market analysis types:
-- 'market_trends' - Overall market trends
-- 'investment_opportunities' - Where to invest
-- 'supply_demand' - Supply/demand dynamics
-- 'price_analysis' - Price trends and predictions
-- 'competitive_landscape' - Market competition analysis

-- ========================================
-- Security
-- ========================================

-- Row-level security policies
ALTER TABLE property_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own analyses
CREATE POLICY property_analyses_user_select ON property_analyses
    FOR SELECT
    USING (analyzed_by = current_setting('app.current_user_id')::UUID);

-- Users can insert their own analyses
CREATE POLICY property_analyses_user_insert ON property_analyses
    FOR INSERT
    WITH CHECK (analyzed_by = current_setting('app.current_user_id')::UUID);

-- Users can update their own analyses
CREATE POLICY property_analyses_user_update ON property_analyses
    FOR UPDATE
    USING (analyzed_by = current_setting('app.current_user_id')::UUID);

-- Similar policies for market_analyses
CREATE POLICY market_analyses_user_select ON market_analyses
    FOR SELECT
    USING (analyzed_by = current_setting('app.current_user_id')::UUID);

CREATE POLICY market_analyses_user_insert ON market_analyses
    FOR INSERT
    WITH CHECK (analyzed_by = current_setting('app.current_user_id')::UUID);

CREATE POLICY market_analyses_user_update ON market_analyses
    FOR UPDATE
    USING (analyzed_by = current_setting('app.current_user_id')::UUID);

-- LLM usage policies
CREATE POLICY llm_usage_user_select ON llm_usage
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY llm_usage_user_insert ON llm_usage
    FOR INSERT
    WITH CHECK (user_id = current_setting('app.current_user_id')::UUID);

-- ========================================
-- Grant Permissions
-- ========================================

-- Grant permissions to application role (adjust role name as needed)
-- GRANT ALL ON property_analyses TO jedire_app;
-- GRANT ALL ON market_analyses TO jedire_app;
-- GRANT ALL ON llm_usage TO jedire_app;

-- ========================================
-- Migration Complete
-- ========================================

COMMENT ON SCHEMA public IS 'JediRe LLM Integration - Migration 011 Complete';
