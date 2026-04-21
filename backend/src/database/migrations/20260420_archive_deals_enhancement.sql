-- Migration: archive_deals_enhancement
-- Date: 2026-04-20
-- Description: Enhance data_library_assets for archive deal storage with
--              bucketing attributes for comparable deal matching.

-- Add archive-specific columns to data_library_assets if they don't exist
DO $$
BEGIN
  -- Source type: 'archive' for ingested historical deals, 'active' for current deals
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'source_type') THEN
    ALTER TABLE data_library_assets ADD COLUMN source_type TEXT DEFAULT 'active';
  END IF;

  -- Archive folder path (for tracking which folder this came from)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'archive_folder_path') THEN
    ALTER TABLE data_library_assets ADD COLUMN archive_folder_path TEXT;
  END IF;

  -- Property attributes for bucketing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'property_type') THEN
    ALTER TABLE data_library_assets ADD COLUMN property_type TEXT; -- garden, mid-rise, high-rise, townhome
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'stories') THEN
    ALTER TABLE data_library_assets ADD COLUMN stories INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'vintage_band') THEN
    ALTER TABLE data_library_assets ADD COLUMN vintage_band TEXT; -- pre-1980, 1980-1999, 2000-2009, 2010-2019, 2020+
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'asset_class') THEN
    ALTER TABLE data_library_assets ADD COLUMN asset_class TEXT DEFAULT 'B'; -- A, B, C, D
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'submarket_id') THEN
    ALTER TABLE data_library_assets ADD COLUMN submarket_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'msa') THEN
    ALTER TABLE data_library_assets ADD COLUMN msa TEXT;
  END IF;

  -- Unit count bands for bucketing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'unit_count_band') THEN
    ALTER TABLE data_library_assets ADD COLUMN unit_count_band TEXT; -- <100, 100-199, 200-299, 300-399, 400+
  END IF;

  -- Financial metrics extracted from T12
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'trailing_noi') THEN
    ALTER TABLE data_library_assets ADD COLUMN trailing_noi NUMERIC;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'trailing_revenue') THEN
    ALTER TABLE data_library_assets ADD COLUMN trailing_revenue NUMERIC;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'trailing_opex') THEN
    ALTER TABLE data_library_assets ADD COLUMN trailing_opex NUMERIC;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'opex_ratio') THEN
    ALTER TABLE data_library_assets ADD COLUMN opex_ratio NUMERIC;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'noi_per_unit') THEN
    ALTER TABLE data_library_assets ADD COLUMN noi_per_unit NUMERIC;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'opex_per_unit') THEN
    ALTER TABLE data_library_assets ADD COLUMN opex_per_unit NUMERIC;
  END IF;

  -- Rent roll metrics
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'avg_rent') THEN
    ALTER TABLE data_library_assets ADD COLUMN avg_rent NUMERIC;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'occupancy_pct') THEN
    ALTER TABLE data_library_assets ADD COLUMN occupancy_pct NUMERIC;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'loss_to_lease_pct') THEN
    ALTER TABLE data_library_assets ADD COLUMN loss_to_lease_pct NUMERIC;
  END IF;

  -- OM / broker claims (JSONB)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'broker_claims') THEN
    ALTER TABLE data_library_assets ADD COLUMN broker_claims JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Source files tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'source_files') THEN
    ALTER TABLE data_library_assets ADD COLUMN source_files JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Parse status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'parse_status') THEN
    ALTER TABLE data_library_assets ADD COLUMN parse_status TEXT DEFAULT 'pending'; -- pending, parsing, complete, error
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'parse_warnings') THEN
    ALTER TABLE data_library_assets ADD COLUMN parse_warnings TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'data_library_assets' AND column_name = 'parsed_at') THEN
    ALTER TABLE data_library_assets ADD COLUMN parsed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Index for archive comp queries
CREATE INDEX IF NOT EXISTS idx_data_library_archive_comps
  ON data_library_assets (source_type, state, msa, property_type, vintage_band, unit_count_band)
  WHERE source_type = 'archive';

-- Index for financial metric queries
CREATE INDEX IF NOT EXISTS idx_data_library_financials
  ON data_library_assets (source_type, trailing_noi, opex_ratio, noi_per_unit)
  WHERE trailing_noi IS NOT NULL;

-- Unique constraint on archive folder path
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_library_archive_folder
  ON data_library_assets (archive_folder_path)
  WHERE archive_folder_path IS NOT NULL;
