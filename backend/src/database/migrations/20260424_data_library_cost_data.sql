-- ============================================================================
-- DATA LIBRARY COST DATA
-- Migration: 20260424_data_library_cost_data.sql
-- 
-- Stores user-uploaded construction cost data for the replacement cost engine.
-- Types: GC bids, actual project costs, construction estimates, renovation costs
-- ============================================================================

-- ============================================================================
-- PART 1: COST DATA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_library_cost_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to Data Library asset (the uploaded file)
  asset_id UUID REFERENCES data_library_assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Property identification (for matching)
  property_name VARCHAR(255),
  address VARCHAR(255),
  city VARCHAR(100),
  county VARCHAR(100),
  state VARCHAR(2) NOT NULL,
  zip VARCHAR(10),
  
  -- Property characteristics
  units INTEGER,
  square_footage INTEGER,
  stories INTEGER,
  year_built INTEGER,
  asset_class VARCHAR(10), -- A, B, C
  construction_type VARCHAR(50), -- wood_frame, masonry, steel_frame, concrete
  
  -- Cost data
  cost_type VARCHAR(50) NOT NULL, -- gc_bid, actual_cost, estimate, renovation, development
  total_cost NUMERIC(14,2),
  cost_per_sf NUMERIC(10,2),
  cost_per_unit NUMERIC(12,2),
  
  -- Cost breakdown (optional)
  hard_costs NUMERIC(14,2),
  soft_costs NUMERIC(14,2),
  land_cost NUMERIC(14,2),
  contingency NUMERIC(14,2),
  
  -- Detailed breakdown (JSONB for flexibility)
  cost_breakdown JSONB,
  -- Example: {
  --   "sitework": 500000,
  --   "foundation": 800000,
  --   "framing": 2000000,
  --   "mep": 1500000,
  --   "finishes": 1200000,
  --   "amenities": 400000
  -- }
  
  -- Source metadata
  source_type VARCHAR(50), -- uploaded_document, manual_entry, extracted
  source_document VARCHAR(255), -- filename or description
  contractor_name VARCHAR(255),
  
  -- Date context
  as_of_date DATE NOT NULL, -- When was this cost valid
  bid_date DATE,
  project_start_date DATE,
  project_end_date DATE,
  
  -- Quality indicators
  confidence VARCHAR(20) DEFAULT 'medium', -- high, medium, low
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  
  -- Notes
  notes TEXT,
  scope_notes TEXT, -- What's included/excluded
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for queries
CREATE INDEX idx_cost_data_state ON data_library_cost_data(state);
CREATE INDEX idx_cost_data_city ON data_library_cost_data(city);
CREATE INDEX idx_cost_data_county ON data_library_cost_data(county);
CREATE INDEX idx_cost_data_asset_class ON data_library_cost_data(asset_class);
CREATE INDEX idx_cost_data_cost_type ON data_library_cost_data(cost_type);
CREATE INDEX idx_cost_data_as_of_date ON data_library_cost_data(as_of_date);
CREATE INDEX idx_cost_data_user ON data_library_cost_data(user_id);
CREATE INDEX idx_cost_data_asset ON data_library_cost_data(asset_id);

-- For replacement cost queries
CREATE INDEX idx_cost_data_market_lookup ON data_library_cost_data(state, city, as_of_date, cost_per_sf);

-- ============================================================================
-- PART 2: COST DATA AGGREGATES (for faster queries)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_data_market_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Geography
  market VARCHAR(100) NOT NULL, -- city or county
  state VARCHAR(2) NOT NULL,
  
  -- Aggregation period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Stats
  sample_size INTEGER NOT NULL,
  median_cost_per_sf NUMERIC(10,2),
  avg_cost_per_sf NUMERIC(10,2),
  p25_cost_per_sf NUMERIC(10,2),
  p75_cost_per_sf NUMERIC(10,2),
  min_cost_per_sf NUMERIC(10,2),
  max_cost_per_sf NUMERIC(10,2),
  
  -- By asset class
  class_a_median NUMERIC(10,2),
  class_a_count INTEGER,
  class_b_median NUMERIC(10,2),
  class_b_count INTEGER,
  class_c_median NUMERIC(10,2),
  class_c_count INTEGER,
  
  -- By cost type
  gc_bid_median NUMERIC(10,2),
  gc_bid_count INTEGER,
  actual_cost_median NUMERIC(10,2),
  actual_count INTEGER,
  
  -- Metadata
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT uq_cost_aggregate_market_period UNIQUE (market, state, period_start, period_end)
);

CREATE INDEX idx_cost_aggregates_market ON cost_data_market_aggregates(market, state);
CREATE INDEX idx_cost_aggregates_period ON cost_data_market_aggregates(period_end);

