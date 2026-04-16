CREATE TABLE IF NOT EXISTS driver_analysis_runs (
  id SERIAL PRIMARY KEY,
  property_id TEXT NOT NULL,
  property_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  outcome_metrics TEXT[],
  driver_count INTEGER,
  results_count INTEGER,
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_driver_runs_property ON driver_analysis_runs(property_id);
CREATE INDEX IF NOT EXISTS idx_driver_runs_status ON driver_analysis_runs(status);

CREATE TABLE IF NOT EXISTS driver_analysis_results (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES driver_analysis_runs(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL,
  driver_metric_id TEXT NOT NULL,
  driver_metric_name TEXT,
  driver_category TEXT,
  driver_geography_type TEXT,
  driver_geography_id TEXT,
  outcome_metric_id TEXT NOT NULL,
  optimal_lag_weeks INTEGER NOT NULL DEFAULT 0,
  pearson_r NUMERIC(10,6),
  p_value NUMERIC(16,10),
  r_squared NUMERIC(10,6),
  slope NUMERIC(20,10),
  intercept NUMERIC(20,10),
  sample_size INTEGER,
  direction TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_results_run ON driver_analysis_results(run_id);
CREATE INDEX IF NOT EXISTS idx_driver_results_property ON driver_analysis_results(property_id);
CREATE INDEX IF NOT EXISTS idx_driver_results_outcome ON driver_analysis_results(outcome_metric_id);
CREATE INDEX IF NOT EXISTS idx_driver_results_pearson ON driver_analysis_results(pearson_r);
