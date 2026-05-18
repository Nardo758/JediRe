-- Task #878: Extend user_type to human_sponsor | human_lp | human_lender
--
-- Rationale: the LP/Lender feature adds three distinct human user sub-types.
-- user_type is extended in-place rather than replaced so all existing
-- RBAC/auth code that checks `user_type = 'agent'` remains correct.
-- The legacy value 'human' is kept valid (backward compat) but all new
-- registrations use 'human_sponsor' | 'human_lp' | 'human_lender'.
--
-- Relationship with platform_role:
--   platform_role = 'sponsor' | 'lp' | 'lender' (denormalised, fast)
--   user_type     = the canonical enum — now extended to human_* variants
--   Both columns are kept in sync at registration + migration time.

-- 1. Replace the existing CHECK constraint with the extended set.
--    'human' remains valid (backward compat for any in-flight rows).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;

ALTER TABLE users
  ADD CONSTRAINT users_user_type_check
  CHECK (user_type IN ('human', 'agent', 'human_sponsor', 'human_lp', 'human_lender'));

-- 2. Migrate existing 'human' rows → 'human_sponsor'.
--    This is safe and idempotent: all such rows have platform_role = 'sponsor'
--    (set by the 20260523 migration), so both columns agree after this update.
UPDATE users
SET user_type = 'human_sponsor'
WHERE user_type = 'human';
