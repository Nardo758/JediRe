-- News API Tables
-- Usage tracking and caching for credit-metered news providers
-- Created: 2026-04-22

-- ============================================================================
-- NEWS API USAGE LOG
-- Track every API call for billing visibility and provider cost analysis
-- ============================================================================

CREATE TABLE IF NOT EXISTS news_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,        -- news.search, news.article_full, etc.
  provider TEXT NOT NULL,         -- guardian, nyt, newsapi, multi
  credits_charged NUMERIC(10,4) NOT NULL,
  metadata JSONB DEFAULT '{}',    -- query, resultsCount, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_usage_user ON news_api_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_usage_provider ON news_api_usage(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_usage_operation ON news_api_usage(operation, created_at DESC);

COMMENT ON TABLE news_api_usage IS 'Track news API usage for billing and margin analysis';

-- ============================================================================
-- ARTICLE CACHE
-- Cache fetched articles to reduce API calls and improve response time
-- ============================================================================

CREATE TABLE IF NOT EXISTS news_article_cache (
  id TEXT PRIMARY KEY,            -- provider:articleId
  provider TEXT NOT NULL,
  article_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,                   -- Full body if available
  url TEXT NOT NULL,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  source_id TEXT,
  source_name TEXT,
  author TEXT,
  category TEXT,
  tags JSONB DEFAULT '[]',
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_article_cache_provider ON news_article_cache(provider);
CREATE INDEX IF NOT EXISTS idx_article_cache_expires ON news_article_cache(expires_at);

COMMENT ON TABLE news_article_cache IS 'Cache fetched articles to reduce API calls';

-- ============================================================================
-- USER NEWS PREFERENCES
-- Store user preferences for personalized briefs
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_news_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Topics of interest
  topics JSONB DEFAULT '["real estate", "interest rates", "market trends"]',
  
  -- Preferred providers (empty = all)
  preferred_providers JSONB DEFAULT '[]',
  
  -- Morning brief settings
  morning_brief_enabled BOOLEAN DEFAULT true,
  morning_brief_time TIME DEFAULT '07:00:00',
  include_market_news BOOLEAN DEFAULT true,
  include_real_estate_news BOOLEAN DEFAULT true,
  max_articles_per_brief INTEGER DEFAULT 20,
  
  -- Markets to track
  tracked_markets JSONB DEFAULT '[]',  -- e.g., ["Phoenix", "Dallas", "Tampa"]
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_prefs_user ON user_news_preferences(user_id);

COMMENT ON TABLE user_news_preferences IS 'User preferences for news content and delivery';

-- ============================================================================
-- SAVED ARTICLES
-- Articles users want to keep
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_saved_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  article_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  tags JSONB DEFAULT '[]',
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,  -- Associate with a deal
  
  UNIQUE(user_id, provider, article_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_articles_user ON user_saved_articles(user_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_articles_deal ON user_saved_articles(deal_id);

COMMENT ON TABLE user_saved_articles IS 'Articles saved by users for later reference';

-- ============================================================================
-- PROVIDER USAGE STATS (MATERIALIZED VIEW)
-- For admin dashboard: see margin per provider
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_news_provider_stats AS
SELECT 
  provider,
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) AS total_calls,
  SUM(credits_charged) AS total_credits_charged,
  COUNT(DISTINCT user_id) AS unique_users,
  jsonb_agg(DISTINCT operation) AS operations_used
FROM news_api_usage
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY provider, DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_provider_stats ON mv_news_provider_stats(provider, day);

-- Refresh function (call daily)
CREATE OR REPLACE FUNCTION refresh_news_provider_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_news_provider_stats;
END;
$$ LANGUAGE plpgsql;

COMMENT ON MATERIALIZED VIEW mv_news_provider_stats IS 'Daily stats per provider for margin analysis';

-- ============================================================================
-- CLEANUP: Remove expired cache entries (run daily)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_news_cache()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM news_article_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_news_cache IS 'Remove expired cached articles';
