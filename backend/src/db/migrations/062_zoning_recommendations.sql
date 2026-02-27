-- Migration 062: Zoning Recommendations Cache Table
-- Stores orchestrator results per deal with 24-hour expiry

CREATE TABLE IF NOT EXISTS zoning_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE,
  result_json JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoning_recommendations_deal_id ON zoning_recommendations(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoning_recommendations_expires_at ON zoning_recommendations(expires_at);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_zoning_recommendations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_zoning_recommendations_updated_at ON zoning_recommendations;
CREATE TRIGGER trg_zoning_recommendations_updated_at
  BEFORE UPDATE ON zoning_recommendations
  FOR EACH ROW EXECUTE FUNCTION update_zoning_recommendations_updated_at();
