-- Building permits table for permit-derived replacement cost computation.
--
-- The ReplacementCostServiceV2 uses this table as its highest-quality data tier.
-- When ≥1 matching permit exists, getPermitDerivedCostPerSF() returns a real
-- median $/SF instead of falling back to the class-based defaults (A=$225, B=$185,
-- C=$155). getPermitDerivedRegionalFactor() needs ≥10 permits in the target market
-- to override the BLS RPP fallback.
--
-- Seeded via: backend/scripts/seed-building-permits.ts
--
-- ── UP ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS building_permits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core cost fields (the two that drive $/SF calculation)
  permit_value      numeric(14, 2) NOT NULL,   -- total valuation in USD
  square_footage    numeric(10, 2) NOT NULL,   -- gross area covered by permit

  -- Classification
  permit_date       date          NOT NULL,
  permit_type       text          NOT NULL,   -- 'new_construction' | 'new_building' | 'new'
  property_type     text          NOT NULL,   -- 'multifamily' | 'apartment' | 'residential_multi'

  -- Geography
  county            text          NOT NULL,
  city              text,
  state             text          NOT NULL,   -- 2-letter postal code

  -- Optional provenance
  permit_number     text,
  source            text,                     -- 'arcgis_fulton' | 'pic_derived' | 'seed'

  -- Timestamps
  created_at        timestamptz   NOT NULL DEFAULT NOW(),
  updated_at        timestamptz   NOT NULL DEFAULT NOW()
);

-- Deduplication key — prevents duplicate rows when the seed script is re-run.
-- The ON CONFLICT clause in the seed script references this index explicitly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_building_permits_dedup
  ON building_permits (state, county, permit_type, property_type, permit_date, permit_value, square_footage);

-- Index for the service's WHERE clause patterns
CREATE INDEX IF NOT EXISTS idx_building_permits_state_county
  ON building_permits (state, county);

CREATE INDEX IF NOT EXISTS idx_building_permits_permit_date
  ON building_permits (permit_date DESC);

CREATE INDEX IF NOT EXISTS idx_building_permits_type_filter
  ON building_permits (permit_type, property_type, permit_date DESC);

COMMENT ON TABLE building_permits IS
  'New-construction building permits ingested from county ArcGIS sources. '
  'Used by ReplacementCostServiceV2.getPermitDerivedCostPerSF() to compute '
  'real market $/SF values instead of falling back to static class defaults. '
  'Seeded for Core 5 GA counties (Cobb, Gwinnett, DeKalb, Fulton, Clayton).';

COMMENT ON COLUMN building_permits.permit_value IS
  'Total project valuation in USD as declared on the permit application. '
  'Must be > $100,000 to pass the service filter.';

COMMENT ON COLUMN building_permits.square_footage IS
  'Gross area in square feet covered by the permit. '
  'Must be > 1,000 SF to pass the service filter.';

COMMENT ON COLUMN building_permits.source IS
  'Ingestion source: arcgis_fulton (live ArcGIS), pic_derived (derived from '
  'property_info_cache improvement values), seed (calibrated market baseline).';

-- ── DOWN (run manually to reverse) ──────────────────────────────────────────
-- DROP TABLE IF EXISTS building_permits;
