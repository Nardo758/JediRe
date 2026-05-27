-- Task #1271 — Unit Mix: adoption timeline for lease-up deals
-- Adds construction_months, lease_up_months, absorption_units_per_month
-- to deal_assumptions so operators can define the ramp schedule for
-- development/lease-up deals. Nullable; NULL means "use platform default".

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS construction_months       NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS lease_up_months           NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS absorption_units_per_month NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS stabilization_target_pct  NUMERIC(5,4);

COMMENT ON COLUMN deal_assumptions.construction_months        IS 'Months from deal close to certificate of occupancy (Task #1271)';
COMMENT ON COLUMN deal_assumptions.lease_up_months            IS 'Months from CO to stabilized occupancy (Task #1271)';
COMMENT ON COLUMN deal_assumptions.absorption_units_per_month IS 'Units leased per month during lease-up ramp (Task #1271)';
COMMENT ON COLUMN deal_assumptions.stabilization_target_pct   IS 'Target occupancy at stabilization, stored as decimal (0.95 = 95%) (Task #1271)';
