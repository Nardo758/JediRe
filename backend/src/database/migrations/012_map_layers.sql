-- Migration 012: Map Layers System
-- Purpose: Store layer configurations for maps
-- Created: 2026-02-08

-- =============================================================================
-- MAP LAYERS TABLE
-- =============================================================================
-- Stores individual layer configurations for maps
-- Each map can have multiple layers with different sources and styles

CREATE TABLE IF NOT EXISTS map_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  
  -- Layer Identity
  name VARCHAR(255) NOT NULL,
  layer_type VARCHAR(50) NOT NULL, -- 'pin', 'bubble', 'heatmap', 'boundary', 'overlay'
  source_type VARCHAR(50) NOT NULL, -- 'assets', 'pipeline', 'email', 'news', 'market', 'custom'
  
  -- Layer State
  visible BOOLEAN DEFAULT true,
  opacity NUMERIC(3,2) DEFAULT 1.0 CHECK (opacity >= 0 AND opacity <= 1),
  z_index INTEGER DEFAULT 0, -- Higher = rendered on top
  
  -- Layer Configuration (JSONB for flexibility)
  filters JSONB DEFAULT '{}', -- { "status": ["active"], "propertyType": ["multifamily"] }
  style JSONB DEFAULT '{}', -- { "color": "#10b981", "icon": "building", "size": "medium" }
  
  -- Data Source Configuration
  source_config JSONB DEFAULT '{}', -- Source-specific settings (API params, query filters)
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_map_layers_map_id ON map_layers(map_id);
CREATE INDEX idx_map_layers_visible ON map_layers(visible) WHERE visible = true;
CREATE INDEX idx_map_layers_z_index ON map_layers(map_id, z_index);
CREATE INDEX idx_map_layers_source_type ON map_layers(source_type);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get all visible layers for a map, ordered by z-index
CREATE OR REPLACE FUNCTION get_visible_layers(p_map_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  layer_type VARCHAR,
  source_type VARCHAR,
  opacity NUMERIC,
  z_index INTEGER,
  filters JSONB,
  style JSONB,
  source_config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ml.id,
    ml.name,
    ml.layer_type,
    ml.source_type,
    ml.opacity,
    ml.z_index,
    ml.filters,
    ml.style,
    ml.source_config
  FROM map_layers ml
  WHERE ml.map_id = p_map_id
    AND ml.visible = true
  ORDER BY ml.z_index ASC, ml.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get layer count by type for a map
CREATE OR REPLACE FUNCTION get_layer_stats(p_map_id UUID)
RETURNS TABLE (
  layer_type VARCHAR,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ml.layer_type,
    COUNT(*) as count
  FROM map_layers ml
  WHERE ml.map_id = p_map_id
  GROUP BY ml.layer_type;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_map_layers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER map_layers_updated_at
  BEFORE UPDATE ON map_layers
  FOR EACH ROW
  EXECUTE FUNCTION update_map_layers_updated_at();

-- =============================================================================
-- DEFAULT DATA
-- =============================================================================

-- Note: Default layers will be created when maps are created
-- See maps.routes.ts for default layer creation logic

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE map_layers IS 'Layer configurations for maps (pins, heatmaps, boundaries, etc.)';
COMMENT ON COLUMN map_layers.layer_type IS 'Visual representation: pin, bubble, heatmap, boundary, overlay';
COMMENT ON COLUMN map_layers.source_type IS 'Data source: assets, pipeline, email, news, market, custom';
COMMENT ON COLUMN map_layers.z_index IS 'Render order (higher = on top)';
COMMENT ON COLUMN map_layers.filters IS 'JSON filters applied to source data';
COMMENT ON COLUMN map_layers.style IS 'JSON style configuration (colors, icons, sizes)';
COMMENT ON COLUMN map_layers.source_config IS 'Source-specific configuration (API params, queries)';
