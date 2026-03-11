-- ═══════════════════════════════════════════════════════════════
-- JEDI RE — Intelligence Context Engine
-- Migration 081: Foundation (pgvector + unified documents)
-- ═══════════════════════════════════════════════════════════════

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- ───────────────────────────────────────────────────────────────
-- Unified Document Registry
-- Single source of truth for ALL documents across systems
-- ───────────────────────────────────────────────────────────────

CREATE TABLE unified_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source tracking
  source_system VARCHAR(50) NOT NULL CHECK (source_system IN (
    'data_library', 'gmail', 'drive', 'sheets', 'manual', 'api_import'
  )),
  source_id VARCHAR(500) NOT NULL,
  external_url TEXT,
  
  -- Content
  document_type VARCHAR(100) NOT NULL,
  -- Common types: 'om', 't12', 'rent_roll', 'market_report', 'comp_sheet',
  -- 'impact_fee_schedule', 'construction_cost_data', 'zoning_code',
  -- 'permit_timeline', 'appraisal', 'psa', 'environmental_report'
  
  title TEXT NOT NULL,
  content_text TEXT,
  content_embedding VECTOR(1536),  -- OpenAI text-embedding-3-small
  
  -- Metadata
  property_address TEXT,
  property_city VARCHAR(255),
  property_state VARCHAR(2),
  property_zip VARCHAR(10),
  property_type VARCHAR(100),
  unit_count INTEGER,
  lot_size_sf INTEGER,
  year_built INTEGER,
  
  -- Deal linkage
  deal_capsule_id UUID,  -- FK added after deal_capsules table exists
  
  -- Extracted structured data (normalized across document types)
  structured_data JSONB DEFAULT '{}',
  -- Examples:
  -- {
  --   "noi_annual": 2400000,
  --   "cap_rate": 0.052,
  --   "asking_price": 46000000,
  --   "gross_rental_income": 3200000,
  --   "operating_expenses": 800000,
  --   "expense_ratio": 0.25
  -- }
  
  -- Quality indicators
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  validation_status VARCHAR(50) DEFAULT 'pending' CHECK (validation_status IN (
    'pending', 'validated', 'flagged', 'rejected', 'archived'
  )),
  validation_notes TEXT,
  data_quality_flags JSONB DEFAULT '[]',
  -- [
  --   {"field": "lot_area_sf", "issue": "Estimated from tax records", "severity": "low"},
  --   {"field": "noi_annual", "issue": "Outlier (>2 std dev)", "severity": "high"}
  -- ]
  
  -- Provenance
  created_by_agent VARCHAR(100),
  user_id UUID,  -- FK to users table
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(source_system, source_id)
);

-- Indexes
CREATE INDEX idx_unified_docs_embedding ON unified_documents 
  USING ivfflat (content_embedding vector_cosine_ops)
  WITH (lists = 100);  -- Adjust based on expected document count

CREATE INDEX idx_unified_docs_city ON unified_documents (property_city);
CREATE INDEX idx_unified_docs_state ON unified_documents (property_state);
CREATE INDEX idx_unified_docs_type ON unified_documents (document_type);
CREATE INDEX idx_unified_docs_deal ON unified_documents (deal_capsule_id) WHERE deal_capsule_id IS NOT NULL;
CREATE INDEX idx_unified_docs_user ON unified_documents (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_unified_docs_source ON unified_documents (source_system, source_id);
CREATE INDEX idx_unified_docs_validation ON unified_documents (validation_status);
CREATE INDEX idx_unified_docs_created ON unified_documents (created_at DESC);

-- Full-text search on title and content_text
CREATE INDEX idx_unified_docs_search ON unified_documents 
  USING gin(to_tsvector('english', title || ' ' || COALESCE(content_text, '')));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_unified_documents_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_unified_documents_timestamp
  BEFORE UPDATE ON unified_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_unified_documents_timestamp();

-- ───────────────────────────────────────────────────────────────
-- Document Relationships
-- Track connections between documents (supplements, supersedes, contradicts)
-- ───────────────────────────────────────────────────────────────

CREATE TABLE doc_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  parent_doc_id UUID NOT NULL REFERENCES unified_documents(id) ON DELETE CASCADE,
  child_doc_id UUID NOT NULL REFERENCES unified_documents(id) ON DELETE CASCADE,
  
  relationship_type VARCHAR(100) NOT NULL CHECK (relationship_type IN (
    'supersedes',      -- newer version replaces old
    'supplements',     -- additional data (rent roll supplements OM)
    'contradicts',     -- conflicting data, flag for review
    'references',      -- cited in document (market report references comp)
    'derived_from',    -- extracted/generated from parent
    'part_of'          -- child is section of parent document
  )),
  
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  detected_by VARCHAR(100),  -- Agent/service that created relationship
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  
  metadata JSONB DEFAULT '{}',
  -- { "conflict_field": "noi_annual", "parent_value": 2400000, "child_value": 2100000 }
  
  notes TEXT,
  
  -- Prevent duplicate relationships
  UNIQUE(parent_doc_id, child_doc_id, relationship_type),
  
  -- Prevent self-relationships
  CHECK (parent_doc_id != child_doc_id)
);

CREATE INDEX idx_doc_rel_parent ON doc_relationships (parent_doc_id);
CREATE INDEX idx_doc_rel_child ON doc_relationships (child_doc_id);
CREATE INDEX idx_doc_rel_type ON doc_relationships (relationship_type);

COMMENT ON TABLE unified_documents IS 'Unified registry for all documents across systems with semantic search';
COMMENT ON TABLE doc_relationships IS 'Tracks relationships between documents (supersedes, supplements, contradicts)';
COMMENT ON COLUMN unified_documents.content_embedding IS 'OpenAI text-embedding-3-small (1536 dimensions)';
COMMENT ON COLUMN unified_documents.structured_data IS 'Normalized extracted fields using canonical schema';
COMMENT ON COLUMN unified_documents.confidence_score IS 'Extraction quality 0-1 (OCR=0.6, structured=0.9)';
