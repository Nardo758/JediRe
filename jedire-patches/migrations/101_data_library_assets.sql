-- Migration 101: Data Library Structured Asset Schema
-- Enables like-kind comp matching for AI agents

-- ═══════════════════════════════════════════════════════════════════════════
-- MAIN ASSET TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS data_library_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source Reference
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  source_type VARCHAR(50) NOT NULL DEFAULT 'manual',
  -- 'owned_deal', 'market_comp', 'broker_om', 'costar', 'manual'
  
  -- ─────────────────────────────────────────────────────────────────────────
  -- LOCATION
  -- ─────────────────────────────────────────────────────────────────────────
  property_name VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  county VARCHAR(100),
  
  -- Geographic hierarchy
  msa_id INTEGER,
  msa_name VARCHAR(255),
  submarket_id INTEGER,
  submarket_name VARCHAR(255),
  
  -- Coordinates
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  
  -- ─────────────────────────────────────────────────────────────────────────
  -- PHYSICAL CHARACTERISTICS
  -- ─────────────────────────────────────────────────────────────────────────
  
  -- Property Type
  property_type VARCHAR(50),
  -- 'multifamily', 'btr', 'student', 'senior', 'affordable', 'mixed_use'
  property_subtype VARCHAR(50),
  -- 'garden', 'wrap', 'podium', 'tower', 'townhome', 'duplex'
  
  -- Vintage
  year_built INTEGER,
  year_renovated INTEGER,
  vintage_tier VARCHAR(20) GENERATED ALWAYS AS (
    CASE 
      WHEN year_built < 1980 THEN 'pre-1980'
      WHEN year_built < 2000 THEN '1980-1999'
      WHEN year_built < 2010 THEN '2000-2009'
      WHEN year_built < 2020 THEN '2010-2019'
      ELSE '2020+'
    END
  ) STORED,
  
  -- Size
  unit_count INTEGER,
  net_rentable_sqft INTEGER,
  avg_unit_sqft INTEGER,
  lot_size_acres DECIMAL(10, 2),
  
  -- Height/Density
  stories INTEGER,
  height_class VARCHAR(20) GENERATED ALWAYS AS (
    CASE 
      WHEN stories <= 3 THEN 'garden'
      WHEN stories <= 6 THEN 'low-rise'
      WHEN stories <= 12 THEN 'mid-rise'
      ELSE 'high-rise'
    END
  ) STORED,
  density_units_per_acre DECIMAL(10, 2),
  
  -- Construction
  construction_type VARCHAR(50),
  -- 'wood-frame', 'concrete', 'steel', 'masonry', 'hybrid'
  parking_type VARCHAR(50),
  -- 'surface', 'garage', 'podium', 'tuck-under', 'structured'
  parking_ratio DECIMAL(4, 2),
  
  -- Unit Mix (JSONB for flexibility)
  unit_mix JSONB DEFAULT '{}',
  -- {studio: 10, 1br: 50, 2br: 35, 3br: 5}
  avg_bedrooms DECIMAL(3, 2),
  
  -- ─────────────────────────────────────────────────────────────────────────
  -- CLASS & QUALITY
  -- ─────────────────────────────────────────────────────────────────────────
  asset_class VARCHAR(5),
  -- 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D'
  finish_level VARCHAR(20),
  -- 'luxury', 'upscale', 'standard', 'value', 'workforce'
  
  -- Amenities
  amenities JSONB DEFAULT '{}',
  -- {pool: true, fitness: true, clubhouse: true, dog_park: true, ...}
  amenity_score INTEGER,
  -- Computed 0-100
  
  -- ─────────────────────────────────────────────────────────────────────────
  -- OPERATIONS
  -- ─────────────────────────────────────────────────────────────────────────
  management_company VARCHAR(255),
  owner_operator VARCHAR(255),
  ownership_type VARCHAR(50),
  -- 'institutional', 'private', 'reit', 'syndicator', 'family_office'
  
  -- ─────────────────────────────────────────────────────────────────────────
  -- FINANCIAL DATA
  -- ─────────────────────────────────────────────────────────────────────────
  
  -- Rent Data
  avg_rent DECIMAL(10, 2),
  avg_rent_psf DECIMAL(10, 4),
  rent_by_unit_type JSONB DEFAULT '{}',
  -- {studio: 1200, 1br: 1450, 2br: 1800, 3br: 2200}
  rent_as_of_date DATE,
  
  -- Occupancy
  occupancy_rate DECIMAL(5, 2),
  occupancy_as_of_date DATE,
  
  -- NOI
  noi DECIMAL(15, 2),
  noi_per_unit DECIMAL(10, 2),
  expense_ratio DECIMAL(5, 4),
  noi_as_of_date DATE,
  
  -- Transaction Data (if sold)
  sale_price DECIMAL(15, 2),
  sale_date DATE,
  price_per_unit DECIMAL(10, 2),
  price_per_sqft DECIMAL(10, 2),
  cap_rate DECIMAL(5, 4),
  buyer VARCHAR(255),
  seller VARCHAR(255),
  
  -- ─────────────────────────────────────────────────────────────────────────
  -- METADATA
  -- ─────────────────────────────────────────────────────────────────────────
  data_quality_score INTEGER DEFAULT 0,
  -- 0-100, how complete is this record
  last_verified_date DATE,
  notes TEXT,
  tags TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES FOR COMP QUERIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Location indexes
