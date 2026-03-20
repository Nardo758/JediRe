-- Migration 050: Zoning Verification Pipeline
-- Adds tables for the verification-first zoning AI agent pipeline:
-- 1. jurisdiction_source_map - routing table for code sources
-- 2. zoning_source_citation - individual code section citations
-- 3. zoning_verification - per-parcel verification records

-- Table 1: jurisdiction_source_map
CREATE TABLE IF NOT EXISTS jurisdiction_source_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id VARCHAR(100) NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  source_tier VARCHAR(30) NOT NULL CHECK (source_tier IN ('municode', 'municipal_direct', 'county')),
  base_url TEXT NOT NULL,
  zoning_code_path TEXT,
  api_available BOOLEAN DEFAULT FALSE,
  api_endpoint TEXT,
  scrape_method VARCHAR(30) DEFAULT 'html_parse' CHECK (scrape_method IN ('api', 'html_parse', 'pdf_extract')),
  last_verified TIMESTAMPTZ,
  update_frequency VARCHAR(20) DEFAULT 'monthly' CHECK (update_frequency IN ('weekly', 'monthly', 'quarterly')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_jurisdiction_source UNIQUE (jurisdiction_id)
);

CREATE INDEX IF NOT EXISTS idx_jurisdiction_source_map_jurisdiction ON jurisdiction_source_map(jurisdiction_id);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_source_map_tier ON jurisdiction_source_map(source_tier);

-- Table 2: zoning_source_citation
CREATE TABLE IF NOT EXISTS zoning_source_citation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id VARCHAR(100) NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  source_tier VARCHAR(30) NOT NULL CHECK (source_tier IN ('municode', 'municipal_direct', 'county')),
  code_title TEXT,
  section_number TEXT NOT NULL,
  section_title TEXT,
  subsection TEXT,
  source_url TEXT NOT NULL,
  full_text TEXT,
  full_text_hash TEXT,
  last_fetched TIMESTAMPTZ,
  last_changed TIMESTAMPTZ,
  confidence DECIMAL(3, 2) DEFAULT 0.90 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoning_source_citation_jurisdiction ON zoning_source_citation(jurisdiction_id);
CREATE INDEX IF NOT EXISTS idx_zoning_source_citation_section ON zoning_source_citation(section_number);
CREATE INDEX IF NOT EXISTS idx_zoning_source_citation_hash ON zoning_source_citation(full_text_hash);

-- Table 3: zoning_verification
CREATE TABLE IF NOT EXISTS zoning_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  parcel_id TEXT,
  gis_designation TEXT NOT NULL,
  verified_designation TEXT,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'confirmed', 'stale', 'split', 'conflict')),
  discrepancy_detail TEXT,
  overlays_detected TEXT[] DEFAULT '{}',
  recent_amendments JSONB DEFAULT '[]'::jsonb,
  conditional_approvals JSONB DEFAULT '[]'::jsonb,
  source_citation_ids UUID[] DEFAULT '{}',
  user_action VARCHAR(20) CHECK (user_action IN ('confirmed', 'flagged', 'corrected')),
  user_correction_detail TEXT,
  verified_at TIMESTAMPTZ,
  verified_by VARCHAR(30) DEFAULT 'agent_auto' CHECK (verified_by IN ('agent_auto', 'user_confirmed', 'expert_reviewed')),
  confidence DECIMAL(3, 2) DEFAULT 0.00 CHECK (confidence >= 0 AND confidence <= 1),
  jurisdiction_id VARCHAR(100) REFERENCES municipalities(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoning_verification_deal ON zoning_verification(deal_id);
CREATE INDEX IF NOT EXISTS idx_zoning_verification_parcel ON zoning_verification(parcel_id);
CREATE INDEX IF NOT EXISTS idx_zoning_verification_status ON zoning_verification(verification_status);

-- Auto-update triggers
CREATE OR REPLACE FUNCTION update_timestamp_050()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS jurisdiction_source_map_updated_at ON jurisdiction_source_map;
CREATE TRIGGER jurisdiction_source_map_updated_at
  BEFORE UPDATE ON jurisdiction_source_map
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_050();

DROP TRIGGER IF EXISTS zoning_source_citation_updated_at ON zoning_source_citation;
CREATE TRIGGER zoning_source_citation_updated_at
  BEFORE UPDATE ON zoning_source_citation
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_050();

DROP TRIGGER IF EXISTS zoning_verification_updated_at ON zoning_verification;
CREATE TRIGGER zoning_verification_updated_at
  BEFORE UPDATE ON zoning_verification
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_050();
