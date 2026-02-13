-- Migration: Unified Documents & Files Module
-- Description: Creates deal_files table with support for versioning, categories, folders, tags
-- Context: Replaces separate Documents and Files tabs with intelligent unified system
-- Adapts to Pipeline (pre-purchase) vs Portfolio (post-purchase) deal types
-- Author: AI Agent
-- Date: 2025-02-12

-- ============================================================================
-- DEAL FILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_files (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- File metadata
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL, -- Size in bytes
  mime_type VARCHAR(100),
  file_extension VARCHAR(20),
  
  -- Organization
  category VARCHAR(50) NOT NULL, -- acquisition, financial-analysis, due-diligence, legal, etc.
  folder_path TEXT DEFAULT '/', -- Hierarchical folder structure
  tags TEXT[], -- Array of tags for flexible categorization
  
  -- Version control
  version INTEGER DEFAULT 1,
  parent_file_id UUID REFERENCES deal_files(id) ON DELETE SET NULL, -- Points to previous version
  is_latest_version BOOLEAN DEFAULT true,
  version_notes TEXT,
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'draft', -- draft, final, archived, expired
  is_required BOOLEAN DEFAULT false, -- Required for closing/compliance
  expiration_date TIMESTAMP, -- For leases, warranties, certifications
  
  -- Smart metadata
  description TEXT,
  auto_category_confidence DECIMAL(3,2), -- 0.00-1.00 confidence score
  extracted_text TEXT, -- For searchable content from PDFs
  thumbnail_path TEXT, -- Path to generated thumbnail
  
  -- Permissions & access
  uploaded_by UUID NOT NULL REFERENCES users(id),
  shared_with UUID[], -- Array of user IDs with access
  is_public BOOLEAN DEFAULT false,
  
  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP, -- Soft delete
  
  -- Indexes
  CONSTRAINT valid_version CHECK (version > 0),
  CONSTRAINT valid_category CHECK (category IN (
    -- Pipeline categories
    'acquisition', 'financial-analysis', 'due-diligence', 'property-info',
    'correspondence', 'financing', 'legal-preliminary',
    -- Portfolio categories
    'legal', 'financial', 'leasing', 'operations', 'property-media',
    'marketing', 'compliance', 'maintenance', 'tenant-files',
    -- Shared categories
    'contracts', 'reports', 'presentations', 'photos', 'other'
  )),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'final', 'archived', 'expired', 'pending-review'))
);

