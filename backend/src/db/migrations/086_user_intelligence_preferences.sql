-- ═══════════════════════════════════════════════════════════════
-- JEDI RE — Intelligence Context Engine
-- Migration 086: User Intelligence Preferences
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- User Intelligence Preferences
-- Per-user settings for semantic search, agent learning, privacy
-- ───────────────────────────────────────────────────────────────

CREATE TABLE user_intelligence_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,  -- FK to users table
  
  -- Semantic Search Preferences
  semantic_search_enabled BOOLEAN DEFAULT true,
  semantic_search_threshold FLOAT DEFAULT 0.6 CHECK (semantic_search_threshold >= 0 AND semantic_search_threshold <= 1),
  -- 0.4 = low precision (wide net), 0.6 = medium (balanced), 0.8 = high precision (narrow)
  
  -- Agent Learning Preferences
  contribute_to_learning BOOLEAN DEFAULT true,
  -- Allow my corrections to train agents
  
  request_feedback BOOLEAN DEFAULT true,
  -- Ask me to rate agent results (thumbs up/down)
  
  auto_submit_corrections BOOLEAN DEFAULT false,
  -- Automatically submit my edits as training data (advanced users)
  
  -- Privacy Preferences
  include_documents BOOLEAN DEFAULT true,
  -- Include my documents in intelligence layer (for semantic search + agent context)
  
  task_history_retention_days INTEGER DEFAULT 90,
  -- How long to keep my agent task history (30, 60, 90, 180, 365, 730, -1 for forever)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One row per user
  UNIQUE(user_id)
);

CREATE INDEX idx_user_intel_prefs_user ON user_intelligence_preferences (user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_intel_prefs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_intel_prefs_timestamp
  BEFORE UPDATE ON user_intelligence_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_intel_prefs_timestamp();

COMMENT ON TABLE user_intelligence_preferences IS 'Per-user settings for semantic search, agent learning, and data privacy';
COMMENT ON COLUMN user_intelligence_preferences.semantic_search_threshold IS 'Similarity threshold: 0.4=low, 0.6=medium (default), 0.8=high precision';
COMMENT ON COLUMN user_intelligence_preferences.contribute_to_learning IS 'Allow user corrections to train agents';
COMMENT ON COLUMN user_intelligence_preferences.task_history_retention_days IS 'Days to keep agent task history (-1 = forever)';
