-- Deal Zoning Confirmations Table
-- Stores confirmed zoning districts to unlock analysis tabs

CREATE TABLE IF NOT EXISTS deal_zoning_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  zoning_code VARCHAR(50) NOT NULL,
  municipality VARCHAR(255),
  state VARCHAR(2),
  confirmed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_zoning_confirmations_deal_id 
  ON deal_zoning_confirmations(deal_id);

COMMENT ON TABLE deal_zoning_confirmations IS 'Tracks zoning district confirmation for progressive disclosure in Property & Zoning module';
COMMENT ON COLUMN deal_zoning_confirmations.zoning_code IS 'Confirmed zoning district code (e.g., MRC-3, R-4)';
COMMENT ON COLUMN deal_zoning_confirmations.confirmed_at IS 'When user confirmed the zoning, triggers full analysis';
