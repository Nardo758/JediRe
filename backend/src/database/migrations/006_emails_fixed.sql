-- Email System Tables (Fixed for UUID users)

-- Drop existing incompatible tables if they exist
DROP TABLE IF EXISTS email_label_assignments CASCADE;
DROP TABLE IF EXISTS email_labels CASCADE;
DROP TABLE IF EXISTS email_attachments CASCADE;
DROP TABLE IF EXISTS emails CASCADE;
DROP TABLE IF EXISTS email_accounts CASCADE;

-- Email accounts (connected email addresses)
CREATE TABLE email_accounts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_address VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'gmail', 'outlook', 'exchange'
  is_primary BOOLEAN DEFAULT FALSE,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  last_sync_at TIMESTAMP,
  sync_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_accounts_user ON email_accounts(user_id);
CREATE INDEX idx_email_accounts_email ON email_accounts(email_address);

-- Emails table
CREATE TABLE emails (
  id SERIAL PRIMARY KEY,
  email_account_id INTEGER NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Email metadata
  external_id VARCHAR(255) UNIQUE, -- Provider's message ID
  thread_id VARCHAR(255), -- For threading
  
  -- Content
  subject TEXT,
  from_name VARCHAR(255),
  from_address VARCHAR(255) NOT NULL,
  to_addresses TEXT[], -- Array of recipients
  cc_addresses TEXT[],
  body_preview TEXT,
  body_html TEXT,
  body_text TEXT,
  
  -- Flags
  is_read BOOLEAN DEFAULT FALSE,
  is_flagged BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  has_attachments BOOLEAN DEFAULT FALSE,
  
  -- Deal/Property linking
  deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
  property_id INTEGER, -- If linked to a property
  
  -- AI extraction
  extracted_properties JSONB, -- Array of extracted property info
  action_items JSONB, -- Array of detected action items
  ai_processed BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  received_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_emails_user ON emails(user_id);
CREATE INDEX idx_emails_account ON emails(email_account_id);
CREATE INDEX idx_emails_external ON emails(external_id);
CREATE INDEX idx_emails_thread ON emails(thread_id);
CREATE INDEX idx_emails_deal ON emails(deal_id);
CREATE INDEX idx_emails_received ON emails(received_at DESC);
CREATE INDEX idx_emails_read ON emails(is_read) WHERE is_read = FALSE;

-- Email attachments
CREATE TABLE email_attachments (
  id SERIAL PRIMARY KEY,
  email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(100),
  size_bytes INTEGER,
  download_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_attachments_email ON email_attachments(email_id);

-- Email labels/folders
CREATE TABLE email_labels (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20),
  is_system BOOLEAN DEFAULT FALSE, -- inbox, sent, trash, etc
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_labels_user ON email_labels(user_id);

-- Email-Label junction table
CREATE TABLE email_label_assignments (
  email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES email_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (email_id, label_id)
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_email_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER emails_updated_at
BEFORE UPDATE ON emails
FOR EACH ROW
EXECUTE FUNCTION update_email_timestamp();

CREATE TRIGGER email_accounts_updated_at
BEFORE UPDATE ON email_accounts
FOR EACH ROW
EXECUTE FUNCTION update_email_timestamp();
