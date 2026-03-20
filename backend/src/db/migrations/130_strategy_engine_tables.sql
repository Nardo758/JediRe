-- Strategy Engine Tables (Sessions 1-4)

CREATE TABLE IF NOT EXISTS geographies (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  parent_id VARCHAR(50),
  state VARCHAR(2),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS metric_time_series (
  id BIGSERIAL PRIMARY KEY,
  metric_id VARCHAR(50) NOT NULL,
  geography_type VARCHAR(20) NOT NULL,
  geography_id VARCHAR(50) NOT NULL,
  geography_name VARCHAR(255),
  period_date DATE NOT NULL,
  period_type VARCHAR(10) NOT NULL DEFAULT 'monthly',
  value DOUBLE PRECISION NOT NULL,
  source VARCHAR(50) NOT NULL,
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mts_unique
  ON metric_time_series(metric_id, geography_type, geography_id, period_date);
CREATE INDEX IF NOT EXISTS idx_mts_metric_geo
  ON metric_time_series(metric_id, geography_type);
CREATE INDEX IF NOT EXISTS idx_mts_geo_period
  ON metric_time_series(geography_id, period_date);
CREATE INDEX IF NOT EXISTS idx_mts_latest
  ON metric_time_series(metric_id, geography_type, period_date DESC);

CREATE TABLE IF NOT EXISTS strategy_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'custom',
  scope VARCHAR(20) DEFAULT 'submarket',
  conditions JSONB NOT NULL DEFAULT '[]',
  combinator VARCHAR(5) DEFAULT 'AND',
  signal_weights JSONB,
  sort_by VARCHAR(50),
  sort_direction VARCHAR(4) DEFAULT 'desc',
  max_results INTEGER DEFAULT 50,
  asset_classes TEXT[] DEFAULT '{}',
  deal_types TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategy_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategy_definitions(id) ON DELETE CASCADE,
  user_id UUID,
  scope VARCHAR(20),
  result_count INTEGER,
  results JSONB,
  execution_ms INTEGER,
  run_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metric_correlations (
  id BIGSERIAL PRIMARY KEY,
  metric_a VARCHAR(50) NOT NULL,
  metric_b VARCHAR(50) NOT NULL,
  geography_type VARCHAR(20) NOT NULL,
  geography_id VARCHAR(50) NOT NULL,
  window_months INTEGER NOT NULL,
  correlation_r REAL NOT NULL,
  lead_lag_months INTEGER,
  p_value REAL,
  sample_size INTEGER,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mc_unique
  ON metric_correlations(metric_a, metric_b, geography_type, geography_id, window_months);
