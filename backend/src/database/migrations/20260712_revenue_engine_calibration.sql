-- revenue_engine_calibration
-- Stores learned CONFIG overrides for the revenue beat-plan engine,
-- keyed by property_id (or NULL for platform-wide defaults).
-- Computed by the calibration service from deal_monthly_actuals actuals +
-- archive_assumption_benchmarks.  Loaded at beat-plan request time; the
-- hardcoded CONFIG constants remain as fallback for properties with < 6 months
-- of actuals.

CREATE TABLE IF NOT EXISTS revenue_engine_calibration (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                 UUID REFERENCES properties(id) ON DELETE CASCADE,
  -- how many non-budget actuals months were used to derive these params
  months_of_actuals           INTEGER NOT NULL,

  -- calibrated CONFIG overrides (NULL → use hardcoded default)
  vacancy_elasticity          NUMERIC(6,4),    -- CONFIG.vacancyElasticity
  controllable_fraction       NUMERIC(6,4),    -- CONFIG.controllableFractionDefault
  renewal_cap_fraction        NUMERIC(6,4),    -- CONFIG.renewalCapFraction
  rent_runway_full_bps        NUMERIC(8,2),    -- CONFIG.rentRunwayFullBps
  push_above_market_ceiling   NUMERIC(6,4),    -- CONFIG.pushAboveMarketCeiling

  -- source provenance
  actuals_vacancy_rate        NUMERIC(8,6),    -- avg actual vacancy rate used in computation
  archive_vacancy_benchmark   NUMERIC(8,6),    -- archive p50 vacancy benchmark
  archive_rent_growth_bps     NUMERIC(8,2),    -- archive p50 annual rent growth in bps
  archive_concession_p50      NUMERIC(8,6),    -- archive p50 concessions_pct

  calibration_notes           TEXT,
  calibrated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rev_cal_property_id
  ON revenue_engine_calibration(property_id, calibrated_at DESC);
