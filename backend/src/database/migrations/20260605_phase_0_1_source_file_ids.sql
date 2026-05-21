-- Phase 0.1 — add source_file_ids to historical_observations
-- Links observation rows back to the data_library_files that sourced them.

BEGIN;

ALTER TABLE historical_observations
  ADD COLUMN IF NOT EXISTS source_file_ids uuid[];

CREATE INDEX IF NOT EXISTS idx_ho_source_files
  ON historical_observations USING GIN (source_file_ids);

COMMIT;
