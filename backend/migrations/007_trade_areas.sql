-- Migration: Trade Area Definition System
-- Created: 2026-02-07
-- Purpose: Geographic hierarchy (Trade Area, Submarket, MSA) for deal context

-- Enable PostGIS extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Trade areas table (user-defined competitive boundaries)
CREATE TABLE IF NOT EXISTS trade_areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    team_id INTEGER, -- Reference to teams if team sharing is implemented
    
    -- Geographic data (PostGIS geometry)
    geometry GEOMETRY(POLYGON, 4326) NOT NULL,
    
    -- Definition method and parameters
    definition_method VARCHAR(50) NOT NULL CHECK (definition_method IN ('radius', 'drive_time', 'traffic_informed', 'custom_draw')),
    method_params JSONB, -- {radius_miles: 3, traffic_adjusted: true, drive_time_minutes: 10, profile: 'driving'}
    
    -- Quality metrics
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1), -- 0.00 to 1.00
    
    -- Hierarchy linkage
    parent_submarket_id INTEGER REFERENCES submarkets(id) ON DELETE SET NULL,
    parent_msa_id INTEGER REFERENCES msas(id) ON DELETE SET NULL,
    
    -- Cached statistics (updated periodically)
    stats_snapshot JSONB, -- {population: 42850, existing_units: 8240, pipeline_units: 1200, avg_rent: 2150}
    
    -- Sharing
    is_shared BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deal geographic context (links deals to trade areas/submarkets/MSAs)
