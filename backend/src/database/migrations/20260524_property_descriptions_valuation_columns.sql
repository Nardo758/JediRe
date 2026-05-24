-- Step 2: Add assessed_value, appraised_value, owner to property_descriptions
-- LayeredValue<number|string> shape: { value, source, runAt }

ALTER TABLE property_descriptions
  ADD COLUMN IF NOT EXISTS assessed_value  jsonb,
  ADD COLUMN IF NOT EXISTS appraised_value jsonb,
  ADD COLUMN IF NOT EXISTS owner           jsonb;

-- GIN index for owner-name search (off-market sourcing use case)
CREATE INDEX IF NOT EXISTS idx_pd_owner_value
  ON property_descriptions USING gin ((owner -> 'value'));

COMMENT ON COLUMN property_descriptions.assessed_value  IS 'LayeredValue<number> — county assessed value in dollars. { value, source: "municipal:<arcgis_source>", runAt }';
COMMENT ON COLUMN property_descriptions.appraised_value IS 'LayeredValue<number> — county appraised/market value in dollars. { value, source: "municipal:<arcgis_source>", runAt }';
COMMENT ON COLUMN property_descriptions.owner           IS 'LayeredValue<string> — owner name from county assessor. { value, source: "municipal:<arcgis_source>", runAt }';
