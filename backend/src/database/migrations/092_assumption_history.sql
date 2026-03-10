-- ============================================================================
-- Migration 092: Assumption History (Audit Trail)
-- Tracks all user overrides and assumption changes with full provenance
-- ============================================================================

CREATE TABLE IF NOT EXISTS assumption_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to financial model
  financial_model_id UUID NOT NULL REFERENCES financial_models(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- What changed
  assumption_path VARCHAR(255) NOT NULL, -- e.g., "revenue.rentGrowth"
  field_name VARCHAR(100) NOT NULL,
  
  -- Old and new values
  old_value JSONB,
  new_value JSONB NOT NULL,
  
  -- Source attribution
  source_layer VARCHAR(20) NOT NULL CHECK (source_layer IN ('broker', 'platform', 'user', 'agent', 'computed')),
  source_module VARCHAR(50), -- e.g., "M05", "M15", "manual"
  
  -- Who made the change
  changed_by UUID REFERENCES users(id),
  change_reason TEXT,
  
  -- Metadata
  confidence NUMERIC(3,2) CHECK (confidence BETWEEN 0 AND 1),
  platform_suggested_value JSONB, -- What platform recommended (if user overrode)
  override_delta NUMERIC,
  
  -- Timestamp
  changed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_assumption_history_model ON assumption_history(financial_model_id);
CREATE INDEX idx_assumption_history_deal ON assumption_history(deal_id);
CREATE INDEX idx_assumption_history_path ON assumption_history(assumption_path);
CREATE INDEX idx_assumption_history_user ON assumption_history(changed_by);
CREATE INDEX idx_assumption_history_timestamp ON assumption_history(changed_at DESC);

-- View: Latest assumption for each path
CREATE OR REPLACE VIEW assumption_latest AS
SELECT DISTINCT ON (financial_model_id, assumption_path)
  *
FROM assumption_history
ORDER BY financial_model_id, assumption_path, changed_at DESC;

-- View: User overrides (platform suggestions that were manually changed)
CREATE OR REPLACE VIEW user_overrides AS
SELECT *
FROM assumption_history
WHERE 
  source_layer = 'user'
  AND platform_suggested_value IS NOT NULL
ORDER BY changed_at DESC;

COMMENT ON TABLE assumption_history IS 'Complete audit trail of all assumption changes across financial models';
COMMENT ON COLUMN assumption_history.assumption_path IS 'Dot-notation path to the field (e.g., revenue.rentGrowth)';
COMMENT ON COLUMN assumption_history.override_delta IS 'Difference from platform suggestion when user overrides';
COMMENT ON VIEW assumption_latest IS 'Latest value for each assumption path per model';
COMMENT ON VIEW user_overrides IS 'All cases where user manually overrode platform suggestions';
