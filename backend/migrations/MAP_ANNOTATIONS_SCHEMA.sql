-- Map Annotations Table
-- Stores user-created drawings and annotations on the pipeline map

CREATE TABLE user_map_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Metadata
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- GeoJSON data
  geojson JSONB NOT NULL,
  
  -- Visual styling
  color VARCHAR(7) DEFAULT '#3B82F6',
  stroke_width INTEGER DEFAULT 2,
  fill_opacity DECIMAL(3, 2) DEFAULT 0.3,
  
  -- Sharing
  is_shared BOOLEAN DEFAULT FALSE,
  shared_with_team BOOLEAN DEFAULT FALSE,
  shared_with_users VARCHAR(255)[], -- Array of user IDs
  
  -- Metadata
  feature_count INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN geojson ? 'features' 
      THEN jsonb_array_length(geojson->'features')
      ELSE 0
    END
  ) STORED,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_annotations_user_id ON user_map_annotations(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_annotations_shared ON user_map_annotations(shared_with_team) WHERE deleted_at IS NULL;
CREATE INDEX idx_annotations_created ON user_map_annotations(created_at DESC);

-- GIN index for GeoJSON queries
CREATE INDEX idx_annotations_geojson ON user_map_annotations USING GIN (geojson);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_annotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_annotations_updated_at
  BEFORE UPDATE ON user_map_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_annotations_updated_at();

-- Comments
COMMENT ON TABLE user_map_annotations IS 'User-created map annotations and drawings';
COMMENT ON COLUMN user_map_annotations.geojson IS 'GeoJSON FeatureCollection with drawn shapes';
COMMENT ON COLUMN user_map_annotations.shared_with_team IS 'Visible to all team members';
COMMENT ON COLUMN user_map_annotations.shared_with_users IS 'Shared with specific users';


-- Sample queries

-- Get user's annotations
SELECT id, title, description, color, feature_count, created_at, updated_at
FROM user_map_annotations
WHERE user_id = 'user-123' AND deleted_at IS NULL
ORDER BY updated_at DESC;

-- Get team shared annotations
SELECT a.*, u.name AS user_name
FROM user_map_annotations a
LEFT JOIN users u ON a.user_id = u.id
WHERE a.shared_with_team = TRUE AND a.deleted_at IS NULL
ORDER BY a.updated_at DESC;

-- Get annotations shared with specific user
SELECT a.*, u.name AS user_name
FROM user_map_annotations a
LEFT JOIN users u ON a.user_id = u.id
WHERE (
  a.user_id = 'user-123' 
  OR a.shared_with_team = TRUE 
  OR 'user-123' = ANY(a.shared_with_users)
) AND a.deleted_at IS NULL
ORDER BY a.updated_at DESC;

-- Count features in annotation
SELECT title, jsonb_array_length(geojson->'features') AS feature_count
FROM user_map_annotations
WHERE user_id = 'user-123';

-- Search annotations by feature type
SELECT title, feature_count
FROM user_map_annotations
WHERE geojson @> '{"features": [{"geometry": {"type": "Polygon"}}]}'::jsonb;