CREATE TABLE IF NOT EXISTS deal_geographic_context (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
    property_id INTEGER, -- Optional: link to specific property
    
    -- Three-tier hierarchy
    trade_area_id INTEGER REFERENCES trade_areas(id) ON DELETE SET NULL, -- NULL = use submarket default
    submarket_id INTEGER REFERENCES submarkets(id) ON DELETE SET NULL, -- Always populated (fallback)
    msa_id INTEGER REFERENCES msas(id) ON DELETE SET NULL, -- Always populated (broadest scope)
    
    -- Active scope for analytics (which level user is currently viewing)
    active_scope VARCHAR(20) DEFAULT 'submarket' CHECK (active_scope IN ('trade_area', 'submarket', 'msa')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_deal_context UNIQUE (deal_id)
);

-- Reference submarkets (industry-standard boundaries, e.g., CoStar)
CREATE TABLE IF NOT EXISTS submarkets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    msa_id INTEGER REFERENCES msas(id) ON DELETE CASCADE,
    
    -- Geographic boundary (can be multipolygon for non-contiguous areas)
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    
    -- Data source
    source VARCHAR(100) DEFAULT 'custom', -- 'costar', 'manual', 'custom'
    
    -- Cached market statistics
    properties_count INTEGER DEFAULT 0,
    avg_occupancy DECIMAL(5,2),
    avg_rent DECIMAL(10,2),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MSAs (Metropolitan Statistical Areas, Census-defined)
CREATE TABLE IF NOT EXISTS msas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cbsa_code VARCHAR(10) UNIQUE, -- Census Bureau Statistical Area code
    state_codes TEXT[], -- Array of state abbreviations (e.g., ['GA', 'AL'])
    
    -- Geographic boundary
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    
    -- Census data
    population INTEGER,
    median_household_income DECIMAL(10,2),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance

-- Spatial indexes (essential for fast geometric queries)
CREATE INDEX idx_trade_areas_geometry ON trade_areas USING GIST(geometry);
CREATE INDEX idx_submarkets_geometry ON submarkets USING GIST(geometry);
CREATE INDEX idx_msas_geometry ON msas USING GIST(geometry);

-- Foreign key indexes
CREATE INDEX idx_trade_areas_user ON trade_areas(user_id);
CREATE INDEX idx_trade_areas_team ON trade_areas(team_id);
CREATE INDEX idx_trade_areas_submarket ON trade_areas(parent_submarket_id);
CREATE INDEX idx_trade_areas_msa ON trade_areas(parent_msa_id);

CREATE INDEX idx_deal_geographic_context_deal ON deal_geographic_context(deal_id);
CREATE INDEX idx_deal_geographic_context_trade_area ON deal_geographic_context(trade_area_id);
CREATE INDEX idx_deal_geographic_context_submarket ON deal_geographic_context(submarket_id);
CREATE INDEX idx_deal_geographic_context_msa ON deal_geographic_context(msa_id);

CREATE INDEX idx_submarkets_msa ON submarkets(msa_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_trade_areas_updated_at
    BEFORE UPDATE ON trade_areas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deal_geographic_context_updated_at
    BEFORE UPDATE ON deal_geographic_context
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submarkets_updated_at
    BEFORE UPDATE ON submarkets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_msas_updated_at
    BEFORE UPDATE ON msas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed data: Atlanta MSA (example for testing)
INSERT INTO msas (name, cbsa_code, state_codes, geometry, population, median_household_income)
VALUES (
    'Atlanta-Sandy Springs-Roswell, GA',
    '12060',
    ARRAY['GA'],
    -- Simplified polygon (real data would come from Census TIGER/Line)
    ST_GeomFromText('MULTIPOLYGON(((-84.6 33.5, -84.6 34.1, -84.0 34.1, -84.0 33.5, -84.6 33.5)))', 4326),
    6144050,
    71936.00
) ON CONFLICT (cbsa_code) DO NOTHING;

-- Seed data: Example Atlanta submarkets
INSERT INTO submarkets (name, msa_id, geometry, source, properties_count, avg_occupancy, avg_rent)
VALUES 
    (
        'Midtown Atlanta',
        (SELECT id FROM msas WHERE cbsa_code = '12060'),
        ST_GeomFromText('MULTIPOLYGON(((-84.39 33.77, -84.39 33.80, -84.36 33.80, -84.36 33.77, -84.39 33.77)))', 4326),
        'manual',
        142,
        91.50,
        2150.00
    ),
    (
        'Buckhead',
        (SELECT id FROM msas WHERE cbsa_code = '12060'),
        ST_GeomFromText('MULTIPOLYGON(((-84.40 33.84, -84.40 33.87, -84.36 33.87, -84.36 33.84, -84.40 33.84)))', 4326),
        'manual',
        238,
        93.20,
        2380.00
    ),
    (
        'Virginia Highland',
        (SELECT id FROM msas WHERE cbsa_code = '12060'),
        ST_GeomFromText('MULTIPOLYGON(((-84.36 33.78, -84.36 33.81, -84.33 33.81, -84.33 33.78, -84.36 33.78)))', 4326),
        'manual',
        87,
        94.10,
        1950.00
    )
ON CONFLICT DO NOTHING;

-- Helper function: Find submarket for a point
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
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Find MSA for a point
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
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Get properties within trade area
CREATE OR REPLACE FUNCTION get_properties_in_trade_area(trade_area_id_param INTEGER)
RETURNS TABLE (
    property_id INTEGER,
    name VARCHAR(255),
    address TEXT,
    distance_miles DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS property_id,
        p.name,
        p.address,
        ST_Distance(
            p.location::geography,
            (SELECT ST_Centroid(geometry)::geography FROM trade_areas WHERE id = trade_area_id_param)
        ) / 1609.34 AS distance_miles
    FROM properties p
    WHERE ST_Within(
        p.location,
        (SELECT geometry FROM trade_areas WHERE id = trade_area_id_param)
    )
    ORDER BY distance_miles;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE trade_areas IS 'User-defined competitive boundaries around properties (1-10 mile radius or custom shapes)';
COMMENT ON TABLE deal_geographic_context IS 'Links deals to trade areas, submarkets, and MSAs (three-tier geographic hierarchy)';
COMMENT ON TABLE submarkets IS 'Industry-standard submarket boundaries (e.g., from CoStar) - default fallback if no trade area defined';
COMMENT ON TABLE msas IS 'Metropolitan Statistical Areas from Census Bureau - broadest geographic context';

COMMENT ON COLUMN trade_areas.definition_method IS 'How trade area was created: radius, drive_time, traffic_informed, custom_draw';
COMMENT ON COLUMN trade_areas.method_params IS 'JSON params for recreation: {radius_miles: 3, traffic_adjusted: true}';
COMMENT ON COLUMN trade_areas.confidence_score IS 'Quality score 0-1 based on data sources: high (>0.8), medium (0.5-0.8), low (<0.5)';
COMMENT ON COLUMN trade_areas.stats_snapshot IS 'Cached statistics to avoid recalculation: {population, units, pipeline, avg_rent}';

COMMENT ON COLUMN deal_geographic_context.active_scope IS 'Which level user is viewing analytics at: trade_area, submarket, or msa';
