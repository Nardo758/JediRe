-- Migration: deal_templates table for F9 Settings persistence
-- Note: uses `category` instead of the spec's `type` to match the frontend CATEGORIES array
-- and avoid conflict with the reserved SQL keyword `type`.

CREATE TABLE IF NOT EXISTS deal_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'ProForma',
  description TEXT,
  sections    JSONB DEFAULT '[]'::jsonb,
  is_default  BOOLEAN DEFAULT false,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_templates_org_id ON deal_templates(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_deal_templates_org_name ON deal_templates(org_id, name);
