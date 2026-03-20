-- JEDI RE Platform Architecture Migration
-- Adds tables for: AI usage tracking, credit balances, chat sessions,
-- deal context caching, and proactive alert logging.

-- ── AI Usage Log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  stripe_customer_id TEXT,
  deal_id UUID,

  agent_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  surface TEXT NOT NULL,
  platform TEXT,

  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_read_tokens INTEGER DEFAULT 0,

  credits_consumed INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6),

  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_deal ON ai_usage_log(deal_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_agent ON ai_usage_log(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_surface ON ai_usage_log(surface);

-- ── User Credit Balances ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_credit_balances (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  stripe_customer_id TEXT NOT NULL DEFAULT '',

  subscription_tier TEXT NOT NULL DEFAULT 'scout',
  automation_level INTEGER NOT NULL DEFAULT 1,

  credits_included_monthly INTEGER NOT NULL DEFAULT 100,
  credits_remaining INTEGER NOT NULL DEFAULT 100,
  credits_used_this_period INTEGER NOT NULL DEFAULT 0,

  monthly_credit_cap INTEGER,
  alert_threshold_pct SMALLINT DEFAULT 80,

  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Chat Sessions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,

  -- Twilio-specific (NULL for Telegram)
  twilio_conversation_sid TEXT,
  twilio_participant_sid TEXT,
  whatsapp_window_expires_at TIMESTAMPTZ,

  conversation_history JSONB NOT NULL DEFAULT '[]',
  active_deal_ids UUID[] DEFAULT '{}',

  automation_level INTEGER NOT NULL DEFAULT 1,
  credits_used_this_session INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_chat_platform ON chat_sessions(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_sessions(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_expires ON chat_sessions(expires_at);

-- ── Cached DealContexts ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID,
  user_id UUID NOT NULL REFERENCES users(id),

  address TEXT NOT NULL,
  context_json JSONB NOT NULL,

  sources_queried TEXT[] NOT NULL DEFAULT '{}',
  sources_succeeded TEXT[] NOT NULL DEFAULT '{}',
  sources_failed TEXT[] NOT NULL DEFAULT '{}',
  confidence_score NUMERIC(3, 2),
  assembly_time_ms INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_deal_context_address ON deal_contexts(address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_context_user ON deal_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_context_expires ON deal_contexts(expires_at);

-- ── Proactive Alerts Log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS proactive_alerts_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  alert_type TEXT NOT NULL,
  deal_id UUID,
  platform TEXT NOT NULL,
  summary TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON proactive_alerts_log(user_id, created_at DESC);

-- ── Add phone column to users if not exists ───────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE users ADD COLUMN phone TEXT;
    CREATE INDEX idx_users_phone ON users(phone);
  END IF;
END $$;
