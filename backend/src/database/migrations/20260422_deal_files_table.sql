-- Deal Files Table
-- Unified document storage for pipeline and portfolio deals
-- Created: 2026-04-22

CREATE TABLE IF NOT EXISTS deal_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- File info
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  file_extension TEXT,
  
  -- Categorization
  category TEXT NOT NULL DEFAULT 'other',
  folder_path TEXT NOT NULL DEFAULT '/',
  tags TEXT[] DEFAULT '{}',
  description TEXT,
  
  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  parent_file_id UUID REFERENCES deal_files(id),
  is_latest_version BOOLEAN NOT NULL DEFAULT true,
  version_notes TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'archived', 'expired', 'pending-review')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  expiration_date DATE,
  
  -- Auto-categorization
  auto_category_confidence NUMERIC(4,3),
  extracted_text TEXT,
  thumbnail_path TEXT,
  
  -- Ownership & sharing
  uploaded_by UUID REFERENCES users(id),
  shared_with UUID[] DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_files_deal ON deal_files(deal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deal_files_category ON deal_files(deal_id, category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deal_files_original_name ON deal_files(deal_id, original_filename) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deal_files_latest ON deal_files(deal_id, is_latest_version) WHERE deleted_at IS NULL AND is_latest_version = true;
CREATE INDEX IF NOT EXISTS idx_deal_files_folder ON deal_files(deal_id, folder_path) WHERE deleted_at IS NULL;

-- File access log for audit trail
CREATE TABLE IF NOT EXISTS deal_file_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES deal_files(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('viewed', 'downloaded', 'uploaded', 'deleted', 'shared', 'version_created')),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_access_log_file ON deal_file_access_log(file_id);
CREATE INDEX IF NOT EXISTS idx_file_access_log_user ON deal_file_access_log(user_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_deal_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deal_files_updated_at ON deal_files;
CREATE TRIGGER trg_deal_files_updated_at
  BEFORE UPDATE ON deal_files
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_files_updated_at();

-- Comments
COMMENT ON TABLE deal_files IS 'Unified document storage for all deal types (pipeline and portfolio)';
COMMENT ON COLUMN deal_files.category IS 'Document category: financial, legal, inspections, appraisals, environmental, insurance, permits, other';
COMMENT ON COLUMN deal_files.folder_path IS 'Virtual folder path for organization (e.g., /due-diligence/phase-1)';
COMMENT ON COLUMN deal_files.version IS 'Version number, increments on re-upload of same filename';
COMMENT ON COLUMN deal_files.is_latest_version IS 'True if this is the most recent version of the file';
