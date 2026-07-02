-- B2b: users.default_org_id — deterministic org resolution (replaces LIMIT 1)
--
-- Every user creation path (signup, bridge, invite-accept) sets this field.
-- resolveOrgForUser reads it first; LIMIT 1 fallback fires only if it's NULL and logs a warning.
-- Switcher-ready: the workspace-switcher UI later sets session_active_org_id, which resolution
-- reads before default_org_id. Only default_org_id is built here.

ALTER TABLE users ADD COLUMN IF NOT EXISTS default_org_id UUID NULL
  REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_default_org_id
  ON users(default_org_id) WHERE default_org_id IS NOT NULL;

-- Backfill existing users: post-B1, every user has 0 or 1 org membership — unambiguous.
-- Leon → dd201183; any user with no org membership → NULL (will be set on next creation event).
UPDATE users u
SET default_org_id = (
  SELECT org_id FROM org_members om
  WHERE om.user_id = u.id
  LIMIT 1
)
WHERE u.default_org_id IS NULL;

-- schema-check tag (read by run-migrations.ts assertCriticalSchema)
-- CRITICAL: users.default_org_id
