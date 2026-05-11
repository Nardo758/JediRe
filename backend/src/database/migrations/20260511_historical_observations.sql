-- Migration: 20260511_historical_observations
-- Description: Creates the historical_observations table — the platform's
--   empirical calibration substrate. Stores stacked input signals (mobility,
--   events, MSA macro, submarket micro, property performance) against realized
--   output changes (rent, occupancy, concessions, signing velocity, cap rates)
--   at common geography x time keys. Consuming modules (M35, M07, M36, M37,
--   M38) read from this corpus to derive coefficients empirically rather than
--   from hand-set constants.
--
-- Phase 1 of the Empirical Calibration Substrate per HISTORICAL_OBSERVATIONS_SPEC.md.
-- See spec Section 3 for full schema design rationale.

BEGIN;

CREATE TABLE IF NOT EXISTS historical_observations (
  -- Primary key
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Geography (sparse — at least one must be present)
  msa_id                      VARCHAR(20),                -- e.g., 'MSA_12060' Atlanta
  submarket_id                VARCHAR(40),                -- e.g., 'ATL_midtown'
  parcel_id                   VARCHAR(80),                -- when row is property-specific
  latitude                    NUMERIC(10,7),              -- when row is point-specific
  longitude                   NUMERIC(10,7),
  geography_level             VARCHAR(20) NOT NULL,       -- msa | submarket | parcel | point

  -- Time
  observation_date            DATE NOT NULL,              -- the month being observed (use 1st of month)
  observation_window          VARCHAR(20) NOT NULL,       -- monthly | quarterly | annual

  -- ─── INPUTS — Mobility (LODES / Veraset / Placer / Advan) ─────────────────

  commute_shed_workers        INTEGER,                    -- LODES workers in 10mi radius
  commute_shed_wage_pct       NUMERIC(6,4),               -- LODES wage-weighted vs MSA median
  mobility_visits_monthly     INTEGER,                    -- Veraset / Placer visit count
  mobility_unique_visitors    INTEGER,
  mobility_visits_psf         NUMERIC(8,4),               -- normalized for venue size

  -- ─── INPUTS — Events (key_events denormalized) ───────────────────────────

  active_event_count          INTEGER,                    -- M35 events active in window
  event_employer_jobs_added   INTEGER,
  event_employer_jobs_lost    INTEGER,
  event_supply_units_delivered INTEGER,
  event_supply_units_announced INTEGER,
  event_subtypes              TEXT[],                     -- which subtypes were active

  -- ─── INPUTS — MSA macro ──────────────────────────────────────────────────

  msa_employment_total        INTEGER,                    -- QCEW total employment
  msa_employment_growth_yoy   NUMERIC(6,4),
  msa_avg_wage                NUMERIC(10,2),              -- QCEW average wage
  msa_wage_growth_yoy         NUMERIC(6,4),
  msa_unemployment_rate       NUMERIC(5,3),               -- BLS
  msa_population              INTEGER,                    -- Census
  msa_household_growth_yoy    NUMERIC(6,4),
  msa_in_migration_net        INTEGER,
  msa_treasury_10y            NUMERIC(6,4),               -- FRED
  msa_fed_funds_rate          NUMERIC(6,4),

  -- ─── INPUTS — Submarket ─────────────────────────────────────────────────

  submarket_avg_asking_rent    NUMERIC(10,2),
  submarket_avg_effective_rent NUMERIC(10,2),
  submarket_vacancy_rate      NUMERIC(5,3),
  submarket_concession_pct    NUMERIC(5,3),
  submarket_under_construction INTEGER,
  submarket_pipeline_units_24mo INTEGER,
  submarket_class_a_share     NUMERIC(5,3),

  -- ─── INPUTS — Property state (when geography_level = parcel) ────────────

  property_occupancy           NUMERIC(5,3),
  property_avg_rent            NUMERIC(10,2),
  property_concession_per_unit NUMERIC(10,2),
  property_unit_count          INTEGER,
  property_year_built          INTEGER,
  property_class               VARCHAR(2),                -- 'A' | 'B' | 'C'

  -- ─── OUTPUTS — Realized changes ─────────────────────────────────────────

  realized_rent_change_t3      NUMERIC(6,4),              -- rent change over next 3 months
  realized_rent_change_t12     NUMERIC(6,4),
  realized_rent_change_t24     NUMERIC(6,4),
  realized_occupancy_change_t3 NUMERIC(5,3),              -- pp change
  realized_occupancy_change_t12 NUMERIC(5,3),
  realized_concession_change_t12 NUMERIC(5,3),
  realized_signing_velocity_t3 NUMERIC(8,3),              -- units/month
  realized_signing_velocity_t12 NUMERIC(8,3),
  realized_cap_rate_change_t12_bps INTEGER,
  realized_cap_rate_change_t24_bps INTEGER,
  realized_walkins_psf_t12     NUMERIC(8,4),              -- (when mobility data present at T+12)

  -- ─── METADATA ───────────────────────────────────────────────────────────

  source_signals               TEXT[] NOT NULL DEFAULT '{}',
  signal_freshness_days        JSONB,                     -- per-signal staleness at obs date
  is_subject_property          BOOLEAN DEFAULT FALSE,     -- TRUE for the labeled core
  realization_complete         BOOLEAN DEFAULT FALSE,     -- TRUE once all output windows closed
  realization_complete_date    DATE,
  data_quality_flags           TEXT[],
  created_at                   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── UNIQUE CONSTRAINT (functional index) ───────────────────────────────────
-- PostgreSQL does not support expressions like COALESCE() inside a
-- CONSTRAINT ... UNIQUE table declaration, so we use a unique index instead.
-- One row per (geography x date x window).

CREATE UNIQUE INDEX IF NOT EXISTS idx_hist_obs_geo_date_window
  ON historical_observations (
    geography_level,
    COALESCE(parcel_id, submarket_id, msa_id),
    observation_date,
    observation_window
  );

-- ─── INDEXES ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_hist_obs_msa_date
  ON historical_observations(msa_id, observation_date);

CREATE INDEX IF NOT EXISTS idx_hist_obs_submarket_date
  ON historical_observations(submarket_id, observation_date);

CREATE INDEX IF NOT EXISTS idx_hist_obs_parcel_date
  ON historical_observations(parcel_id, observation_date);

CREATE INDEX IF NOT EXISTS idx_hist_obs_subject
  ON historical_observations(is_subject_property, observation_date)
  WHERE is_subject_property = TRUE;

CREATE INDEX IF NOT EXISTS idx_hist_obs_realization
  ON historical_observations(realization_complete, observation_date)
  WHERE realization_complete = TRUE;

-- ─── COMMENTS ──────────────────────────────────────────────────────────────

COMMENT ON TABLE historical_observations IS
  'Empirical calibration substrate — stacked input signals vs realized outputs '
  'at common geography x time keys. Consumed by M35, M07, M36, M37, M38 for '
  'empirical coefficient derivation. See HISTORICAL_OBSERVATIONS_SPEC.md.';

COMMENT ON INDEX idx_hist_obs_geo_date_window IS
  'Unique functional index enforcing one row per (geography x date x window). '
  'Uses COALESCE to handle sparse geography columns — at least one of '
  'parcel_id, submarket_id, or msa_id must be populated.';

COMMENT ON INDEX idx_hist_obs_msa_date IS
  'Fast MSA-level time-series queries (e.g., what did the Atlanta MSA look like '
  'in 2022-Q3?).';

COMMENT ON INDEX idx_hist_obs_submarket_date IS
  'Fast submarket-level time-series queries (e.g., ATL_midtown vacancy trend).';

COMMENT ON INDEX idx_hist_obs_parcel_date IS
  'Fast parcel-level time-series queries (e.g., subject property month-over-month '
  'P&L comparison for realized output computation).';

COMMENT ON INDEX idx_hist_obs_subject IS
  'Partial index scoped to subject properties only — the dense labeled core '
  'where supervised learning of platform accuracy is possible.';

COMMENT ON INDEX idx_hist_obs_realization IS
  'Partial index scoped to rows where all output windows are closed — training '
  'grade observations with complete T+N realized values.';

COMMIT;
