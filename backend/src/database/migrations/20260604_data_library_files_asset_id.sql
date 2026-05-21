-- Add asset_id FK to data_library_files so every uploaded file can be
-- traced back to its parent data_library_assets row.
-- One asset can have many files (1:N); the existing file_id column on
-- data_library_assets stays as a pointer to the PRIMARY source file.

ALTER TABLE data_library_files
  ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES data_library_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dlf_asset_id
  ON data_library_files(asset_id)
  WHERE asset_id IS NOT NULL;

-- Back-fill: for each asset that already has a file_id set, write
-- that asset's id back onto the corresponding data_library_files row.
UPDATE data_library_files dlf
SET    asset_id = a.id
FROM   data_library_assets a
WHERE  a.file_id = dlf.id
  AND  dlf.asset_id IS NULL;
