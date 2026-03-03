-- Migration 071: User Map Annotations
-- Custom user-drawn shapes, markers, and notes on maps

-- 1. User Map Annotations Table
CREATE TABLE IF NOT EXISTS user_map_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Annotation Details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- GeoJSON Data
  geojson JSONB NOT NULL,
  
  -- Styling
  fill_color VARCHAR(20) DEFAULT '#3B82F6',
  stroke_color VARCHAR(20) DEFAULT '#2563EB',
  fill_opacity DECIMAL(3, 2) DEFAULT 0.2 CHECK (fill_opacity >= 0 AND fill_opacity <= 1),
  stroke_width INTEGER DEFAULT 2 CHECK (stroke_width >= 1 AND stroke_width <= 10),
  
  -- Sharing
  is_shared BOOLEAN DEFAULT FALSE,
  shared_with_users UUID[] DEFAULT ARRAY[]::UUID[],
  shared_with_teams UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Organization
  annotation_type VARCHAR(100) DEFAULT 'drawing', -- drawing, marker, polygon, circle, route
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  folder_path VARCHAR(500) DEFAULT '/',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- 2. Annotation Comments Table (for collaboration)
CREATE TABLE IF NOT EXISTS map_annotation_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id UUID NOT NULL REFERENCES user_map_annotations(id) ON DELETE CASCADE,
  
  -- Comment Details
  user_id UUID NOT NULL,
  user_name VARCHAR(255),
  content TEXT NOT NULL,
  
  -- Threading
  parent_comment_id UUID REFERENCES map_annotation_comments(id),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_map_annotations_user_id ON user_map_annotations(user_id);
CREATE INDEX idx_map_annotations_type ON user_map_annotations(annotation_type);
CREATE INDEX idx_map_annotations_tags ON user_map_annotations USING GIN(tags);
CREATE INDEX idx_map_annotations_shared ON user_map_annotations(is_shared);
CREATE INDEX idx_map_annotations_geojson ON user_map_annotations USING GIN(geojson);
CREATE INDEX idx_map_annotations_deleted ON user_map_annotations(deleted_at);

CREATE INDEX idx_annotation_comments_annotation_id ON map_annotation_comments(annotation_id);
CREATE INDEX idx_annotation_comments_user_id ON map_annotation_comments(user_id);
CREATE INDEX idx_annotation_comments_parent ON map_annotation_comments(parent_comment_id);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_annotation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER map_annotations_updated_at
  BEFORE UPDATE ON user_map_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_annotation_timestamp();

CREATE TRIGGER annotation_comments_updated_at
  BEFORE UPDATE ON map_annotation_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_annotation_timestamp();

-- Function to get shared annotations for a user
CREATE OR REPLACE FUNCTION get_user_annotations(p_user_id UUID, p_include_shared BOOLEAN DEFAULT TRUE)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  name VARCHAR,
  description TEXT,
  geojson JSONB,
  fill_color VARCHAR,
  stroke_color VARCHAR,
  fill_opacity DECIMAL,
  stroke_width INTEGER,
  is_shared BOOLEAN,
  annotation_type VARCHAR,
  tags TEXT[],
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  IF p_include_shared THEN
    RETURN QUERY
    SELECT 
      a.id, a.user_id, a.name, a.description, a.geojson,
      a.fill_color, a.stroke_color, a.fill_opacity, a.stroke_width,
      a.is_shared, a.annotation_type, a.tags, a.created_at, a.updated_at
    FROM user_map_annotations a
    WHERE 
      a.deleted_at IS NULL
      AND (
        a.user_id = p_user_id 
        OR a.is_shared = TRUE 
        OR p_user_id = ANY(a.shared_with_users)
      )
    ORDER BY a.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT 
      a.id, a.user_id, a.name, a.description, a.geojson,
      a.fill_color, a.stroke_color, a.fill_opacity, a.stroke_width,
      a.is_shared, a.annotation_type, a.tags, a.created_at, a.updated_at
    FROM user_map_annotations a
    WHERE 
      a.deleted_at IS NULL
      AND a.user_id = p_user_id
    ORDER BY a.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE user_map_annotations IS 'User-created map annotations (drawings, markers, areas of interest)';
COMMENT ON TABLE map_annotation_comments IS 'Comments and discussions on map annotations';
