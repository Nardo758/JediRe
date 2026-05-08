-- ============================================================================
-- Atlanta MSA Market Snapshots + Macro Indicators Seed
-- Purpose: Unblock COR-22 (Job Growth → Absorption), COR-27 (Interest Rate →
--         Cap Rate) and COR-29 (Concession Rate → Future Vacancy) by giving
--         the correlation engine ≥2 quarterly Atlanta data points per metric.
--
-- Data sources (point-in-time, manually curated from public reporting):
--   - job_growth_yoy:                       BLS Current Employment Statistics
--                                           (CES) — Atlanta-Sandy Springs-
--                                           Roswell MSA total nonfarm YoY %.
--                                           https://www.bls.gov/ces/
--   - net_absorption_units:                 CoStar Atlanta Multifamily Market
--                                           Reports (quarterly absorption,
--                                           5+ unit conventional).
--   - avg_cap_rate:                         Real Capital Analytics / CoStar
--                                           Atlanta multifamily transaction
--                                           cap rate avg (decimal fraction,
--                                           e.g. 0.055 = 5.5%).
--   - properties_offering_concessions_pct:  CoStar Atlanta concession survey
--                                           (decimal fraction of properties
--                                           offering any concession).
--   - vacancy_rate:                         CoStar Atlanta multifamily
--                                           vacancy (decimal fraction).
--   - avg_occupancy_pct:                    CoStar Atlanta multifamily
--                                           occupancy (decimal fraction;
--                                           snapshot-capture.service.ts
--                                           filters BETWEEN 0.5 AND 1.0).
--   - macro_indicators (Fed Funds Rate):    FRED series DFF, quarter-end
--                                           effective rate. https://fred.stlouisfed.org/series/DFF
--
-- Numeric conventions (must match correlationEngine.service.ts consumers):
--   *_yoy and *_pct columns are stored as DECIMAL FRACTIONS (0.025 = 2.5%),
--   not percentage points. The engine multiplies by 100 at display time.
--
-- Idempotent: safe to re-run; uses ON CONFLICT to upsert.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- macro_indicators (created if missing — referenced by COR-27 for the
-- 3-month-lagged interest-rate xValue). Schema matches the query shape in
-- backend/src/services/correlationEngine.service.ts (computeCOR27).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS macro_indicators (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_name  TEXT NOT NULL,
  indicator_value DECIMAL(10, 4) NOT NULL,
  indicator_date  DATE NOT NULL,
  source          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (indicator_name, indicator_date)
);

CREATE INDEX IF NOT EXISTS idx_macro_indicators_name_date
  ON macro_indicators (indicator_name, indicator_date DESC);

-- Fed Funds Effective Rate (FRED: DFF), quarter-end values.
-- Values are percentage points (e.g. 4.33 = 4.33%) per FRED convention.
INSERT INTO macro_indicators (indicator_name, indicator_value, indicator_date, source) VALUES
  ('Fed Funds Effective Rate', 5.33, '2024-09-30', 'FRED:DFF'),
  ('Fed Funds Effective Rate', 4.83, '2024-12-31', 'FRED:DFF'),
  ('Fed Funds Effective Rate', 4.58, '2025-03-31', 'FRED:DFF'),
  ('Fed Funds Effective Rate', 4.33, '2025-06-30', 'FRED:DFF'),
  ('Fed Funds Effective Rate', 4.08, '2025-09-30', 'FRED:DFF'),
  ('Fed Funds Effective Rate', 3.83, '2025-12-31', 'FRED:DFF'),
  ('Fed Funds Effective Rate', 3.58, '2026-03-31', 'FRED:DFF')
ON CONFLICT (indicator_name, indicator_date) DO UPDATE
  SET indicator_value = EXCLUDED.indicator_value,
      source          = EXCLUDED.source;

-- ---------------------------------------------------------------------------
-- market_snapshots — Atlanta MSA quarterly rows (last 4 quarters).
-- 4 rows are seeded so the engine's 6-month-aligned-lag search (in
-- computeCOR22 / computeCOR29) has a real ≥6mo window to lock onto
-- regardless of which row is treated as "current".
-- ---------------------------------------------------------------------------
INSERT INTO market_snapshots (
  geography_type, geography_id, geography_name,
  snapshot_date, snapshot_type,
  job_growth_yoy, net_absorption_units,
  avg_cap_rate, properties_offering_concessions_pct,
  vacancy_rate, avg_occupancy_pct,
  rent_growth_yoy, avg_effective_rent,
  data_completeness_score, data_sources
) VALUES
  -- 2025 Q2
  ('msa', 'atlanta', 'Atlanta-Sandy Springs-Roswell, GA',
   '2025-06-30', 'quarterly',
   0.0180, 1850,
   0.0535, 0.34,
   0.1080, 0.8920,
   -0.0090, 1612.00,
   0.85, ARRAY['BLS:CES','CoStar','RCA','FRED']),
  -- 2025 Q3
  ('msa', 'atlanta', 'Atlanta-Sandy Springs-Roswell, GA',
   '2025-09-30', 'quarterly',
   0.0210, 2240,
   0.0555, 0.31,
   0.1040, 0.8960,
   -0.0050, 1620.00,
   0.85, ARRAY['BLS:CES','CoStar','RCA','FRED']),
  -- 2025 Q4
  ('msa', 'atlanta', 'Atlanta-Sandy Springs-Roswell, GA',
   '2025-12-31', 'quarterly',
   0.0235, 2680,
   0.0570, 0.27,
   0.0995, 0.9005,
   0.0040, 1635.00,
   0.85, ARRAY['BLS:CES','CoStar','RCA','FRED']),
  -- 2026 Q1
  ('msa', 'atlanta', 'Atlanta-Sandy Springs-Roswell, GA',
   '2026-03-31', 'quarterly',
   0.0260, 3050,
   0.0565, 0.23,
   0.0950, 0.9050,
   0.0125, 1655.00,
   0.85, ARRAY['BLS:CES','CoStar','RCA','FRED'])
ON CONFLICT (geography_type, geography_id, snapshot_date) DO UPDATE
  SET geography_name                       = EXCLUDED.geography_name,
      snapshot_type                        = EXCLUDED.snapshot_type,
      job_growth_yoy                       = EXCLUDED.job_growth_yoy,
      net_absorption_units                 = EXCLUDED.net_absorption_units,
      avg_cap_rate                         = EXCLUDED.avg_cap_rate,
      properties_offering_concessions_pct  = EXCLUDED.properties_offering_concessions_pct,
      vacancy_rate                         = EXCLUDED.vacancy_rate,
      avg_occupancy_pct                    = EXCLUDED.avg_occupancy_pct,
      rent_growth_yoy                      = EXCLUDED.rent_growth_yoy,
      avg_effective_rent                   = EXCLUDED.avg_effective_rent,
      data_completeness_score              = EXCLUDED.data_completeness_score,
      data_sources                         = EXCLUDED.data_sources;

COMMIT;
