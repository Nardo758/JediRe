ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS source_ref VARCHAR(500);
ALTER TABLE deal_monthly_actuals ADD COLUMN IF NOT EXISTS source_date DATE;

CREATE TABLE IF NOT EXISTS platform_intel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  title VARCHAR(500) NOT NULL,
  detail JSONB DEFAULT '{}'::jsonb,
  source_document_type VARCHAR(50),
  source_ref VARCHAR(500),
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_intel_deal ON platform_intel(deal_id);
CREATE INDEX IF NOT EXISTS idx_platform_intel_type ON platform_intel(alert_type);
