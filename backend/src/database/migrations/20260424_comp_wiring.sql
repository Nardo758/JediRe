-- ============================================================
-- Comp Wiring Migration
-- 1. Unique source+source_id on market_sale_comps (for ETL upserts)
-- 2. qualified column for arm's-length filter
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_sale_comps_source_id
  ON market_sale_comps(source, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE market_sale_comps
  ADD COLUMN IF NOT EXISTS qualified boolean DEFAULT true;

-- Index for spatial comp queries (lat/lon-based)
CREATE INDEX IF NOT EXISTS idx_market_sale_comps_geo
  ON market_sale_comps(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index for price trend time-series
CREATE INDEX IF NOT EXISTS idx_market_sale_comps_county_year
  ON market_sale_comps(county, state, sale_date DESC);
