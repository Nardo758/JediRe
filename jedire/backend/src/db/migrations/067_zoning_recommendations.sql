-- Migration 067: Zoning Recommendations
-- Stores orchestrator-generated zoning recommendations per deal

CREATE TABLE IF NOT EXISTS zoning_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id VARCHAR(255) NOT NULL,
  current_code VARCHAR(50),
  municipality VARCHAR(255),
  state CHAR(2),
  nearby_analysis JSONB DEFAULT '{}',
  candidates JSONB DEFAULT '[]',
  top_recommendation_code VARCHAR(50),
  top_recommendation_score DECIMAL(5,2),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoning_recommendations_deal ON zoning_recommendations(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoning_recommendations_expires ON zoning_recommendations(expires_at);

CREATE OR REPLACE FUNCTION update_zoning_recommendations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_zoning_recommendations_updated ON zoning_recommendations;
CREATE TRIGGER trg_zoning_recommendations_updated
  BEFORE UPDATE ON zoning_recommendations
  FOR EACH ROW EXECUTE FUNCTION update_zoning_recommendations_timestamp();

COMMENT ON TABLE zoning_recommendations IS 'Cached zoning recommendations from the orchestrator — nearby parcel analysis, candidate codes, and top recommendation';
