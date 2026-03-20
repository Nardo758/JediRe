-- Add photos column to property_records table
-- Stores scraped photo URLs from Zillow, Redfin, etc.

ALTER TABLE property_records 
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';

-- Index for faster photo queries
CREATE INDEX IF NOT EXISTS idx_property_records_photos 
ON property_records USING GIN (photos);

-- Example photo structure:
-- [
--   {"url": "https://photos.zillowstatic.com/...", "label": "Exterior", "order": 0, "source": "zillow"},
--   {"url": "https://ssl.cdn-redfin.com/...", "label": "Pool", "order": 1, "source": "redfin"}
-- ]

COMMENT ON COLUMN property_records.photos IS 'Array of photo objects with url, label, order, and source';
