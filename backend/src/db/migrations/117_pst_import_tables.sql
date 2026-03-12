-- Migration 117: PST Email Import Tables
-- Stores parsed emails and AI-extracted real estate entities from PST archives.

CREATE TABLE IF NOT EXISTS pst_email_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES data_uploads(id) ON DELETE CASCADE,
  email_index INTEGER NOT NULL,
  subject TEXT,
  sender TEXT,
  recipients TEXT[],
  email_date TIMESTAMPTZ,
  raw_body TEXT,
  has_signal BOOLEAN DEFAULT FALSE,
  has_attachments BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pst_emails_upload ON pst_email_imports(upload_id);
CREATE INDEX IF NOT EXISTS idx_pst_emails_signal ON pst_email_imports(has_signal) WHERE has_signal = TRUE;
CREATE INDEX IF NOT EXISTS idx_pst_emails_date ON pst_email_imports(email_date);

CREATE TABLE IF NOT EXISTS pst_extracted_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES pst_email_imports(id) ON DELETE CASCADE,
  upload_id UUID NOT NULL REFERENCES data_uploads(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL DEFAULT 'property',
  property_address TEXT,
  deal_name TEXT,
  unit_count INTEGER,
  asking_price NUMERIC(15,2),
  rent_figures TEXT,
  cap_rate NUMERIC(5,2),
  contact_name TEXT,
  organization TEXT,
  confidence NUMERIC(3,2),
  raw_snippet TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pst_entities_upload ON pst_extracted_entities(upload_id);
CREATE INDEX IF NOT EXISTS idx_pst_entities_email ON pst_extracted_entities(email_id);
CREATE INDEX IF NOT EXISTS idx_pst_entities_type ON pst_extracted_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_pst_entities_confidence ON pst_extracted_entities(confidence DESC);
