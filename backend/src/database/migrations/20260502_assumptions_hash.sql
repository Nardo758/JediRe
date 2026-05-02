-- F9 Cache (Task #493): deterministic hash of the enhanced assumptions snapshot.
-- Stored on every completed model build so GET /latest can signal staleness
-- when the caller's current assumptions diverge from the stored ones.
ALTER TABLE deal_financial_models
  ADD COLUMN IF NOT EXISTS assumptions_hash TEXT;

-- Task #511: engine writes error_message on build failures; add if missing.
ALTER TABLE deal_financial_models
  ADD COLUMN IF NOT EXISTS error_message TEXT;
