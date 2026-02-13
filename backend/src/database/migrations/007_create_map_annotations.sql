-- ============================================================================
-- MAP ANNOTATIONS TABLE
-- Store user drawings and annotations on portfolio maps
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_map_annotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Map context
    map_type VARCHAR(50) NOT NULL, -- 'pipeline' or 'assets' or 'general'
    annotation_type VARCHAR(50) NOT NULL, -- 'marker', 'polygon', 'line', 'circle', 'text'
    
    -- Geographic data (GeoJSON Feature)
    geometry JSONB NOT NULL, -- Full GeoJSON geometry object
    coordinates GEOGRAPHY(Point, 4326), -- Extracted for spatial queries (center point)
    
    -- Visual properties
    properties JSONB DEFAULT '{}', -- {color, label, strokeWidth, fillOpacity, etc.}
    
    -- Metadata
    label TEXT,
    description TEXT,
    color VARCHAR(20) DEFAULT '#3B82F6',
    
    -- Sharing
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with_user_ids UUID[], -- Array of user IDs who can see this
    shared_with_team BOOLEAN DEFAULT FALSE,
    
    -- Measurement data (for distance/area tools)
    measurement_value DECIMAL(12, 2),
    measurement_unit VARCHAR(20), -- 'miles', 'km', 'sqmi', 'acres', etc.
    
    -- Ordering
    z_index INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_map_annotations_user ON user_map_annotations(user_id, map_type);
CREATE INDEX idx_map_annotations_map_type ON user_map_annotations(map_type);
CREATE INDEX idx_map_annotations_shared ON user_map_annotations(is_shared, shared_with_team);
CREATE INDEX idx_map_annotations_spatial ON user_map_annotations USING GIST(coordinates);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_map_annotation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_map_annotation_timestamp
    BEFORE UPDATE ON user_map_annotations
    FOR EACH ROW
    EXECUTE FUNCTION update_map_annotation_timestamp();

-- Add constraint for valid annotation types
ALTER TABLE user_map_annotations
    ADD CONSTRAINT valid_annotation_type 
    CHECK (annotation_type IN ('marker', 'polygon', 'line', 'circle', 'text', 'rectangle'));

-- Add constraint for valid map types
ALTER TABLE user_map_annotations
    ADD CONSTRAINT valid_map_type 
    CHECK (map_type IN ('pipeline', 'assets', 'general', 'deal'));

-- Sample data for testing (optional)
-- INSERT INTO user_map_annotations (user_id, map_type, annotation_type, geometry, properties, label, color)
-- VALUES (
--     (SELECT id FROM users LIMIT 1),
--     'pipeline',
--     'polygon',
--     '{"type":"Polygon","coordinates":[[[-84.39,33.75],[-84.38,33.75],[-84.38,33.76],[-84.39,33.76],[-84.39,33.75]]]}',
--     '{"fillColor":"#3B82F6","fillOpacity":0.3,"strokeColor":"#1E40AF","strokeWidth":2}',
--     'Target Market Area',
--     '#3B82F6'
-- );
