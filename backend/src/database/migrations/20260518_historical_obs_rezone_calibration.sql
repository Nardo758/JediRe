-- Migration: 20260518_historical_obs_rezone_calibration
-- Description: Adds Phase B rezone-calibration columns to historical_observations.
--   The RezoneTrendService.computeTrendSignalPhaseB() queries these columns to
--   derive empirical rezone rates from observed outcomes across submarket ×
--   event-density buckets, replacing the hand-set Phase A linear constants.
--
--   Schema design:
--     rezone_upzoning_event_count — upzoning events active in the submarket
--       at the time of observation (snapshot, not cumulative).
--     rezone_approval_event_count — entitlement_approval events active.
--     rezone_moratorium_active    — was a development_moratorium active?
--     rezone_outcome              — did the parcel / submarket see a confirmed
--       rezone to MF within rezone_window_months?  NULL = not yet measured.
--     rezone_window_months        — observation window for the outcome (default 24).
--
--   Populated by the historical ingest pipeline (separate data work).
--   Phase B activates when ≥ 5 matching rows exist; falls back to Phase A otherwise.

BEGIN;

ALTER TABLE historical_observations
  ADD COLUMN IF NOT EXISTS rezone_upzoning_event_count  INTEGER,
  ADD COLUMN IF NOT EXISTS rezone_approval_event_count  INTEGER,
  ADD COLUMN IF NOT EXISTS rezone_moratorium_active     BOOLEAN,
  ADD COLUMN IF NOT EXISTS rezone_outcome               BOOLEAN,
  ADD COLUMN IF NOT EXISTS rezone_window_months         SMALLINT DEFAULT 24;

-- Partial index covering only rows that have a measured outcome — the Phase B
-- query always filters on rezone_outcome IS NOT NULL.
CREATE INDEX IF NOT EXISTS idx_hist_obs_rezone_corpus
  ON historical_observations (rezone_upzoning_event_count, rezone_outcome)
  WHERE rezone_outcome IS NOT NULL;

COMMENT ON COLUMN historical_observations.rezone_upzoning_event_count IS
  'Count of zoning_upzoning key_events active in the submarket at observation_date (Phase B calibration input)';
COMMENT ON COLUMN historical_observations.rezone_approval_event_count IS
  'Count of entitlement_approval key_events active at observation_date (Phase B calibration input)';
COMMENT ON COLUMN historical_observations.rezone_moratorium_active IS
  'True when a development_moratorium was active in the submarket at observation_date';
COMMENT ON COLUMN historical_observations.rezone_outcome IS
  'Empirical outcome: did the parcel/submarket see a confirmed MF rezone within rezone_window_months?';
COMMENT ON COLUMN historical_observations.rezone_window_months IS
  'Outcome observation window in months (default 24). Used when bucketing Phase B corpus rows.';

COMMIT;
