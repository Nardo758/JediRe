-- Migration: deal_roadmaps
-- Stores generated roadmap outputs for each deal.
-- Roadmaps freeze at deal close per spec §Q3.

CREATE TABLE IF NOT EXISTS deal_roadmaps (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id                UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  created_by             UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  target_return_metric   TEXT NOT NULL CHECK (target_return_metric IN ('irr','equity_multiple','noi_growth_3yr','cash_on_cash_y3')),
  target_return_value    NUMERIC(8,4) NOT NULL,
  hold_years             INTEGER NOT NULL CHECK (hold_years BETWEEN 1 AND 30),
  constraints_json       JSONB,
  output_json            JSONB,
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','succeeded','failed')),
  error                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deal_roadmaps_deal_id_idx  ON deal_roadmaps(deal_id);
CREATE INDEX IF NOT EXISTS deal_roadmaps_created_by_idx ON deal_roadmaps(created_by);
CREATE INDEX IF NOT EXISTS deal_roadmaps_status_idx   ON deal_roadmaps(status);
