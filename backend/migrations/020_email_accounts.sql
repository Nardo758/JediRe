-- Email Accounts & Integration System
-- Supports both Google Gmail and Microsoft Outlook

-- User email accounts (can connect multiple)
CREATE TABLE IF NOT EXISTS user_email_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'microsoft')),
  email_address VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  is_primary BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMP,
  sync_enabled BOOLEAN DEFAULT true,
  sync_frequency_minutes INTEGER DEFAULT 15,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_user_email UNIQUE(user_id, email_address)
);

-- Synced emails from all providers
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES user_email_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  provider_message_id VARCHAR(500) NOT NULL,
  thread_id VARCHAR(500),
  subject TEXT,
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  to_emails TEXT[], -- array of email addresses
  cc_emails TEXT[],
  bcc_emails TEXT[],
  body_text TEXT,
  body_html TEXT,
  snippet TEXT, -- First 200 chars
  received_at TIMESTAMP NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  attachment_count INTEGER DEFAULT 0,
  labels TEXT[], -- Provider-specific labels/categories
  extracted_properties JSONB, -- AI-extracted property data
  extraction_confidence NUMERIC(3,2), -- 0.00 to 1.00
  linked_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  raw_data JSONB, -- Full provider response
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_provider_message UNIQUE(account_id, provider_message_id)
);

-- Email property extractions (AI-identified properties)
CREATE TABLE IF NOT EXISTS email_property_extractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Address components
  address_full TEXT,
  address_street VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(2),
  address_zip VARCHAR(10),
  address_country VARCHAR(2) DEFAULT 'US',
  
  -- Property details
  price NUMERIC(15,2),
  price_text VARCHAR(50), -- "$2.5M", "$2,500,000"
  property_type VARCHAR(50), -- apartment, office, retail, etc.
  property_subtype VARCHAR(50), -- multifamily, flex, etc.
  beds INTEGER,
  baths NUMERIC(3,1),
  sqft INTEGER,
  lot_size_acres NUMERIC(10,2),
  year_built INTEGER,
  
  -- Deal context
  deal_status VARCHAR(50), -- for sale, under contract, etc.
  broker_name VARCHAR(255),
  broker_email VARCHAR(255),
  broker_phone VARCHAR(20),
  
  -- Extraction metadata
  confidence_score NUMERIC(3,2) NOT NULL, -- 0.00 to 1.00
  extraction_method VARCHAR(50), -- regex, llm, hybrid
  matched_patterns TEXT[], -- Which patterns matched
  raw_text TEXT, -- Text that was analyzed
  geocoded BOOLEAN DEFAULT false,
  geocoded_lat NUMERIC(10,7),
  geocoded_lng NUMERIC(10,7),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Email sync logs
CREATE TABLE IF NOT EXISTS email_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES user_email_accounts(id) ON DELETE CASCADE,
  sync_started_at TIMESTAMP NOT NULL,
  sync_completed_at TIMESTAMP,
  sync_status VARCHAR(20) NOT NULL, -- 'running', 'success', 'failed'
  messages_fetched INTEGER DEFAULT 0,
  messages_stored INTEGER DEFAULT 0,
  messages_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON user_email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_provider ON user_email_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_email_accounts_primary ON user_email_accounts(user_id, is_primary);

CREATE INDEX IF NOT EXISTS idx_emails_user ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account_id);
CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_linked_deal ON emails(linked_deal_id);
CREATE INDEX IF NOT EXISTS idx_emails_unread ON emails(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_emails_important ON emails(user_id, is_important) WHERE is_important = true;
CREATE INDEX IF NOT EXISTS idx_emails_has_properties ON emails(user_id) WHERE extracted_properties IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_extractions_email ON email_property_extractions(email_id);
CREATE INDEX IF NOT EXISTS idx_extractions_user ON email_property_extractions(user_id);
CREATE INDEX IF NOT EXISTS idx_extractions_confidence ON email_property_extractions(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_extractions_address ON email_property_extractions(address_city, address_state);

CREATE INDEX IF NOT EXISTS idx_sync_logs_account ON email_sync_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON email_sync_logs(sync_status);

-- Function: Update primary account (ensure only one primary per user)
CREATE OR REPLACE FUNCTION update_primary_email_account()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    -- Set all other accounts for this user to non-primary
    UPDATE user_email_accounts
    SET is_primary = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_primary_email_account
  AFTER INSERT OR UPDATE OF is_primary ON user_email_accounts
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION update_primary_email_account();

-- Function: Auto-update timestamps
CREATE OR REPLACE FUNCTION update_email_account_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_email_account_timestamp
  BEFORE UPDATE ON user_email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_email_account_timestamp();

CREATE TRIGGER trigger_update_email_timestamp
  BEFORE UPDATE ON emails
  FOR EACH ROW
  EXECUTE FUNCTION update_email_account_timestamp();

CREATE TRIGGER trigger_update_extraction_timestamp
  BEFORE UPDATE ON email_property_extractions
  FOR EACH ROW
  EXECUTE FUNCTION update_email_account_timestamp();

-- Helper function: Get user's primary email account
CREATE OR REPLACE FUNCTION get_user_primary_email_account(p_user_id UUID)
RETURNS user_email_accounts AS $$
  SELECT * FROM user_email_accounts
  WHERE user_id = p_user_id
    AND is_primary = true
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Helper function: Get unread email count
CREATE OR REPLACE FUNCTION get_unread_email_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM emails
  WHERE user_id = p_user_id
    AND is_read = false;
$$ LANGUAGE sql STABLE;

-- Helper function: Get emails with property extractions
CREATE OR REPLACE FUNCTION get_property_emails(p_user_id UUID, p_min_confidence NUMERIC DEFAULT 0.7)
RETURNS SETOF emails AS $$
  SELECT e.*
  FROM emails e
  JOIN email_property_extractions epe ON epe.email_id = e.id
  WHERE e.user_id = p_user_id
    AND epe.confidence_score >= p_min_confidence
  ORDER BY e.received_at DESC;
$$ LANGUAGE sql STABLE;

COMMENT ON TABLE user_email_accounts IS 'User-connected email accounts (Gmail or Outlook)';
COMMENT ON TABLE emails IS 'Synced emails from all connected accounts';
COMMENT ON TABLE email_property_extractions IS 'AI-extracted property data from emails';
COMMENT ON TABLE email_sync_logs IS 'Email synchronization history and logs';
