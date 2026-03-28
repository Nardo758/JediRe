-- Agent Chat Tables Migration
-- Date: 2026-03-28
-- Description: Creates tables for agent chat logs and user notifications

-- Agent Chat Logs
CREATE TABLE IF NOT EXISTS agent_chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_code VARCHAR(20) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    deal_id UUID REFERENCES deals(id),
    msa_id VARCHAR(10),
    session_id VARCHAR(100),
    user_message TEXT NOT NULL,
    agent_response TEXT NOT NULL,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_chat_logs_user ON agent_chat_logs(user_id);
CREATE INDEX idx_agent_chat_logs_deal ON agent_chat_logs(deal_id);
CREATE INDEX idx_agent_chat_logs_agent ON agent_chat_logs(agent_code);
CREATE INDEX idx_agent_chat_logs_created ON agent_chat_logs(created_at DESC);

-- User Notifications (for mobile push)
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    deal_id UUID REFERENCES deals(id),
    agent_source VARCHAR(20),
    action_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    push_sent_at TIMESTAMPTZ,
    push_error TEXT
);

CREATE INDEX idx_user_notifications_user ON user_notifications(user_id);
CREATE INDEX idx_user_notifications_unread ON user_notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_user_notifications_created ON user_notifications(created_at DESC);

-- User Push Tokens (for Firebase/OneSignal/etc)
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token TEXT NOT NULL UNIQUE,
    platform VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
    device_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_user_push_tokens_user ON user_push_tokens(user_id);
CREATE INDEX idx_user_push_tokens_active ON user_push_tokens(user_id, is_active) WHERE is_active = true;

COMMENT ON TABLE agent_chat_logs IS 'Logs all user interactions with JEDI agents for analytics and learning';
COMMENT ON TABLE user_notifications IS 'Queue of notifications to be delivered to users via mobile/push';
COMMENT ON TABLE user_push_tokens IS 'Push notification tokens for user devices';
