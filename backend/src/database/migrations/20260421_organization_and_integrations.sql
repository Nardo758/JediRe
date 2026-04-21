-- ═══════════════════════════════════════════════════════════════════════════════
-- ORGANIZATION & INTEGRATIONS MIGRATION
-- Multi-tenant orgs, team management, deal assignments, and third-party integrations
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── PART 1: ORGANIZATIONS ────────────────────────────────────────────────────

-- Organizations (companies/firms)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL, -- URL-friendly identifier
  
  -- Billing
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  plan_tier VARCHAR(50) DEFAULT 'starter', -- starter, professional, enterprise
  billing_email VARCHAR(255),
  
  -- Settings
  settings JSONB DEFAULT '{}',
  branding JSONB DEFAULT '{}', -- logo_url, colors, etc.
  
  -- Limits (based on plan)
  max_users INT DEFAULT 5,
  max_deals INT DEFAULT 50,
  max_storage_gb INT DEFAULT 10,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, cancelled
  trial_ends_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_stripe ON organizations(stripe_customer_id);

-- Organization members (users belong to orgs)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- References auth.users or your users table
  
  -- Role within org
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
  title VARCHAR(100), -- "VP of Acquisitions", "Asset Manager", etc.
  department VARCHAR(100), -- "Acquisitions", "Asset Management", "Finance"
  
  -- Permissions (JSON for flexibility)
  permissions JSONB DEFAULT '{}',
  
  -- Their email for this org (BYOE - Bring Your Own Email)
  work_email VARCHAR(255),
  email_connected BOOLEAN DEFAULT FALSE,
  email_provider VARCHAR(50), -- gmail, outlook, other
  email_oauth_token_encrypted TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, invited, disabled
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);

-- ─── PART 2: THIRD-PARTY INTEGRATIONS (Org-Level) ─────────────────────────────

-- Integration credentials (DocuSign, Notarize, Plaid, etc.)
CREATE TABLE IF NOT EXISTS org_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  provider VARCHAR(50) NOT NULL, -- docusign, notarize, plaid, stripe, costar, yardi
  
  -- Credentials (encrypted)
  credentials_encrypted TEXT, -- JSON blob: { api_key, client_id, client_secret, etc. }
  
  -- OAuth tokens (if applicable)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Environment
  environment VARCHAR(20) DEFAULT 'sandbox', -- sandbox, production
  
  -- Configuration
  config JSONB DEFAULT '{}', -- provider-specific settings
  webhook_secret VARCHAR(255),
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, disconnected, error
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, provider)
);

CREATE INDEX idx_org_integrations_org ON org_integrations(organization_id);
CREATE INDEX idx_org_integrations_provider ON org_integrations(provider);

-- Integration usage/events log
CREATE TABLE IF NOT EXISTS integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES org_integrations(id) ON DELETE SET NULL,
  
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- document.sent, signature.completed, identity.verified
  event_id VARCHAR(255), -- External event ID
  
  -- Context
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  user_id UUID,
  
  -- Event data
  payload JSONB,
  
  -- Status
  status VARCHAR(20) DEFAULT 'received', -- received, processed, failed
  processed_at TIMESTAMPTZ,
  error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integration_events_org ON integration_events(organization_id, created_at DESC);
CREATE INDEX idx_integration_events_deal ON integration_events(deal_id);
CREATE INDEX idx_integration_events_type ON integration_events(provider, event_type);

-- ─── PART 3: DEAL TEAM ASSIGNMENTS ────────────────────────────────────────────

-- Team assignments per deal (who works on what)
CREATE TABLE IF NOT EXISTS deal_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  
  -- Role on this deal
  deal_role VARCHAR(50) NOT NULL, -- lead, analyst, asset_manager, legal, finance, observer
  
  -- Assignment phase
  phase VARCHAR(50) NOT NULL DEFAULT 'underwriting', -- underwriting, due_diligence, closing, operations
  
  -- Permissions on this deal
  can_edit BOOLEAN DEFAULT TRUE,
  can_approve BOOLEAN DEFAULT FALSE,
  can_sign BOOLEAN DEFAULT FALSE,
  receives_notifications BOOLEAN DEFAULT TRUE,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, removed
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID,
  removed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(deal_id, member_id, phase)
);

CREATE INDEX idx_deal_team_deal ON deal_team_assignments(deal_id);
CREATE INDEX idx_deal_team_member ON deal_team_assignments(member_id);
CREATE INDEX idx_deal_team_phase ON deal_team_assignments(deal_id, phase);

