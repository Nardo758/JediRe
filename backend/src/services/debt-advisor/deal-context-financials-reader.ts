/**
 * B6: Deal Context Financials Reader (stub)
 *
 * Placeholder for the service that reads deal financials from the
 * database or data flow router to populate DebtContextInput fields.
 *
 * This stub preserves the interface contract. A future iteration will
 * implement the actual DB queries.
 */

import type { DebtContextInput, InPlaceLoan, MarketRates, M11Sizing } from './debt-context';

export interface FinancialsReaderInput {
  dealId: string;
  /** Optional: pass M11 sizing result directly instead of re-computing */
  m11Sizing?: M11Sizing;
  /** Optional: pass market rates directly instead of fetching */
  marketRates?: MarketRates;
  /** Optional: pass loan product context directly */
  loanProduct?: DebtContextInput['loanProduct'];
}

/**
 * Stub: reads deal context financials and returns a partial DebtContextInput.
 *
 * TODO: Implement actual DB queries for:
 *   - deal assumptions (purchasePrice, noiY1, holdYears, etc.)
 *   - in-place loans from deal_debt_schedule
 *   - M11 sizing from capital-structure-adapter
 *   - market rates from rate-environment.service
 *   - loan product from loan-product.ruleset
 */
export async function readDealContextFinancials(
  _input: FinancialsReaderInput,
): Promise<Partial<DebtContextInput>> {
  // Stub: returns empty partial — caller must fill in required fields
  return {};
}

/**
 * Stub: read in-place loans for a deal.
 */
export async function readInPlaceLoan(_dealId: string): Promise<InPlaceLoan | null> {
  return null;
}

/**
 * Stub: read market rates snapshot.
 */
export async function readMarketRates(): Promise<MarketRates | null> {
  return null;
}

/**
 * Stub: read M11 sizing result for a deal.
 */
export async function readM11Sizing(_dealId: string): Promise<M11Sizing | null> {
  return null;
}
