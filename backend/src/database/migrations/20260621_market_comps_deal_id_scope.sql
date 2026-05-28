-- Migration: Add deal_id scope column to market_sale_comps and market_rent_comps
-- Task #1389 — CoStar upload data isolation fix
--
-- NULL deal_id = public market data (county_recorded, research_agent, etc.)
-- Non-null deal_id = uploaded by a specific deal's operator (costar_upload, operator_entry)
-- Consumers must filter: source != 'costar_upload' OR deal_id = <subject_deal_id>

ALTER TABLE market_sale_comps
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

ALTER TABLE market_rent_comps
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_market_sale_comps_deal_id ON market_sale_comps(deal_id)
  WHERE deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_market_rent_comps_deal_id ON market_rent_comps(deal_id)
  WHERE deal_id IS NOT NULL;
