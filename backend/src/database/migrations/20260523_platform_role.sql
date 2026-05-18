-- Task #878: Capital Structure Phase 2 — LP and Lender User Types
-- Adds platform_role column and user_capabilities table.
-- Extends the user type model: human_sponsor (default), human_lp, human_lender
-- are represented as platform_role = 'sponsor' | 'lp' | 'lender'.
-- user_type remains 'human' | 'agent' (unchanged — backward compat).

-- 1. Add platform_role column to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS platform_role TEXT NOT NULL DEFAULT 'sponsor';

-- Enforce valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_platform_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_platform_role_check
      CHECK (platform_role IN ('sponsor', 'lp', 'lender'));
  END IF;
END$$;

-- 2. Backfill: existing human users become sponsors (human → human_sponsor)
UPDATE users
SET platform_role = 'sponsor'
WHERE (user_type = 'human' OR user_type IS NULL)
  AND platform_role = 'sponsor'; -- safe no-op re-run

-- 3. user_capabilities: fine-grained capability grants per user.
-- Source of truth is platform_role at registration; rows seeded by auth route.
-- Also supports ad-hoc grants (granted_by = 'admin').
CREATE TABLE IF NOT EXISTS user_capabilities (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability   TEXT         NOT NULL,
  granted_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  granted_by   TEXT         NOT NULL DEFAULT 'system',
  UNIQUE (user_id, capability)
);

CREATE INDEX IF NOT EXISTS idx_user_capabilities_user_id
  ON user_capabilities(user_id);

-- 4. Seed capabilities for all existing sponsor users.
-- Sponsors get full edit access; LP/lender rows do NOT get edit capabilities.
INSERT INTO user_capabilities (user_id, capability, granted_by)
SELECT id, 'edit:capital_structure', 'system'
FROM users
WHERE platform_role = 'sponsor'
ON CONFLICT DO NOTHING;

INSERT INTO user_capabilities (user_id, capability, granted_by)
SELECT id, 'edit:operating_assumptions', 'system'
FROM users
WHERE platform_role = 'sponsor'
ON CONFLICT DO NOTHING;

-- All users get view:returns
INSERT INTO user_capabilities (user_id, capability, granted_by)
SELECT id, 'view:returns', 'system'
FROM users
ON CONFLICT DO NOTHING;
