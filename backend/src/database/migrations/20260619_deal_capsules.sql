-- Deal Capsules: persistent shareable snapshots with layer-filtered permissions
-- P1-1: Enables sharing with layer-filtered permissions (evidence without thesis)
-- Spec §5: frozen shareable capsule; AES + shortcode + scoped recipient

CREATE TABLE IF NOT EXISTS deal_capsules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- NULL = never expires
  
  -- Encryption & access
  encryption_key_id TEXT, -- reference to KMS/key vault (AES-256-GCM)
  shortcode TEXT UNIQUE, -- e.g. "c/abc123" — minted at creation
  
  -- Layer filter: which assumption layers to include in the shared snapshot
  -- Each boolean controls whether that layer is visible to the recipient
  layer_filter JSONB NOT NULL DEFAULT '{
    "broker_claims": true,
    "extraction_t12": true,
    "extraction_rent_roll": true,
    "extraction_tax_bill": true,
    "platform_benchmark": true,
    "override": false,
    "agent": false
  }'::jsonb,
  
  -- Recipient tier and permissions
  recipient_tier TEXT DEFAULT 'free', -- free | professional | team | enterprise
  permissions JSONB NOT NULL DEFAULT '{
    "view_summary": true,
    "view_assumptions": true,
    "view_documents": true,
    "flex_assumptions": false,
    "export_excel": false,
    "share_again": false
  }'::jsonb,
  
  -- Frozen snapshot data (point-in-time copy of year1 + Projections)
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Share metering (Stripe integration)
  share_metering JSONB DEFAULT '{
    "metered": false,
    "stripe_price_id": null,
    "margin_pct": 30
  }'::jsonb,
  
  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'active', -- active | expired | revoked | viewed
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  revoke_reason TEXT,
  
  -- Access tracking
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMP,
  
  -- Recipient context (for recipient-mode access)
  recipient_email TEXT,
  recipient_name TEXT,
  recipient_org TEXT
);

-- Indexes for fast capsule lookups
CREATE INDEX IF NOT EXISTS idx_deal_capsules_deal_id ON deal_capsules(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_capsules_shortcode ON deal_capsules(shortcode);
CREATE INDEX IF NOT EXISTS idx_deal_capsules_created_by ON deal_capsules(created_by);
CREATE INDEX IF NOT EXISTS idx_deal_capsules_status ON deal_capsules(status);
CREATE INDEX IF NOT EXISTS idx_deal_capsules_expires_at ON deal_capsules(expires_at);
CREATE INDEX IF NOT EXISTS idx_deal_capsules_recipient_email ON deal_capsules(recipient_email);

COMMENT ON TABLE deal_capsules IS
  'Frozen shareable deal snapshots with layer-filtered permissions. Each capsule is a point-in-time copy of the deal model with configurable assumption visibility. Layer filter allows sharing evidence (t12, platform) without sharing thesis (override, agent). Required for institutional LP sharing.';
