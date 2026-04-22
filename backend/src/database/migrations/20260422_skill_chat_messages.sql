-- Skill Chat Messages Table
-- Stores conversation history for skill-enabled AI chat
-- Created: 2026-04-22

CREATE TABLE IF NOT EXISTS skill_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  skill_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_skill_chat_conversation ON skill_chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_skill_chat_deal ON skill_chat_messages(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_chat_user ON skill_chat_messages(user_id, created_at DESC);

-- Comments
COMMENT ON TABLE skill_chat_messages IS 'Conversation history for skill-enabled AI chat';
COMMENT ON COLUMN skill_chat_messages.conversation_id IS 'Groups messages into a single conversation thread';
COMMENT ON COLUMN skill_chat_messages.skill_calls IS 'JSON array of skills called during this message';
