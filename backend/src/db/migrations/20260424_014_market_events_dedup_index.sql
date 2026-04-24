-- Migration: market_events deduplication index
-- Purpose: Support ON CONFLICT DO NOTHING deduplication in market-event-extraction.service.ts.
-- The (event_name, effective_date, geography_id) triple uniquely identifies an event in a
-- geography on a given date — prevents re-inserting the same event from multiple article runs.

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_events_dedup
  ON market_events (event_name, effective_date, geography_id);

COMMENT ON INDEX idx_market_events_dedup IS
  'Deduplication index for news-sourced market event extraction. '
  'Used by ON CONFLICT (event_name, effective_date, geography_id) DO NOTHING.';
