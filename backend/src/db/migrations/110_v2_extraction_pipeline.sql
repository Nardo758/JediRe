CREATE TABLE IF NOT EXISTS deal_properties (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  property_id UUID NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  notes TEXT,
  linked_by VARCHAR(20) DEFAULT 'auto',
  confidence_score NUMERIC(3,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE (deal_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_properties_deal ON deal_properties (deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_properties_property ON deal_properties (property_id);

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS year1 JSONB;

CREATE INDEX IF NOT EXISTS idx_deal_assumptions_year1_gin
  ON deal_assumptions USING GIN (year1);

CREATE UNIQUE INDEX IF NOT EXISTS platform_intel_xdoc_unique
  ON platform_intel (deal_id, alert_type)
  WHERE alert_type LIKE 'cross_doc_%';

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS year_built INTEGER,
  ADD COLUMN IF NOT EXISTS year_renovated INTEGER,
  ADD COLUMN IF NOT EXISTS gross_area_sqft NUMERIC,
  ADD COLUMN IF NOT EXISTS land_area_acres NUMERIC;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS legal_owner VARCHAR(500);
