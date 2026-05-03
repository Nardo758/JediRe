-- =============================================================================
-- M07 Subject History Engine v2 — Task #525 fix
-- =============================================================================
-- Depends on: 20260503_m07_subject_history_engine.sql
--
-- Changes:
--   1. ALTER subject_traffic_history — add deal_mode column
--      Stores the deal's operating mode at the time subject data was collected.
--      Used by ConcessionEnvironmentEngine to enforce mode-mismatch rejection
--      (LEASE_UP-tagged subject data must NOT influence STABILIZED years).
-- =============================================================================

ALTER TABLE subject_traffic_history
  ADD COLUMN IF NOT EXISTS deal_mode text DEFAULT NULL
    CHECK (deal_mode IS NULL OR deal_mode IN ('STABILIZED','LEASE_UP','REDEVELOPMENT'));

COMMENT ON COLUMN subject_traffic_history.deal_mode IS
  'Deal operating mode when subject data was collected (STABILIZED|LEASE_UP|REDEVELOPMENT). '
  'NULL means pre-v2 rows where mode was not recorded. '
  'Used by ConcessionEnvironmentEngine for mode-mismatch enforcement: '
  'LEASE_UP-tagged subject coefficients are rejected when computing STABILIZED years.';
