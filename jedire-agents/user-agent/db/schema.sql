-- JediRe User Agent Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AI Models Catalog
-- ============================================

CREATE TABLE ai_models (
    id TEXT PRIMARY KEY,  -- e.g., "claude-sonnet-4-5", "gpt-4o"
    name TEXT NOT NULL,
    provider TEXT NOT NULL,  -- anthropic|openai|google
    tier TEXT NOT NULL CHECK (tier IN ('fast', 'standard', 'premium')),
    
    -- Pricing (per 1M tokens, in USD)
    price_input_usd DECIMAL(10,6) NOT NULL,
    price_output_usd DECIMAL(10,6) NOT NULL,
    
    -- Capabilities
    context_window INTEGER NOT NULL,
    max_output_tokens INTEGER,
    capabilities JSONB DEFAULT '[]'::jsonb,  -- ["reasoning", "analysis", "coding"]
    speed_tier TEXT CHECK (speed_tier IN ('very_fast', 'fast', 'moderate', 'slow')),
    
    -- Availability
    is_active BOOLEAN DEFAULT true,
    released_at TIMESTAMPTZ,
    deprecated_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample data
INSERT INTO ai_models (id, name, provider, tier, price_input_usd, price_output_usd, context_window, speed_tier, capabilities) VALUES
    -- Fast tier
    ('gpt-4o-mini', 'GPT-4o Mini', 'openai', 'fast', 0.15, 0.60, 128000, 'very_fast', '["chat", "basic_analysis"]'),
    ('claude-haiku-3-5', 'Claude Haiku 3.5', 'anthropic', 'fast', 0.25, 1.25, 200000, 'very_fast', '["chat", "reasoning"]'),
    ('gemini-flash', 'Gemini Flash', 'google', 'fast', 0.075, 0.30, 128000, 'very_fast', '["chat"]'),
    
    -- Standard tier
    ('gpt-4o', 'GPT-4o', 'openai', 'standard', 2.50, 10.00, 128000, 'fast', '["reasoning", "analysis", "coding"]'),
    ('claude-sonnet-4-5', 'Claude Sonnet 4.5', 'anthropic', 'standard', 3.00, 15.00, 200000, 'fast', '["reasoning", "analysis", "coding", "long_context"]'),
    ('gemini-pro', 'Gemini Pro', 'google', 'standard', 1.25, 5.00, 128000, 'fast', '["reasoning", "analysis"]'),
    
    -- Premium tier
    ('claude-opus-4', 'Claude Opus 4', 'anthropic', 'premium', 15.00, 75.00, 200000, 'moderate', '["advanced_reasoning", "complex_analysis", "coding", "long_context"]'),
    ('gpt-o1', 'GPT-o1', 'openai', 'premium', 15.00, 60.00, 128000, 'slow', '["advanced_reasoning", "complex_problem_solving"]'),
    ('gemini-ultra', 'Gemini Ultra', 'google', 'premium', 10.00, 40.00, 128000, 'moderate', '["advanced_reasoning", "multimodal"]')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Users & Preferences
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    
    -- Stripe
    stripe_customer_id TEXT UNIQUE,
    
    -- Billing
    plan TEXT DEFAULT 'basic' CHECK (plan IN ('basic', 'pro', 'enterprise')),
    billing_type TEXT DEFAULT 'subscription' CHECK (billing_type IN ('subscription', 'credits', 'invoice')),
    credit_balance DECIMAL(10,2) DEFAULT 0.00,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_ai_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Model selection
    default_model TEXT REFERENCES ai_models(id) DEFAULT 'claude-sonnet-4-5',
    fallback_model TEXT REFERENCES ai_models(id),
    
    -- Cost controls
    cost_warning_threshold DECIMAL(10,6),  -- Warn if single request > this
    monthly_budget_usd DECIMAL(10,2),
    auto_downgrade_on_low_credits BOOLEAN DEFAULT false,
    
    -- Tier restrictions (NULL = use plan defaults)
    allowed_tiers TEXT[],  -- e.g., ['fast', 'standard']
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Usage Tracking
-- ============================================

CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User info
    user_id UUID NOT NULL REFERENCES users(id),
    stripe_customer_id TEXT,
    session_id TEXT,
    
    -- Request details
    source TEXT NOT NULL CHECK (source IN ('platform', 'telegram', 'whatsapp', 'api')),
    model_id TEXT NOT NULL REFERENCES ai_models(id),
    model_tier TEXT NOT NULL,
    user_selected_model BOOLEAN DEFAULT false,  -- Did user explicitly pick this model?
    
    -- Token usage
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    
    -- Costs (in USD)
    provider_cost_usd DECIMAL(10,6) NOT NULL,  -- What we paid the LLM provider
    stripe_cost_usd DECIMAL(10,6),  -- What Stripe charged the customer
    our_markup_usd DECIMAL(10,6),  -- Our profit
    markup_percentage DECIMAL(5,2),
    
    -- Request/Response metadata
    request_metadata JSONB DEFAULT '{}'::jsonb,  -- Query type, context, etc.
    response_metadata JSONB DEFAULT '{}'::jsonb,  -- Response time, etc.
    
    -- Billing status
    billed_at TIMESTAMPTZ,
    invoiced_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_usage_logs_user_created ON usage_logs(user_id, created_at DESC);
CREATE INDEX idx_usage_logs_stripe_customer ON usage_logs(stripe_customer_id);
CREATE INDEX idx_usage_logs_model ON usage_logs(model_id);
CREATE INDEX idx_usage_logs_unbilled ON usage_logs(user_id) WHERE billed_at IS NULL;
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);

