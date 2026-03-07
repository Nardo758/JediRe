-- Migration: Add missing property fields for automation gaps
-- Date: 2026-03-05
-- Purpose: Add land_cost, parcel_id, lot_size_acres to enable full deal automation

-- Add missing fields to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS parcel_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS lot_size_acres NUMERIC(10, 4),
ADD COLUMN IF NOT EXISTS land_cost NUMERIC(15, 2);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_properties_parcel_id ON properties(parcel_id);
CREATE INDEX IF NOT EXISTS idx_properties_lot_size_acres ON properties(lot_size_acres);

-- Add comments for documentation
COMMENT ON COLUMN properties.parcel_id IS 'County assessor parcel/APN number';
COMMENT ON COLUMN properties.lot_size_acres IS 'Lot size in acres (easier for development calcs than sqft)';
COMMENT ON COLUMN properties.land_cost IS 'Land acquisition cost (user-provided)';
