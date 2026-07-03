/**
 * Debt Advisor — public exports
 */

export {
  computeVintageDebtEstimate,
  persistVintageDebtEstimate,
  type VintageDebtEstimate,
  type FlagResult,
  type DebtPositionEstimate,
  type MaybeNumber,
  type Undeterminable,
} from './vintage-debt-estimator.service';

export {
  VINTAGE_SPREAD_RULESET,
  type LenderType,
} from './rulesets/vintage-spread.ruleset';

export {
  AMORT_PROFILE_RULESET,
  resolveAmortProfile,
  type AmortProfile,
} from './rulesets/amort-profile.ruleset';

export {
  DISTRESS_THRESHOLD_RULESET,
} from './rulesets/distress-threshold.ruleset';
