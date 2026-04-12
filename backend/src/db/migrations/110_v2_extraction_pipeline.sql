CREATE TABLE IF NOT EXISTS deal_properties (
  deal_id VARCHAR(255) NOT NULL,
  property_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'subject',
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (deal_id, property_id)
);

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS year1 JSONB;

CREATE INDEX IF NOT EXISTS idx_deal_assumptions_year1_gin
  ON deal_assumptions USING GIN (year1);

CREATE UNIQUE INDEX IF NOT EXISTS platform_intel_xdoc_unique
  ON platform_intel (deal_id, intel_type, source_label)
  WHERE intel_type = 'cross_doc_variance';

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS year_built INTEGER,
  ADD COLUMN IF NOT EXISTS year_renovated INTEGER,
  ADD COLUMN IF NOT EXISTS gross_area_sqft NUMERIC,
  ADD COLUMN IF NOT EXISTS land_area_acres NUMERIC;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS legal_owner VARCHAR(500);
