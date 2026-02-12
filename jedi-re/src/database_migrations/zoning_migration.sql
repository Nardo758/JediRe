-- Database Migration: Add Zoning and Development Capacity Fields
-- Run this script to add zoning-related fields to the JEDI RE database

-- ============================================================================
-- ADD ZONING FIELDS TO PROPERTIES TABLE
-- ============================================================================

-- Add zoning_code field to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS zoning_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS lot_size_sqft DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS development_capacity INTEGER,
ADD COLUMN IF NOT EXISTS zoning_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_zoning_check_date DATE;

-- Add index for zoning code queries
CREATE INDEX IF NOT EXISTS idx_properties_zoning ON properties(zoning_code);
CREATE INDEX IF NOT EXISTS idx_properties_lot_size ON properties(lot_size_sqft);


-- ============================================================================
-- CREATE ZONING RULES CACHE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS zoning_rules_cache (
    id SERIAL PRIMARY KEY,
    zoning_code VARCHAR(20) NOT NULL UNIQUE,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    
    -- Rule data (stored as JSON for flexibility)
    rule_data JSONB NOT NULL,
    
    -- Rule metadata
    zone_type VARCHAR(50),  -- 'single-family', 'multi-family', 'mixed-use', etc.
    description TEXT,
    
    -- Source information
    source_file VARCHAR(255),
    source_url TEXT,
    verification_status VARCHAR(50) DEFAULT 'PARSED',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_verified_date DATE
);

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_zoning_cache_code ON zoning_rules_cache(zoning_code);
CREATE INDEX IF NOT EXISTS idx_zoning_cache_city_state ON zoning_rules_cache(city, state);
CREATE INDEX IF NOT EXISTS idx_zoning_cache_type ON zoning_rules_cache(zone_type);
CREATE INDEX IF NOT EXISTS idx_zoning_cache_json ON zoning_rules_cache USING GIN (rule_data);


-- ============================================================================
-- CREATE DEVELOPMENT CAPACITY ANALYSIS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS development_capacity_analysis (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id),
    submarket_id INTEGER REFERENCES submarkets(id),
    
    -- Analysis inputs
    zoning_code VARCHAR(20) NOT NULL,
    lot_size_sqft DECIMAL(12, 2) NOT NULL,
    current_units INTEGER DEFAULT 0,
    
    -- Analysis results
    maximum_buildable_units INTEGER,
    development_potential VARCHAR(20),  -- 'VERY_HIGH', 'HIGH', 'MODERATE', etc.
    estimated_far DECIMAL(5, 3),
    max_height_feet DECIMAL(6, 1),
    
    -- Constraints (stored as JSON array)
    constraints JSONB,
    
    -- Supply forecast
    supply_forecast JSONB,
    
    -- Confidence and metadata
    confidence_score DECIMAL(3, 2),
    analysis_method VARCHAR(50) DEFAULT 'zoning_rules',
    analysis_version VARCHAR(20),
    
    -- Timestamps
    analyzed_at TIMESTAMP DEFAULT NOW(),
    valid_until DATE,
    
    UNIQUE (property_id, analyzed_at)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_dev_capacity_property ON development_capacity_analysis(property_id);
CREATE INDEX IF NOT EXISTS idx_dev_capacity_submarket ON development_capacity_analysis(submarket_id);
CREATE INDEX IF NOT EXISTS idx_dev_capacity_potential ON development_capacity_analysis(development_potential);
CREATE INDEX IF NOT EXISTS idx_dev_capacity_analyzed ON development_capacity_analysis(analyzed_at DESC);


-- ============================================================================
-- CREATE SUBMARKET DEVELOPMENT PIPELINE VIEW
-- ============================================================================

CREATE OR REPLACE VIEW submarket_development_pipeline AS
SELECT 
    s.id AS submarket_id,
    s.name AS submarket_name,
    s.city,
    s.state,
    
    -- Existing supply
    COUNT(DISTINCT p.id) AS existing_properties,
    COALESCE(SUM(p.total_units), 0) AS existing_units,
    
    -- Zoning analysis
    COUNT(DISTINCT p.id) FILTER (WHERE p.zoning_code IS NOT NULL) AS properties_with_zoning,
    
    -- Development pipeline from capacity analysis
    COUNT(DISTINCT dca.id) AS parcels_analyzed,
    COALESCE(SUM(
        CASE 
            WHEN dca.maximum_buildable_units > dca.current_units 
            THEN dca.maximum_buildable_units - dca.current_units
            ELSE 0 
        END
    ), 0) AS potential_new_units,
    
    -- Pipeline by development potential
    COUNT(DISTINCT dca.id) FILTER (WHERE dca.development_potential IN ('VERY_HIGH', 'HIGH')) AS high_potential_parcels,
    COUNT(DISTINCT dca.id) FILTER (WHERE dca.development_potential = 'MODERATE') AS moderate_potential_parcels,
    COUNT(DISTINCT dca.id) FILTER (WHERE dca.development_potential IN ('LOW', 'VERY_LOW')) AS low_potential_parcels,
    
    -- Under construction pipeline (from existing table)
    COALESCE(SUM(sp.units) FILTER (WHERE sp.status IN ('Under Construction', 'Permitted')), 0) AS under_construction_units
    
