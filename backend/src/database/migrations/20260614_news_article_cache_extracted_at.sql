-- Task #1079: Track which articles have already been through event extraction
-- Prevents re-paying for the same LLM call when backfill or nightly cron re-runs.
-- extracted_at IS NULL means "not yet processed"; stamped by extractAndPersistEvents().

ALTER TABLE news_article_cache
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;

-- Partial index so WHERE extracted_at IS NULL scans are fast even on large caches.
CREATE INDEX IF NOT EXISTS idx_news_article_cache_unextracted
  ON news_article_cache (cached_at DESC)
  WHERE extracted_at IS NULL;
