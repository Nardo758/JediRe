-- Migration 034: Add multifamily building columns to properties table
-- These columns support the leasing service for apartment/multifamily properties

ALTER TABLE properties ADD COLUMN IF NOT EXISTS units INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS current_occupancy DECIMAL(4,3);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS submarket_id VARCHAR(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS avg_rent DECIMAL(10,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS market_rent DECIMAL(10,2);

COMMENT ON COLUMN properties.units IS 'Total unit count for multifamily buildings';
COMMENT ON COLUMN properties.current_occupancy IS 'Current occupancy rate as decimal (e.g. 0.950 = 95%)';
COMMENT ON COLUMN properties.submarket_id IS 'Submarket identifier for market comparison';
COMMENT ON COLUMN properties.avg_rent IS 'Average in-place rent across all units';
COMMENT ON COLUMN properties.market_rent IS 'Current market rent for comparable units';
