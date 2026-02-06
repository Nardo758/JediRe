-- =====================================================
-- REPLIT Migration 002: Zoning Intelligence Schema
-- =====================================================
-- Description: Zoning districts and rules for AI analysis
-- Following Map-Agnostic Architecture approach
-- =====================================================

-- =====================================================
-- Zoning Districts Table
-- =====================================================
-- Stores zoning rules for each district in each municipality

CREATE TABLE IF NOT EXISTS zoning_districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    municipality VARCHAR(255) NOT NULL,
    state VARCHAR(50) NOT NULL,
    district_code VARCHAR(50) NOT NULL,
    district_name VARCHAR(255),
    description TEXT,
    
    -- Permitted uses
    permitted_uses TEXT[] DEFAULT '{}',
    conditional_uses TEXT[] DEFAULT '{}',
    prohibited_uses TEXT[] DEFAULT '{}',
    
    -- Dimensional standards
    min_lot_size_sqft INTEGER,
    max_lot_coverage DECIMAL(5, 2),
    max_building_height_ft INTEGER,
    max_stories INTEGER,
    min_front_setback_ft INTEGER,
    min_side_setback_ft INTEGER,
    min_rear_setback_ft INTEGER,
    
    -- Density standards
    max_units_per_acre DECIMAL(8, 2),
    min_lot_per_unit_sqft INTEGER,
    max_far DECIMAL(5, 2),
    
    -- Parking requirements
    parking_per_unit DECIMAL(5, 2),
    parking_per_1000_sqft DECIMAL(5, 2),
    
    -- Full zoning code text (for RAG/AI)
    full_code_text TEXT,
    
    -- Metadata
    effective_date DATE,
    source_url TEXT,
    last_verified_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_district_per_municipality UNIQUE(municipality, state, district_code)
);

CREATE INDEX idx_zoning_districts_municipality ON zoning_districts(municipality, state);
CREATE INDEX idx_zoning_districts_code ON zoning_districts(district_code);

-- =====================================================
-- Zoning District Boundaries Table
-- =====================================================
-- Simplified polygons for reverse geocoding (point-in-polygon)
-- Uses bounding box + GeoJSON for lightweight spatial queries

CREATE TABLE IF NOT EXISTS zoning_district_boundaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_id UUID REFERENCES zoning_districts(id) ON DELETE CASCADE,
    municipality VARCHAR(255) NOT NULL,
    state VARCHAR(50) NOT NULL,
    district_code VARCHAR(50) NOT NULL,
    
    -- Bounding box for fast filtering (before GeoJSON check)
    min_lat DECIMAL(10, 8),
    max_lat DECIMAL(10, 8),
    min_lng DECIMAL(11, 8),
    max_lng DECIMAL(11, 8),
    
    -- Full boundary as GeoJSON (for precise point-in-polygon)
    boundary_geojson TEXT NOT NULL,
    
    -- Centroid for distance calculations
    centroid_lat DECIMAL(10, 8),
    centroid_lng DECIMAL(11, 8),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_boundaries_bbox ON zoning_district_boundaries(min_lat, max_lat, min_lng, max_lng);
CREATE INDEX idx_boundaries_municipality ON zoning_district_boundaries(municipality, state);

-- =====================================================
-- Property Analysis Results Table
-- =====================================================
-- Stores analysis results for properties

CREATE TABLE IF NOT EXISTS property_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Input data
    address VARCHAR(500) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    municipality VARCHAR(255),
    state VARCHAR(50),
    lot_size_sqft INTEGER,
    current_use VARCHAR(100),
    
    -- Zoning lookup result
    district_id UUID REFERENCES zoning_districts(id) ON DELETE SET NULL,
    district_code VARCHAR(50),
    district_name VARCHAR(255),
    
    -- Calculated results
    max_units INTEGER,
    max_building_height_ft INTEGER,
    max_footprint_sqft INTEGER,
    max_gfa_sqft INTEGER,
    parking_required INTEGER,
    setbacks JSONB DEFAULT '{}',
    buildable_envelope_geojson TEXT,
    
    -- Scoring
    opportunity_score INTEGER,
    opportunity_factors JSONB DEFAULT '{}',
    
    -- AI interpretation
    ai_summary TEXT,
    ai_recommendations TEXT[],
    
    -- Status
    status analysis_status DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analyses_user ON property_analyses(user_id, created_at DESC);
CREATE INDEX idx_analyses_location ON property_analyses(latitude, longitude);

-- =====================================================
-- Apply update triggers
-- =====================================================

CREATE TRIGGER update_zoning_districts_updated_at BEFORE UPDATE ON zoning_districts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_boundaries_updated_at BEFORE UPDATE ON zoning_district_boundaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analyses_updated_at BEFORE UPDATE ON property_analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Sample Austin Zoning Data
-- =====================================================

-- Austin R-3 (Multi-Family Low Density)
INSERT INTO zoning_districts (
    municipality, state, district_code, district_name, description,
    permitted_uses, conditional_uses,
    min_lot_size_sqft, max_lot_coverage, max_building_height_ft, max_stories,
    min_front_setback_ft, min_side_setback_ft, min_rear_setback_ft,
    max_units_per_acre, min_lot_per_unit_sqft, max_far,
    parking_per_unit, full_code_text, source_url
) VALUES (
    'Austin', 'TX', 'SF-3',
    'Family Residence (SF-3)',
    'Single-family residential district',
    ARRAY['single_family_residence', 'home_occupation', 'accessory_dwelling_unit'],
    ARRAY['group_home', 'family_home'],
    5750, 0.45, 35, 3,
    25, 5, 10,
    7.26, 5750, 0.4,
    2.0,
    'SF-3 permits single-family residential uses. Maximum impervious cover 45%. Height limit 35 feet or 3 stories. Minimum lot width 50 feet. Accessory dwelling units permitted with conditions.',
    'https://library.municode.com/tx/austin/codes/code_of_ordinances'
) ON CONFLICT (municipality, state, district_code) DO NOTHING;

