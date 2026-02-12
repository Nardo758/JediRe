-- Migration 021: Geographic Assignment Engine for News Intelligence
-- Purpose: Complete geographic hierarchy with PostGIS for event assignment
-- Created: 2026-02-10

-- Enable PostGIS (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- CORE GEOGRAPHIC TABLES
-- ============================================

-- MSAs (Metropolitan Statistical Areas)
CREATE TABLE IF NOT EXISTS msas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cbsa_code VARCHAR(10) UNIQUE,
    state_codes TEXT[],
    
    -- PostGIS geometry
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    centroid GEOMETRY(POINT, 4326),
    
    -- Demographics
    population INTEGER,
    median_household_income DECIMAL(10,2),
    
    -- Market stats (cached)
    total_properties INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    avg_occupancy DECIMAL(5,2),
    avg_rent DECIMAL(10,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Submarkets (neighborhood/district groupings)
CREATE TABLE IF NOT EXISTS submarkets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    msa_id INTEGER REFERENCES msas(id) ON DELETE CASCADE,
    
    -- PostGIS geometry (can be non-contiguous)
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    centroid GEOMETRY(POINT, 4326),
    
    -- Data source
    source VARCHAR(100) DEFAULT 'manual', -- 'costar', 'manual', 'census'
    external_id VARCHAR(100),
    
    -- Market stats (cached)
    properties_count INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    avg_occupancy DECIMAL(5,2),
    avg_rent DECIMAL(10,2),
    avg_cap_rate DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_submarket_name_msa UNIQUE (name, msa_id)
);

-- Trade Areas (1-5 mile radius polygons around properties)
CREATE TABLE IF NOT EXISTS trade_areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    
    -- PostGIS geometry
    geometry GEOMETRY(POLYGON, 4326) NOT NULL,
    centroid GEOMETRY(POINT, 4326),
    
    -- Definition method
    definition_method VARCHAR(50) NOT NULL 
        CHECK (definition_method IN ('radius', 'drive_time', 'isochrone', 'custom_draw')),
    method_params JSONB, -- {radius_miles: 3, minutes: 10, mode: 'driving'}
    
    -- Quality/confidence
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Market stats snapshot (cached)
    stats_snapshot JSONB,
    
    -- Sharing
    is_shared BOOLEAN DEFAULT false,
    team_id INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Geographic Relationships (links trade areas to submarkets to MSAs)
CREATE TABLE IF NOT EXISTS geographic_relationships (
    id SERIAL PRIMARY KEY,
    trade_area_id INTEGER REFERENCES trade_areas(id) ON DELETE CASCADE,
    submarket_id INTEGER REFERENCES submarkets(id) ON DELETE CASCADE,
    msa_id INTEGER REFERENCES msas(id) ON DELETE CASCADE,
    
    -- Relationship metadata
    overlap_pct DECIMAL(5,2), -- % of trade area that overlaps with submarket
    is_primary BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_trade_area_relationships UNIQUE (trade_area_id, submarket_id)
);

-- ============================================
-- NEWS EVENT GEOGRAPHIC LINKAGE
-- ============================================

-- Add geographic foreign keys to news_events table (if they don't exist)
DO $$
BEGIN
    -- Add trade_area_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'news_events' AND column_name = 'trade_area_id'
    ) THEN
        ALTER TABLE news_events ADD COLUMN trade_area_id INTEGER REFERENCES trade_areas(id) ON DELETE SET NULL;
        CREATE INDEX idx_news_events_trade_area ON news_events(trade_area_id);
    END IF;
    
    -- Add submarket_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'news_events' AND column_name = 'submarket_id'
    ) THEN
        ALTER TABLE news_events ADD COLUMN submarket_id INTEGER REFERENCES submarkets(id) ON DELETE SET NULL;
        CREATE INDEX idx_news_events_submarket ON news_events(submarket_id);
    END IF;
    
    -- Add msa_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'news_events' AND column_name = 'msa_id'
    ) THEN
        ALTER TABLE news_events ADD COLUMN msa_id INTEGER REFERENCES msas(id) ON DELETE SET NULL;
        CREATE INDEX idx_news_events_msa ON news_events(msa_id);
    END IF;
    
    -- Add geographic_tier column (pin_drop, area, metro)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'news_events' AND column_name = 'geographic_tier'
    ) THEN
        ALTER TABLE news_events ADD COLUMN geographic_tier VARCHAR(20) 
            CHECK (geographic_tier IN ('pin_drop', 'area', 'metro'));
        CREATE INDEX idx_news_events_geo_tier ON news_events(geographic_tier);
    END IF;
