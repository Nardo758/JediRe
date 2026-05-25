-- Creates the jedi_scores table referenced by agent-chat.service.ts.
--
-- Context:
--   The primary JEDI Score persistence store is jedi_score_history (already exists),
--   written by jedi-score.service.ts (saveScore / calculateAndSave).
--   jedi_scores is a companion "current score" table for fast join lookups.
--
-- Callers (as of Task #1051 audit):
--   - backend/src/services/agent-chat.service.ts:133
--       LEFT JOIN jedi_scores j ON j.deal_id = d.id
--       Reads: total_score, market_score, financial_score, location_score, risk_score
--
-- Column set includes both the service's native dimensions (demand/supply/momentum/
-- position/risk) and the agent-chat join dimensions (market/financial/location) so
-- all callers are satisfied without any code changes.

CREATE TABLE IF NOT EXISTS jedi_scores (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

  -- Primary scoring dimensions (written by jedi-score.service.ts)
  total_score         NUMERIC,
  demand_score        NUMERIC,
  supply_score        NUMERIC,
  momentum_score      NUMERIC,
  position_score      NUMERIC,
  risk_score          NUMERIC,
  demand_contribution   NUMERIC,
  supply_contribution   NUMERIC,
  momentum_contribution NUMERIC,
  position_contribution NUMERIC,
  risk_contribution     NUMERIC,

  -- Alternative scoring dimensions (read by agent-chat.service.ts)
  market_score        NUMERIC,
  financial_score     NUMERIC,
  location_score      NUMERIC,

  -- Calculation metadata
  calculation_method  TEXT,
  trigger_event_id    UUID,
  trigger_type        TEXT,
  previous_score      NUMERIC,
  score_delta         NUMERIC,

  -- Rich payloads (optional)
  market_snapshot     JSONB,
  demand_factors      JSONB,
  supply_factors      JSONB,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast deal_id lookup (used by LEFT JOIN in agent-chat)
CREATE INDEX IF NOT EXISTS idx_jedi_scores_deal_id
  ON jedi_scores(deal_id);

-- Composite for "latest score per deal" queries
CREATE INDEX IF NOT EXISTS idx_jedi_scores_deal_created
  ON jedi_scores(deal_id, created_at DESC);
