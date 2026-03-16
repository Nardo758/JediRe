-- M29 Phase 1: Organization Foundation & RBAC

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orgs_owner ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_orgs_slug ON organizations(slug);

CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);

CREATE TABLE IF NOT EXISTS org_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'analyst',
  token VARCHAR(64) NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON org_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON org_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON org_invitations(email);

ALTER TABLE deals ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_deals_org ON deals(org_id);

-- Backfill: create a personal org for each existing user and assign them as owner
DO $$
DECLARE
  u RECORD;
  new_org_id UUID;
  slug_base TEXT;
BEGIN
  FOR u IN SELECT id, email, full_name FROM users LOOP
    slug_base := split_part(u.email, '@', 1);
    slug_base := regexp_replace(slug_base, '[^a-zA-Z0-9_-]', '-', 'g');
    slug_base := left(slug_base, 80);

    IF NOT EXISTS (SELECT 1 FROM org_members WHERE user_id = u.id) THEN
      new_org_id := gen_random_uuid();

      INSERT INTO organizations (id, name, slug, owner_id)
      VALUES (
        new_org_id,
        COALESCE(u.full_name, split_part(u.email, '@', 1)) || '''s Organization',
        slug_base || '-' || left(new_org_id::text, 8),
        u.id
      )
      ON CONFLICT (slug) DO NOTHING;

      INSERT INTO org_members (org_id, user_id, role)
      VALUES (new_org_id, u.id, 'owner')
      ON CONFLICT (org_id, user_id) DO NOTHING;

      UPDATE deals SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
    END IF;
  END LOOP;
END $$;
