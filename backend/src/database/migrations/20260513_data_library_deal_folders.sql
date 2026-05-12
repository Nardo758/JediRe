-- Migration: Data Library deal_id FK + redistribution_restricted flag
-- Establishes per-deal folder structure for the Data Library. Files with
-- deal_id IS NULL surface in the "Unaffiliated" pseudo-folder.
-- Downstream: corpus-build ticket consumes deal_id to set is_subject_property
-- on historical_observations rows.

ALTER TABLE data_library_files
  ADD COLUMN IF NOT EXISTS deal_id UUID
    REFERENCES deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS redistribution_restricted BOOLEAN
    NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_data_library_files_deal
  ON data_library_files(deal_id)
  WHERE deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_library_files_restricted
  ON data_library_files(redistribution_restricted)
  WHERE redistribution_restricted = TRUE;

COMMENT ON COLUMN data_library_files.deal_id IS
  'Optional foreign key to deals.id. NULL for files not associated with a
   specific deal (e.g., email archive imports, market-wide data uploads).';

COMMENT ON COLUMN data_library_files.redistribution_restricted IS
  'TRUE for files containing licensed data that cannot be redistributed
   (e.g., CoStar, Yardi Matrix). Multi-tenant surfaces must filter these rows out.';