-- Austin MF-3 (Multi-Family Medium Density)
INSERT INTO zoning_districts (
    municipality, state, district_code, district_name, description,
    permitted_uses, conditional_uses,
    min_lot_size_sqft, max_lot_coverage, max_building_height_ft, max_stories,
    min_front_setback_ft, min_side_setback_ft, min_rear_setback_ft,
    max_units_per_acre, min_lot_per_unit_sqft, max_far,
    parking_per_unit, full_code_text, source_url
) VALUES (
    'Austin', 'TX', 'MF-3',
    'Multifamily Residence Medium Density (MF-3)',
    'Medium density multifamily residential district',
    ARRAY['single_family', 'duplex', 'townhouse', 'apartment', 'condominium'],
    ARRAY['group_residential', 'bed_and_breakfast', 'home_occupation'],
    8000, 0.60, 40, 3,
    15, 10, 10,
    36, 1210, 0.75,
    1.5,
    'MF-3 allows medium density multifamily development. Maximum 36 units per acre. Maximum FAR 0.75:1. Height limit 40 feet. Minimum lot 8,000 sqft. Parking 1.5 spaces per unit for 1BR, 2.0 for 2BR+.',
    'https://library.municode.com/tx/austin/codes/code_of_ordinances'
) ON CONFLICT (municipality, state, district_code) DO NOTHING;

-- Austin GR (General Commercial)
INSERT INTO zoning_districts (
    municipality, state, district_code, district_name, description,
    permitted_uses, conditional_uses,
    min_lot_size_sqft, max_lot_coverage, max_building_height_ft, max_stories,
    min_front_setback_ft, min_side_setback_ft, min_rear_setback_ft,
    max_units_per_acre, max_far,
    parking_per_1000_sqft, full_code_text, source_url
) VALUES (
    'Austin', 'TX', 'GR',
    'Community Commercial (GR)',
    'General retail and commercial services',
    ARRAY['retail', 'restaurant', 'office', 'personal_services', 'medical_office'],
    ARRAY['bar', 'outdoor_entertainment', 'residential_above_ground_floor'],
    5750, 0.80, 60, 5,
    0, 0, 0,
    NULL, 1.0,
    3.3,
    'GR district for community-serving commercial uses. No residential at ground floor. Maximum FAR 1.0:1. Height limit 60 feet. No setback requirements. Parking 3.3 spaces per 1,000 sqft retail.',
    'https://library.municode.com/tx/austin/codes/code_of_ordinances'
) ON CONFLICT (municipality, state, district_code) DO NOTHING;

-- Add sample boundaries for Austin districts (simplified rectangles for demo)
INSERT INTO zoning_district_boundaries (
    district_id,
    municipality, state, district_code,
    min_lat, max_lat, min_lng, max_lng,
    centroid_lat, centroid_lng,
    boundary_geojson
)
SELECT 
    id,
    municipality, state, district_code,
    30.2650, 30.2750, -97.7500, -97.7400,
    30.2700, -97.7450,
    '{"type":"Polygon","coordinates":[[[-97.7500,30.2650],[-97.7400,30.2650],[-97.7400,30.2750],[-97.7500,30.2750],[-97.7500,30.2650]]]}'
FROM zoning_districts
WHERE municipality = 'Austin' AND district_code = 'SF-3'
ON CONFLICT DO NOTHING;

INSERT INTO zoning_district_boundaries (
    district_id,
    municipality, state, district_code,
    min_lat, max_lat, min_lng, max_lng,
    centroid_lat, centroid_lng,
    boundary_geojson
)
SELECT 
    id,
    municipality, state, district_code,
    30.2750, 30.2850, -97.7400, -97.7300,
    30.2800, -97.7350,
    '{"type":"Polygon","coordinates":[[[-97.7400,30.2750],[-97.7300,30.2750],[-97.7300,30.2850],[-97.7400,30.2850],[-97.7400,30.2750]]]}'
FROM zoning_districts
WHERE municipality = 'Austin' AND district_code = 'MF-3'
ON CONFLICT DO NOTHING;

INSERT INTO zoning_district_boundaries (
    district_id,
    municipality, state, district_code,
    min_lat, max_lat, min_lng, max_lng,
    centroid_lat, centroid_lng,
    boundary_geojson
)
SELECT 
    id,
    municipality, state, district_code,
    30.2672, 30.2720, -97.7450, -97.7380,
    30.2696, -97.7415,
    '{"type":"Polygon","coordinates":[[[-97.7450,30.2672],[-97.7380,30.2672],[-97.7380,30.2720],[-97.7450,30.2720],[-97.7450,30.2672]]]}'
FROM zoning_districts
WHERE municipality = 'Austin' AND district_code = 'GR'
ON CONFLICT DO NOTHING;

COMMENT ON TABLE zoning_districts IS 'Zoning district rules and regulations per municipality';
COMMENT ON TABLE zoning_district_boundaries IS 'Simplified boundaries for point-in-polygon zoning lookup';
COMMENT ON TABLE property_analyses IS 'Saved property analysis results with zoning calculations';
