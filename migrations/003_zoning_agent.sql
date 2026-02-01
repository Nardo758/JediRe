-- =====================================================
-- Migration 003: Zoning Agent Tables
-- =====================================================
-- Description: Tables for zoning intelligence and development feasibility
-- Created: 2026-01-31
-- =====================================================

-- =====================================================
-- Zoning Districts & Boundaries
-- =====================================================

CREATE TABLE zoning_districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    
    -- District identification
    district_code VARCHAR(50) NOT NULL, -- e.g., "R-3", "C-2"
    district_name VARCHAR(255),
    district_category VARCHAR(100), -- residential, commercial, industrial, etc.
    
    -- Simplified boundary for lookup
    boundary GEOMETRY(MultiPolygon, 4326),
    
    -- Zoning rules (structured)
    permitted_uses TEXT[],
    conditional_uses TEXT[],
    prohibited_uses TEXT[],
    
    -- Dimensional standards
    min_lot_size_sqft INTEGER,
    max_units_per_acre DECIMAL(10, 2),
    max_density_factor DECIMAL(5, 2),
    
    -- Setbacks (feet)
    front_setback_ft INTEGER,
    rear_setback_ft INTEGER,
    side_setback_ft INTEGER,
    
    -- Building envelope
    max_height_ft INTEGER,
    max_stories INTEGER,
    max_lot_coverage_pct INTEGER,
    floor_area_ratio DECIMAL(5, 2),
    
    -- Parking requirements
    parking_ratio_residential DECIMAL(5, 2), -- spaces per unit
    parking_ratio_commercial DECIMAL(5, 2), -- spaces per 1000 sqft
    
    -- Full code text (for RAG/embeddings)
    code_text TEXT,
    code_sections JSONB, -- Structured sections
    code_embeddings vector(1536), -- OpenAI embeddings for semantic search
    
    -- Source information
    ordinance_url TEXT,
    data_source VARCHAR(100),
    effective_date DATE,
    last_updated DATE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_market_district UNIQUE(market_id, district_code)
);

CREATE INDEX idx_zoning_districts_market ON zoning_districts(market_id);
CREATE INDEX idx_zoning_districts_boundary ON zoning_districts USING GIST(boundary);
CREATE INDEX idx_zoning_districts_category ON zoning_districts(district_category);
CREATE INDEX idx_zoning_districts_code ON zoning_districts(district_code);
CREATE INDEX idx_zoning_embeddings ON zoning_districts USING ivfflat(code_embeddings vector_cosine_ops);

COMMENT ON TABLE zoning_districts IS 'Zoning district boundaries and rules for development feasibility';
COMMENT ON COLUMN zoning_districts.code_embeddings IS 'Vector embeddings of zoning code for semantic search';

-- =====================================================
-- Property Zoning Lookup (Materialized)
-- =====================================================

CREATE TABLE property_zoning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE UNIQUE,
    market_id UUID REFERENCES markets(id),
    zoning_district_id UUID REFERENCES zoning_districts(id),
    
    -- Quick reference
    district_code VARCHAR(50),
    district_name VARCHAR(255),
    
    -- Calculated development potential
    max_units_allowed INTEGER,
    max_buildable_sqft INTEGER,
    max_lot_coverage_sqft INTEGER,
    buildable_envelope GEOMETRY(Polygon, 4326),
    
    -- Compliance checks
    is_conforming BOOLEAN,
    nonconforming_reasons TEXT[],
    
    -- Lookup metadata
    lookup_confidence DECIMAL(3, 2), -- 0.00 to 1.00
    lookup_method VARCHAR(50), -- 'postgis', 'api', 'manual'
    
    -- Cache control
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days'),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_property_zoning_property ON property_zoning(property_id);
CREATE INDEX idx_property_zoning_district ON property_zoning(zoning_district_id);
CREATE INDEX idx_property_zoning_expires ON property_zoning(expires_at);

COMMENT ON TABLE property_zoning IS 'Cached zoning lookup results for properties';
COMMENT ON COLUMN property_zoning.buildable_envelope IS 'Polygon showing buildable area after setbacks';

-- =====================================================
-- Zoning Analysis Results
-- =====================================================

CREATE TABLE zoning_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    zoning_district_id UUID REFERENCES zoning_districts(id),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- User query
    user_question TEXT,
    
    -- Analysis results
    can_build BOOLEAN,
    max_units INTEGER,
    max_buildable_area_sqft INTEGER,
    parking_spaces_required INTEGER,
    estimated_construction_cost INTEGER,
    
    -- Development scenarios
    scenarios JSONB, -- Different build-out options
    
    -- AI interpretation
    ai_summary TEXT,
    ai_recommendations TEXT[],
    constraints TEXT[],
    opportunities TEXT[],
    
    -- Score
    development_score INTEGER CHECK (development_score BETWEEN 0 AND 100),
    
    -- Supporting data
    analysis_data JSONB,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_zoning_analyses_property ON zoning_analyses(property_id);
CREATE INDEX idx_zoning_analyses_user ON zoning_analyses(user_id);
CREATE INDEX idx_zoning_analyses_created ON zoning_analyses(created_at DESC);

COMMENT ON TABLE zoning_analyses IS 'AI-powered zoning analysis results with development feasibility';
COMMENT ON COLUMN zoning_analyses.scenarios IS 'Different development scenarios (max density, conservative, etc.)';

-- =====================================================
-- Zoning Code RAG Queries (for learning)
-- =====================================================

CREATE TABLE zoning_rag_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id),
    zoning_district_id UUID REFERENCES zoning_districts(id),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Query
    query_text TEXT NOT NULL,
    query_embedding vector(1536),
    
    -- Response
    response_text TEXT,
    retrieved_sections JSONB, -- Which code sections were used
    
    -- Feedback
    was_helpful BOOLEAN,
    user_feedback TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_zoning_rag_market ON zoning_rag_queries(market_id);
CREATE INDEX idx_zoning_rag_district ON zoning_rag_queries(zoning_district_id);
CREATE INDEX idx_zoning_rag_embedding ON zoning_rag_queries USING ivfflat(query_embedding vector_cosine_ops);

COMMENT ON TABLE zoning_rag_queries IS 'Log of RAG queries for zoning code questions';

-- =====================================================
-- Zoning Lookup Function
-- =====================================================

CREATE OR REPLACE FUNCTION get_zoning_for_point(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    market_name TEXT
)
RETURNS TABLE (
    district_id UUID,
    district_code VARCHAR(50),
    district_name VARCHAR(255),
    max_units_per_acre DECIMAL(10, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        zd.id,
        zd.district_code,
        zd.district_name,
        zd.max_units_per_acre
    FROM zoning_districts zd
    JOIN markets m ON m.id = zd.market_id
    WHERE m.name = market_name
      AND ST_Contains(
          zd.boundary,
          ST_SetSRID(ST_Point(lng, lat), 4326)
      )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_zoning_for_point IS 'Point-in-polygon lookup for zoning district';
