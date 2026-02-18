-- Migration 031: Add Deal Capsule Three-Layer Architecture to Deals Table
-- Date: 2026-02-18
-- Description: Add three-layer architecture columns to existing deals table
--              Integrates training/calibration system directly into deals

-- ============================================================================
-- ADD THREE-LAYER ARCHITECTURE COLUMNS
-- ============================================================================

-- Layer 1: Deal Data (broker/seller claims - NEVER modified)
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS deal_data JSONB DEFAULT '{}';

-- Layer 2: Platform Intelligence (market reality - comparison only)
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS platform_intel JSONB DEFAULT '{}';

-- Layer 3: User Adjustments (pro forma input - user controls)
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS user_adjustments JSONB DEFAULT '{}';

-- Module Outputs (analysis results - separate from layers)
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS module_outputs JSONB DEFAULT '{}';

COMMENT ON COLUMN deals.deal_data IS 'Layer 1: Original broker/seller claims - preserved as-is, never modified by platform';
COMMENT ON COLUMN deals.platform_intel IS 'Layer 2: Platform market intelligence - used for comparison only, not replacement';
COMMENT ON COLUMN deals.user_adjustments IS 'Layer 3: User pro forma adjustments - what actually goes into financial model';
COMMENT ON COLUMN deals.module_outputs IS 'Module analysis results - stored separately from three layers';

-- ============================================================================
-- ADD CAPSULE-SPECIFIC COLUMNS
-- ============================================================================

-- Property address (for display/search)
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS property_address TEXT;

-- JEDI Score (overall deal quality)
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS jedi_score INTEGER;

COMMENT ON COLUMN deals.property_address IS 'Primary property address for this deal';
COMMENT ON COLUMN deals.jedi_score IS 'Overall deal quality score (0-100)';

-- ============================================================================
-- ADD INDEXES FOR PERFORMANCE
-- ============================================================================

-- GIN indexes for JSONB columns (enables fast queries on JSON fields)
CREATE INDEX IF NOT EXISTS idx_deals_deal_data ON deals USING GIN(deal_data);
CREATE INDEX IF NOT EXISTS idx_deals_platform_intel ON deals USING GIN(platform_intel);
CREATE INDEX IF NOT EXISTS idx_deals_user_adjustments ON deals USING GIN(user_adjustments);
CREATE INDEX IF NOT EXISTS idx_deals_module_outputs ON deals USING GIN(module_outputs);

-- Index on property address for search
CREATE INDEX IF NOT EXISTS idx_deals_property_address ON deals(property_address);

-- Index on JEDI score for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_deals_jedi_score ON deals(jedi_score DESC);

-- ============================================================================
-- DEAL DOCUMENTS (attachments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- File metadata
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL, -- 'pdf', 'xlsx', 'docx', 'jpg', etc.
  file_url TEXT NOT NULL,
  file_size BIGINT, -- bytes
  
  -- Upload tracking
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  
  -- Optional metadata
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_deal_documents_deal_id ON deal_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_documents_uploaded_by ON deal_documents(uploaded_by);

COMMENT ON TABLE deal_documents IS 'Documents attached to deals (OM, contracts, reports, etc.)';

-- ============================================================================
-- DEAL SHARES (collaboration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Sharing details
  shared_by UUID NOT NULL REFERENCES users(id),
  shared_with_email VARCHAR(255) NOT NULL,
  
  -- Permission tier
  permission_tier VARCHAR(20) NOT NULL, -- 'VIEW', 'COMMENT', 'EDIT', 'ADMIN'
  
  -- Share token (for public access)
  share_token VARCHAR(100) UNIQUE,
  
  -- Expiration
  expires_at TIMESTAMP,
  
  -- Optional message
  custom_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  accessed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deal_shares_deal_id ON deal_shares(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_shares_shared_by ON deal_shares(shared_by);
CREATE INDEX IF NOT EXISTS idx_deal_shares_token ON deal_shares(share_token);

COMMENT ON TABLE deal_shares IS 'Deal sharing and collaboration permissions';

-- ============================================================================
-- DEAL ACTIVITY LOG (audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Activity details
  user_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'shared', 'document_uploaded', etc.
  details JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_activity_deal_id ON deal_activity(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_activity_user_id ON deal_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_activity_created_at ON deal_activity(created_at DESC);

COMMENT ON TABLE deal_activity IS 'Audit trail of all deal activities';

-- ============================================================================
-- CREATE VIEW FOR DEAL SUMMARY (list view)
-- ============================================================================
CREATE OR REPLACE VIEW deal_summary AS
SELECT 
  d.id,
  d.user_id,
  d.name,
  d.property_address,
  d.status,
  d.jedi_score,
  d.created_at,
  d.updated_at,
  COUNT(DISTINCT dd.id) as document_count,
  COUNT(DISTINCT ds.id) as share_count
FROM deals d
LEFT JOIN deal_documents dd ON d.id = dd.deal_id
LEFT JOIN deal_shares ds ON d.id = ds.deal_id
GROUP BY d.id, d.user_id, d.name, d.property_address, d.status, d.jedi_score, d.created_at, d.updated_at;

COMMENT ON VIEW deal_summary IS 'Summary view of deals with counts for list displays';

-- ============================================================================
-- UPDATE TRIGGER FOR updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_deals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_deals_updated_at ON deals;
CREATE TRIGGER trigger_update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_deals_updated_at();

COMMENT ON FUNCTION update_deals_updated_at() IS 'Auto-update updated_at timestamp on deals table';
