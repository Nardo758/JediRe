-- Migration: Add deal categorization fields
-- Created: 2026-02-07
-- Description: Add fields for Portfolio vs Pipeline and New vs Existing Development

-- Add new columns to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_category VARCHAR(20) DEFAULT 'pipeline';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS development_type VARCHAR(20) DEFAULT 'existing';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS address TEXT;

-- Add check constraints
ALTER TABLE deals ADD CONSTRAINT IF NOT EXISTS deals_category_check 
  CHECK (deal_category IN ('portfolio', 'pipeline'));

ALTER TABLE deals ADD CONSTRAINT IF NOT EXISTS deals_development_type_check 
  CHECK (development_type IN ('new', 'existing'));

-- Add indexes for filtering
CREATE INDEX IF NOT EXISTS idx_deals_category ON deals(deal_category);
CREATE INDEX IF NOT EXISTS idx_deals_development_type ON deals(development_type);

-- Add comments
COMMENT ON COLUMN deals.deal_category IS 'Portfolio (owned) or Pipeline (prospecting)';
COMMENT ON COLUMN deals.development_type IS 'New development or existing property';
COMMENT ON COLUMN deals.address IS 'Property address for geocoding and display';

-- Update existing deals to have default values (pipeline + existing)
UPDATE deals 
SET deal_category = 'pipeline',
    development_type = 'existing'
WHERE deal_category IS NULL OR development_type IS NULL;
