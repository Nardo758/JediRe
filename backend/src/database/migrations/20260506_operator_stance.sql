-- Migration: 20260506_operator_stance
-- Description: Adds operator_stance JSONB column to deals table.
--
-- OperatorStance is the meta-layer that modulates how the Cashflow Agent
-- exercises discretion when deriving assumptions. It is a sibling of
-- LayeredValue, not a layer of it.
--
-- NULL means operator has not set a stance → backend resolves MARKET defaults.
-- Non-null persists the operator's last-set stance as a JSONB blob.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS operator_stance JSONB DEFAULT NULL;

COMMENT ON COLUMN deals.operator_stance IS
  'OperatorStance blob: { rateEnvironment, cyclePosition, recessionProbability, '
  'underwritingPosture, concessionStrategy, marketingIntensity, expenseGrowthPosture, '
  'leasingCostTreatment, '
  'stressRentGrowthHaircut, stressExitCapWiden, stressVacancyFloor, defaulted, updatedAt }. '
  'NULL = platform MARKET defaults apply. '
  'leasingCostTreatment: OPERATING | CAPITALIZED | HYBRID — governs how lease-up costs '
  '(concessions, marketing, locator fees) split between P&L and capitalized_lease_up_total.';
