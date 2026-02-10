-- Migration 018: Fix Boundary Geometry Type
-- Issue: deals.boundary column only accepts Polygon, but existing properties need Point
-- Solution: Change from strict Polygon to flexible Geometry (accepts Point, Polygon, etc.)

-- ============================================================================
-- FIX DEALS.BOUNDARY COLUMN TYPE
-- ============================================================================

-- Change from Polygon to generic Geometry
-- This allows both Point (existing properties) and Polygon (new developments)
ALTER TABLE deals 
ALTER COLUMN boundary 
TYPE geometry 
USING boundary::geometry;

COMMENT ON COLUMN deals.boundary IS 
'Property boundary geometry - can be Point (existing property address) or Polygon (custom drawn boundary for new development)';

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- To rollback (WARNING: will fail if any Point geometries exist):
-- ALTER TABLE deals ALTER COLUMN boundary TYPE geometry(Polygon, 4326) USING boundary::geometry;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test that both Point and Polygon work:
-- INSERT INTO deals (name, boundary, ...) VALUES ('Test Point', ST_SetSRID(ST_MakePoint(-84.388, 33.749), 4326), ...);
-- INSERT INTO deals (name, boundary, ...) VALUES ('Test Polygon', ST_SetSRID(ST_GeomFromText('POLYGON((...))'), 4326), ...);