FROM submarkets s
LEFT JOIN properties p ON p.submarket_id = s.id
LEFT JOIN development_capacity_analysis dca ON dca.property_id = p.id 
    AND dca.analyzed_at = (
        SELECT MAX(analyzed_at) 
        FROM development_capacity_analysis 
        WHERE property_id = p.id
    )
LEFT JOIN supply_pipeline sp ON sp.submarket_id = s.id
GROUP BY s.id, s.name, s.city, s.state;


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update development capacity for a property
CREATE OR REPLACE FUNCTION update_property_development_capacity(
    p_property_id INTEGER,
    p_zoning_code VARCHAR(20),
    p_lot_size_sqft DECIMAL(12, 2)
) RETURNS INTEGER AS $$
DECLARE
    v_capacity INTEGER;
BEGIN
    -- This would call the Python analysis engine
    -- For now, placeholder logic
    v_capacity := 0;
    
    -- Update the property record
    UPDATE properties 
    SET 
        zoning_code = p_zoning_code,
        lot_size_sqft = p_lot_size_sqft,
        development_capacity = v_capacity,
        last_zoning_check_date = CURRENT_DATE
    WHERE id = p_property_id;
    
    RETURN v_capacity;
END;
$$ LANGUAGE plpgsql;


-- Function to get zoning rules for a code
CREATE OR REPLACE FUNCTION get_zoning_rules(
    p_zoning_code VARCHAR(20),
    p_city VARCHAR(100) DEFAULT 'Atlanta',
    p_state VARCHAR(2) DEFAULT 'GA'
) RETURNS JSONB AS $$
DECLARE
    v_rules JSONB;
BEGIN
    SELECT rule_data INTO v_rules
    FROM zoning_rules_cache
    WHERE zoning_code = p_zoning_code
        AND city = p_city
        AND state = p_state
    LIMIT 1;
    
    RETURN v_rules;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- SAMPLE DATA INSERTION (for testing)
-- ============================================================================

-- Insert some sample zoning rules from our JSON files
-- Note: In production, this would be populated by a data loader script

INSERT INTO zoning_rules_cache (zoning_code, city, state, zone_type, description, rule_data, source_file)
VALUES 
    ('MR-4A', 'Atlanta', 'GA', 'multi-family', 'Multi-Family Residential - High Density', 
     '{"maximum_far": 1.49, "maximum_height_feet": 80, "minimum_lot_size_sqft": 1000, "parking_required_per_unit": 1.5}',
     'atlanta_mf_zoning_verified.json')
ON CONFLICT (zoning_code) DO NOTHING;

INSERT INTO zoning_rules_cache (zoning_code, city, state, zone_type, description, rule_data, source_file)
VALUES 
    ('R-1', 'Atlanta', 'GA', 'single-family', 'Single-Family Residential - Low Density', 
     '{"maximum_density_units_per_acre": 0.5, "minimum_lot_size_sqft": 87120, "maximum_far": 0.25, "maximum_height_feet": 35}',
     'atlanta_zoning_verified.json')
ON CONFLICT (zoning_code) DO NOTHING;

INSERT INTO zoning_rules_cache (zoning_code, city, state, zone_type, description, rule_data, source_file)
VALUES 
    ('RG', 'Atlanta', 'GA', 'multi-family', 'Residential General District', 
     '{"maximum_far": 1.49, "minimum_lot_size_sqft": 1000, "notes": ["Uses Land Use Intensity Ratio (LUI) table"]}',
     'atlanta_mf_zoning_verified.json')
ON CONFLICT (zoning_code) DO NOTHING;


-- ============================================================================
-- MIGRATION COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Zoning migration completed successfully';
    RAISE NOTICE 'Added zoning fields to properties table';
    RAISE NOTICE 'Created zoning_rules_cache table';
    RAISE NOTICE 'Created development_capacity_analysis table';
    RAISE NOTICE 'Created submarket_development_pipeline view';
END $$;