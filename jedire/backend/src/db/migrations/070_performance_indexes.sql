-- Performance Optimization Indexes
-- Created: 2026-03-03
-- Purpose: Add missing indexes for frequently queried columns

-- Property Records: Spatial index for PostGIS distance queries
-- This dramatically speeds up ST_DWithin and ST_Distance operations
CREATE INDEX IF NOT EXISTS idx_property_records_geography 
ON property_records USING GIST (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Property Records: Commonly filtered columns
CREATE INDEX IF NOT EXISTS idx_property_records_units ON property_records(units) 
WHERE units > 0;

CREATE INDEX IF NOT EXISTS idx_property_records_year_built ON property_records(year_built) 
WHERE year_built IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_records_property_class ON property_records(property_class) 
WHERE property_class IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_records_property_type ON property_records(property_type) 
WHERE property_type IS NOT NULL;

-- Deals: Spatial index for deal boundaries
CREATE INDEX IF NOT EXISTS idx_deals_boundary 
ON deals USING GIST (boundary) 
WHERE boundary IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deals_user_archived 
ON deals(user_id, archived_at) 
WHERE archived_at IS NULL;

-- Deal Properties: Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_deal_properties_deal_id ON deal_properties(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_properties_property_id ON deal_properties(property_id);

-- Deal Tasks: Status and deal lookup
CREATE INDEX IF NOT EXISTS idx_deal_tasks_deal_status ON deal_tasks(deal_id, status);
CREATE INDEX IF NOT EXISTS idx_deal_tasks_status ON deal_tasks(status) WHERE status != 'done';

-- News Events: Location-based queries
CREATE INDEX IF NOT EXISTS idx_news_events_location ON news_events(city, state);
CREATE INDEX IF NOT EXISTS idx_news_events_published ON news_events(published_at DESC);

-- MSAs: Spatial containment queries
CREATE INDEX IF NOT EXISTS idx_msas_geometry ON msas USING GIST (geometry) 
WHERE geometry IS NOT NULL;

-- Submarkets: Spatial proximity queries
CREATE INDEX IF NOT EXISTS idx_submarkets_geometry ON submarkets USING GIST (geometry) 
WHERE geometry IS NOT NULL;

-- Market Coverage: Market lookup
CREATE INDEX IF NOT EXISTS idx_market_coverage_market_id ON market_coverage_status(market_id);

-- User Market Preferences: User and active state
CREATE INDEX IF NOT EXISTS idx_user_market_prefs_user_active 
ON user_market_preferences(user_id, is_active) 
WHERE is_active = true;

-- Rankings performance
CREATE INDEX IF NOT EXISTS idx_property_records_multifamily_units 
ON property_records(property_type, units DESC) 
WHERE property_type = 'Multifamily' AND units > 50;

-- Comment explaining the performance impact
COMMENT ON INDEX idx_property_records_geography IS 
'GiST index for spatial queries. Speeds up ST_DWithin and competition analysis from O(n) to O(log n)';

COMMENT ON INDEX idx_property_records_multifamily_units IS 
'Composite index for rankings queries. Eliminates sequential scan for large result sets';
