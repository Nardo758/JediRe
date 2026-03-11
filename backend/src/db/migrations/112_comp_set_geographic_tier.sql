ALTER TABLE deal_comp_sets ADD COLUMN IF NOT EXISTS geographic_tier VARCHAR(20) DEFAULT 'trade_area';
CREATE INDEX IF NOT EXISTS idx_deal_comp_sets_tier ON deal_comp_sets (geographic_tier);