-- Operations handoff tracking
CREATE TABLE IF NOT EXISTS deal_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Handoff type
  handoff_type VARCHAR(50) NOT NULL, -- acquisition_to_operations, operations_to_disposition
  
  -- Who handed off and received
  from_team_lead_id UUID REFERENCES organization_members(id),
  to_team_lead_id UUID REFERENCES organization_members(id),
  
  -- Handoff date
  handoff_date DATE NOT NULL,
  effective_date DATE, -- When new team takes over
  
  -- Documentation
  handoff_notes TEXT,
  checklist_completed JSONB, -- { "financials_transferred": true, "vendor_contacts": true, ... }
  
  -- Approval
  approved_by UUID REFERENCES organization_members(id),
  approved_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, completed
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deal_handoffs_deal ON deal_handoffs(deal_id);

-- ─── PART 4: CONTEXT TRACKER (Email-Wired) ────────────────────────────────────

-- Deal context items (decisions, action items, key info)
CREATE TABLE IF NOT EXISTS deal_context_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Context type
  context_type VARCHAR(50) NOT NULL, -- decision, action_item, key_info, risk, contact, note
  
  -- Content
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Metadata
  category VARCHAR(100), -- financing, legal, due_diligence, operations, etc.
  priority VARCHAR(20), -- high, medium, low
  status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved, closed
  
  -- Due date (for action items)
  due_date DATE,
  
  -- Assignee
  assigned_to UUID REFERENCES organization_members(id),
  
  -- Source tracking (where did this come from?)
  source_type VARCHAR(50), -- manual, email, document, ai_extracted
  source_email_id UUID, -- References emails table
  source_document_id UUID,
  
  -- AI extraction metadata
  ai_extracted BOOLEAN DEFAULT FALSE,
  ai_confidence DECIMAL(3,2),
  ai_source_snippet TEXT, -- The text that was parsed
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES organization_members(id),
  resolution_notes TEXT,
  
  -- Audit
  created_by UUID REFERENCES organization_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deal_context_deal ON deal_context_items(deal_id);
CREATE INDEX idx_deal_context_type ON deal_context_items(deal_id, context_type);
CREATE INDEX idx_deal_context_status ON deal_context_items(deal_id, status);
CREATE INDEX idx_deal_context_source ON deal_context_items(source_email_id);

-- Link table: context items to emails (many-to-many)
CREATE TABLE IF NOT EXISTS deal_context_email_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_item_id UUID NOT NULL REFERENCES deal_context_items(id) ON DELETE CASCADE,
  email_id UUID NOT NULL, -- References your emails table
  
  -- How they're related
  link_type VARCHAR(50) DEFAULT 'mentioned', -- mentioned, created_from, follow_up, resolved_by
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(context_item_id, email_id)
);

CREATE INDEX idx_context_email_links_context ON deal_context_email_links(context_item_id);
CREATE INDEX idx_context_email_links_email ON deal_context_email_links(email_id);

-- ─── PART 5: DOCUMENT SIGNING TRACKING ────────────────────────────────────────

-- Document signing envelopes (DocuSign, Notarize)
CREATE TABLE IF NOT EXISTS signing_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  -- Provider info
  provider VARCHAR(50) NOT NULL, -- docusign, notarize, hellosign
  external_envelope_id VARCHAR(255) NOT NULL,
  
  -- Envelope details
  envelope_type VARCHAR(50), -- psa, loi, loan_docs, side_letter, amendment
  subject VARCHAR(500),
  message TEXT,
  
  -- Documents in envelope
  documents JSONB, -- [{ name, document_id, order }]
  
  -- Status
  status VARCHAR(50) DEFAULT 'created', -- created, sent, delivered, signed, completed, declined, voided
  
  -- Timestamps
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Created by
  created_by UUID REFERENCES organization_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signing_envelopes_org ON signing_envelopes(organization_id);
CREATE INDEX idx_signing_envelopes_deal ON signing_envelopes(deal_id);
CREATE INDEX idx_signing_envelopes_external ON signing_envelopes(provider, external_envelope_id);

