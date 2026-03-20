CREATE TABLE IF NOT EXISTS traffic_submarket_calibration (
  id SERIAL PRIMARY KEY,
  submarket_id VARCHAR(255) NOT NULL DEFAULT '',
  msa_id VARCHAR(255) NOT NULL DEFAULT '',
  city VARCHAR(255) NOT NULL DEFAULT '',
  state VARCHAR(50) NOT NULL DEFAULT '',
  avg_traffic_per_unit DECIMAL(8,4),
  avg_closing_ratio DECIMAL(5,4),
  avg_tour_conversion DECIMAL(5,4),
  seasonal_factors JSONB,
  website_pct DECIMAL(5,4),
  sample_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(submarket_id, msa_id, city, state)
);

CREATE INDEX IF NOT EXISTS idx_traffic_cal_submarket ON traffic_submarket_calibration(submarket_id);
CREATE INDEX IF NOT EXISTS idx_traffic_cal_msa ON traffic_submarket_calibration(msa_id);
CREATE INDEX IF NOT EXISTS idx_traffic_cal_city ON traffic_submarket_calibration(city, state);