-- ============================================================================
-- PART 3: COST TYPE ENUM (for reference)
-- ============================================================================

COMMENT ON TABLE data_library_cost_data IS 'User-uploaded construction cost data for replacement cost estimation';

COMMENT ON COLUMN data_library_cost_data.cost_type IS 'Type of cost data:
- gc_bid: General contractor bid/proposal
- actual_cost: Actual completed project cost
- estimate: Internal estimate or budget
- renovation: Renovation/rehab cost (not new construction)
- development: Full development cost including land';

COMMENT ON COLUMN data_library_cost_data.confidence IS 'Data quality indicator:
- high: Verified actual cost or signed contract
- medium: Bid/estimate from reputable source
- low: Rough estimate or old data';

-- ============================================================================
-- PART 4: TRIGGER TO COMPUTE cost_per_sf IF NOT PROVIDED
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_cost_per_sf()
RETURNS TRIGGER AS $$
BEGIN
  -- If cost_per_sf not provided, calculate from total_cost and square_footage
  IF NEW.cost_per_sf IS NULL AND NEW.total_cost IS NOT NULL AND NEW.square_footage > 0 THEN
    NEW.cost_per_sf := NEW.total_cost / NEW.square_footage;
  END IF;
  
  -- If cost_per_unit not provided, calculate from total_cost and units
  IF NEW.cost_per_unit IS NULL AND NEW.total_cost IS NOT NULL AND NEW.units > 0 THEN
    NEW.cost_per_unit := NEW.total_cost / NEW.units;
  END IF;
  
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_compute_cost_per_sf
  BEFORE INSERT OR UPDATE ON data_library_cost_data
  FOR EACH ROW
  EXECUTE FUNCTION compute_cost_per_sf();

-- ============================================================================
-- PART 5: FUNCTION TO REFRESH MARKET AGGREGATES
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_cost_data_aggregates(
  p_market VARCHAR DEFAULT NULL,
  p_state VARCHAR DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Delete existing aggregates for the market (if specified)
  IF p_market IS NOT NULL AND p_state IS NOT NULL THEN
    DELETE FROM cost_data_market_aggregates 
    WHERE market = p_market AND state = p_state;
  ELSE
    DELETE FROM cost_data_market_aggregates;
  END IF;
  
  -- Insert fresh aggregates
  INSERT INTO cost_data_market_aggregates (
    market, state, period_start, period_end,
    sample_size, median_cost_per_sf, avg_cost_per_sf,
    p25_cost_per_sf, p75_cost_per_sf, min_cost_per_sf, max_cost_per_sf,
    class_a_median, class_a_count,
    class_b_median, class_b_count,
    class_c_median, class_c_count,
    gc_bid_median, gc_bid_count,
    actual_cost_median, actual_count
  )
  SELECT 
    COALESCE(city, county) as market,
    state,
    MIN(as_of_date) as period_start,
    MAX(as_of_date) as period_end,
    COUNT(*) as sample_size,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_per_sf) as median_cost_per_sf,
    AVG(cost_per_sf) as avg_cost_per_sf,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cost_per_sf) as p25_cost_per_sf,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cost_per_sf) as p75_cost_per_sf,
    MIN(cost_per_sf) as min_cost_per_sf,
    MAX(cost_per_sf) as max_cost_per_sf,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_per_sf) FILTER (WHERE asset_class = 'A') as class_a_median,
    COUNT(*) FILTER (WHERE asset_class = 'A') as class_a_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_per_sf) FILTER (WHERE asset_class = 'B') as class_b_median,
    COUNT(*) FILTER (WHERE asset_class = 'B') as class_b_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_per_sf) FILTER (WHERE asset_class = 'C') as class_c_median,
    COUNT(*) FILTER (WHERE asset_class = 'C') as class_c_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_per_sf) FILTER (WHERE cost_type = 'gc_bid') as gc_bid_median,
    COUNT(*) FILTER (WHERE cost_type = 'gc_bid') as gc_bid_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_per_sf) FILTER (WHERE cost_type = 'actual_cost') as actual_cost_median,
    COUNT(*) FILTER (WHERE cost_type = 'actual_cost') as actual_count
  FROM data_library_cost_data
  WHERE cost_per_sf > 50 AND cost_per_sf < 500
    AND as_of_date > NOW() - INTERVAL '36 months'
    AND (p_market IS NULL OR city ILIKE '%' || p_market || '%' OR county ILIKE '%' || p_market || '%')
    AND (p_state IS NULL OR state = p_state)
  GROUP BY COALESCE(city, county), state
  HAVING COUNT(*) >= 3;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 6: SAMPLE DATA FOR TESTING
-- ============================================================================

-- Will be populated by actual user uploads through Data Library
