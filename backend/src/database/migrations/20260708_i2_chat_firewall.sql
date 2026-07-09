-- I2 Chat-Content License Firewall
-- 2026-07-08
--
-- Creates skill_chat_messages if it does not yet exist (the April-2026 migration
-- was declared but never applied to this environment), adds contains_restricted
-- for the flag-and-exclude firewall strategy.
--
-- contains_restricted = TRUE  → assistant response may contain restricted-vendor-
--   derived values (e.g. CoStar correlations). Such rows are:
--   • EXCLUDED from loadConversationHistory replay into AI prompts (firewall)
--   • Still readable by the frontend history endpoint (display is fine; only
--     LLM re-ingestion is the risk)
--   • Retained for counsel's purge ruling (do not delete)
--
-- Derivation-chain rule applies: if the deal carries any metric_time_series rows
-- with redistribution_restricted=TRUE, every assistant turn for that deal is
-- flagged at write time.

CREATE TABLE IF NOT EXISTS skill_chat_messages (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  TEXT          NOT NULL,
  deal_id          UUID          NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role             TEXT          NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT          NOT NULL,
  skill_calls      JSONB,
  contains_restricted BOOLEAN    NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Add contains_restricted to existing tables that were created by the April-2026 migration
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_chat_messages' AND column_name = 'contains_restricted'
  ) THEN
    ALTER TABLE skill_chat_messages ADD COLUMN contains_restricted BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_skill_chat_conversation ON skill_chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_skill_chat_deal        ON skill_chat_messages(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_chat_user        ON skill_chat_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_chat_restricted  ON skill_chat_messages(deal_id, contains_restricted)
  WHERE contains_restricted = TRUE;

COMMENT ON COLUMN skill_chat_messages.contains_restricted IS
  'TRUE when the assistant response was generated in a deal context with restricted-vendor lineage (e.g. CoStar). Excluded from AI replay; retained for counsel purge ruling.';
