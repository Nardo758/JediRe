CREATE TABLE IF NOT EXISTS deal_assumptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  source_type VARCHAR(50),
  source_date TIMESTAMP,
  year1 JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE (deal_id)
);

CREATE TABLE IF NOT EXISTS platform_intel (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  title VARCHAR(500) NOT NULL,
  detail JSONB DEFAULT '{}'::jsonb,
  source_document_type VARCHAR(50),
  source_ref VARCHAR(500),
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_platform_intel_deal ON platform_intel (deal_id);
CREATE INDEX IF NOT EXISTS idx_platform_intel_type ON platform_intel (alert_type);

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
