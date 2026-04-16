CREATE TABLE IF NOT EXISTS metric_lead_lag_results (
  id BIGSERIAL PRIMARY KEY,
  metric_a_id VARCHAR(50) NOT NULL,
  metric_b_id VARCHAR(50) NOT NULL,
  optimal_lag_months INTEGER NOT NULL,
  r_at_optimal_lag REAL NOT NULL,
  r_at_zero_lag REAL NOT NULL,
  improvement_abs REAL NOT NULL DEFAULT 0,
  improvement_pct REAL NOT NULL,
  lag_profile JSONB NOT NULL DEFAULT '[]',
  geography_type VARCHAR(20) NOT NULL DEFAULT 'submarket',
  sample_size INTEGER NOT NULL,
  confidence_level VARCHAR(10) NOT NULL DEFAULT 'low',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_a_id, metric_b_id, geography_type)
);

CREATE INDEX IF NOT EXISTS idx_llr_metric_a ON metric_lead_lag_results(metric_a_id);
CREATE INDEX IF NOT EXISTS idx_llr_metric_b ON metric_lead_lag_results(metric_b_id);
CREATE INDEX IF NOT EXISTS idx_llr_r ON metric_lead_lag_results(r_at_optimal_lag DESC);
