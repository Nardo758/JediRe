-- ============================================================
-- JEDI RE ↔ Apartment Locator AI Integration Schema
-- Links deals to apartment market data via API
-- ============================================================

-- 1. Link deals to comparable apartment properties
CREATE TABLE IF NOT EXISTS deal_comparable_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Reference to Apartment Locator AI property (via API)
  apartment_property_id UUID NOT NULL,  -- ID from Apartment Locator AI
  apartment_property_name VARCHAR(255),
  apartment_property_address VARCHAR(500),
  
  -- Spatial relationship
  distance_miles DECIMAL(5,2),
  within_trade_area BOOLEAN DEFAULT false,
  
  -- Market comparison
  relevance_score INTEGER CHECK (relevance_score BETWEEN 0 AND 100),
  price_per_sqft DECIMAL(10,2),
  occupancy_rate DECIMAL(5,2),
  unit_mix_similarity DECIMAL(5,2),  -- How similar unit types are
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Cache market metrics by trade area
CREATE TABLE IF NOT EXISTS trade_area_market_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  trade_area_id INTEGER REFERENCES trade_areas(id) ON DELETE CASCADE,
  
  -- Aggregated from Apartment Locator AI properties
  properties_count INTEGER DEFAULT 0,
  avg_rent_studio DECIMAL(10,2),
  avg_rent_1br DECIMAL(10,2),
  avg_rent_2br DECIMAL(10,2),
  avg_rent_3br DECIMAL(10,2),
  avg_occupancy_rate DECIMAL(5,2),
  
  -- Market trends (from historical data)
  rent_growth_6mo DECIMAL(5,2),  -- % growth
  rent_growth_12mo DECIMAL(5,2),
  rent_growth_24mo DECIMAL(5,2),
  
  -- Supply metrics
  total_units INTEGER,
  available_units INTEGER,
  
  -- Calculated from data
  market_saturation DECIMAL(5,2),  -- % of market captured
  competition_intensity VARCHAR(50),  -- LOW/MEDIUM/HIGH
  
  -- Sync tracking
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_freshness VARCHAR(50)  -- FRESH/STALE/OLD
);

-- 3. Historical market snapshots (track changes over time)
CREATE TABLE IF NOT EXISTS market_metric_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_area_id INTEGER REFERENCES trade_areas(id) ON DELETE CASCADE,
  
  -- Snapshot data
  snapshot_date DATE NOT NULL,
  avg_rent DECIMAL(10,2),
  avg_occupancy DECIMAL(5,2),
  properties_count INTEGER,
  available_units INTEGER,
  
  -- Source
  source VARCHAR(50) DEFAULT 'apartment_locator_ai',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(trade_area_id, snapshot_date)
);

-- 4. API sync status (track last successful syncs)
CREATE TABLE IF NOT EXISTS apartment_api_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Sync details
  sync_type VARCHAR(50),  -- 'comps', 'metrics', 'full'
  status VARCHAR(50),  -- 'success', 'failed', 'partial'
  records_synced INTEGER,
  error_message TEXT,
  
  -- API metadata
  api_endpoint VARCHAR(255),
  response_time_ms INTEGER,
  
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_deal_comps_deal_id ON deal_comparable_properties(deal_id);
CREATE INDEX idx_deal_comps_distance ON deal_comparable_properties(distance_miles);
CREATE INDEX idx_deal_comps_relevance ON deal_comparable_properties(relevance_score DESC);
CREATE INDEX idx_trade_metrics_deal ON trade_area_market_metrics(deal_id);
CREATE INDEX idx_trade_metrics_area ON trade_area_market_metrics(trade_area_id);
CREATE INDEX idx_market_history_date ON market_metric_history(snapshot_date DESC);
CREATE INDEX idx_sync_log_deal ON apartment_api_sync_log(deal_id);
CREATE INDEX idx_sync_log_status ON apartment_api_sync_log(status, synced_at DESC);

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_apartment_integration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_deal_comps_timestamp
BEFORE UPDATE ON deal_comparable_properties
FOR EACH ROW EXECUTE FUNCTION update_apartment_integration_timestamp();

-- Views for easy querying
CREATE OR REPLACE VIEW deal_market_summary AS
SELECT 
  d.id as deal_id,
  d.property_name as deal_name,
  tm.properties_count,
  tm.avg_rent_1br,
  tm.avg_rent_2br,
  tm.avg_occupancy_rate,
  tm.rent_growth_12mo,
  tm.market_saturation,
  tm.competition_intensity,
  tm.calculated_at as metrics_updated,
  COUNT(dcp.id) as comparable_properties_count,
  AVG(dcp.relevance_score) as avg_comp_relevance
FROM deals d
LEFT JOIN trade_area_market_metrics tm ON tm.deal_id = d.id
LEFT JOIN deal_comparable_properties dcp ON dcp.deal_id = d.id
GROUP BY d.id, d.property_name, tm.properties_count, tm.avg_rent_1br, 
         tm.avg_rent_2br, tm.avg_occupancy_rate, tm.rent_growth_12mo,
         tm.market_saturation, tm.competition_intensity, tm.calculated_at;

COMMENT ON TABLE deal_comparable_properties IS 'Links JEDI RE deals to Apartment Locator AI properties for market comparison';
COMMENT ON TABLE trade_area_market_metrics IS 'Aggregated market metrics calculated from Apartment Locator AI data';
COMMENT ON TABLE market_metric_history IS 'Historical snapshots of market metrics over time';
COMMENT ON TABLE apartment_api_sync_log IS 'Tracks API sync operations with Apartment Locator AI';