-- Signers on envelopes
CREATE TABLE IF NOT EXISTS signing_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id UUID NOT NULL REFERENCES signing_envelopes(id) ON DELETE CASCADE,
  
  -- Recipient info
  recipient_type VARCHAR(50) NOT NULL, -- signer, cc, in_person_signer, notary
  routing_order INT DEFAULT 1,
  
  -- Contact details
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  
  -- Optional: link to member
  member_id UUID REFERENCES organization_members(id),
  
  -- Status
  status VARCHAR(50) DEFAULT 'created', -- created, sent, delivered, signed, declined
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  
  -- External IDs
  external_recipient_id VARCHAR(255),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signing_recipients_envelope ON signing_recipients(envelope_id);
CREATE INDEX idx_signing_recipients_email ON signing_recipients(email);

-- ─── PART 6: IDENTITY VERIFICATION (Plaid, etc.) ──────────────────────────────

-- Identity verification requests
CREATE TABLE IF NOT EXISTS identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  -- Provider
  provider VARCHAR(50) NOT NULL, -- plaid, persona, jumio
  external_verification_id VARCHAR(255),
  
  -- Subject
  subject_type VARCHAR(50) NOT NULL, -- investor, borrower, guarantor, principal
  subject_name VARCHAR(255) NOT NULL,
  subject_email VARCHAR(255),
  
  -- Link to member if internal
  member_id UUID REFERENCES organization_members(id),
  
  -- Verification type
  verification_type VARCHAR(50) NOT NULL, -- identity, kyc, kyb, accreditation, bank_account
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed, expired
  
  -- Results
  verification_result JSONB, -- Provider-specific results
  risk_score DECIMAL(3,2),
  flags JSONB, -- Any flags or warnings
  
  -- Timestamps
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Requested by
  requested_by UUID REFERENCES organization_members(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_identity_verifications_org ON identity_verifications(organization_id);
CREATE INDEX idx_identity_verifications_deal ON identity_verifications(deal_id);
CREATE INDEX idx_identity_verifications_status ON identity_verifications(status);

-- ─── PART 7: ADD ORG REFERENCE TO DEALS ───────────────────────────────────────

-- Add organization_id to deals if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE deals ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_deals_organization ON deals(organization_id);
  END IF;
END $$;

-- ─── PART 8: VIEWS ────────────────────────────────────────────────────────────

-- Deal team roster view
CREATE OR REPLACE VIEW deal_team_roster AS
SELECT 
  dta.deal_id,
  d.name as deal_name,
  dta.phase,
  om.user_id,
  om.work_email,
  om.title,
  om.department,
  dta.deal_role,
  dta.can_edit,
  dta.can_approve,
  dta.can_sign,
  dta.assigned_at
FROM deal_team_assignments dta
JOIN organization_members om ON om.id = dta.member_id
JOIN deals d ON d.id = dta.deal_id
WHERE dta.status = 'active';

-- Pending action items view
CREATE OR REPLACE VIEW pending_action_items AS
SELECT 
  dci.id,
  dci.deal_id,
  d.name as deal_name,
  dci.title,
  dci.description,
  dci.category,
  dci.priority,
  dci.due_date,
  dci.assigned_to,
  om.work_email as assignee_email,
  dci.created_at,
  CASE 
    WHEN dci.due_date < CURRENT_DATE THEN 'overdue'
    WHEN dci.due_date = CURRENT_DATE THEN 'due_today'
    WHEN dci.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
    ELSE 'upcoming'
  END as urgency
FROM deal_context_items dci
JOIN deals d ON d.id = dci.deal_id
LEFT JOIN organization_members om ON om.id = dci.assigned_to
WHERE dci.context_type = 'action_item'
  AND dci.status IN ('open', 'in_progress')
ORDER BY dci.due_date NULLS LAST, dci.priority DESC;

-- Signing status summary view
CREATE OR REPLACE VIEW signing_status_summary AS
SELECT 
  se.deal_id,
  d.name as deal_name,
  se.envelope_type,
  se.subject,
  se.status,
  se.sent_at,
  se.completed_at,
  COUNT(sr.id) as total_signers,
  COUNT(sr.id) FILTER (WHERE sr.status = 'signed') as signed_count,
  COUNT(sr.id) FILTER (WHERE sr.status = 'declined') as declined_count
FROM signing_envelopes se
JOIN deals d ON d.id = se.deal_id
LEFT JOIN signing_recipients sr ON sr.envelope_id = se.id
GROUP BY se.id, se.deal_id, d.name, se.envelope_type, se.subject, se.status, se.sent_at, se.completed_at;