CREATE INDEX idx_dla_msa ON data_library_assets(msa_id);
CREATE INDEX idx_dla_submarket ON data_library_assets(submarket_id);
CREATE INDEX idx_dla_location ON data_library_assets(msa_id, submarket_id, city);
CREATE INDEX idx_dla_state_city ON data_library_assets(state, city);

-- Physical characteristic indexes
CREATE INDEX idx_dla_type ON data_library_assets(property_type, property_subtype);
CREATE INDEX idx_dla_vintage ON data_library_assets(year_built);
CREATE INDEX idx_dla_vintage_tier ON data_library_assets(vintage_tier);
CREATE INDEX idx_dla_units ON data_library_assets(unit_count);
CREATE INDEX idx_dla_stories ON data_library_assets(stories);
CREATE INDEX idx_dla_height ON data_library_assets(height_class);

-- Quality indexes
CREATE INDEX idx_dla_class ON data_library_assets(asset_class);
CREATE INDEX idx_dla_management ON data_library_assets(management_company);

-- Financial indexes
CREATE INDEX idx_dla_rent ON data_library_assets(avg_rent);
CREATE INDEX idx_dla_sale ON data_library_assets(sale_date, sale_price);
CREATE INDEX idx_dla_cap_rate ON data_library_assets(cap_rate);

-- Source tracking
CREATE INDEX idx_dla_source ON data_library_assets(source_type);
CREATE INDEX idx_dla_deal ON data_library_assets(deal_id);

-- Full-text search on property name/address
CREATE INDEX idx_dla_search ON data_library_assets 
  USING GIN (to_tsvector('english', COALESCE(property_name, '') || ' ' || COALESCE(address, '')));

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Convert asset class to numeric for sorting/comparison
CREATE OR REPLACE FUNCTION asset_class_rank(class VARCHAR)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE class
    WHEN 'A+' THEN 1
    WHEN 'A' THEN 2
    WHEN 'A-' THEN 3
    WHEN 'B+' THEN 4
    WHEN 'B' THEN 5
    WHEN 'B-' THEN 6
    WHEN 'C+' THEN 7
    WHEN 'C' THEN 8
    WHEN 'C-' THEN 9
    WHEN 'D' THEN 10
    ELSE 11
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate similarity score between two assets
CREATE OR REPLACE FUNCTION calc_asset_similarity(
  target_id UUID,
  comp_id UUID
) RETURNS DECIMAL AS $$
DECLARE
  t RECORD;
  c RECORD;
  vintage_score DECIMAL;
  size_score DECIMAL;
  height_score DECIMAL;
  class_score DECIMAL;
  total_score DECIMAL;
BEGIN
  SELECT * INTO t FROM data_library_assets WHERE id = target_id;
  SELECT * INTO c FROM data_library_assets WHERE id = comp_id;
  
  -- Vintage score (±10 years preferred)
  vintage_score := CASE 
    WHEN ABS(COALESCE(c.year_built, 0) - COALESCE(t.year_built, 0)) <= 5 THEN 100
    WHEN ABS(COALESCE(c.year_built, 0) - COALESCE(t.year_built, 0)) <= 10 THEN 80
    WHEN ABS(COALESCE(c.year_built, 0) - COALESCE(t.year_built, 0)) <= 15 THEN 50
    ELSE 20
  END;
  
  -- Size score (±30% preferred)
  size_score := CASE
    WHEN c.unit_count BETWEEN t.unit_count * 0.7 AND t.unit_count * 1.3 THEN 100
    WHEN c.unit_count BETWEEN t.unit_count * 0.5 AND t.unit_count * 1.5 THEN 70
    ELSE 30
  END;
  
  -- Height score
  height_score := CASE
    WHEN c.height_class = t.height_class THEN 100
    WHEN ABS(COALESCE(c.stories, 0) - COALESCE(t.stories, 0)) <= 2 THEN 70
    ELSE 30
  END;
  
  -- Class score
  class_score := CASE
    WHEN c.asset_class = t.asset_class THEN 100
    WHEN ABS(asset_class_rank(c.asset_class) - asset_class_rank(t.asset_class)) = 1 THEN 70
    ELSE 30
  END;
  
  -- Weighted total (no proximity without PostGIS)
  total_score := (
    vintage_score * 0.25 +
    size_score * 0.25 +
    height_score * 0.20 +
    class_score * 0.30
  );
  
  RETURN total_score;
