-- Add deal_id FK to historical_observations so reactive status-change hooks
-- and query guards can operate at the row's own deal level rather than via
-- parcel → deal_properties joins (which are ambiguous when a parcel appears
-- in multiple deals).
--
-- ON DELETE SET NULL keeps corpus rows alive if the deal is deleted
-- (observations are historical record; the deal going away doesn't erase history).

ALTER TABLE historical_observations
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_historical_observations_deal_id
  ON historical_observations(deal_id)
  WHERE deal_id IS NOT NULL;
