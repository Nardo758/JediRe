-- Add deterministic asset_id FK to property_descriptions
-- Resolves the brittle property_name == parcel_id string-match assumption
-- by persisting a direct UUID reference to data_library_assets.

ALTER TABLE property_descriptions
  ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES data_library_assets(id) ON DELETE SET NULL;

-- Backfill: link existing rows via property_name → parcel_id match.
-- ORDER BY created_at DESC inside the subquery ensures the most-recent
-- asset wins when property names are not globally unique.
UPDATE property_descriptions pd
SET asset_id = (
  SELECT a.id
  FROM data_library_assets a
  WHERE a.property_name = pd.parcel_id
  ORDER BY a.created_at DESC
  LIMIT 1
)
WHERE pd.asset_id IS NULL;

-- Efficient lookups by asset_id (DQ recalculator, apply/discard paths)
CREATE INDEX IF NOT EXISTS idx_property_descriptions_asset_id
  ON property_descriptions(asset_id)
  WHERE asset_id IS NOT NULL;
