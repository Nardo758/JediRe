-- Migration 026: Property Data Coverage Tracking
-- Purpose: Monitor property data coverage across counties
-- Created: 2026-02-15

-- Coverage tracking table
CREATE TABLE IF NOT EXISTS property_data_coverage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  county VARCHAR(100) NOT NULL,
  state_code VARCHAR(2) NOT NULL,
  
  -- Coverage metrics
  total_parcels BIGINT,
  scraped_count BIGINT DEFAULT 0,
  coverage_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_parcels > 0 THEN (scraped_count::DECIMAL / total_parcels * 100)
      ELSE 0
    END
  ) STORED,
  
  -- API status
  api_status VARCHAR(20) DEFAULT 'active', -- active, degraded, down, not_configured
  api_url TEXT,
  api_type VARCHAR(50), -- arcgis, custom, scraper
  last_api_check TIMESTAMP,
  avg_response_time_ms INTEGER,
  
  -- Freshness
  oldest_record_date TIMESTAMP,
  newest_record_date TIMESTAMP,
  stale_count BIGINT DEFAULT 0, -- records > 30 days old
  
  -- Activity
  scrapes_today INTEGER DEFAULT 0,
  scrapes_this_week INTEGER DEFAULT 0,
  scrapes_this_month INTEGER DEFAULT 0,
  last_scrape_at TIMESTAMP,
  
  -- Success metrics
  success_rate_24h DECIMAL(5,2),
  failed_scrapes_24h INTEGER DEFAULT 0,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(county, state_code)
);

-- Indexes
CREATE INDEX idx_coverage_state ON property_data_coverage(state_code);
CREATE INDEX idx_coverage_status ON property_data_coverage(api_status);
CREATE INDEX idx_coverage_updated ON property_data_coverage(updated_at DESC);

-- Scrape activity log
CREATE TABLE IF NOT EXISTS scrape_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  county VARCHAR(100) NOT NULL,
  state_code VARCHAR(2) NOT NULL,
  
  -- Activity type
  activity_type VARCHAR(50), -- initial_scrape, refresh, bulk_import, health_check
  
  -- Results
  properties_attempted INTEGER DEFAULT 0,
  properties_succeeded INTEGER DEFAULT 0,
  properties_failed INTEGER DEFAULT 0,
  
  -- Performance
  duration_seconds DECIMAL(10,2),
  avg_time_per_property_ms INTEGER,
  
  -- Errors
  error_count INTEGER DEFAULT 0,
  error_summary JSONB,
  sample_errors TEXT[], -- First 5 error messages
  
  -- Trigger context
  triggered_by VARCHAR(50), -- cron, manual, api_call, user
  triggered_by_user_id UUID REFERENCES users(id),
  
  -- Metadata
  worker_version VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scrape_log_county ON scrape_activity_log(county, state_code);
CREATE INDEX idx_scrape_log_date ON scrape_activity_log(created_at DESC);
CREATE INDEX idx_scrape_log_type ON scrape_activity_log(activity_type);
CREATE INDEX idx_scrape_log_user ON scrape_activity_log(triggered_by_user_id);

-- Seed initial data for Fulton County
INSERT INTO property_data_coverage (
  county,
  state_code,
  total_parcels,
  scraped_count,
  api_status,
  api_url,
  api_type,
  last_api_check,
  notes
) VALUES (
  'Fulton',
  'GA',
  340000, -- Approximate total parcels in Fulton County
  0, -- Will be updated by actual scrape count
  'active',
  'https://property-api.m-dixon5030.workers.dev',
  'arcgis',
  NOW(),
  'Fulton County ArcGIS REST API - live and working'
) ON CONFLICT (county, state_code) DO NOTHING;

-- Placeholder entries for other metro Atlanta counties
INSERT INTO property_data_coverage (
  county,
  state_code,
  total_parcels,
  scraped_count,
  api_status,
  notes
) VALUES 
  ('DeKalb', 'GA', 280000, 0, 'not_configured', 'API research needed'),
  ('Gwinnett', 'GA', 320000, 0, 'not_configured', 'API research needed'),
  ('Cobb', 'GA', 270000, 0, 'not_configured', 'API research needed'),
  ('Forsyth', 'GA', 85000, 0, 'not_configured', 'API research needed'),
  ('Cherokee', 'GA', 95000, 0, 'not_configured', 'API research needed')
ON CONFLICT (county, state_code) DO NOTHING;