END $$;

-- Trade Area Event Impacts (many-to-many with decay scores)
CREATE TABLE IF NOT EXISTS trade_area_event_impacts (
    id SERIAL PRIMARY KEY,
    trade_area_id INTEGER NOT NULL REFERENCES trade_areas(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
    
    -- Impact calculation
    impact_type VARCHAR(20) NOT NULL, -- 'direct', 'proximity', 'sector', 'metro'
    distance_miles DECIMAL(8,2),
    
    -- 4-Factor Decay Score (Proximity 30%, Sector 30%, Absorption 25%, Temporal 15%)
    proximity_score DECIMAL(5,2) DEFAULT 0, -- 0-100
    sector_score DECIMAL(5,2) DEFAULT 0,    -- 0-100
    absorption_score DECIMAL(5,2) DEFAULT 0, -- 0-100
    temporal_score DECIMAL(5,2) DEFAULT 0,  -- 0-100
    
    -- Weighted composite
    decay_score DECIMAL(5,2) DEFAULT 0, -- 0-100 (weighted average)
    
    -- Final impact (Event Magnitude × Decay Score)
    impact_score DECIMAL(8,2) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_trade_area_event UNIQUE (trade_area_id, event_id)
);

-- ============================================
-- SPATIAL INDEXES (CRITICAL FOR PERFORMANCE)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_msas_geometry ON msas USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_msas_centroid ON msas USING GIST(centroid);
CREATE INDEX IF NOT EXISTS idx_submarkets_geometry ON submarkets USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_submarkets_centroid ON submarkets USING GIST(centroid);
CREATE INDEX IF NOT EXISTS idx_submarkets_msa ON submarkets(msa_id);
CREATE INDEX IF NOT EXISTS idx_trade_areas_geometry ON trade_areas USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_trade_areas_centroid ON trade_areas USING GIST(centroid);
CREATE INDEX IF NOT EXISTS idx_trade_areas_user ON trade_areas(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_areas_property ON trade_areas(property_id);

-- Geographic relationships indexes
CREATE INDEX IF NOT EXISTS idx_geo_relationships_trade_area ON geographic_relationships(trade_area_id);
CREATE INDEX IF NOT EXISTS idx_geo_relationships_submarket ON geographic_relationships(submarket_id);
CREATE INDEX IF NOT EXISTS idx_geo_relationships_msa ON geographic_relationships(msa_id);

-- Event impacts indexes
CREATE INDEX IF NOT EXISTS idx_trade_area_impacts_trade_area ON trade_area_event_impacts(trade_area_id);
CREATE INDEX IF NOT EXISTS idx_trade_area_impacts_event ON trade_area_event_impacts(event_id);
CREATE INDEX IF NOT EXISTS idx_trade_area_impacts_type ON trade_area_event_impacts(impact_type);
CREATE INDEX IF NOT EXISTS idx_trade_area_impacts_score ON trade_area_event_impacts(impact_score DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function: Find submarket by point containment
CREATE OR REPLACE FUNCTION find_submarket_for_point(lat DOUBLE PRECISION, lng DOUBLE PRECISION)
RETURNS TABLE (
    submarket_id INTEGER,
    submarket_name VARCHAR(255),
    msa_id INTEGER,
    msa_name VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id AS submarket_id,
        s.name AS submarket_name,
        m.id AS msa_id,
        m.name AS msa_name
    FROM submarkets s
    JOIN msas m ON s.msa_id = m.id
    WHERE ST_Contains(s.geometry, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
    ORDER BY s.id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Find MSA by point containment
CREATE OR REPLACE FUNCTION find_msa_for_point(lat DOUBLE PRECISION, lng DOUBLE PRECISION)
RETURNS TABLE (
    msa_id INTEGER,
    msa_name VARCHAR(255),
    cbsa_code VARCHAR(10)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id AS msa_id,
        m.name AS msa_name,
        m.cbsa_code
    FROM msas m
    WHERE ST_Contains(m.geometry, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
    ORDER BY m.id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Find all trade areas containing a point
CREATE OR REPLACE FUNCTION find_trade_areas_for_point(lat DOUBLE PRECISION, lng DOUBLE PRECISION)
RETURNS TABLE (
    trade_area_id INTEGER,
    trade_area_name VARCHAR(255),
    distance_miles DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ta.id AS trade_area_id,
        ta.name AS trade_area_name,
        ST_Distance(
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
            ta.centroid::geography
        ) / 1609.34 AS distance_miles
    FROM trade_areas ta
    WHERE ST_Contains(ta.geometry, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
    ORDER BY distance_miles;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate centroid after geometry insert/update
CREATE OR REPLACE FUNCTION update_centroid()
RETURNS TRIGGER AS $$
BEGIN
    NEW.centroid = ST_Centroid(NEW.geometry);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-calculate centroids
DROP TRIGGER IF EXISTS trigger_msa_centroid ON msas;
CREATE TRIGGER trigger_msa_centroid
    BEFORE INSERT OR UPDATE OF geometry ON msas
    FOR EACH ROW
    EXECUTE FUNCTION update_centroid();

DROP TRIGGER IF EXISTS trigger_submarket_centroid ON submarkets;
CREATE TRIGGER trigger_submarket_centroid
    BEFORE INSERT OR UPDATE OF geometry ON submarkets
    FOR EACH ROW
    EXECUTE FUNCTION update_centroid();

DROP TRIGGER IF EXISTS trigger_trade_area_centroid ON trade_areas;
CREATE TRIGGER trigger_trade_area_centroid
    BEFORE INSERT OR UPDATE OF geometry ON trade_areas
    FOR EACH ROW
    EXECUTE FUNCTION update_centroid();

-- Auto-update timestamps
DROP TRIGGER IF EXISTS trigger_msa_updated_at ON msas;
CREATE TRIGGER trigger_msa_updated_at
    BEFORE UPDATE ON msas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_submarket_updated_at ON submarkets;
CREATE TRIGGER trigger_submarket_updated_at
    BEFORE UPDATE ON submarkets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_trade_area_updated_at ON trade_areas;
CREATE TRIGGER trigger_trade_area_updated_at
    BEFORE UPDATE ON trade_areas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE COMMENTS (DOCUMENTATION)
-- ============================================

COMMENT ON TABLE msas IS 'Metropolitan Statistical Areas (Census Bureau definitions) - broadest geographic context';
COMMENT ON TABLE submarkets IS 'Neighborhood/district groupings (e.g., Buckhead, Midtown) - mid-level context';
COMMENT ON TABLE trade_areas IS 'User-defined competitive boundaries around properties (1-5 mile radius or custom) - finest granularity';
COMMENT ON TABLE geographic_relationships IS 'Links trade areas to submarkets to MSAs (hierarchical relationships)';
COMMENT ON TABLE trade_area_event_impacts IS 'Event impact scores with 4-factor decay calculation';

COMMENT ON COLUMN trade_areas.definition_method IS 'How trade area was created: radius, drive_time, isochrone, custom_draw';
COMMENT ON COLUMN trade_areas.method_params IS 'JSON params: {radius_miles: 3, minutes: 10, mode: "driving"}';
COMMENT ON COLUMN trade_areas.confidence_score IS 'Quality/confidence score 0-1';

COMMENT ON COLUMN trade_area_event_impacts.proximity_score IS 'Distance-based score (30% weight): closer = higher';
COMMENT ON COLUMN trade_area_event_impacts.sector_score IS 'Sector alignment score (30% weight): same sector = higher';
COMMENT ON COLUMN trade_area_event_impacts.absorption_score IS 'Market absorption capacity (25% weight): tighter market = higher impact';
COMMENT ON COLUMN trade_area_event_impacts.temporal_score IS 'Time decay (15% weight): recent = higher';
COMMENT ON COLUMN trade_area_event_impacts.decay_score IS 'Weighted composite of all 4 factors (0-100)';
COMMENT ON COLUMN trade_area_event_impacts.impact_score IS 'Event Magnitude × Decay Score = final impact on trade area';
