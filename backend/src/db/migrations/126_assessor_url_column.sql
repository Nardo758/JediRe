ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS assessor_url TEXT;

ALTER TABLE property_records
  ADD COLUMN IF NOT EXISTS assessor_url TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_assessor_url
  ON properties(assessor_url)
  WHERE assessor_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_records_assessor_url
  ON property_records(assessor_url)
  WHERE assessor_url IS NOT NULL;
