CREATE TABLE IF NOT EXISTS deal_document_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  filename VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  document_type VARCHAR(30),
  extraction_status VARCHAR(20) DEFAULT 'pending',
  extraction_result JSONB DEFAULT '{}',
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_files_deal ON deal_document_files(deal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_files_deal_filename ON deal_document_files(deal_id, filename);
