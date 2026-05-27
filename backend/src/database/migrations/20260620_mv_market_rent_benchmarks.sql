-- Task EC3 — Market Rent Benchmarks Materialized View
-- Creates mv_market_rent_benchmarks aggregating apartment_locator_properties
-- into P25/P50/P75 distributions by city × state × asset_class.
--
-- Architectural constraint: apartment_locator_properties.avg_asking_rent is a
-- building-level average (not per bedroom type). This view provides building-average
-- benchmarks only. Per-unit-type stratification is a Phase 3 enhancement.
--
-- Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_rent_benchmarks
-- is called at the end of the ApartmentIQ sync push handlers.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_market_rent_benchmarks AS
SELECT
  city,
  state,
  CASE
    WHEN year_built >= 2010 THEN 'A'
    WHEN year_built >= 1995 THEN 'B'
    ELSE 'C'
  END AS asset_class,
  COUNT(*)                                                              AS sample_size,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY avg_asking_rent)        AS p25_rent,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY avg_asking_rent)        AS p50_rent,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY avg_asking_rent)        AS p75_rent,
  AVG(avg_asking_rent)                                                  AS avg_rent,
  MIN(avg_asking_rent)                                                  AS min_rent,
  MAX(avg_asking_rent)                                                  AS max_rent,
  NOW()                                                                 AS refreshed_at
FROM apartment_locator_properties
WHERE avg_asking_rent IS NOT NULL
  AND avg_asking_rent > 0
GROUP BY city, state, asset_class
HAVING COUNT(*) >= 3;

COMMENT ON MATERIALIZED VIEW mv_market_rent_benchmarks IS
  'Building-average market rent P25/P50/P75 by city × state × asset class (A/B/C). '
  'Source: apartment_locator_properties (ApartmentIQ). '
  'Refresh: manual on ApartmentIQ sync push. '
  'Constraint: building-average only — no per-bedroom stratification (Phase 3). '
  'Task EC3.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_market_rent_benchmarks_key
  ON mv_market_rent_benchmarks (city, state, asset_class);

-- Initial population
REFRESH MATERIALIZED VIEW mv_market_rent_benchmarks;
