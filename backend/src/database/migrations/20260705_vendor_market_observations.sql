-- Migration: 20260705_vendor_market_observations
-- Piece A § "VENDOR_MARKET_OBSERVATIONS"
--
-- Creates a vendor-agnostic normalized table for submarket-level market
-- observations sourced from any registered vendor (CoStar, Yardi Matrix, etc.).
-- Each row represents one period snapshot for one geography from one vendor file.
--
-- This is the substrate Piece B cross-vendor reconciliation will read from.
-- It is populated alongside vendor-specific tables on each ingest (dual-write):
--   CoStar DataTable → costar_submarket_stats + costar_market_metrics
--                     + vendor_market_observations (vendor_id='costar')
--   Yardi Matrix Rent Survey → yardi_matrix_rent_survey
--                             + vendor_market_observations (vendor_id='yardi_matrix')
--
-- Design notes:
--   • geography_id + vendor_id + observation_date + deal_id form the
--     deduplication key (COALESCE handles NULL deal_id consistently).
--   • deal_id is nullable — platform-level observations have no deal context.
--   • raw_snapshot preserves the full parsed row as JSONB for forward-compat.
--   • vendor_license_posture mirrors VendorLicensePosture in the registry
--     and governs downstream display/export rules.
--   • All metric columns are nullable — not every vendor carries every field.

BEGIN;

CREATE TABLE IF NOT EXISTS vendor_market_observations (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vendor identity (matches VendorDeclaration.vendorId in the registry)
  vendor_id                VARCHAR(50)  NOT NULL,

  -- Registry file type key (e.g. 'COSTAR_SUBMARKET_EXPORT', 'YARDI_MATRIX_RENT_SURVEY')
  vendor_file_type         VARCHAR(100) NOT NULL,

  -- Deal scope (nullable — platform-level observations carry no deal context)
  deal_id                  UUID         REFERENCES deals(id) ON DELETE CASCADE,

  -- Source file in data_library_files
  file_id                  TEXT,

  -- Period this observation covers
  observation_date         DATE         NOT NULL,

  -- Geography granularity: 'submarket', 'market', 'metro', 'national'
  geography_level          VARCHAR(20)  NOT NULL DEFAULT 'submarket',

  -- Stable geography identifier (e.g. submarket name, CoStar geography label)
  geography_id             TEXT         NOT NULL,

  -- Human-readable geography label (may differ from geography_id in display)
  geography_name           TEXT,

  -- Two-letter US state code
  state                    CHAR(2),

  -- ── Normalized market metrics ─────────────────────────────────────────────
  -- Null when the vendor export does not carry the field.

  avg_asking_rent          NUMERIC(10,2),
  avg_effective_rent       NUMERIC(10,2),

  -- Vacancy rate as a percentage (0–100), NOT a decimal fraction
  vacancy_rate             NUMERIC(6,3),

  under_construction_units INTEGER,
  inventory_units          INTEGER,
  net_absorption_units     INTEGER,

  -- Cap rate as a percentage (0–100), NOT a decimal fraction
  cap_rate                 NUMERIC(6,4),

  -- Sale price per unit in dollars
  price_per_unit           NUMERIC(12,2),

  -- ── Vendor provenance ─────────────────────────────────────────────────────

  -- License posture governs display/export; mirrors VendorLicensePosture type
  vendor_license_posture   VARCHAR(20)
    CHECK (vendor_license_posture IN ('restricted', 'platform_only', 'open')),

  -- When the vendor generated this snapshot (distinct from ingested_at)
  vendor_data_as_of        DATE,

  -- Full parsed row preserved for forward-compatibility and Piece B reconciliation
  raw_snapshot             JSONB,

  ingested_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Deduplication: one observation per vendor+date+geography combination per deal.
-- COALESCE(deal_id::text, '') ensures two NULL deal_ids are treated as the same
-- (PostgreSQL partial unique indexes would let two NULLs coexist otherwise).
CREATE UNIQUE INDEX IF NOT EXISTS uix_vendor_market_obs_dedup
  ON vendor_market_observations (
    vendor_id,
    observation_date,
    geography_level,
    geography_id,
    COALESCE(deal_id::text, '')
  );

-- Time-series reads per vendor (Piece B cross-vendor reconciliation primary query)
CREATE INDEX IF NOT EXISTS idx_vendor_market_obs_vendor_date
  ON vendor_market_observations (vendor_id, observation_date);

-- Per-deal observations (deal intelligence features)
CREATE INDEX IF NOT EXISTS idx_vendor_market_obs_deal_id
  ON vendor_market_observations (deal_id)
  WHERE deal_id IS NOT NULL;

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE vendor_market_observations IS
  'Cross-vendor normalized market observations. '
  'Populated by vendor parsers alongside vendor-specific tables (dual-write). '
  'Substrate for Piece B cross-vendor reconciliation. '
  'Piece A — Vendor Registry Foundation.';

COMMENT ON COLUMN vendor_market_observations.geography_id IS
  'Stable identifier for the geography — typically the submarket name or '
  'vendor-assigned market code. Used as the deduplication key alongside '
  'vendor_id, observation_date, and deal_id.';

COMMENT ON COLUMN vendor_market_observations.vacancy_rate IS
  'Vacancy rate expressed as a percentage (0–100), not a decimal fraction. '
  'Normalised from vendor exports which may deliver either form.';

COMMENT ON COLUMN vendor_market_observations.cap_rate IS
  'Cap rate expressed as a percentage (0–100), not a decimal fraction.';

COMMENT ON COLUMN vendor_market_observations.raw_snapshot IS
  'Full parsed row serialised as JSONB. Preserved for forward-compatibility '
  'and Piece B field-level reconciliation. Not for direct application logic.';

COMMIT;
