-- Migration: Task #1540 (Piece B1 — LTL Forward Trajectory Math)
-- Adds lease_roll_velocity_per_year and mark_to_market_capture_rate to deal_assumptions.
--
-- lease_roll_velocity_per_year: JSONB array of per-year velocity fractions (one entry per
--   hold year). Each element is the fraction of leases rolling in that year, computed from
--   deal_lease_transactions.lease_end distribution at seeder time. Used as the primary
--   driver in the LTL forward trajectory formula:
--     LTL[yr] = LTL[yr-1] × (1 − velocity[yr] × captureRate)
--
-- mark_to_market_capture_rate: operator-controllable fraction of LTL gap closed each time
--   a lease rolls. Default 0.33 (33% gap closure per roll event). Stored as decimal.

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS lease_roll_velocity_per_year  JSONB,
  ADD COLUMN IF NOT EXISTS mark_to_market_capture_rate   NUMERIC(6,4);

COMMENT ON COLUMN deal_assumptions.lease_roll_velocity_per_year IS
  'Per-year lease roll velocity fractions computed from deal_lease_transactions.lease_end distribution. '
  'Array length matches hold_period_years. Element[i] = fraction of leases rolling in year (i+1). '
  'Seeded by proforma-seeder.service.ts; re-seeded on new rent roll upload. Null = use uniform fallback (1/holdYears).';

COMMENT ON COLUMN deal_assumptions.mark_to_market_capture_rate IS
  'Operator-controllable fraction of LTL gap closed per roll event (0–1). '
  'Default 0.33 (33%). Applies in formula: LTL[yr] = LTL[yr-1] × (1 − velocity[yr] × captureRate). '
  'Surfaced in F9 LEASING tab as Cat C operator assumption.';
