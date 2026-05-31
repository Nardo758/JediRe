-- lifecycle_profile — detection + operator override columns for deal_assumptions
-- Phase 1A lifecycle state machine: STABILIZED | VALUE_ADD | DISTRESSED | DEVELOPMENT

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS lifecycle_profile          VARCHAR(32),
  ADD COLUMN IF NOT EXISTS lifecycle_profile_override VARCHAR(32);

COMMENT ON COLUMN deal_assumptions.lifecycle_profile IS
  'Auto-detected lifecycle profile for this deal. One of: STABILIZED, VALUE_ADD, DISTRESSED, DEVELOPMENT. Written by the detection algorithm after pipeline runs and on material input changes. Null until first detection pass.';

COMMENT ON COLUMN deal_assumptions.lifecycle_profile_override IS
  'Operator-set lifecycle profile override. Takes precedence over the auto-detected value when set. One of: STABILIZED, VALUE_ADD, DISTRESSED, DEVELOPMENT. Cleared by setting to NULL.';
