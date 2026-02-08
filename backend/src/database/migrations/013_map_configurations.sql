-- Migration 013: Map Configurations (Saved Map Tabs)
-- Purpose: Store saved layer configurations for quick loading
-- Created: 2026-02-08

-- =============================================================================
-- MAP CONFIGURATIONS TABLE
-- =============================================================================
-- Stores saved map configurations (War Maps, custom views, etc.)

CREATE TABLE IF NOT EXISTS map_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Configuration Identity
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50), -- Emoji or icon name
  
  -- Configuration Type
  config_type VARCHAR(50) DEFAULT 'custom', -- 'war_map', 'custom', 'template'
  is_default BOOLEAN DEFAULT false, -- Default map to load
  is_public BOOLEAN DEFAULT false, -- Shareable with team
  
  -- Layer Configuration (JSONB array of layer definitions)
  layer_config JSONB NOT NULL DEFAULT '[]',
  -- Example structure:
  -- [
  --   {
  --     "source_type": "assets",
  --     "layer_type": "pin",
  --     "name": "Assets Owned",
  --     "visible": true,
  --     "opacity": 1.0,
  --     "z_index": 0,
  --     "filters": {},
  --     "style": { "color": "#10b981", "icon": "🏢" }
  --   }
  -- ]
  
  -- Map View State
  map_center JSONB DEFAULT '{"lng": -84.388, "lat": 33.749}',
  map_zoom NUMERIC(4,2) DEFAULT 11,
  
  -- Usage Stats
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_map_configurations_user_id ON map_configurations(user_id);
CREATE INDEX idx_map_configurations_config_type ON map_configurations(config_type);
CREATE INDEX idx_map_configurations_is_default ON map_configurations(user_id, is_default) WHERE is_default = true;
CREATE INDEX idx_map_configurations_public ON map_configurations(is_public) WHERE is_public = true;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get user's default map configuration
CREATE OR REPLACE FUNCTION get_default_map_config(p_user_id UUID)
RETURNS map_configurations AS $$
DECLARE
  v_config map_configurations;
BEGIN
  -- Try to get user's default
  SELECT * INTO v_config
  FROM map_configurations
  WHERE user_id = p_user_id
    AND is_default = true
  LIMIT 1;
  
  -- If no default, get most recently viewed
  IF v_config IS NULL THEN
    SELECT * INTO v_config
    FROM map_configurations
    WHERE user_id = p_user_id
    ORDER BY last_viewed_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
  END IF;
  
  RETURN v_config;
END;
$$ LANGUAGE plpgsql STABLE;

-- Increment view count
CREATE OR REPLACE FUNCTION increment_map_config_views(p_config_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE map_configurations
  SET view_count = view_count + 1,
      last_viewed_at = now()
  WHERE id = p_config_id;
END;
$$ LANGUAGE plpgsql;

-- Clone configuration
CREATE OR REPLACE FUNCTION clone_map_config(p_config_id UUID, p_new_name VARCHAR, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
BEGIN
  INSERT INTO map_configurations (
    user_id,
    name,
    description,
    icon,
    config_type,
    layer_config,
    map_center,
    map_zoom
  )
  SELECT
    p_user_id,
    p_new_name,
    description || ' (Copy)',
    icon,
    'custom',
    layer_config,
    map_center,
    map_zoom
  FROM map_configurations
  WHERE id = p_config_id
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_map_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER map_configurations_updated_at
  BEFORE UPDATE ON map_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_map_configurations_updated_at();

-- Ensure only one default per user
CREATE OR REPLACE FUNCTION enforce_single_default_map()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE map_configurations
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_default_map_config
  AFTER INSERT OR UPDATE ON map_configurations
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION enforce_single_default_map();

-- =============================================================================
-- DEFAULT TEMPLATES
-- =============================================================================

-- Note: Default War Maps templates will be seeded via application code
-- See map-configs.seed.ts for seeding logic

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE map_configurations IS 'Saved map layer configurations (War Maps, custom views)';
COMMENT ON COLUMN map_configurations.layer_config IS 'JSONB array of layer definitions with styles and filters';
COMMENT ON COLUMN map_configurations.config_type IS 'war_map (pre-configured), custom (user-created), template (shareable)';
COMMENT ON COLUMN map_configurations.is_default IS 'Default map to load on dashboard (one per user)';
COMMENT ON COLUMN map_configurations.is_public IS 'Shareable with team members';
