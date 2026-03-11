-- Migration 041: Add Geometry Support to Property Records
-- Enables spatial queries for neighboring property analysis

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column to property_records
ALTER TABLE property_records 
ADD COLUMN IF NOT EXISTS parcel_geometry geometry(Geometry, 4326);

-- Create spatial index for performance
CREATE INDEX IF NOT EXISTS idx_property_records_geometry 
ON property_records USING GIST (parcel_geometry);

-- Create helper function to generate simple polygon from parcel area
-- (For properties that don't have actual parcel boundaries yet)
CREATE OR REPLACE FUNCTION generate_parcel_boundary(
  center_lat FLOAT,
  center_lng FLOAT,
  area_sqft FLOAT
)
RETURNS geometry AS $$
DECLARE
  radius_meters FLOAT;
  buffer_size FLOAT;
BEGIN
  -- Calculate approximate radius from area (assuming square parcel)
  radius_meters := SQRT(area_sqft * 0.092903) / 2; -- sqft to m2, then half diagonal
  
  -- Create a buffered point as a simple polygon approximation
  RETURN ST_Buffer(
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_meters
  )::geometry;
END;
$$ LANGUAGE plpgsql;

-- Update existing records with approximate geometries if they have parcel_area_sqft
-- and lat/lng coordinates (you'll need to add lat/lng columns first if they don't exist)
-- This is a placeholder - in production, you'd import actual parcel boundaries from GIS data

COMMENT ON COLUMN property_records.parcel_geometry IS 
  'Parcel boundary geometry for spatial analysis. Polygon or MultiPolygon in WGS84 (SRID 4326).';

COMMENT ON FUNCTION generate_parcel_boundary IS
  'Helper function to create approximate parcel boundary from center point and area. Use actual GIS data when available.';
