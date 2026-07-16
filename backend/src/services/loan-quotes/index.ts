/**
 * loan-quotes — public exports
 */

export type {
  LoanQuote,
  LoanQuoteStore,
  SpreadMatrix,
  SpreadRange,
  Adjustment,
  PrepayStructure,
  PrepayType,
  BrokerClaimsProvenance,
  IndexBasis,
  RateType,
  LeverageTier,
  TermYears,
} from './loan-quote.types';

export {
  PostgresLoanQuoteStore,
  getLoanQuoteStore,
  resetLoanQuoteStore,
  validateQuoteShape,
  QuoteNotFoundError,
  OrgMismatchError,
} from './loan-quote-store';

export {
  computeAllInRate,
  termIndex,
} from './pricing-resolver';
export type {
  PricingInput,
  PricingResult,
  PricingAbsence,
} from './pricing-resolver';

export {
  fetchForwardCurve,
  interpolateRate,
  isStale,
  getTermIndex,
} from './forward-curve';
export type {
  ForwardCurve,
  TenorPoint,
} from './forward-curve';

export {
  compareQuotes,
  flagStaleQuotes,
} from './quote-comparison';
export type {
  QuoteComparisonInput,
  QuoteComparisonResult,
  RankedQuote,
  ComparisonObjective,
} from './quote-comparison';

export {
  createManualQuote,
} from './intake/manual-entry';
export type {
  ManualQuoteForm,
} from './intake/manual-entry';

export {
  processEmailQuote,
} from './intake/email-intake';
export type {
  FinancingEmail,
} from './intake/email-intake';

export {
  extractRateSheet,
} from './intake/rate-sheet-extractor';
export type {
  RateSheetDocument,
} from './intake/rate-sheet-extractor';
