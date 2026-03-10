-- ============================================================================
-- Migration 090: Financial Models Table
-- Stores financial model assumptions + outputs for deals
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Model classification
  model_type VARCHAR(20) NOT NULL CHECK (model_type IN ('acquisition', 'development', 'redevelopment')),
  model_version VARCHAR(10) NOT NULL DEFAULT '1.0',
  
  -- Complete assumptions (input to Claude)
  assumptions JSONB NOT NULL,
  
  -- Complete output (from Claude)
  output JSONB,
  
  -- Cache invalidation
  assumptions_hash VARCHAR(64) NOT NULL,
  
  -- Metadata
  computed_at TIMESTAMP,
  computed_by UUID REFERENCES users(id),
  computation_duration_ms INTEGER,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  -- Indexing
  UNIQUE(deal_id, model_version),
  CHECK (output IS NULL OR computed_at IS NOT NULL)
);

-- Index for lookups
CREATE INDEX idx_financial_models_deal_id ON financial_models(deal_id);
CREATE INDEX idx_financial_models_type ON financial_models(model_type);
CREATE INDEX idx_financial_models_hash ON financial_models(assumptions_hash);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_financial_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER financial_models_updated_at
  BEFORE UPDATE ON financial_models
  FOR EACH ROW
  EXECUTE FUNCTION update_financial_models_updated_at();

COMMENT ON TABLE financial_models IS 'Financial models (acquisition/development/redevelopment) with Claude-computed outputs';
COMMENT ON COLUMN financial_models.assumptions_hash IS 'SHA-256 hash of assumptions JSONB for cache invalidation';
COMMENT ON COLUMN financial_models.output IS 'Complete Claude-generated output matching model type schema';
