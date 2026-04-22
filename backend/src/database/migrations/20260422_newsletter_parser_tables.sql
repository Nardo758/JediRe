-- Newsletter Parser Tables
-- Store LLM-extracted articles from user subscription newsletters
-- Created: 2026-04-22

-- ============================================================================
-- NEWSLETTER PARSES
-- Track each newsletter email that was parsed
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_newsletter_parses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_id TEXT,                           -- Reference to emails table
  source TEXT NOT NULL,                    -- WSJ, Bloomberg, Bisnow, etc.
  newsletter_type TEXT,                    -- daily_brief, market_update, etc.
  market_mentions JSONB DEFAULT '[]',      -- Cities/markets mentioned
  key_takeaways JSONB DEFAULT '[]',        -- Top insights
  article_count INTEGER DEFAULT 0,
  parsed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_parses_user ON user_newsletter_parses(user_id, parsed_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_parses_source ON user_newsletter_parses(source);

COMMENT ON TABLE user_newsletter_parses IS 'Track newsletter emails parsed by LLM';

-- ============================================================================
-- NEWSLETTER ARTICLES
-- Individual articles extracted from newsletters
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_newsletter_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parse_id UUID REFERENCES user_newsletter_parses(id) ON DELETE CASCADE,
  
  -- Article content
  title TEXT NOT NULL,
  url TEXT,
  summary TEXT,
  source TEXT NOT NULL,                    -- Original publisher
  author TEXT,
  category TEXT,                           -- business, finance, real-estate, etc.
  
  -- RE relevance
  relevance_to_re TEXT CHECK (relevance_to_re IN ('high', 'medium', 'low', 'none')),
  key_topics JSONB DEFAULT '[]',
  
  -- Metadata
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicates per user
  UNIQUE(user_id, url)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_articles_user ON user_newsletter_articles(user_id, extracted_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_articles_relevance ON user_newsletter_articles(user_id, relevance_to_re);
CREATE INDEX IF NOT EXISTS idx_newsletter_articles_source ON user_newsletter_articles(source);
CREATE INDEX IF NOT EXISTS idx_newsletter_articles_category ON user_newsletter_articles(category);

-- Full-text search on title and summary
CREATE INDEX IF NOT EXISTS idx_newsletter_articles_fts ON user_newsletter_articles 
  USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(summary, '')));

COMMENT ON TABLE user_newsletter_articles IS 'Articles extracted from user subscription newsletters';

-- ============================================================================
-- NEWSLETTER SOURCES
-- Track which newsletter sources a user receives
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_newsletter_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                    -- WSJ, Bloomberg, etc.
  from_pattern TEXT,                       -- Email pattern to detect
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_parsed INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(user_id, source)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_sources_user ON user_newsletter_sources(user_id);

COMMENT ON TABLE user_newsletter_sources IS 'Track which newsletter subscriptions each user has';

-- ============================================================================
-- VIEW: Recent high-relevance RE articles
-- ============================================================================

CREATE OR REPLACE VIEW vw_user_re_articles AS
SELECT 
  a.*,
  p.source as newsletter_source,
  p.newsletter_type,
  p.market_mentions
FROM user_newsletter_articles a
JOIN user_newsletter_parses p ON a.parse_id = p.id
WHERE a.relevance_to_re IN ('high', 'medium')
ORDER BY a.extracted_at DESC;

COMMENT ON VIEW vw_user_re_articles IS 'Recent articles with high/medium RE relevance';

-- ============================================================================
-- FUNCTION: Update newsletter source stats
-- ============================================================================

CREATE OR REPLACE FUNCTION update_newsletter_source_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_newsletter_sources (user_id, source, first_seen, last_seen, total_parsed)
  VALUES (NEW.user_id, NEW.source, NOW(), NOW(), 1)
  ON CONFLICT (user_id, source) DO UPDATE SET
    last_seen = NOW(),
    total_parsed = user_newsletter_sources.total_parsed + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_newsletter_source ON user_newsletter_parses;
CREATE TRIGGER trg_update_newsletter_source
  AFTER INSERT ON user_newsletter_parses
  FOR EACH ROW
  EXECUTE FUNCTION update_newsletter_source_stats();
