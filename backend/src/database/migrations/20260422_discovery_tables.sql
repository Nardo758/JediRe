-- Discovery System Tables
-- Stores cached data from external API discoveries
-- Created: 2026-04-22

-- ============================================================================
-- DISCOVERY CACHE
-- Caches API responses to avoid redundant calls
-- ============================================================================

CREATE TABLE IF NOT EXISTS discovery_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  UNIQUE(source_id, endpoint_id, query_hash)
);

CREATE INDEX IF NOT EXISTS idx_discovery_cache_source ON discovery_cache(source_id, endpoint_id);
CREATE INDEX IF NOT EXISTS idx_discovery_cache_expires ON discovery_cache(expires_at) WHERE expires_at IS NOT NULL;

-- Auto-cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_discovery_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM discovery_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE discovery_cache IS 'Cached responses from external API discoveries';

-- ============================================================================
-- NEWS DISCOVERIES
-- Stores discovered news articles
-- ============================================================================

CREATE TABLE IF NOT EXISTS news_discoveries (
  id TEXT PRIMARY KEY,
  headline TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  summary TEXT,
  category TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  relevant_msas JSONB,
  relevant_deals JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_discoveries_published ON news_discoveries(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_discoveries_category ON news_discoveries(category);
CREATE INDEX IF NOT EXISTS idx_news_discoveries_deals ON news_discoveries USING GIN (relevant_deals);

COMMENT ON TABLE news_discoveries IS 'News articles discovered by automated scanning';

-- ============================================================================
-- MARKET DATA SNAPSHOTS
-- Periodic snapshots of market data
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_data_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type TEXT NOT NULL, -- 'hourly', 'daily', 'weekly'
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_type ON market_data_snapshots(snapshot_type, created_at DESC);

-- Keep 30 days of snapshots
CREATE OR REPLACE FUNCTION cleanup_old_market_snapshots()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM market_data_snapshots 
  WHERE created_at < NOW() - INTERVAL '30 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_market_snapshots ON market_data_snapshots;
CREATE TRIGGER trg_cleanup_market_snapshots
  AFTER INSERT ON market_data_snapshots
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_market_snapshots();

COMMENT ON TABLE market_data_snapshots IS 'Periodic snapshots of market data (rates, REITs, etc.)';

-- ============================================================================
-- DISCOVERY RUNS
-- Tracks discovery job executions
-- ============================================================================

CREATE TABLE IF NOT EXISTS discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  items_discovered INTEGER DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_discovery_runs_job ON discovery_runs(job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_status ON discovery_runs(status) WHERE status = 'running';

COMMENT ON TABLE discovery_runs IS 'Tracks automated discovery job executions';