-- ============================================
-- Conversations & Sessions
-- ============================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Metadata
    title TEXT,
    source TEXT NOT NULL CHECK (source IN ('platform', 'telegram', 'whatsapp', 'api')),
    
    -- Context
    context JSONB DEFAULT '{}'::jsonb,  -- Deal IDs, property info, etc.
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Message
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    -- Usage link
    usage_log_id UUID REFERENCES usage_logs(id),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

-- ============================================
-- Billing & Credits
-- ============================================

CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Transaction
    amount_usd DECIMAL(10,2) NOT NULL,  -- Positive = added, negative = deducted
    type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus', 'adjustment')),
    
    -- Related records
    usage_log_id UUID REFERENCES usage_logs(id),
    stripe_payment_intent_id TEXT,
    
    -- Balance tracking
    balance_before DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    
    -- Description
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);

-- ============================================
-- Custom Invoices
-- ============================================

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Invoice details
    invoice_number TEXT UNIQUE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Amounts
    subtotal_usd DECIMAL(10,2) NOT NULL,
    tax_usd DECIMAL(10,2) DEFAULT 0.00,
    total_usd DECIMAL(10,2) NOT NULL,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
    
    -- Files
    pdf_url TEXT,
    
    -- Stripe
    stripe_invoice_id TEXT,
    
    -- Timestamps
    issued_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Line item
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price_usd DECIMAL(10,6) NOT NULL,
    amount_usd DECIMAL(10,2) NOT NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,  -- Model, tokens, etc.
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Views for Analytics
-- ============================================

-- Daily usage summary per user
CREATE VIEW daily_usage_summary AS
SELECT 
    user_id,
    DATE(created_at) as date,
    COUNT(*) as request_count,
    SUM(total_tokens) as total_tokens,
    SUM(prompt_tokens) as prompt_tokens,
    SUM(completion_tokens) as completion_tokens,
    SUM(stripe_cost_usd) as total_cost_usd,
    SUM(our_markup_usd) as total_markup_usd,
    jsonb_object_agg(model_id, COUNT(*)) as requests_by_model
FROM usage_logs
GROUP BY user_id, DATE(created_at);

-- Monthly usage by tier
CREATE VIEW monthly_usage_by_tier AS
SELECT 
    user_id,
    DATE_TRUNC('month', created_at) as month,
    model_tier,
    COUNT(*) as request_count,
    SUM(total_tokens) as total_tokens,
    SUM(stripe_cost_usd) as total_cost_usd
FROM usage_logs
GROUP BY user_id, DATE_TRUNC('month', created_at), model_tier;

-- ============================================
-- Functions
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_ai_preferences_updated_at BEFORE UPDATE ON user_ai_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at BEFORE UPDATE ON ai_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Sample Data (for testing)
-- ============================================

-- Test user
INSERT INTO users (email, name, stripe_customer_id, plan, billing_type, credit_balance) VALUES
    ('test@jedire.com', 'Test User', 'cus_test123', 'pro', 'credits', 50.00);

-- User preferences
INSERT INTO user_ai_preferences (user_id, default_model, monthly_budget_usd, cost_warning_threshold)
SELECT id, 'claude-sonnet-4-5', 100.00, 0.10
FROM users WHERE email = 'test@jedire.com';

-- Comments
COMMENT ON TABLE ai_models IS 'Catalog of available AI models with pricing';
COMMENT ON TABLE users IS 'User accounts with billing info';
COMMENT ON TABLE usage_logs IS 'Detailed logs of every AI request with costs';
COMMENT ON TABLE conversations IS 'Chat conversation sessions';
COMMENT ON TABLE messages IS 'Individual messages in conversations';
COMMENT ON TABLE credit_transactions IS 'Credit purchases and usage tracking';
COMMENT ON TABLE invoices IS 'Custom invoices for enterprise customers';
