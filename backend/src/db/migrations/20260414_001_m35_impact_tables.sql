-- M35 Impact Measurement Tables
-- OLS Windowing + Difference-in-Differences engine storage
-- Idempotent: safe to re-run via CREATE TABLE IF NOT EXISTS

-- ─── event_impacts ────────────────────────────────────────────────────────────
-- One row per event × metric_key × geography_id × window_months
-- Populated by the nightly M35 Impact Measurement Job.

CREATE TABLE IF NOT EXISTS event_impacts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             UUID NOT NULL REFERENCES key_events(id) ON DELETE CASCADE,
  metric_key           VARCHAR(64) NOT NULL,
  geography_type       VARCHAR(32) NOT NULL DEFAULT 'metro',
  geography_id         VARCHAR(128) NOT NULL,
  window_months        SMALLINT NOT NULL,          -- 3 | 12 | 24 | 36

  measurement_date     TIMESTAMPTZ NOT NULL,

  -- OLS baseline (T-12mo → T0)
  baseline_slope       NUMERIC(18,8),
  baseline_intercept   NUMERIC(18,8),
  baseline_r2          NUMERIC(6,4),
  baseline_n           SMALLINT NOT NULL DEFAULT 0,

  -- Extrapolation vs actual
  projected_value      NUMERIC(18,4),
  actual_value         NUMERIC(18,4),
  delta                NUMERIC(18,4),             -- actual - projected
  delta_pct            NUMERIC(10,4),             -- % vs projected

  -- Difference-in-Differences
  control_avg_delta    NUMERIC(18,4),
  attributed_delta     NUMERIC(18,4),             -- delta - control_avg_delta
  attributed_delta_pct NUMERIC(10,4),
  did_confidence       NUMERIC(6,4) NOT NULL DEFAULT 0,
  p_value              NUMERIC(8,6),
  control_group_n      SMALLINT NOT NULL DEFAULT 0,

  -- Data quality flags
  data_quality         VARCHAR(16) NOT NULL DEFAULT 'insufficient',
  -- 'complete' | 'partial' | 'insufficient'
  data_gaps            JSONB DEFAULT '[]'::jsonb,

  computed_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_impacts_unique
  ON event_impacts (event_id, metric_key, geography_id, window_months);

CREATE INDEX IF NOT EXISTS idx_event_impacts_event
  ON event_impacts (event_id);

CREATE INDEX IF NOT EXISTS idx_event_impacts_metric
  ON event_impacts (metric_key);

CREATE INDEX IF NOT EXISTS idx_event_impacts_window
  ON event_impacts (window_months);

-- ─── event_control_groups ─────────────────────────────────────────────────────
-- Control submarkets selected for each event's DiD computation.
-- Re-computed idempotently each time computeEventImpact() runs.

CREATE TABLE IF NOT EXISTS event_control_groups (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                 UUID NOT NULL REFERENCES key_events(id) ON DELETE CASCADE,
  control_geography_type   VARCHAR(32) NOT NULL DEFAULT 'submarket',
  control_geography_id     VARCHAR(128) NOT NULL,
  control_geography_name   VARCHAR(256),
  match_score              NUMERIC(6,4) NOT NULL,
  match_criteria           JSONB DEFAULT '{}'::jsonb,
  -- keys: no_confounding_event, pre_event_trend_similarity,
  --       class_similarity, rent_level_similarity, occupancy_similarity
  is_included              BOOLEAN NOT NULL DEFAULT TRUE,
  exclusion_reason         TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_control_groups_unique
  ON event_control_groups (event_id, control_geography_id);

CREATE INDEX IF NOT EXISTS idx_event_control_groups_event
  ON event_control_groups (event_id);
