/**
 * debt-context-assembler.ts
 * B6b: Build DebtContext assembler service.
 *
 * Assembles all debt-layer inputs into a single DebtContext object
 * used by the debt advisor, S1 distress engine, and downstream agents.
 */

import type {
  DebtContext,
  DebtContextInput,
  M11Sizing,
  LoanProductContext,
} from './debt-context';

export { DebtContext, DebtContextInput } from './debt-context';

/**
 * Assemble a complete DebtContext from all debt-layer inputs.
 *
 * @param dealId The deal identifier.
 * @param inputs All inputs required to build the DebtContext.
 * @returns A fully populated DebtContext with an ISO timestamp.
 */
export function assembleDebtContext(dealId: string, inputs: DebtContextInput): DebtContext {
  const {
    m11Result,
    dealContextFinancials,
    inPlaceLoan,
    distressFlags,
    marketRates,
    loanProduct,
    loanQuotes,
  } = inputs;

  // Build M11 sizing from the RecommendedTerms result (null if not provided)
  const m11Sizing: M11Sizing | null = m11Result
    ? {
        recommendedLoanAmount: m11Result.recommendedLoanAmount,
        bindingConstraint: m11Result.bindingConstraint,
        constraintDetails: m11Result.constraintDetails,
      }
    : null;

  // Build loan product context from the ruleset result (or null if not provided)
  const resolvedLoanProduct: LoanProductContext | null = loanProduct ?? null;

  return {
    dealId,
    inPlaceLoan,
    distressFlags,
    marketRates,
    loanProduct: resolvedLoanProduct,
    m11Sizing,
    dealContextFinancials: dealContextFinancials ?? undefined,
    loanQuotes: loanQuotes ?? undefined,
    assembledAt: new Date().toISOString(),
  };
}
