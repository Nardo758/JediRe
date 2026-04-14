-- Migration: M07 Traffic Engine — Self-Calibrating Backend
-- Description: Bayesian calibration stack, rent roll ingestion, starting state resolution
-- Date: 2026-04-14

-- ============================================================================
-- 0.5. Rename M06 legacy table so the M07 spec name is available.
--   The pre-existing table traffic_calibration_factors stored M06 "manual
--   multiplier" calibration rows (schema: factor_type/factor_key/multiplier/
--   reason/is_active/effective_until/created_by, 23 rows).  M07 requires
--   traffic_calibration_factors as the Bayesian coefficient store.  We rename
--   the M06 table to traffic_calibration_legacy_factors to free the name.
--   The rename is guarded so re-running the migration is safe.
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'traffic_calibration_factors'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'traffic_calibration_legacy_factors'
  ) THEN
    ALTER TABLE traffic_calibration_factors RENAME TO traffic_calibration_legacy_factors;
  END IF;
END $$;

-- Rename any associated index/sequence objects if needed (guard with IF EXISTS)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_traffic_calibration_active')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tcl_active') THEN
    ALTER INDEX idx_traffic_calibration_active RENAME TO idx_tcl_active;
  END IF;
END $$;

-- ============================================================================
-- 1. deal_mode enum + column on deals
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_mode_type') THEN
    CREATE TYPE deal_mode_type AS ENUM ('STABILIZED', 'LEASE_UP', 'REDEVELOPMENT');
  END IF;
END $$;

ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_mode deal_mode_type
  DEFAULT 'STABILIZED'::deal_mode_type;

-- ============================================================================
-- 2. traffic_calibration_factors (M07 Bayesian coefficient store)
--    Named to match the M07 task spec.  The M06 multiplier rows that previously
--    lived here have been moved to traffic_calibration_legacy_factors above.
-- ============================================================================
CREATE TABLE IF NOT EXISTS traffic_calibration_factors (
  id                BIGSERIAL PRIMARY KEY,
  coefficient_name  TEXT NOT NULL,
  scope_level       TEXT NOT NULL CHECK (scope_level IN ('msa', 'submarket', 'class', 'vintage', 'platform')),
  msa_id            TEXT,
  submarket_id      TEXT,
  property_class    TEXT,
  vintage_band      TEXT,

  prior_value       NUMERIC(12,6) NOT NULL,
  posterior_value   NUMERIC(12,6) NOT NULL,
  n_prior           INTEGER NOT NULL DEFAULT 0,
  n_evidence        INTEGER NOT NULL DEFAULT 0,
  n_peer_properties INTEGER NOT NULL DEFAULT 0,

  cal_window        TEXT NOT NULL DEFAULT 'TTM' CHECK (cal_window IN ('TTM', 'PYTM', 'TTM_24')),
  period_start      DATE,
  period_end        DATE,

  match_tier        TEXT NOT NULL CHECK (match_tier IN ('DEAL', 'PLATFORM', 'BASELINE')),
  calibration_source TEXT,
  confidence_low    NUMERIC(12,6),
  confidence_mid    NUMERIC(12,6),
  confidence_high   NUMERIC(12,6),

  curve_data        JSONB,

  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  -- NOTE: No inline UNIQUE constraint — PostgreSQL treats two NULLs as NOT equal
  -- in standard UNIQUE indexes, which would create duplicate platform-scope rows.
  -- A COALESCE functional unique index (below) provides correct dedup semantics.
);

CREATE INDEX IF NOT EXISTS idx_tcf_scope ON traffic_calibration_factors
  (coefficient_name, scope_level, submarket_id, property_class, vintage_band);
CREATE INDEX IF NOT EXISTS idx_tcf_msa ON traffic_calibration_factors
  (msa_id, coefficient_name) WHERE msa_id IS NOT NULL;

-- Functional unique index: NULLs coalesced to '' so platform/class/vintage
-- scopes with all-null dimensions still get proper uniqueness enforcement.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tcf_scope_coalesce ON traffic_calibration_factors (
  coefficient_name,
  scope_level,
  cal_window,
  COALESCE(msa_id,        ''),
  COALESCE(submarket_id,  ''),
  COALESCE(property_class,''),
  COALESCE(vintage_band,  '')
);

