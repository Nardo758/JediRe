-- Task #1134: Backfill extracted_at for articles that already have matching market_events rows.
-- Prevents the nightly cron / backfill script from re-sending already-processed articles
-- to the LLM on the first run after Task #1079 is deployed.
-- Safe to re-run (WHERE extracted_at IS NULL guard makes it idempotent).

UPDATE news_article_cache nac
SET extracted_at = NOW()
WHERE EXISTS (
  SELECT 1
  FROM market_events me
  WHERE me.source_url = nac.url
)
AND nac.extracted_at IS NULL;
