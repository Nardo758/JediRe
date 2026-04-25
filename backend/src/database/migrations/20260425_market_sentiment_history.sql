-- Market sentiment history (Task #382)
-- Daily/per-run snapshots of blended sentiment for MSA + submarket entities.
-- Each row is one observation; the trend chart on the COMMENTARY tab queries
-- this table for a 12-24 month window.
--
-- Sources blended:
--   * agent_score              — Commentary Agent marketNarrative.sentiment (-1/0/+1)
--   * news_30d_avg             — rolling 30-day mean of news_items.sentiment_score
--                                (NULL when news sentiment is not yet captured)
--   * macro_consumer_sentiment — m28_rate_environment.consumer_sentiment (UMCSI)
--
-- Two write paths:
--   1. Commentary Agent run (cacheCommentary) — source = 'agent_run'
--   2. Daily Inngest cron snapshot          — source = 'cron_snapshot'

CREATE TABLE IF NOT EXISTS market_sentiment_history (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('msa','submarket')),
  entity_id   TEXT NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  agent_score SMALLINT CHECK (agent_score IS NULL OR agent_score BETWEEN -1 AND 1),
  news_30d_avg NUMERIC(5,3),
  news_count_30d INTEGER,
  macro_consumer_sentiment NUMERIC(7,2),
  top_driver_news_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL CHECK (source IN ('agent_run','cron_snapshot','backfill'))
);

CREATE INDEX IF NOT EXISTS idx_market_sentiment_history_lookup
  ON market_sentiment_history (entity_type, entity_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_sentiment_history_recent
  ON market_sentiment_history (snapshot_at DESC);
