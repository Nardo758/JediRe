CREATE TABLE IF NOT EXISTS deal_receivables_aging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  unit_number VARCHAR(20),
  tenant_name VARCHAR(200),
  current_balance NUMERIC(12, 2) DEFAULT 0,
  bucket_0_30 NUMERIC(12, 2) DEFAULT 0,
  bucket_31_60 NUMERIC(12, 2) DEFAULT 0,
  bucket_61_90 NUMERIC(12, 2) DEFAULT 0,
  bucket_90_plus NUMERIC(12, 2) DEFAULT 0,
  prepaid NUMERIC(12, 2) DEFAULT 0,
  total_balance NUMERIC(12, 2) DEFAULT 0,
  lease_status VARCHAR(30),
  source_type VARCHAR(30) DEFAULT 'upload',
  source_ref VARCHAR(500),
  source_date DATE,
  source_deal_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receivables_deal ON deal_receivables_aging(deal_id);
CREATE INDEX IF NOT EXISTS idx_receivables_unit ON deal_receivables_aging(unit_number);

ALTER TABLE data_library_assets ADD COLUMN IF NOT EXISTS source_deal_id UUID;
ALTER TABLE data_library_assets ADD COLUMN IF NOT EXISTS extraction_data JSONB DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_library_assets_source_deal_id ON data_library_assets(source_deal_id) WHERE source_deal_id IS NOT NULL;
