ALTER TABLE property_records ADD COLUMN IF NOT EXISTS enrichment_source TEXT;
ALTER TABLE property_records ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;
