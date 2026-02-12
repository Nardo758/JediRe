-- Migration 017: Deal Auto-Triage System
-- Date: 2026-02-09
-- Description: Add triage_result column and supporting data for automatic deal scoring

-- ============================================================================
-- ADD TRIAGE RESULT COLUMN TO DEALS
-- ============================================================================
ALTER TABLE deals ADD COLUMN IF NOT EXISTS triage_result JSONB DEFAULT NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS triage_status VARCHAR(20) DEFAULT NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS triage_score INTEGER DEFAULT NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMP DEFAULT NULL;

CREATE INDEX idx_deals_triage_status ON deals(triage_status);
CREATE INDEX idx_deals_triage_score ON deals(triage_score DESC);
CREATE INDEX idx_deals_triaged_at ON deals(triaged_at DESC);

COMMENT ON COLUMN deals.triage_result IS 'JSONB object containing auto-triage analysis: score, status, strategies, risks, metrics';
COMMENT ON COLUMN deals.triage_status IS 'Quick triage status: Hot, Warm, Watch, Pass';
COMMENT ON COLUMN deals.triage_score IS 'Quick triage score (0-50 range)';
COMMENT ON COLUMN deals.triaged_at IS 'Timestamp when deal was last triaged';

-- ============================================================================
-- TRADE AREAS / SUBMARKETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS trade_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  municipality VARCHAR(100),
  state VARCHAR(50),
  boundary GEOMETRY(POLYGON, 4326),
  
  -- Market metrics
  avg_rent_growth DECIMAL(5,4), -- 0.0500 = 5%
  population_growth DECIMAL(5,4),
  job_growth DECIMAL(5,4),
  
  -- Quality scores
  location_quality_score DECIMAL(3,2), -- 0.00 to 1.00
  market_strength_score DECIMAL(3,2), -- 0.00 to 1.00
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trade_areas_boundary ON trade_areas USING GIST(boundary);
CREATE INDEX idx_trade_areas_name ON trade_areas(name);

COMMENT ON TABLE trade_areas IS 'Geographic trade areas/submarkets for deal assignment and market analysis';

-- ============================================================================
-- DEAL TRADE AREA ASSIGNMENT
-- ============================================================================
ALTER TABLE deals ADD COLUMN IF NOT EXISTS trade_area_id UUID REFERENCES trade_areas(id) ON DELETE SET NULL;
CREATE INDEX idx_deals_trade_area_id ON deals(trade_area_id);

COMMENT ON COLUMN deals.trade_area_id IS 'Assigned trade area/submarket based on deal location';

-- ============================================================================
-- HELPER FUNCTION: Find trade area for coordinates
-- ============================================================================
CREATE OR REPLACE FUNCTION find_trade_area(p_lat DECIMAL, p_lng DECIMAL)
RETURNS UUID AS $$
DECLARE
  v_trade_area_id UUID;
BEGIN
  SELECT id INTO v_trade_area_id
  FROM trade_areas
  WHERE ST_Contains(boundary, ST_Point(p_lng, p_lat))
  ORDER BY location_quality_score DESC NULLS LAST
  LIMIT 1;
  
  RETURN v_trade_area_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Auto-assign trade area to deal
-- ============================================================================
CREATE OR REPLACE FUNCTION assign_deal_trade_area(p_deal_id UUID)
RETURNS UUID AS $$
DECLARE
  v_centroid GEOMETRY;
  v_lat DECIMAL;
  v_lng DECIMAL;
  v_trade_area_id UUID;
BEGIN
  -- Get deal centroid
  SELECT ST_Centroid(boundary) INTO v_centroid
  FROM deals WHERE id = p_deal_id;
  
  -- Extract lat/lng
  v_lat := ST_Y(v_centroid);
  v_lng := ST_X(v_centroid);
  
  -- Find trade area
  v_trade_area_id := find_trade_area(v_lat, v_lng);
  
  -- Update deal
  IF v_trade_area_id IS NOT NULL THEN
    UPDATE deals SET trade_area_id = v_trade_area_id WHERE id = p_deal_id;
  END IF;
  
  RETURN v_trade_area_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED SOME SAMPLE TRADE AREAS (Atlanta metro)
-- ============================================================================
INSERT INTO trade_areas (name, municipality, state, boundary, avg_rent_growth, population_growth, job_growth, location_quality_score, market_strength_score, metadata)
VALUES
  -- Midtown
  ('Midtown Atlanta', 'Atlanta', 'GA', 
   ST_GeomFromText('POLYGON((-84.395 33.795, -84.375 33.795, -84.375 33.775, -84.395 33.775, -84.395 33.795))', 4326),
   0.0650, 0.0320, 0.0450, 0.90, 0.85,
   '{"description": "Prime urban core with high demand", "avg_rent_psf": 2.45}'::jsonb),
   
  -- Buckhead
  ('Buckhead', 'Atlanta', 'GA',
   ST_GeomFromText('POLYGON((-84.395 33.860, -84.375 33.860, -84.375 33.840, -84.395 33.840, -84.395 33.860))', 4326),
   0.0580, 0.0280, 0.0380, 0.95, 0.88,
   '{"description": "Luxury residential and retail hub", "avg_rent_psf": 2.80}'::jsonb),
   
  -- Downtown
  ('Downtown Atlanta', 'Atlanta', 'GA',
   ST_GeomFromText('POLYGON((-84.395 33.765, -84.375 33.765, -84.375 33.745, -84.395 33.745, -84.395 33.765))', 4326),
   0.0420, 0.0150, 0.0250, 0.75, 0.70,
   '{"description": "Central business district, mixed signals", "avg_rent_psf": 1.95}'::jsonb),
   
  -- Inman Park
  ('Inman Park/Old Fourth Ward', 'Atlanta', 'GA',
   ST_GeomFromText('POLYGON((-84.360 33.770, -84.340 33.770, -84.340 33.750, -84.360 33.750, -84.360 33.770))', 4326),
   0.0720, 0.0450, 0.0520, 0.82, 0.80,
   '{"description": "Emerging neighborhood with strong growth", "avg_rent_psf": 2.20}'::jsonb),
   
  -- Westside
  ('Westside', 'Atlanta', 'GA',
   ST_GeomFromText('POLYGON((-84.420 33.780, -84.400 33.780, -84.400 33.760, -84.420 33.760, -84.420 33.780))', 4326),
   0.0550, 0.0310, 0.0400, 0.78, 0.75,
   '{"description": "Up-and-coming mixed-use area", "avg_rent_psf": 2.10}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON trade_areas TO jedire_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO jedire_app;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
COMMENT ON SCHEMA public IS 'JEDI RE deal-centric architecture - Migration 017 (Triage System) applied 2026-02-09';
