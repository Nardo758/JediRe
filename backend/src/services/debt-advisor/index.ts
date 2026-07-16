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

// B6: Debt Context
export type {
  DebtContext,
  DebtContextInput,
  InPlaceLoan,
  DistressFlags,
  MarketRates,
  M11Sizing,
  LoanProductContext,
  LoanQuote,
} from './debt-context';

export { assembleDebtContext } from './debt-context-assembler';

export { computeDistressFlags } from './s1-distress-calculator';

export {
  computeOptimalTerm,
  batchOptimizeTerms,
  type TermOptimizerInput,
  type TermOptimizerResult,
  type TermOptimizerAbsence,
  type TermEvaluation,
  type BatchTermOptimizerInput,
  type BatchTermOptimizerResult,
} from './term-optimizer';

export {
  readDealContextFinancials,
  readInPlaceLoan,
  readMarketRates,
  readM11Sizing,
} from './deal-context-financials-reader';

// LQ-5: Exit Window Calculator
export {
  computeExitWindows,
  type ExitWindowInput,
  type ExitWindowAnalysis,
  type RefiWindow,
} from './exit-window-calculator';
