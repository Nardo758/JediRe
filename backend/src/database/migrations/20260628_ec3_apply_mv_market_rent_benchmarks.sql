-- Task EC3 (Task #1405 Wave A) — Apply mv_market_rent_benchmarks
--
-- The CREATE statement exists in 20260620_mv_market_rent_benchmarks.sql but
-- the migration had never been executed against the database.  This file
-- re-applies it using IF NOT EXISTS guards so it is safe to run on any
-- environment that was missed (prod, staging, developer machines).
--
-- Additionally creates the unique index required for CONCURRENTLY refresh
-- (also IF NOT EXISTS).
--
-- Root cause: The 20260620 migration file was authored but never wired into
-- the automated migration run sequence.  Running this file brings every
-- environment to the same state.
--
-- D-DEAL-1 note: Only 464 Bishop (deal_id 3f32276f-…) has a linked
-- properties row.  The 1,585 remaining properties rows are ApartmentIQ
-- market comps — they do not need deal_id.  28 other deals have no linked
-- properties row because deal creation never auto-creates one.  Fix path:
-- Task #1422.

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_market_rent_benchmarks_key
  ON mv_market_rent_benchmarks (city, state, asset_class);

-- REFRESH only if the view was just created (row count = 0 means it is new).
-- This avoids a redundant full refresh on environments where the view already
-- had data.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM mv_market_rent_benchmarks) = 0 THEN
    REFRESH MATERIALIZED VIEW mv_market_rent_benchmarks;
  END IF;
END $$;

COMMENT ON MATERIALIZED VIEW mv_market_rent_benchmarks IS
  'Building-average market rent P25/P50/P75 by city × state × asset class (A/B/C). '
  'Source: apartment_locator_properties (ApartmentIQ). '
  'Refresh: manual on ApartmentIQ sync push (REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_rent_benchmarks). '
  'Constraint: building-average only — no per-bedroom stratification (Phase 3). '
  'GAP-4 (Task #1420): year_built NULL for all 954 seeded rows → all rows are class C. '
  'Class A/B stratification available after Task #1423 backfill. '
  'Task EC3 / Task #1405.';
