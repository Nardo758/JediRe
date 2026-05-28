-- Migration: fix mv_market_rent_benchmarks null year_built classification
--
-- Problem: apartment_locator_properties has 954 rows, all with year_built = NULL.
-- The view's CASE maps NULL → 'C' (the ELSE branch), so every benchmark row
-- is class C regardless of the actual building vintage. GRM/GIM never fires for
-- class A or class B deals (including Bishop, year_built 2017).
--
-- Fix: treat NULL year_built as class B (conservative middle-ground default).
-- Class A (>=2010) and class C (<1995) remain unchanged. Task #1423 will
-- backfill real year_built values; this migration unblocks GRM/GIM immediately.

DROP MATERIALIZED VIEW IF EXISTS mv_market_rent_benchmarks;

CREATE MATERIALIZED VIEW mv_market_rent_benchmarks AS
SELECT
  city,
  state,
  CASE
    WHEN year_built >= 2010 THEN 'A'
    WHEN year_built >= 1995 THEN 'B'
    WHEN year_built IS NULL THEN 'B'   -- unknown vintage → conservative class B default
    ELSE 'C'
  END AS asset_class,
  count(*)                                                                          AS sample_size,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY avg_asking_rent::float)             AS p25_rent,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY avg_asking_rent::float)             AS p50_rent,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY avg_asking_rent::float)             AS p75_rent,
  avg(avg_asking_rent)                                                              AS avg_rent,
  min(avg_asking_rent)                                                              AS min_rent,
  max(avg_asking_rent)                                                              AS max_rent,
  now()                                                                             AS refreshed_at
FROM apartment_locator_properties
WHERE avg_asking_rent IS NOT NULL
  AND avg_asking_rent > 0
GROUP BY
  city,
  state,
  CASE
    WHEN year_built >= 2010 THEN 'A'
    WHEN year_built >= 1995 THEN 'B'
    WHEN year_built IS NULL THEN 'B'
    ELSE 'C'
  END
HAVING count(*) >= 3;

CREATE UNIQUE INDEX idx_mv_market_rent_benchmarks_key
  ON mv_market_rent_benchmarks (city, state, asset_class);
