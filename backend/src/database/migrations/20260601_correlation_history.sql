-- Task #919 — Historical correlations pipeline (Gap 4)
-- Append-only table that stores every computed correlation snapshot.
-- metric_correlations continues to hold the *latest* value (DELETE+INSERT).
-- correlation_history holds *all* historical values for sparkline/stability queries.
--
-- Note: computed_date (DATE) is a separate column instead of a functional index
-- on computed_at::date — PostgreSQL requires IMMUTABLE functions in index expressions
-- and timestamptz-to-date casting is STABLE (timezone-dependent).

BEGIN;

CREATE TABLE IF NOT EXISTS correlation_history (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_a         TEXT        NOT NULL,
  metric_b         TEXT        NOT NULL,
  geography_type   TEXT        NOT NULL,
  geography_id     TEXT,                         -- NULL = scope-level aggregate
  window_months    INT         NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computed_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  correlation_r    NUMERIC(10, 7) NOT NULL,
  p_value          NUMERIC(10, 7),
  sample_size      INT         NOT NULL,
  observation_start DATE,
  observation_end   DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One snapshot per pair per calendar day (prevents duplicate nightly runs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_corr_hist_daily_unique
  ON correlation_history (metric_a, metric_b, geography_type, COALESCE(geography_id, ''), window_months, computed_date);

-- Primary sparkline lookup: given a pair + geography + window, return history newest-first
CREATE INDEX IF NOT EXISTS idx_corr_hist_pair_lookup
  ON correlation_history (metric_a, metric_b, geography_type, geography_id, window_months, computed_date DESC);

-- Secondary index: all pairs for a geography (used by nightly job summary)
CREATE INDEX IF NOT EXISTS idx_corr_hist_geo_time
  ON correlation_history (geography_type, geography_id, computed_date DESC);

COMMIT;
