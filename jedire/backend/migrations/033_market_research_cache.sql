-- Migration 033: Market Research Cache Table
-- Created: 2026-02-18
-- Purpose: Cache market research data for leasing traffic predictions

-- Market research cache for submarket demand metrics
CREATE TABLE IF NOT EXISTS market_research_cache (
  id SERIAL PRIMARY KEY,
  submarket_id VARCHAR(100) NOT NULL,
  
  -- Supply/demand metrics
  supply_demand_ratio DECIMAL(5,2) NOT NULL,  -- 0.5 = oversupplied, 1.5 = undersupplied
  market_condition VARCHAR(50),  -- 'undersupplied', 'balanced', 'oversupplied'
  
  -- Additional market context
  total_units INT,
  pipeline_units INT,
  absorption_rate DECIMAL(5,2),  -- Units per month
  avg_rent DECIMAL(8,2),
  rent_growth_yoy DECIMAL(5,2),  -- Year-over-year %
  
  -- Metadata
  data_source VARCHAR(100),  -- 'market_research_engine', 'manual', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT unique_submarket_date UNIQUE(submarket_id, created_at)
);

-- Index for fast lookups by submarket
CREATE INDEX idx_market_research_submarket ON market_research_cache(submarket_id);

-- Index for date-based queries (get latest data)
CREATE INDEX idx_market_research_date ON market_research_cache(created_at DESC);

-- Composite index for the exact query used by multifamilyTrafficService
CREATE INDEX idx_market_research_lookup ON market_research_cache(submarket_id, created_at DESC);

-- Add comment
COMMENT ON TABLE market_research_cache IS 'Cached market research data from Market Research Engine for leasing traffic predictions';

-- Sample data for testing (optional - remove in production)
INSERT INTO market_research_cache (
  submarket_id,
  supply_demand_ratio,
  market_condition,
  total_units,
  pipeline_units,
  absorption_rate,
  avg_rent,
  rent_growth_yoy,
  data_source
) VALUES 
  ('atlanta-buckhead', 1.35, 'undersupplied', 8500, 1200, 85, 2150.00, 4.5, 'sample_data'),
  ('atlanta-midtown', 1.15, 'balanced', 12000, 800, 120, 2350.00, 5.2, 'sample_data'),
  ('atlanta-downtown', 0.75, 'oversupplied', 6200, 2400, 45, 1950.00, 1.8, 'sample_data')
ON CONFLICT (submarket_id, created_at) DO NOTHING;
