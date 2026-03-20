-- Migration 134: Remote Online Notarization (RON) — M31 Closing Execution
-- Tables: notarize_sessions, notarize_signers, notarize_webhooks

CREATE TABLE IF NOT EXISTS notarize_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'notarize',
  provider_session_id VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  session_type VARCHAR(30) DEFAULT 'ron',
  document_ids UUID[] DEFAULT '{}',
  document_names TEXT[] DEFAULT '{}',
  initiated_by UUID REFERENCES users(id),
  initiated_at TIMESTAMP DEFAULT NOW(),
  scheduled_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancel_reason TEXT,
  recording_url TEXT,
  certificate_url TEXT,
  certificate_file_id UUID,
  notary_name VARCHAR(255),
  notary_commission VARCHAR(100),
  notary_state VARCHAR(2),
  signer_count INTEGER DEFAULT 0,
  signers_verified INTEGER DEFAULT 0,
  signers_completed INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notarize_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES notarize_sessions(id) ON DELETE CASCADE,
  provider_signer_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) DEFAULT 'signer',
  status VARCHAR(30) DEFAULT 'pending',
  kba_verified BOOLEAN DEFAULT FALSE,
  id_verified BOOLEAN DEFAULT FALSE,
  signed_at TIMESTAMP,
  verification_method VARCHAR(50),
  ip_address VARCHAR(45),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notarize_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL DEFAULT 'notarize',
  event_type VARCHAR(100) NOT NULL,
  provider_session_id VARCHAR(255),
  session_id UUID REFERENCES notarize_sessions(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  signature VARCHAR(500),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  error TEXT,
  received_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notarize_sessions_deal ON notarize_sessions(deal_id);
CREATE INDEX IF NOT EXISTS idx_notarize_sessions_status ON notarize_sessions(status);
CREATE INDEX IF NOT EXISTS idx_notarize_sessions_provider ON notarize_sessions(provider, provider_session_id);
CREATE INDEX IF NOT EXISTS idx_notarize_sessions_org ON notarize_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_notarize_signers_session ON notarize_signers(session_id);
CREATE INDEX IF NOT EXISTS idx_notarize_signers_email ON notarize_signers(email);
CREATE INDEX IF NOT EXISTS idx_notarize_webhooks_session ON notarize_webhooks(session_id);
CREATE INDEX IF NOT EXISTS idx_notarize_webhooks_event ON notarize_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_notarize_webhooks_processed ON notarize_webhooks(processed);

COMMENT ON TABLE notarize_sessions IS 'RON sessions linking deals to remote online notarization provider sessions';
COMMENT ON TABLE notarize_signers IS 'Individual signers within a RON session with KBA/ID verification status';
COMMENT ON TABLE notarize_webhooks IS 'Raw webhook payloads from RON providers for audit and reprocessing';
