-- ============================================
-- DEAL CAPSULES SYSTEM (Complete)
-- ============================================
-- Created: 2026-02-17
-- Purpose: Deal capsules with 3-layer architecture + module integration

-- Deal capsules table (main container for deals)
CREATE TABLE IF NOT EXISTS deal_capsules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Core 3 layers
  deal_data JSONB NOT NULL DEFAULT '{}', -- Layer 1: Original broker/seller claims (PRESERVED)
  platform_intel JSONB DEFAULT '{}',      -- Layer 2: Market data from platform (COMPARISON)
  user_adjustments JSONB DEFAULT '{}',    -- Layer 3: User's final model (PRO FORMA INPUT)
  
  -- Module outputs (separate from layers!)
  module_outputs JSONB DEFAULT '{}',
  -- Structure:
  -- {
  --   "financial": { "pro_forma": [...], "irr": 18.1, "last_calculated": "..." },
  --   "traffic": { "weekly_walk_ins": 2250, "revenue": 13500, "last_calculated": "..." },
  --   "development": { "building_design": {...}, "cost_estimate": {...} },
  --   "market_research": { "submarket_analysis": {...} },
  --   "due_diligence": { "checklist": {...}, "progress": 32 },
  --   "ai_conversations": [...]
  -- }
  
  -- Metadata
  property_address TEXT,
  asset_class VARCHAR(50),
  status VARCHAR(50) DEFAULT 'DISCOVER', -- DISCOVER, RESEARCH, ANALYZE, MODEL, EXECUTE, TRACK
  
  -- JEDI Score (calculated from collision engine)
  jedi_score INTEGER, -- 0-100
  collision_score INTEGER, -- 0-100 (personalized score)
  
  -- Tracking
  last_module_run JSONB DEFAULT '{}', -- Track when each module last ran
  -- { "financial": "2026-02-17T14:30:00Z", "traffic": "2026-02-17T14:31:00Z" }
  
  version INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deal_capsules_user ON deal_capsules(user_id);
CREATE INDEX idx_deal_capsules_status ON deal_capsules(status);
CREATE INDEX idx_deal_capsules_asset_class ON deal_capsules(asset_class);
CREATE INDEX idx_deal_capsules_jedi_score ON deal_capsules(jedi_score);
CREATE INDEX idx_deal_capsules_created ON deal_capsules(created_at);

-- GIN indexes for JSONB searching
CREATE INDEX idx_deal_capsules_deal_data ON deal_capsules USING GIN(deal_data);
CREATE INDEX idx_deal_capsules_platform_intel ON deal_capsules USING GIN(platform_intel);
CREATE INDEX idx_deal_capsules_user_adjustments ON deal_capsules USING GIN(user_adjustments);

-- Capsule documents (attachments, broker OMs, etc.)
CREATE TABLE capsule_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID NOT NULL REFERENCES deal_capsules(id) ON DELETE CASCADE,
  
  document_type VARCHAR(50) NOT NULL, -- 'offering_memorandum', 'pro_forma', 'inspection', 'appraisal', etc.
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type VARCHAR(100),
  
  -- Extracted data (OCR, parsing)
  extracted_data JSONB,
  extraction_status VARCHAR(50), -- 'pending', 'processing', 'complete', 'failed'
  
  uploaded_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_capsule_documents_capsule ON capsule_documents(capsule_id);
CREATE INDEX idx_capsule_documents_type ON capsule_documents(document_type);

-- Capsule sharing (for collaboration)
CREATE TABLE capsule_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID NOT NULL REFERENCES deal_capsules(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL,
  shared_with UUID, -- NULL = public link
  
  permission_tier VARCHAR(20) NOT NULL, -- 'basic', 'intel', 'full', 'collaborative'
  -- 'basic' = Layer 1 only
  -- 'intel' = Layer 1 + selected Layer 2 insights
  -- 'full' = All 3 layers + sender's analysis
  -- 'collaborative' = Real-time editing
  
  share_token VARCHAR(100) UNIQUE, -- For public links
  expires_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_capsule_shares_capsule ON capsule_shares(capsule_id);
CREATE INDEX idx_capsule_shares_token ON capsule_shares(share_token);
CREATE INDEX idx_capsule_shares_with ON capsule_shares(shared_with);

-- Capsule activity log (audit trail)
CREATE TABLE capsule_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID NOT NULL REFERENCES deal_capsules(id) ON DELETE CASCADE,
  user_id UUID,
  
  activity_type VARCHAR(50) NOT NULL, -- 'created', 'layer3_updated', 'module_ran', 'shared', 'exported'
  activity_data JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_capsule_activity_capsule ON capsule_activity(capsule_id);
CREATE INDEX idx_capsule_activity_type ON capsule_activity(activity_type);
CREATE INDEX idx_capsule_activity_created ON capsule_activity(created_at);

-- View: Capsule summary for list views
CREATE VIEW capsule_summary AS
SELECT 
  c.id,
  c.user_id,
  c.property_address,
  c.asset_class,
  c.status,
  c.jedi_score,
  c.collision_score,
  c.deal_data->>'asking_price' as asking_price,
  c.deal_data->>'units' as units,
  c.created_at,
  c.updated_at,
  COUNT(DISTINCT cd.id) as document_count,
  COUNT(DISTINCT cs.id) as share_count
FROM deal_capsules c
LEFT JOIN capsule_documents cd ON cd.capsule_id = c.id
LEFT JOIN capsule_shares cs ON cs.capsule_id = c.id
GROUP BY c.id;

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_deal_capsule_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deal_capsules_updated
BEFORE UPDATE ON deal_capsules
FOR EACH ROW
EXECUTE FUNCTION update_deal_capsule_timestamp();

-- Comments
COMMENT ON TABLE deal_capsules IS 'Main table for deal capsules with 3-layer architecture';
COMMENT ON COLUMN deal_capsules.deal_data IS 'Layer 1: Original broker/seller claims - NEVER modified by platform';
COMMENT ON COLUMN deal_capsules.platform_intel IS 'Layer 2: Market data for comparison - does NOT override deal_data';
COMMENT ON COLUMN deal_capsules.user_adjustments IS 'Layer 3: Users final assumptions - used in pro formas';
COMMENT ON COLUMN deal_capsules.module_outputs IS 'Results from modules (financial, traffic, etc.) - separate from layers';
COMMENT ON COLUMN deal_capsules.collision_score IS 'Personalized score from collision engine (Layer 1 + 2 + 3 combined)';

COMMENT ON TABLE capsule_shares IS 'Sharing & collaboration with 4 permission tiers';
COMMENT ON COLUMN capsule_shares.permission_tier IS 'basic=L1 only, intel=L1+L2 selected, full=all 3 layers, collaborative=real-time edit';
