-- Migration 041: Deal Documents Table
-- Track document uploads for deals

-- Create deal_documents table
CREATE TABLE IF NOT EXISTS deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  document_type VARCHAR(50) DEFAULT 'general', -- 'financial', 'legal', 'site_plan', 'environmental', 'general', etc.
  description TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deal_documents_deal_id ON deal_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_documents_user_id ON deal_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_documents_document_type ON deal_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_deal_documents_uploaded_at ON deal_documents(uploaded_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_deal_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deal_documents_updated_at
  BEFORE UPDATE ON deal_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_documents_updated_at();

-- Add comment
COMMENT ON TABLE deal_documents IS 'Stores metadata for documents uploaded to deals';
COMMENT ON COLUMN deal_documents.document_type IS 'Type of document: financial, legal, site_plan, environmental, general, etc.';
