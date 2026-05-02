-- Task #511: deal_financial_models was missing two columns written by the
-- financial-model engine, causing every model build to fail with a 500.
--
-- assumptions_hash: stored with each build so /latest can detect stale
--   assumptions without re-running the full LLM pipeline.
-- error_message:    populated when status is set to 'error' so failures are
--   surfaced to the UI without decoding the raw exception.
--
-- Both use IF NOT EXISTS so this is safe to re-run in any environment.

ALTER TABLE deal_financial_models
  ADD COLUMN IF NOT EXISTS assumptions_hash TEXT;

ALTER TABLE deal_financial_models
  ADD COLUMN IF NOT EXISTS error_message TEXT;
