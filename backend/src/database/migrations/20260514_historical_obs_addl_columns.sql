-- Migration: 20260514_historical_obs_addl_columns
-- Description: Adds Phase 1 columns that were missing from the initial
--   20260511_historical_observations.sql migration:
--   - property_asking_rent, property_signing_velocity (property state)
--   - capital_event_type, capital_event_amount, capital_event_metadata
--   - data_quality_tier, redistribution_restricted
--   - CoStar overlay columns (costar_submarket_*)
--   - market_survey_source, market_survey_snapshot
--
-- All additions are nullable / have safe defaults so existing rows are
-- unaffected. Run: cd backend && npm run migrate

BEGIN;

-- ─── Property state: extra columns per spec §3 ────────────────────────────

ALTER TABLE historical_observations
  ADD COLUMN IF NOT EXISTS property_asking_rent       NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS property_signing_velocity  NUMERIC(8,3);

-- ─── Capital events (tax assessments, insurance claims, etc.) ─────────────

ALTER TABLE historical_observations
  ADD COLUMN IF NOT EXISTS capital_event_type         TEXT,
  ADD COLUMN IF NOT EXISTS capital_event_amount       NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS capital_event_metadata     JSONB;

-- ─── Data quality ─────────────────────────────────────────────────────────

ALTER TABLE historical_observations
  ADD COLUMN IF NOT EXISTS data_quality_tier          VARCHAR(20);

ALTER TABLE historical_observations
  ADD COLUMN IF NOT EXISTS redistribution_restricted  BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── CoStar overlay columns (Phase 4 writes; stubbed here for schema parity) ─

ALTER TABLE historical_observations
  ADD COLUMN IF NOT EXISTS costar_submarket_rent          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS costar_submarket_vacancy       NUMERIC(5,3),
  ADD COLUMN IF NOT EXISTS costar_submarket_absorption    INTEGER,
  ADD COLUMN IF NOT EXISTS costar_submarket_concession_pct NUMERIC(5,3),
  ADD COLUMN IF NOT EXISTS costar_submarket_new_supply    INTEGER;

-- ─── Market survey (Phase 4 writes; stubbed here for schema parity) ──────

ALTER TABLE historical_observations
  ADD COLUMN IF NOT EXISTS market_survey_source       VARCHAR(40),
  ADD COLUMN IF NOT EXISTS market_survey_snapshot     JSONB;

-- ─── Comments ──────────────────────────────────────────────────────────────

COMMENT ON COLUMN historical_observations.property_asking_rent IS
  'Advertised asking rent per unit at the observation date (from OM or rent roll).';

COMMENT ON COLUMN historical_observations.property_signing_velocity IS
  'Average new leases signed per month at the observation date (units/month).';

COMMENT ON COLUMN historical_observations.capital_event_type IS
  'Type of capital event at observation date: tax_assessment | insurance_claim | renovation | acquisition.';

COMMENT ON COLUMN historical_observations.capital_event_amount IS
  'Dollar amount of the capital event (tax bill total, insurance claim, capex budget, etc.).';

COMMENT ON COLUMN historical_observations.capital_event_metadata IS
  'JSONB bag of capital event detail: {assessedValue, taxYear, taxingAuthority, appealStatus, ...}.';

COMMENT ON COLUMN historical_observations.data_quality_tier IS
  'S1 (T12+RentRoll in 14-day window), S2 (T12 only), S3 (OM/TaxBill only), S4 (submarket aggregated).';

COMMENT ON COLUMN historical_observations.redistribution_restricted IS
  'TRUE for CoStar / licensed market data that may not be redistributed downstream.';

COMMENT ON COLUMN historical_observations.costar_submarket_rent IS
  'CoStar-sourced submarket avg effective rent at observation_date (Phase 4 ingestion).';

COMMENT ON COLUMN historical_observations.costar_submarket_vacancy IS
  'CoStar-sourced submarket vacancy rate at observation_date (Phase 4 ingestion).';

COMMENT ON COLUMN historical_observations.costar_submarket_absorption IS
  'CoStar-sourced net absorption (units) at observation_date (Phase 4 ingestion).';

COMMENT ON COLUMN historical_observations.costar_submarket_concession_pct IS
  'CoStar-sourced concession percentage at observation_date (Phase 4 ingestion).';

COMMENT ON COLUMN historical_observations.costar_submarket_new_supply IS
  'CoStar-sourced new supply (units delivered) at observation_date (Phase 4 ingestion).';

COMMENT ON COLUMN historical_observations.market_survey_source IS
  'Source of the market survey snapshot: costar | axiometrics | yardi_matrix | other.';

COMMENT ON COLUMN historical_observations.market_survey_snapshot IS
  'Full market survey payload as JSONB for reference and audit.';

COMMIT;
