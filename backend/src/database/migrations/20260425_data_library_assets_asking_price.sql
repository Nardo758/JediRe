-- Add asking_price column to data_library_assets so the Asset Detail Modal can
-- record Asking Price separately from Sold Price (sale_price). Additive only;
-- does not touch any existing column or primary key.

ALTER TABLE data_library_assets
  ADD COLUMN IF NOT EXISTS asking_price NUMERIC(15,2);

CREATE INDEX IF NOT EXISTS idx_dla_asking_price
  ON data_library_assets (asking_price)
  WHERE asking_price IS NOT NULL;
