-- DL-192: traffic growth index fix — storage for speed samples and speed–flow parameters.
--
-- Schema only. Creates two new tables and touches no existing table or row,
-- so it is safe to run on a database that already has data. Idempotent.

-- ─── 1. Speed samples ───────────────────────────────────────────────────────
-- One travel-time reading per property per clock hour, kept for a rolling
-- window (the sampler purges older rows). local_* are the hour, weekday
-- (0 = Sunday) and month at the property, which is what dot_temporal_profiles
-- is keyed on.

CREATE TABLE IF NOT EXISTS traffic_speed_samples (
  id                     BIGSERIAL PRIMARY KEY,
  property_id            UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  sampled_at             TIMESTAMPTZ NOT NULL,
  sample_hour_start      TIMESTAMPTZ NOT NULL,
  time_zone              TEXT NOT NULL,
  local_hour             SMALLINT NOT NULL CHECK (local_hour BETWEEN 0 AND 23),
  local_dow              SMALLINT NOT NULL CHECK (local_dow BETWEEN 0 AND 6),
  local_month            SMALLINT NOT NULL CHECK (local_month BETWEEN 1 AND 12),
  duration_in_traffic_s  INTEGER NOT NULL CHECK (duration_in_traffic_s > 0),
  duration_typical_s     INTEGER NOT NULL CHECK (duration_typical_s > 0),
  vendor                 TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_traffic_speed_samples_property_hour
  ON traffic_speed_samples (property_id, sample_hour_start);

CREATE INDEX IF NOT EXISTS idx_traffic_speed_samples_property_time
  ON traffic_speed_samples (property_id, sampled_at);

CREATE INDEX IF NOT EXISTS idx_traffic_speed_samples_sampled_at
  ON traffic_speed_samples (sampled_at);

-- ─── 2. Speed–flow parameters ───────────────────────────────────────────────
-- Fitted BPR-form parameters with their source and fit date. No rows are
-- seeded: until a calibration writes one, the estimator uses its built-in
-- defaults and labels every result as uncalibrated.

CREATE TABLE IF NOT EXISTS traffic_speed_flow_params (
  id                     BIGSERIAL PRIMARY KEY,
  scope                  TEXT NOT NULL CHECK (scope IN ('station', 'road_class')),
  road_class             TEXT NOT NULL CHECK (road_class IN ('Interstate', 'Expressway', 'Arterial', 'Collector', 'Local')),
  station_id             TEXT,
  alpha                  DOUBLE PRECISION NOT NULL CHECK (alpha > 0),
  beta                   DOUBLE PRECISION NOT NULL CHECK (beta > 0),
  capacity_per_lane_vph  DOUBLE PRECISION NOT NULL CHECK (capacity_per_lane_vph > 0),
  default_lanes          DOUBLE PRECISION NOT NULL CHECK (default_lanes > 0),
  max_vc_ratio           DOUBLE PRECISION NOT NULL CHECK (max_vc_ratio > 0),
  source                 TEXT NOT NULL,
  calibrated_at          TIMESTAMPTZ NOT NULL,
  sample_count           INTEGER NOT NULL CHECK (sample_count >= 0),
  fit_r2                 DOUBLE PRECISION,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((scope = 'station') = (station_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_traffic_speed_flow_params_lookup
  ON traffic_speed_flow_params (road_class, scope, station_id, calibrated_at DESC);
