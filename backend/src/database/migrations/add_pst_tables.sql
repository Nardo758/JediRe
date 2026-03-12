CREATE TABLE IF NOT EXISTS pst_email_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES data_uploads(id) ON DELETE CASCADE,
  email_index INTEGER NOT NULL,
  subject TEXT,
  sender TEXT,
  recipients TEXT[],
  email_date TIMESTAMPTZ,
  raw_body TEXT,
  has_signal BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pst_emails_upload ON pst_email_imports(upload_id);
CREATE INDEX IF NOT EXISTS idx_pst_emails_signal ON pst_email_imports(has_signal);

CREATE TABLE IF NOT EXISTS pst_extracted_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES pst_email_imports(id) ON DELETE CASCADE,
  upload_id UUID NOT NULL REFERENCES data_uploads(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  property_address TEXT,
  deal_name TEXT,
  unit_count INTEGER,
  asking_price NUMERIC(14, 2),
  rent_figures TEXT,
  cap_rate NUMERIC(5, 3),
  contact_name TEXT,
  organization TEXT,
  confidence NUMERIC(3, 2),
  raw_snippet TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pst_entities_email ON pst_extracted_entities(email_id);
CREATE INDEX IF NOT EXISTS idx_pst_entities_upload ON pst_extracted_entities(upload_id);
CREATE INDEX IF NOT EXISTS idx_pst_entities_type ON pst_extracted_entities(entity_type);
