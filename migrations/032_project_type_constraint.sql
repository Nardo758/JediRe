-- Migration 032: Fix check_project_type constraint to allow canonical deal modes
--
-- Context: W1-10 epoch flag positive case was blocked because the CHECK constraint
-- on deals.project_type rejected 'lease_up' / 'lease-up' (canonical values from
-- model-type-inference.service.ts). The constraint fossilized the old vocabulary
-- that W1-2 killed in code but never updated in DDL.
--
-- Canonical values (from backend/src/shared/canonical-keys.ts + model-type-inference):
--   existing, stabilized, value_add, lease_up, development, redevelopment
--
-- Safe: wrapped in transaction; constraint dropped only if exists, new one added
-- only if missing.

BEGIN;

-- Drop old constraint if it exists
ALTER TABLE deals DROP CONSTRAINT IF EXISTS check_project_type;

-- Add new constraint with canonical 6-value set + NULL allowance
-- NULL is allowed because fresh deals may not have a project_type yet
ALTER TABLE deals
  ADD CONSTRAINT check_project_type
  CHECK (
    project_type IS NULL
    OR project_type IN (
      'existing',
      'stabilized',
      'value_add',
      'lease_up',
      'development',
      'redevelopment'
    )
  );

COMMIT;
