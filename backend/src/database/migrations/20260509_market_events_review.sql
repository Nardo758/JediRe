-- Migration: 20260509_market_events_review
-- Description: Adds analyst-review columns to market_events so news-sourced
--              events can be triaged before they affect proximity / backtest.
--
-- Task #371 — Analyst review queue for AI-extracted market events
--
-- New columns:
--   reviewed_by    UUID  — user id who reviewed (nullable until reviewed)
--   reviewed_at    TIMESTAMPTZ — when reviewed
--   review_notes   TEXT  — free-form analyst notes
--
-- Behaviour change (enforced in application code, not the DB):
--   Newly-extracted news events with confidence_score < 0.75 get
--   status='rumored' instead of the LLM-supplied default. Analysts then
--   PATCH /events/:id/review to promote them to 'confirmed' (or any other
--   valid status) and the row gets stamped here.

BEGIN;

ALTER TABLE market_events
  ADD COLUMN IF NOT EXISTS reviewed_by  UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Partial index to quickly find unreviewed news events for the queue endpoint.
CREATE INDEX IF NOT EXISTS idx_events_pending_review
  ON market_events (created_at DESC)
  WHERE source_type = 'news' AND reviewed_at IS NULL;

COMMENT ON COLUMN market_events.reviewed_by IS
  'User id (users.id) of the analyst who reviewed this event. NULL = unreviewed.';
COMMENT ON COLUMN market_events.reviewed_at IS
  'Timestamp when the analyst review was recorded. NULL = unreviewed.';
COMMENT ON COLUMN market_events.review_notes IS
  'Free-form analyst notes captured at review time.';

COMMIT;
