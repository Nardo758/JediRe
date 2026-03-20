-- ═══════════════════════════════════════════════════════════════
-- JEDI RE — Intelligence Context Engine
-- Migration 083: Agent Task Learnings & Historical Memory
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- Agent Task Learnings
-- Stores task execution context and outcomes for pattern learning
-- ───────────────────────────────────────────────────────────────

CREATE TABLE agent_task_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Task reference
  agent_type VARCHAR(100) NOT NULL,
  -- 'zoning_analysis', 'supply_analysis', 'cashflow_analysis', 'deal_intake', etc.
  
  task_id UUID,  -- FK to agent_tasks(id) if task tracking exists
  deal_capsule_id UUID,  -- Link to deal if applicable
  
  -- Context fingerprint (what data was used)
  context_documents UUID[] DEFAULT '{}',
  -- Array of unified_documents.id that were used as input
  
  context_summary TEXT,
  -- Human-readable summary of context used
  
  context_embedding VECTOR(1536),
  -- Embedding of concatenated context for similarity search
  
  -- Input parameters
  input_params JSONB NOT NULL,
  -- The original task input parameters
  
  -- Output result
  output_result JSONB NOT NULL,
  -- The agent's output
  
  output_confidence FLOAT CHECK (output_confidence >= 0 AND output_confidence <= 1),
  -- Agent's self-assessed confidence in result
  
  -- Execution metrics
  execution_time_ms INTEGER,
  data_sources_used TEXT[],
  -- ['unified_documents', 'benchmark_projects', 'zoning_database']
  
  -- Human feedback
  user_validation VARCHAR(50) CHECK (user_validation IN (
    'approved', 'rejected', 'corrected', 'pending', NULL
  )),
  user_corrections JSONB,
  -- What the user changed in the output
  
  user_feedback_notes TEXT,
  user_feedback_at TIMESTAMPTZ,
  
  -- Similarity to past tasks (computed at query time, cached here)
  similar_task_ids UUID[],
  similarity_scores FLOAT[],
  -- Parallel arrays: similar_task_ids[0] has similarity_scores[0]
  
  -- Outcome tracking
  outcome_status VARCHAR(50),
  -- 'deal_approved', 'deal_rejected', 'variance_required', 'pending', etc.
  
  outcome_notes TEXT,
  outcome_recorded_at TIMESTAMPTZ,
  
  -- Metadata
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agent_learnings_type ON agent_task_learnings (agent_type);
CREATE INDEX idx_agent_learnings_task ON agent_task_learnings (task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_agent_learnings_deal ON agent_task_learnings (deal_capsule_id) WHERE deal_capsule_id IS NOT NULL;
CREATE INDEX idx_agent_learnings_validation ON agent_task_learnings (user_validation) WHERE user_validation IS NOT NULL;
CREATE INDEX idx_agent_learnings_created ON agent_task_learnings (created_at DESC);
CREATE INDEX idx_agent_learnings_user ON agent_task_learnings (user_id) WHERE user_id IS NOT NULL;

-- Vector similarity index
CREATE INDEX idx_agent_learnings_context ON agent_task_learnings 
  USING ivfflat (context_embedding vector_cosine_ops)
  WITH (lists = 50);

-- GIN index on input/output JSONB for fast queries
CREATE INDEX idx_agent_learnings_input ON agent_task_learnings USING gin(input_params);
CREATE INDEX idx_agent_learnings_output ON agent_task_learnings USING gin(output_result);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_learnings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_learnings_timestamp
  BEFORE UPDATE ON agent_task_learnings
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_learnings_timestamp();

-- ───────────────────────────────────────────────────────────────
-- Pattern Library
-- Stores discovered patterns and heuristics across tasks
-- ───────────────────────────────────────────────────────────────

CREATE TABLE agent_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  agent_type VARCHAR(100) NOT NULL,
  
  pattern_name VARCHAR(200) NOT NULL,
  -- 'midrise_atlanta_urban_core', 'suburban_garden_style_variance_rate'
  
  pattern_description TEXT,
  
  -- Pattern detection criteria
  criteria JSONB NOT NULL,
  -- {
  --   "property_type": "multifamily",
  --   "property_city": "Atlanta",
  --   "zoning_type": "MR-5",
  --   "height_range": [80, 150]
  -- }
  
  -- Learned statistics
  statistics JSONB DEFAULT '{}',
  -- {
  --   "sample_size": 23,
  --   "avg_timeline_days": 195,
  --   "variance_rate": 0.35,
  --   "success_rate": 0.92,
  --   "avg_confidence": 0.88,
  --   "outlier_count": 2
  -- }
  
  -- Associated learnings
  learning_ids UUID[],
  -- Array of agent_task_learnings.id that contributed to this pattern
  
  -- Pattern strength
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  sample_count INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_applied_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(agent_type, pattern_name)
);

CREATE INDEX idx_agent_patterns_type ON agent_patterns (agent_type);
CREATE INDEX idx_agent_patterns_active ON agent_patterns (is_active) WHERE is_active = true;
CREATE INDEX idx_agent_patterns_confidence ON agent_patterns (confidence DESC);

-- GIN index on criteria for pattern matching
CREATE INDEX idx_agent_patterns_criteria ON agent_patterns USING gin(criteria);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_patterns_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_patterns_timestamp
  BEFORE UPDATE ON agent_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_patterns_timestamp();

-- ───────────────────────────────────────────────────────────────
-- Helper Functions
-- ───────────────────────────────────────────────────────────────

-- Function to find similar past tasks by context embedding
CREATE OR REPLACE FUNCTION find_similar_tasks(
  p_agent_type VARCHAR,
  p_context_embedding VECTOR(1536),
  p_limit INTEGER DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  learning_id UUID,
  similarity FLOAT,
  input_params JSONB,
  output_result JSONB,
  user_validation VARCHAR,
  execution_time_ms INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    atl.id,
    1 - (atl.context_embedding <=> p_context_embedding) AS similarity,
    atl.input_params,
    atl.output_result,
    atl.user_validation,
    atl.execution_time_ms
  FROM agent_task_learnings atl
  WHERE atl.agent_type = p_agent_type
    AND atl.context_embedding IS NOT NULL
    AND 1 - (atl.context_embedding <=> p_context_embedding) >= p_min_similarity
  ORDER BY atl.context_embedding <=> p_context_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE agent_task_learnings IS 'Historical task executions with context and outcomes for pattern learning';
COMMENT ON TABLE agent_patterns IS 'Discovered patterns and heuristics aggregated across tasks';
COMMENT ON FUNCTION find_similar_tasks IS 'Find past tasks with similar context using vector similarity';
COMMENT ON COLUMN agent_task_learnings.context_embedding IS 'Embedding of concatenated context documents for similarity search';
COMMENT ON COLUMN agent_task_learnings.user_corrections IS 'User edits to agent output for learning';
