-- Task #390: extend market_sentiment_history to allow entity_type='property'.
-- The original CHECK constraint (migration 20260425) only permitted
-- 'msa' | 'submarket'. Property-level snapshots are now written by the
-- Commentary Agent (cacheCommentary) and by the daily cron iterator
-- (snapshotAllActiveEntities), so the constraint needs to be widened or
-- those inserts fail silently with check-constraint violations.

ALTER TABLE market_sentiment_history
  DROP CONSTRAINT IF EXISTS market_sentiment_history_entity_type_check;

ALTER TABLE market_sentiment_history
  ADD CONSTRAINT market_sentiment_history_entity_type_check
  CHECK (entity_type IN ('msa','submarket','property'));
