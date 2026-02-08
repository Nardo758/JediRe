-- Migration 012: Map Layers System
-- Purpose: Store layer configurations for maps
-- Created: 2026-02-08

CREATE TABLE IF NOT EXISTS map_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL,
  
  name VARCHAR(255) NOT NULL,
  layer_type VARCHAR(50) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  
  visible BOOLEAN DEFAULT true,
  opacity NUMERIC(3,2) DEFAULT 1.0 CHECK (opacity >= 0 AND opacity <= 1),
  z_index INTEGER DEFAULT 0,
  
  filters JSONB DEFAULT '{}',
  style JSONB DEFAULT '{}',
  source_config JSONB DEFAULT '{}',
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_map_layers_map_id ON map_layers(map_id);
CREATE INDEX idx_map_layers_visible ON map_layers(visible) WHERE visible = true;
CREATE INDEX idx_map_layers_z_index ON map_layers(map_id, z_index);
CREATE INDEX idx_map_layers_source_type ON map_layers(source_type);

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