-- Indexes for performance
CREATE INDEX idx_deal_files_deal_id ON deal_files(deal_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deal_files_category ON deal_files(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_deal_files_folder_path ON deal_files(folder_path) WHERE deleted_at IS NULL;
CREATE INDEX idx_deal_files_status ON deal_files(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_deal_files_created_at ON deal_files(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_deal_files_version ON deal_files(deal_id, filename, version DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_deal_files_latest ON deal_files(deal_id, is_latest_version) WHERE deleted_at IS NULL AND is_latest_version = true;
CREATE INDEX idx_deal_files_search ON deal_files USING gin(to_tsvector('english', coalesce(filename, '') || ' ' || coalesce(description, '') || ' ' || coalesce(extracted_text, '')));
CREATE INDEX idx_deal_files_tags ON deal_files USING gin(tags) WHERE deleted_at IS NULL;

-- ============================================================================
-- FILE ACCESS LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_file_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES deal_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(20) NOT NULL, -- viewed, downloaded, shared, deleted
  ip_address INET,
  user_agent TEXT,
  accessed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_action CHECK (action IN ('viewed', 'downloaded', 'shared', 'deleted', 'uploaded', 'edited'))
);

CREATE INDEX idx_file_access_log_file_id ON deal_file_access_log(file_id);
CREATE INDEX idx_file_access_log_user_id ON deal_file_access_log(user_id);
CREATE INDEX idx_file_access_log_accessed_at ON deal_file_access_log(accessed_at DESC);

-- ============================================================================
-- STORAGE ANALYTICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_storage_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Storage metrics
  total_files INTEGER DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  files_by_category JSONB DEFAULT '{}', -- {"acquisition": 10, "legal": 5, ...}
  size_by_category JSONB DEFAULT '{}', -- {"acquisition": 1024000, "legal": 512000, ...}
  
  -- Version metrics
  total_versions INTEGER DEFAULT 0,
  files_with_versions INTEGER DEFAULT 0,
  
  -- Activity metrics
  files_uploaded_last_7d INTEGER DEFAULT 0,
  files_uploaded_last_30d INTEGER DEFAULT 0,
  most_active_uploader_id UUID REFERENCES users(id),
  
  -- Compliance tracking
  required_files_count INTEGER DEFAULT 0,
  missing_required_files TEXT[], -- Array of missing required file types
  expired_files_count INTEGER DEFAULT 0,
  
  -- Last computed
  computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_deal_analytics UNIQUE(deal_id)
);

CREATE INDEX idx_storage_analytics_deal_id ON deal_storage_analytics(deal_id);

-- ============================================================================
-- AUTO-CATEGORIZATION RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_categorization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Pattern matching
  filename_pattern TEXT NOT NULL, -- Regex pattern
  mime_type_pattern TEXT, -- Optional MIME type pattern
  
  -- Categorization
  suggested_category VARCHAR(50) NOT NULL,
  confidence_threshold DECIMAL(3,2) DEFAULT 0.75,
  
  -- Context
  deal_stage VARCHAR(50)[], -- Which deal stages this applies to
  deal_category VARCHAR(20)[], -- ['pipeline', 'portfolio'] or both
  
  -- Metadata
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher priority rules checked first
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categorization_rules_active ON file_categorization_rules(priority DESC) WHERE is_active = true;

-- ============================================================================
-- SEED AUTO-CATEGORIZATION RULES
-- ============================================================================

INSERT INTO file_categorization_rules (filename_pattern, mime_type_pattern, suggested_category, deal_category, description, priority) VALUES
  -- Pipeline categories
  ('(?i)(appraisal|valuation)', 'application/pdf', 'financial-analysis', ARRAY['pipeline'], 'Appraisal and valuation reports', 10),
  ('(?i)(rent.?roll|T-12|T12)', 'application/(pdf|vnd.ms-excel|vnd.openxmlformats)', 'financial-analysis', ARRAY['pipeline'], 'Rent rolls and financial statements', 10),
  ('(?i)(inspection|environmental|phase.?i)', 'application/pdf', 'due-diligence', ARRAY['pipeline'], 'Property inspections and environmental reports', 9),
  ('(?i)(PSA|purchase.?agreement|LOI)', 'application/pdf', 'acquisition', ARRAY['pipeline'], 'Purchase agreements and LOIs', 10),
  ('(?i)(survey|plat|boundary)', 'application/pdf', 'property-info', ARRAY['pipeline'], 'Property surveys and plats', 8),
  ('(?i)(title|commitment)', 'application/pdf', 'legal-preliminary', ARRAY['pipeline'], 'Title reports and commitments', 9),
  ('(?i)(zoning|entitlement)', 'application/pdf', 'property-info', ARRAY['pipeline'], 'Zoning and entitlement documents', 8),
  ('(?i)(pro.?forma|underwriting)', 'application/(pdf|vnd.ms-excel|vnd.openxmlformats)', 'financial-analysis', ARRAY['pipeline'], 'Pro forma and underwriting models', 10),
  ('(?i)(loan|financing|term.?sheet)', 'application/pdf', 'financing', ARRAY['pipeline'], 'Loan documents and term sheets', 9),
  
  -- Portfolio categories
  ('(?i)(lease|tenant)', 'application/pdf', 'leasing', ARRAY['portfolio'], 'Lease agreements and tenant files', 10),
  ('(?i)(P&L|income.?statement|financial.?statement)', 'application/(pdf|vnd.ms-excel|vnd.openxmlformats)', 'financial', ARRAY['portfolio'], 'Financial statements', 10),
  ('(?i)(deed|mortgage|lien)', 'application/pdf', 'legal', ARRAY['portfolio'], 'Legal documents', 10),
  ('(?i)(maintenance|repair|work.?order)', 'application/pdf', 'maintenance', ARRAY['portfolio'], 'Maintenance and repair records', 8),
  ('(?i)(insurance|policy)', 'application/pdf', 'compliance', ARRAY['portfolio'], 'Insurance policies', 9),
  ('(?i)(permit|license|certificate)', 'application/pdf', 'compliance', ARRAY['portfolio'], 'Permits and certifications', 9),
  ('(?i)(photo|image)', 'image/', 'property-media', ARRAY['portfolio'], 'Property photos', 7),
  ('(?i)(marketing|brochure|flyer)', 'application/pdf', 'marketing', ARRAY['portfolio'], 'Marketing materials', 7),
  ('(?i)(operating.?agreement|bylaws)', 'application/pdf', 'legal', ARRAY['portfolio'], 'Operating agreements', 9),
  ('(?i)(budget|forecast)', 'application/(pdf|vnd.ms-excel|vnd.openxmlformats)', 'financial', ARRAY['portfolio'], 'Budgets and forecasts', 8),
  
  -- Shared categories
  ('(?i)(contract|agreement)', 'application/pdf', 'contracts', ARRAY['pipeline', 'portfolio'], 'General contracts', 7),
  ('(?i)(report|analysis)', 'application/pdf', 'reports', ARRAY['pipeline', 'portfolio'], 'General reports', 6),
  ('(?i)(presentation|deck)', 'application/(pdf|vnd.ms-powerpoint|vnd.openxmlformats)', 'presentations', ARRAY['pipeline', 'portfolio'], 'Presentations', 6),
  ('(?i)\.(jpg|jpeg|png|gif|heic)$', 'image/', 'photos', ARRAY['pipeline', 'portfolio'], 'Photos and images', 5);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update storage analytics
CREATE OR REPLACE FUNCTION update_deal_storage_analytics(p_deal_id UUID)
RETURNS void AS $$
DECLARE
  v_total_files INTEGER;
  v_total_size BIGINT;
  v_category_counts JSONB;
  v_category_sizes JSONB;
  v_total_versions INTEGER;
  v_files_with_versions INTEGER;
  v_required_count INTEGER;
  v_expired_count INTEGER;
  v_recent_7d INTEGER;
  v_recent_30d INTEGER;
  v_most_active_uploader UUID;
BEGIN
  -- Calculate metrics
  SELECT 
    COUNT(*),
    COALESCE(SUM(file_size), 0)
  INTO v_total_files, v_total_size
  FROM deal_files
  WHERE deal_id = p_deal_id AND deleted_at IS NULL AND is_latest_version = true;
  
  -- Files by category
  SELECT jsonb_object_agg(category, count)
  INTO v_category_counts
  FROM (
    SELECT category, COUNT(*)::INTEGER as count
    FROM deal_files
    WHERE deal_id = p_deal_id AND deleted_at IS NULL AND is_latest_version = true
    GROUP BY category
  ) sub;
  
  -- Size by category
  SELECT jsonb_object_agg(category, size)
  INTO v_category_sizes
  FROM (
    SELECT category, COALESCE(SUM(file_size), 0) as size
    FROM deal_files
    WHERE deal_id = p_deal_id AND deleted_at IS NULL AND is_latest_version = true
    GROUP BY category
  ) sub;
  
  -- Version metrics
  SELECT 
    COUNT(*),
    COUNT(DISTINCT parent_file_id)
  INTO v_total_versions, v_files_with_versions
  FROM deal_files
  WHERE deal_id = p_deal_id AND deleted_at IS NULL AND version > 1;
  
  -- Required and expired
  SELECT 
    COUNT(*) FILTER (WHERE is_required = true),
    COUNT(*) FILTER (WHERE status = 'expired' OR (expiration_date IS NOT NULL AND expiration_date < NOW()))
  INTO v_required_count, v_expired_count
  FROM deal_files
  WHERE deal_id = p_deal_id AND deleted_at IS NULL AND is_latest_version = true;
  
  -- Recent activity
  SELECT 
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')
  INTO v_recent_7d, v_recent_30d
  FROM deal_files
  WHERE deal_id = p_deal_id AND deleted_at IS NULL;
  
  -- Most active uploader
  SELECT uploaded_by
  INTO v_most_active_uploader
  FROM deal_files
  WHERE deal_id = p_deal_id AND deleted_at IS NULL
  GROUP BY uploaded_by
  ORDER BY COUNT(*) DESC
  LIMIT 1;
  
  -- Upsert analytics
  INSERT INTO deal_storage_analytics (
    deal_id,
    total_files,
    total_size_bytes,
    files_by_category,
    size_by_category,
    total_versions,
    files_with_versions,
    required_files_count,
    expired_files_count,
    files_uploaded_last_7d,
    files_uploaded_last_30d,
    most_active_uploader_id,
    computed_at
  ) VALUES (
    p_deal_id,
    v_total_files,
    v_total_size,
    v_category_counts,
    v_category_sizes,
    v_total_versions,
    v_files_with_versions,
    v_required_count,
    v_expired_count,
    v_recent_7d,
    v_recent_30d,
    v_most_active_uploader,
    NOW()
  )
  ON CONFLICT (deal_id) DO UPDATE SET
    total_files = EXCLUDED.total_files,
    total_size_bytes = EXCLUDED.total_size_bytes,
    files_by_category = EXCLUDED.files_by_category,
    size_by_category = EXCLUDED.size_by_category,
    total_versions = EXCLUDED.total_versions,
    files_with_versions = EXCLUDED.files_with_versions,
    required_files_count = EXCLUDED.required_files_count,
    expired_files_count = EXCLUDED.expired_files_count,
    files_uploaded_last_7d = EXCLUDED.files_uploaded_last_7d,
    files_uploaded_last_30d = EXCLUDED.files_uploaded_last_30d,
    most_active_uploader_id = EXCLUDED.most_active_uploader_id,
    computed_at = EXCLUDED.computed_at;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update analytics after file changes
CREATE OR REPLACE FUNCTION trigger_update_storage_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update analytics for the affected deal
  PERFORM update_deal_storage_analytics(
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.deal_id
      ELSE NEW.deal_id
    END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_deal_file_change
AFTER INSERT OR UPDATE OR DELETE ON deal_files
FOR EACH ROW
EXECUTE FUNCTION trigger_update_storage_analytics();

-- ============================================================================
-- PERMISSIONS & COMMENTS
-- ============================================================================

COMMENT ON TABLE deal_files IS 'Unified documents and files for deals with intelligent categorization';
COMMENT ON TABLE deal_file_access_log IS 'Audit log of all file access actions';
COMMENT ON TABLE deal_storage_analytics IS 'Pre-computed storage metrics for quick dashboard display';
COMMENT ON TABLE file_categorization_rules IS 'Rules for automatic file categorization based on patterns';

COMMENT ON COLUMN deal_files.parent_file_id IS 'Points to previous version for version control';
COMMENT ON COLUMN deal_files.auto_category_confidence IS 'ML confidence score for auto-categorization (0.00-1.00)';
COMMENT ON COLUMN deal_files.extracted_text IS 'Extracted text from PDFs for full-text search';
COMMENT ON COLUMN deal_files.folder_path IS 'Hierarchical path like /Financial/2024/Q1';
COMMENT ON COLUMN deal_files.is_required IS 'Flag for files required for closing or compliance';

-- Grant permissions (adjust based on your role structure)
-- GRANT SELECT, INSERT, UPDATE ON deal_files TO authenticated_users;
-- GRANT SELECT ON deal_file_access_log TO authenticated_users;
-- GRANT SELECT ON deal_storage_analytics TO authenticated_users;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Add to schema version tracking if you have one
-- INSERT INTO schema_migrations (version, description) VALUES ('019', 'Unified Documents & Files Module');
