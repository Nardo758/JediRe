-- ============================================================================
-- USER MODEL PREFERENCES (per-surface LLM routing)
-- ============================================================================
-- Allows a user to pin a specific LLM model to a specific surface
-- (agent / skill / pipeline). Falls back to user_credit_balances.llm_preference
-- (global), then to the tier default in MODEL_ROUTING.
--
-- surface_type:
--   'agent'    -> AgentId (research/zoning/supply/cashflow/coordinator/commentary)
--   'skill'    -> Skill family id (cfo, debt_advisor, tax_advisor, market_expert,
--                                 document_extraction, ...)
--   'pipeline' -> Named non-agent LLM call site (om_parsing,
--                                                 email_intake_classification,
--                                                 document_classification, ...)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_model_preferences (
  user_id       UUID         NOT NULL,
  surface_type  VARCHAR(20)  NOT NULL,
  surface_id    VARCHAR(100) NOT NULL,
  model         VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, surface_type, surface_id),
  CONSTRAINT user_model_preferences_surface_type_check
    CHECK (surface_type IN ('agent', 'skill', 'pipeline'))
);

CREATE INDEX IF NOT EXISTS idx_user_model_prefs_user
  ON user_model_preferences (user_id);

-- updated_at trigger (defensive: define function if not already present)
CREATE OR REPLACE FUNCTION update_user_model_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_user_model_preferences_updated ON user_model_preferences;
CREATE TRIGGER tr_user_model_preferences_updated
  BEFORE UPDATE ON user_model_preferences
  FOR EACH ROW EXECUTE FUNCTION update_user_model_preferences_timestamp();
