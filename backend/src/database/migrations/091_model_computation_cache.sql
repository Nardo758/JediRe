-- ============================================================================
-- Migration 091: Model Computation Cache
-- Caches Claude API responses to avoid redundant expensive computations
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_computation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Cache key (hash of assumptions)
  assumptions_hash VARCHAR(64) NOT NULL UNIQUE,
  
  -- Model metadata
  model_type VARCHAR(20) NOT NULL CHECK (model_type IN ('acquisition', 'development', 'redevelopment')),
  
  -- Cached data
  assumptions JSONB NOT NULL,
  output JSONB NOT NULL,
  
  -- Cache management
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  -- Computation metadata
  computation_duration_ms INTEGER,
  tokens_used INTEGER,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cache_hash ON model_computation_cache(assumptions_hash);
CREATE INDEX idx_cache_type ON model_computation_cache(model_type);
CREATE INDEX idx_cache_expires ON model_computation_cache(expires_at);
CREATE INDEX idx_cache_accessed ON model_computation_cache(last_accessed_at);

-- Function to update hit count and last accessed
CREATE OR REPLACE FUNCTION increment_cache_hit()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hit_count = OLD.hit_count + 1;
  NEW.last_accessed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM model_computation_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE model_computation_cache IS 'Caches Claude API computation results to avoid redundant expensive calls';
COMMENT ON COLUMN model_computation_cache.assumptions_hash IS 'SHA-256 hash of assumptions - unique cache key';
COMMENT ON COLUMN model_computation_cache.expires_at IS 'Cache entry expiration (typically 7-30 days)';
COMMENT ON COLUMN model_computation_cache.hit_count IS 'Number of times this cached result was served';
