-- Task #388 — News article sentiment scoring
--
-- Additive migration: ensure `news_items` carries a normalized sentiment
-- score + label so the Sentiment Trend chart's 30-day news series
-- (computed by sentiment-history.service.computeNews30dAvg) can resolve
-- to a real value instead of staying NULL.
--
-- The columns are additive and idempotent — the sentiment-history service
-- already probes information_schema before reading these, so existing
-- deployments without the columns degrade gracefully. After this migration
-- runs the column-probe cache will flip true on next process start.
--
-- `sentiment_score`  : numeric(4,3) in the range [-1.000, +1.000]
-- `sentiment_label`  : free-form text. We seed the scorer to produce one of
--                      'bullish' | 'neutral' | 'bearish' (matching the
--                      AgentSentimentLabel domain used elsewhere), but the
--                      column is intentionally unconstrained so legacy
--                      labels written by older email extractions
--                      (e.g. 'very_positive') remain readable.

ALTER TABLE news_items
  ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS sentiment_label TEXT;

-- Partial index speeds up the 30-day rolling average query in
-- sentiment-history.service.computeNews30dAvg, which always filters on
-- `sentiment_score IS NOT NULL AND published_at >= NOW() - INTERVAL '30 days'`.
CREATE INDEX IF NOT EXISTS idx_news_items_sentiment_recent
  ON news_items (published_at DESC)
  WHERE sentiment_score IS NOT NULL;