-- Function to update coverage stats
CREATE OR REPLACE FUNCTION update_county_coverage_stats(
  p_county VARCHAR(100),
  p_state_code VARCHAR(2)
) RETURNS VOID AS $$
BEGIN
  UPDATE property_data_coverage
  SET
    scraped_count = (
      SELECT COUNT(*)
      FROM property_records
      WHERE county = p_county AND state_code = p_state_code
    ),
    oldest_record_date = (
      SELECT MIN(scraped_at)
      FROM property_records
      WHERE county = p_county AND state_code = p_state_code
    ),
    newest_record_date = (
      SELECT MAX(scraped_at)
      FROM property_records
      WHERE county = p_county AND state_code = p_state_code
    ),
    stale_count = (
      SELECT COUNT(*)
      FROM property_records
      WHERE county = p_county 
        AND state_code = p_state_code
        AND scraped_at < NOW() - INTERVAL '30 days'
    ),
    updated_at = NOW()
  WHERE county = p_county AND state_code = p_state_code;
END;
$$ LANGUAGE plpgsql;

-- Function to log scrape activity
CREATE OR REPLACE FUNCTION log_scrape_activity(
  p_county VARCHAR(100),
  p_state_code VARCHAR(2),
  p_activity_type VARCHAR(50),
  p_attempted INTEGER,
  p_succeeded INTEGER,
  p_failed INTEGER,
  p_duration DECIMAL(10,2),
  p_triggered_by VARCHAR(50),
  p_user_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO scrape_activity_log (
    county,
    state_code,
    activity_type,
    properties_attempted,
    properties_succeeded,
    properties_failed,
    duration_seconds,
    avg_time_per_property_ms,
    triggered_by,
    triggered_by_user_id
  ) VALUES (
    p_county,
    p_state_code,
    p_activity_type,
    p_attempted,
    p_succeeded,
    p_failed,
    p_duration,
    CASE WHEN p_succeeded > 0 THEN (p_duration * 1000 / p_succeeded)::INTEGER ELSE NULL END,
    p_triggered_by,
    p_user_id
  ) RETURNING id INTO v_activity_id;
  
  -- Update daily/weekly/monthly counters
  UPDATE property_data_coverage
  SET
    scrapes_today = scrapes_today + p_succeeded,
    scrapes_this_week = scrapes_this_week + p_succeeded,
    scrapes_this_month = scrapes_this_month + p_succeeded,
    last_scrape_at = NOW(),
    success_rate_24h = (
      SELECT (SUM(properties_succeeded)::DECIMAL / NULLIF(SUM(properties_attempted), 0) * 100)
      FROM scrape_activity_log
      WHERE county = p_county 
        AND state_code = p_state_code
        AND created_at > NOW() - INTERVAL '24 hours'
    )
  WHERE county = p_county AND state_code = p_state_code;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql;

-- View: Coverage summary
CREATE OR REPLACE VIEW coverage_summary AS
SELECT
  county,
  state_code,
  total_parcels,
  scraped_count,
  coverage_percentage,
  api_status,
  CASE 
    WHEN stale_count > 1000 THEN 'critical'
    WHEN stale_count > 100 THEN 'warning'
    ELSE 'good'
  END as freshness_status,
  stale_count,
  scrapes_today,
  scrapes_this_week,
  last_scrape_at,
  EXTRACT(EPOCH FROM (NOW() - last_scrape_at))/3600 as hours_since_last_scrape,
  success_rate_24h,
  updated_at
FROM property_data_coverage
ORDER BY state_code, county;

-- View: Recent activity
CREATE OR REPLACE VIEW recent_scrape_activity AS
SELECT
  l.id,
  l.county,
  l.state_code,
  l.activity_type,
  l.properties_attempted,
  l.properties_succeeded,
  l.properties_failed,
  ROUND((l.properties_succeeded::DECIMAL / NULLIF(l.properties_attempted, 0) * 100), 2) as success_rate,
  l.duration_seconds,
  l.avg_time_per_property_ms,
  l.triggered_by,
  u.email as triggered_by_email,
  l.created_at
FROM scrape_activity_log l
LEFT JOIN users u ON l.triggered_by_user_id = u.id
ORDER BY l.created_at DESC
LIMIT 100;

-- Comments
COMMENT ON TABLE property_data_coverage IS 'Tracks property data coverage and API status per county';
COMMENT ON TABLE scrape_activity_log IS 'Logs all property scraping activity for monitoring and debugging';
COMMENT ON FUNCTION update_county_coverage_stats IS 'Updates coverage statistics for a specific county';
COMMENT ON FUNCTION log_scrape_activity IS 'Logs a scrape activity and updates coverage metrics';
COMMENT ON VIEW coverage_summary IS 'Summary view of property data coverage with freshness indicators';
COMMENT ON VIEW recent_scrape_activity IS 'Recent scraping activity with user context';
