CREATE TABLE IF NOT EXISTS metric_projections (
  id BIGSERIAL PRIMARY KEY,
  metric_id VARCHAR(50) NOT NULL,
  geography_type VARCHAR(20) NOT NULL,
  geography_id VARCHAR(50) NOT NULL,
  projection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  horizon_months INTEGER NOT NULL DEFAULT 60,
  projected_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  r_squared REAL,
  method VARCHAR(30) NOT NULL DEFAULT 'ols_linear',
  training_months INTEGER,
  confidence VARCHAR(10) DEFAULT 'medium',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_unique
  ON metric_projections (metric_id, geography_type, geography_id, horizon_months);

CREATE INDEX IF NOT EXISTS idx_mp_metric_geo
  ON metric_projections (metric_id, geography_type);

CREATE INDEX IF NOT EXISTS idx_mp_computed
  ON metric_projections (computed_at);
