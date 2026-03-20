-- Migration 043: Property Boundaries
-- Create table for storing site boundary definitions for development deals

CREATE TABLE IF NOT EXISTS property_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Boundary geometry (GeoJSON Polygon)
  boundary_geojson JSONB NOT NULL,
  
  -- Calculated metrics
  parcel_area DECIMAL(10, 2), -- acres
  parcel_area_sf DECIMAL(12, 2), -- square feet
  perimeter DECIMAL(10, 2), -- linear feet
  centroid POINT, -- PostgreSQL point type for center coordinates
  
  -- Setbacks (in feet)
  setbacks JSONB NOT NULL DEFAULT '{"front": 25, "side": 15, "rear": 20}'::jsonb,
  
  -- Buildable area (after setbacks)
  buildable_area DECIMAL(10, 2), -- acres
  buildable_area_sf DECIMAL(12, 2), -- square feet
  buildable_percentage DECIMAL(5, 4), -- percentage (0.0 to 1.0)
  
  -- Constraints
  constraints JSONB DEFAULT '{}'::jsonb,
  
  -- Reference documents
  survey_document_url TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  
  -- Ensure only one boundary per deal
  UNIQUE(deal_id)
);

-- Create index on deal_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_property_boundaries_deal_id ON property_boundaries(deal_id);

-- Create index on centroid for spatial queries (if using PostGIS in future)
-- CREATE INDEX IF NOT EXISTS idx_property_boundaries_centroid ON property_boundaries USING GIST(centroid);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_property_boundaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_boundaries_updated_at
  BEFORE UPDATE ON property_boundaries
  FOR EACH ROW
  EXECUTE FUNCTION update_property_boundaries_updated_at();

-- Comments
COMMENT ON TABLE property_boundaries IS 'Site boundary definitions for development deals - source of truth for zoning and 3D design';
COMMENT ON COLUMN property_boundaries.boundary_geojson IS 'GeoJSON Polygon feature representing property boundary';
COMMENT ON COLUMN property_boundaries.buildable_area IS 'Net buildable area after applying setbacks';
COMMENT ON COLUMN property_boundaries.constraints IS 'JSON object containing easements, floodplain, wetlands, etc.';
