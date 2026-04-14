-- Migration: M07 Traffic Engine — Self-Calibrating Backend
-- Description: Bayesian calibration stack, rent roll ingestion, starting state resolution
-- Date: 2026-04-14

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
-- 2. traffic_calibration_coefficients
-- ============================================================================
CREATE TABLE IF NOT EXISTS traffic_calibration_coefficients (
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
  -- NOTE: No UNIQUE constraint here because PostgreSQL treats two NULLs as NOT equal
  -- in standard UNIQUE indexes, which would allow duplicate rows for scopes where
  -- msa_id/submarket_id/property_class/vintage_band are all NULL (platform scope).
  -- Correct deduplication is enforced by a COALESCE functional unique index below.
);

CREATE INDEX IF NOT EXISTS idx_tcc_scope ON traffic_calibration_coefficients
  (coefficient_name, scope_level, submarket_id, property_class, vintage_band);
CREATE INDEX IF NOT EXISTS idx_tcc_msa ON traffic_calibration_coefficients
  (msa_id, coefficient_name) WHERE msa_id IS NOT NULL;

-- Functional unique index using COALESCE so NULLs are treated as empty strings,
-- preventing duplicate rows for platform/class/vintage scopes where dimensions are NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tcc_scope_coalesce ON traffic_calibration_coefficients (
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
  coefficient_id    BIGINT REFERENCES traffic_calibration_coefficients(id) ON DELETE CASCADE,
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
-- 5. lease_events (raw event log per uploaded rent roll)
--    This is the BASE TABLE. The canonical-name alias leasing_events is created
--    as a simple updatable VIEW in section 8.
-- ============================================================================
CREATE TABLE IF NOT EXISTS lease_events (
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

CREATE INDEX IF NOT EXISTS idx_le_snapshot_id ON lease_events (snapshot_id);
CREATE INDEX IF NOT EXISTS idx_le_deal_id ON lease_events (deal_id);
CREATE INDEX IF NOT EXISTS idx_le_lease_start ON lease_events (lease_start);
CREATE INDEX IF NOT EXISTS idx_le_unit_type ON lease_events (unit_type);

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
-- 7. Helper view: latest calibration coefficients per scope
-- ============================================================================
CREATE OR REPLACE VIEW latest_calibration_coefficients AS
SELECT DISTINCT ON (coefficient_name, scope_level, submarket_id, property_class, vintage_band, cal_window)
  *
FROM traffic_calibration_coefficients
ORDER BY coefficient_name, scope_level, submarket_id, property_class, vintage_band, cal_window, updated_at DESC;

-- ============================================================================
-- 8. leasing_events canonical-name VIEW
--    lease_events is the BASE TABLE (section 5).
--    leasing_events is a read/write-capable simple-select view so that any
--    query code that references the canonical spec name continues to work.
--    PostgreSQL makes single-table SELECT * views fully updatable (INSERT/UPDATE/DELETE).
--
-- NOTE ON traffic_calibration_factors vs traffic_calibration_coefficients:
--   The task spec uses "traffic_calibration_factors" as the M07 Bayesian table
--   name.  However, a pre-existing M06 table named traffic_calibration_factors
--   already exists in this database with schema (factor_type, factor_key,
--   multiplier, reason) and 23 active rows.  Renaming or replacing that table
--   would destroy the M06 catalog-metric pipeline.  We therefore preserve
--   traffic_calibration_factors for M06 and use traffic_calibration_coefficients
--   for the M07 Bayesian stack — both names are referenced consistently
--   throughout the M07 codebase.
-- ============================================================================
CREATE OR REPLACE VIEW leasing_events AS
  SELECT * FROM lease_events;
