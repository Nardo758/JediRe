-- Migration: add hedge_type and hedge_expiry_date to debt_positions
-- rate_cap_strike and rate_cap_expiry already exist (added during initial schema design)
-- hedge_type and hedge_expiry_date are new fields for task #1717

ALTER TABLE debt_positions
  ADD COLUMN IF NOT EXISTS hedge_type       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS hedge_expiry_date DATE;

COMMENT ON COLUMN debt_positions.hedge_type        IS 'Rate hedge instrument type: cap | swap | collar | none';
COMMENT ON COLUMN debt_positions.hedge_expiry_date IS 'Date hedge instrument expires (may differ from rate_cap_expiry)';