END;
$$ LANGUAGE plpgsql;

-- Find like-kind comps for an asset
CREATE OR REPLACE FUNCTION find_like_kind_comps(
  target_asset_id UUID,
  limit_count INTEGER DEFAULT 20
) RETURNS TABLE (
  asset_id UUID,
  property_name VARCHAR,
  city VARCHAR,
  unit_count INTEGER,
  year_built INTEGER,
  asset_class VARCHAR,
  avg_rent DECIMAL,
  cap_rate DECIMAL,
  similarity_score DECIMAL
) AS $$
DECLARE
  t RECORD;
BEGIN
  SELECT * INTO t FROM data_library_assets WHERE id = target_asset_id;
  
  RETURN QUERY
  SELECT 
    c.id,
    c.property_name,
    c.city,
    c.unit_count,
    c.year_built,
    c.asset_class,
    c.avg_rent,
    c.cap_rate,
    calc_asset_similarity(target_asset_id, c.id) as similarity_score
  FROM data_library_assets c
  WHERE c.id != target_asset_id
    AND c.msa_id = t.msa_id
    AND c.property_type = t.property_type
  ORDER BY similarity_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- DATA QUALITY SCORE TRIGGER
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION calc_data_quality_score()
RETURNS TRIGGER AS $$
DECLARE
  score INTEGER := 0;
BEGIN
  -- Location (25 points)
  IF NEW.address IS NOT NULL THEN score := score + 5; END IF;
  IF NEW.city IS NOT NULL THEN score := score + 5; END IF;
  IF NEW.msa_id IS NOT NULL THEN score := score + 10; END IF;
  IF NEW.submarket_id IS NOT NULL THEN score := score + 5; END IF;
  
  -- Physical (25 points)
  IF NEW.property_type IS NOT NULL THEN score := score + 5; END IF;
  IF NEW.year_built IS NOT NULL THEN score := score + 5; END IF;
  IF NEW.unit_count IS NOT NULL THEN score := score + 5; END IF;
  IF NEW.stories IS NOT NULL THEN score := score + 5; END IF;
  IF NEW.asset_class IS NOT NULL THEN score := score + 5; END IF;
  
  -- Financial (50 points)
  IF NEW.avg_rent IS NOT NULL THEN score := score + 15; END IF;
  IF NEW.occupancy_rate IS NOT NULL THEN score := score + 10; END IF;
  IF NEW.noi IS NOT NULL THEN score := score + 15; END IF;
  IF NEW.sale_price IS NOT NULL THEN score := score + 10; END IF;
  
  NEW.data_quality_score := score;
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_data_quality_score
  BEFORE INSERT OR UPDATE ON data_library_assets
  FOR EACH ROW
  EXECUTE FUNCTION calc_data_quality_score();

-- ═══════════════════════════════════════════════════════════════════════════
-- AUTO-POPULATE FROM DEAL CLOSE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION populate_data_library_from_deal(p_deal_id UUID)
RETURNS UUID AS $$
DECLARE
  d RECORD;
  asset_id UUID;
BEGIN
  -- Get deal data
  SELECT * INTO d FROM deals WHERE id = p_deal_id;
  
  IF d IS NULL THEN
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;
  
  -- Insert into data library
  INSERT INTO data_library_assets (
    deal_id,
    source_type,
    property_name,
    address,
    city,
    state,
    msa_name,
    submarket_name,
    latitude,
    longitude,
    property_type,
    year_built,
    unit_count,
    created_by
  ) VALUES (
    p_deal_id,
    'owned_deal',
    d.name,
    d.address,
    d.city,
    COALESCE(d.state, d.state_code),
    (d.deal_data->>'msa_name')::VARCHAR,
    (d.deal_data->>'submarket_name')::VARCHAR,
    (d.deal_data->'coordinates'->>'lat')::DECIMAL,
    (d.deal_data->'coordinates'->>'lng')::DECIMAL,
    d.project_type,
    (d.deal_data->>'year_built')::INTEGER,
    (d.deal_data->>'units')::INTEGER,
    d.user_id
  )
  RETURNING id INTO asset_id;
  
  RETURN asset_id;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE data_library_assets IS 'Structured asset data for like-kind comp matching by AI agents';
COMMENT ON COLUMN data_library_assets.vintage_tier IS 'Auto-computed from year_built';
COMMENT ON COLUMN data_library_assets.height_class IS 'Auto-computed from stories';
COMMENT ON COLUMN data_library_assets.data_quality_score IS 'Auto-computed, 0-100 based on field completeness';
COMMENT ON FUNCTION find_like_kind_comps IS 'Find similar assets for comp analysis';
COMMENT ON FUNCTION populate_data_library_from_deal IS 'Auto-populate Data Library when deal closes';
