-- Migration: 20260530_yardi_matrix_vendor_tables
-- Piece A2 — Second Vendor Abstraction Proof
--
-- Creates two Yardi Matrix vendor-specific tables:
--
--   yardi_matrix_rent_survey    — per-submarket quarterly rent/vacancy snapshots
--   yardi_matrix_supply_pipeline — per-property supply pipeline records
--
-- Both tables carry source='yardi_matrix' and link to deals.id for per-deal
-- isolation (same pattern as costar_submarket_stats).
-- Historical_observations cross-vendor rows are written by the aggregation
-- pipeline using vendor_source='yardi_matrix' (vendor fields added by
-- migration 20260530_historical_observations_vendor_fields).

-- ── Rent Survey ───────────────────────────────────────────────────────────────
-- Corresponds to DocumentType = 'YARDI_MATRIX_RENT_SURVEY'
-- One row per (deal_id, submarket, period_date) snapshot.

CREATE TABLE IF NOT EXISTS yardi_matrix_rent_survey (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id               UUID REFERENCES deals(id) ON DELETE CASCADE,

  -- Geography
  submarket             TEXT        NOT NULL,
  metro                 TEXT,
  state                 CHAR(2),

  -- Time
  period_date           DATE        NOT NULL,

  -- Rent / occupancy metrics
  avg_asking_rent       NUMERIC(10, 2),
  avg_effective_rent    NUMERIC(10, 2),
  occupancy_rate        NUMERIC(6, 3),   -- stored as percentage (e.g. 94.5)
  concession_value_mo   NUMERIC(10, 2),  -- Yardi's "Concession Value ($ Per Month)"

  -- Supply metrics
  total_inventory_units INTEGER,
  new_supply_units      INTEGER,
  net_absorption_units  INTEGER,

  -- Provenance
  yardi_matrix_id       TEXT,            -- Yardi's internal property/submarket ID
  source                TEXT        NOT NULL DEFAULT 'yardi_matrix',
  file_id               TEXT,
  data_as_of            DATE,
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yardi_rent_survey_deal
  ON yardi_matrix_rent_survey (deal_id);
CREATE INDEX IF NOT EXISTS idx_yardi_rent_survey_geo
  ON yardi_matrix_rent_survey (submarket, period_date);

COMMENT ON TABLE yardi_matrix_rent_survey IS
  'Yardi Matrix multifamily rent survey snapshots (DocumentType=YARDI_MATRIX_RENT_SURVEY). '
  'One row per submarket-period. Feeds historical_observations via aggregation pipeline.';

-- ── Supply Pipeline ───────────────────────────────────────────────────────────
-- Corresponds to DocumentType = 'YARDI_MATRIX_SUPPLY_PIPELINE'
-- One row per property in the forward-looking supply pipeline.

CREATE TABLE IF NOT EXISTS yardi_matrix_supply_pipeline (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id               UUID REFERENCES deals(id) ON DELETE CASCADE,

  -- Property identity
  property_name         TEXT,
  address               TEXT,
  city                  TEXT,
  state                 CHAR(2),
  zip                   TEXT,

  -- Geography
  submarket             TEXT,
  metro                 TEXT,

  -- Pipeline status
  status                TEXT,           -- 'Under Construction' | 'Lease-Up' | 'Proposed' | 'Stabilized'
  delivery_date         DATE,
  total_units           INTEGER,
  stories               INTEGER,

  -- Parties
  developer             TEXT,
  owner                 TEXT,

  -- Geo-coordinates
  latitude              NUMERIC(10, 6),
  longitude             NUMERIC(10, 6),

  -- Provenance
  yardi_matrix_id       TEXT,
  source                TEXT        NOT NULL DEFAULT 'yardi_matrix',
  file_id               TEXT,
  data_as_of            DATE,
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yardi_supply_deal
  ON yardi_matrix_supply_pipeline (deal_id);
CREATE INDEX IF NOT EXISTS idx_yardi_supply_submarket
  ON yardi_matrix_supply_pipeline (submarket, delivery_date);
CREATE INDEX IF NOT EXISTS idx_yardi_supply_status
  ON yardi_matrix_supply_pipeline (status);

COMMENT ON TABLE yardi_matrix_supply_pipeline IS
  'Yardi Matrix multifamily supply pipeline (DocumentType=YARDI_MATRIX_SUPPLY_PIPELINE). '
  'One row per property. Feeds submarket supply signal computation.';
