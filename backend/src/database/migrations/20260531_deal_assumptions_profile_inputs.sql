-- Profile-specific pre-stabilization input columns for deal_assumptions
-- Task: Profile-Specific Pre-Stabilization Formulas
-- Four lifecycle profile branches: STABILIZED | VALUE_ADD | DISTRESSED | DEVELOPMENT

ALTER TABLE deal_assumptions
  ADD COLUMN IF NOT EXISTS renovation_units_per_year              NUMERIC,
  ADD COLUMN IF NOT EXISTS renovation_premium_per_unit_monthly    NUMERIC,
  ADD COLUMN IF NOT EXISTS renovation_downtime_months_per_unit    NUMERIC,
  ADD COLUMN IF NOT EXISTS operational_improvement_velocity       NUMERIC,
  ADD COLUMN IF NOT EXISTS rent_recovery_path_months              NUMERIC,
  ADD COLUMN IF NOT EXISTS lease_up_velocity_units_per_month      NUMERIC,
  ADD COLUMN IF NOT EXISTS concession_lease_up_initial_months     NUMERIC;

COMMENT ON COLUMN deal_assumptions.renovation_units_per_year IS
  'VALUE_ADD profile: number of units renovated per year. Drives the renovated/non-renovated unit split in the per-year GPR walk.';

COMMENT ON COLUMN deal_assumptions.renovation_premium_per_unit_monthly IS
  'VALUE_ADD profile: incremental monthly rent premium per unit after renovation ($/unit/month). Applied to renovated units in the GPR walk.';

COMMENT ON COLUMN deal_assumptions.renovation_downtime_months_per_unit IS
  'VALUE_ADD profile: months a unit is offline during renovation (vacancy downtime per unit). Default 1.0 month.';

COMMENT ON COLUMN deal_assumptions.operational_improvement_velocity IS
  'DISTRESSED profile: units/month at which operational improvements compress vacancy (e.g. management turnaround, collections recovery).';

COMMENT ON COLUMN deal_assumptions.rent_recovery_path_months IS
  'DISTRESSED profile: number of months until rents recover to market (rent recovery ramp length). Determines rent concession burn-off schedule.';

COMMENT ON COLUMN deal_assumptions.lease_up_velocity_units_per_month IS
  'DEVELOPMENT profile: lease-up absorption rate in units/month after construction completion. Sourced from M07 submarket absorption signal.';

COMMENT ON COLUMN deal_assumptions.concession_lease_up_initial_months IS
  'DEVELOPMENT profile: initial concession offer during lease-up phase expressed in months of free rent (e.g. 1.5 = 1.5 months free). Burns off linearly as occupancy approaches stabilization.';
