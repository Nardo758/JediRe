-- Add submarket_id to deal_files for submarket-scoped Market Documents
-- Phase 2: Document Library download + delete fix

ALTER TABLE deal_files
  ADD COLUMN IF NOT EXISTS submarket_id VARCHAR(40) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_deal_files_submarket_id
  ON deal_files(submarket_id)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN deal_files.submarket_id IS
  'Submarket scope for Market Documents. NULL = deal-private file. When set, the file is visible to all deals in that submarket via /api/v1/submarkets/:submarketId/documents.';
