-- ============================================================================
-- Migration 20260503_019 — M07 Subject History: deal_mode column
--
-- Adds deal_mode to subject_traffic_history so the Concession Environment
-- engine can enforce mode-mismatch rejection (e.g. a LEASE_UP subject cannot
-- be blended into a STABILIZED deal computation).
--
-- Idempotent: IF NOT EXISTS guard makes re-runs safe in all environments.
-- ============================================================================

ALTER TABLE subject_traffic_history
  ADD COLUMN IF NOT EXISTS deal_mode text
    CHECK (deal_mode IN ('STABILIZED', 'LEASE_UP', 'REDEVELOPMENT'));

COMMENT ON COLUMN subject_traffic_history.deal_mode IS
  'Operating mode recorded at the time of S1/S2 collection (from deals.deal_data). '
  'Used by the Concession Environment engine to reject subject blending when the '
  'subject mode does not match the current deal mode.';