-- ============================================================================
-- 3. traffic_calibration_history
-- ============================================================================
CREATE TABLE IF NOT EXISTS traffic_calibration_history (
  id                BIGSERIAL PRIMARY KEY,
  coefficient_id    BIGINT REFERENCES traffic_calibration_factors(id) ON DELETE CASCADE,
  coefficient_name  TEXT NOT NULL,
  scope_level       TEXT NOT NULL,
  submarket_id      TEXT,
  property_class    TEXT,
  vintage_band      TEXT,

  prior_value       NUMERIC(12,6) NOT NULL,
  posterior_value   NUMERIC(12,6) NOT NULL,
  n_prior           INTEGER NOT NULL,
  n_evidence        INTEGER NOT NULL,

  job_run_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  job_version       TEXT,

  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tch_coefficient_id ON traffic_calibration_history (coefficient_id);
CREATE INDEX IF NOT EXISTS idx_tch_job_run_at ON traffic_calibration_history (job_run_at DESC);

-- ============================================================================
-- 4. rent_roll_snapshots
-- ============================================================================
CREATE TABLE IF NOT EXISTS rent_roll_snapshots (
  id                BIGSERIAL PRIMARY KEY,
  deal_id           TEXT NOT NULL,
  upload_id         TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,

  original_filename TEXT,
  file_path         TEXT,
  file_format       TEXT,
  row_count         INTEGER,
  extraction_confidence NUMERIC(4,3),

  snapshot_date     DATE,
  derived_metrics   JSONB DEFAULT '{}',

  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'parsed', 'derived', 'calibrated', 'error')),
  error_message     TEXT,

  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rrs_deal_id ON rent_roll_snapshots (deal_id);
CREATE INDEX IF NOT EXISTS idx_rrs_snapshot_date ON rent_roll_snapshots (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_rrs_status ON rent_roll_snapshots (status);

-- ============================================================================
-- 5. leasing_events (raw event log per uploaded rent roll)
--    This is the BASE TABLE as required by the M07 spec.
--    All parser writes and engine reads use this table directly.
--    If a previous migration created leasing_events as a view (alias over
--    lease_events), we drop the view first so we can create it as a table.
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'leasing_events'
  ) THEN
    DROP VIEW leasing_events;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS leasing_events (
  id                BIGSERIAL PRIMARY KEY,
  snapshot_id       BIGINT NOT NULL REFERENCES rent_roll_snapshots(id) ON DELETE CASCADE,
  deal_id           TEXT NOT NULL,

  unit_id           TEXT,
  unit_type         TEXT,
  unit_sf           INTEGER,

  contract_rent     NUMERIC(10,2),
  market_rent       NUMERIC(10,2),
  concession_value  NUMERIC(10,2),
  concession_months INTEGER,

  lease_start       DATE,
  lease_end         DATE,
  move_in_date      DATE,
  move_out_date     DATE,
  notice_date       DATE,

  unit_status       TEXT,
  is_renewal        BOOLEAN,
  days_vacant       INTEGER,

  row_confidence    NUMERIC(4,3) DEFAULT 1.0,

  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_le_snapshot_id ON leasing_events (snapshot_id);
CREATE INDEX IF NOT EXISTS idx_le_deal_id ON leasing_events (deal_id);
CREATE INDEX IF NOT EXISTS idx_le_lease_start ON leasing_events (lease_start);
CREATE INDEX IF NOT EXISTS idx_le_unit_type ON leasing_events (unit_type);

-- ============================================================================
-- 6. traffic_weight_config
-- ============================================================================
CREATE TABLE IF NOT EXISTS traffic_weight_config (
  id            BIGSERIAL PRIMARY KEY,
  metric_name   TEXT NOT NULL UNIQUE,
  metric_layer  TEXT NOT NULL CHECK (metric_layer IN ('A', 'B', 'C')),
  description   TEXT,
  weight        NUMERIC(6,4) NOT NULL DEFAULT 0.0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO traffic_weight_config (metric_name, metric_layer, description, weight) VALUES
  ('search_momentum_qoq',        'A', 'Search Momentum Quarter-over-Quarter',           0.15),
  ('business_formation_velocity','A', 'Business Formation Velocity (new establishments)',0.10),
  ('wage_growth_yoy',            'A', 'Wage Growth Year-over-Year',                     0.10),
  ('pipeline_pct',               'C', 'New supply as % of existing inventory',          -0.12),
  ('concession_intensity',       'C', 'Avg concession weeks free rent in submarket',    -0.08),
  ('months_of_supply',           'C', 'Months of residential supply (active + pipeline)',-0.10)
ON CONFLICT (metric_name) DO NOTHING;

-- ============================================================================
-- 7. Helper view: latest calibration factors per scope
-- ============================================================================
CREATE OR REPLACE VIEW latest_calibration_factors AS
SELECT DISTINCT ON (coefficient_name, scope_level, submarket_id, property_class, vintage_band, cal_window)
  *
FROM traffic_calibration_factors
ORDER BY coefficient_name, scope_level, submarket_id, property_class, vintage_band, cal_window, updated_at DESC;
