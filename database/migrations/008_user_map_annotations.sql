-- Migration: User Map Annotations
-- Description: Store user drawings and annotations on portfolio map
-- Date: 2025-02-12

-- User Map Annotations Table
CREATE TABLE IF NOT EXISTS user_map_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    geojson JSONB NOT NULL, -- GeoJSON FeatureCollection from Mapbox Draw
    
    -- Style properties
    fill_color VARCHAR(7) DEFAULT '#3B82F6',
    stroke_color VARCHAR(7) DEFAULT '#2563EB',
    fill_opacity DECIMAL(3,2) DEFAULT 0.20,
    stroke_width INTEGER DEFAULT 2,
    
    -- Sharing and permissions
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with_users VARCHAR(255)[] DEFAULT ARRAY[]::VARCHAR[],
    shared_with_teams VARCHAR(255)[] DEFAULT ARRAY[]::VARCHAR[],
    
    -- Metadata
    annotation_type VARCHAR(50) DEFAULT 'drawing', -- 'drawing', 'zone', 'route', 'note'
    tags VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR[],
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    CONSTRAINT user_map_annotations_user_id_name_key UNIQUE(user_id, name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_map_annotations_user_id ON user_map_annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_map_annotations_created_at ON user_map_annotations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_map_annotations_is_shared ON user_map_annotations(is_shared);
CREATE INDEX IF NOT EXISTS idx_user_map_annotations_tags ON user_map_annotations USING GIN(tags);

-- GiST index for spatial queries on GeoJSON
CREATE INDEX IF NOT EXISTS idx_user_map_annotations_geojson ON user_map_annotations USING GIN(geojson);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_user_map_annotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_map_annotations_updated_at
    BEFORE UPDATE ON user_map_annotations
    FOR EACH ROW
    EXECUTE FUNCTION update_user_map_annotations_updated_at();

-- Comments
COMMENT ON TABLE user_map_annotations IS 'User drawings and annotations on portfolio map';
COMMENT ON COLUMN user_map_annotations.geojson IS 'GeoJSON FeatureCollection from Mapbox Draw';
COMMENT ON COLUMN user_map_annotations.fill_color IS 'Hex color for polygon/circle fills';
COMMENT ON COLUMN user_map_annotations.stroke_color IS 'Hex color for strokes/outlines';
COMMENT ON COLUMN user_map_annotations.fill_opacity IS 'Fill opacity (0.00 to 1.00)';
COMMENT ON COLUMN user_map_annotations.is_shared IS 'Whether annotation is shared with team';
COMMENT ON COLUMN user_map_annotations.annotation_type IS 'Type: drawing, zone, route, note';
