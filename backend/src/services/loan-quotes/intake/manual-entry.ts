/**
 * manual-entry.ts
 * Component 4: Manual entry channel.
 *
 * Intake channel #3: Manual entry.
 * For phone quotes / one-off terms — a form that writes a loan_quotes row
 * directly.
 *
 * Provenance chain:
 *   user_form_input → validate → createManualQuote → broker_claims
 *
 * The user is the provenance source (confidence = 1.0).
 */

import type { LoanQuote, BrokerClaimsProvenance, SpreadMatrix, Adjustment, PrepayStructure, IndexBasis, RateType } from '../loan-quote.types';

/**
 * Form input for manual quote entry.
 */
export interface ManualQuoteForm {
  /** Org scope — Lane B privacy. */
  orgId: string;

  /** User entering the quote. */
  enteredBy: string;

  /** Lender name. */
  lender: string;

  /** Program. */
  program: string;

  /** Quote date (ISO 8601). */
  quoteDate: string;

  /** Expiry date (ISO 8601). */
  expires: string;

  /** Index basis. */
  indexBasis: IndexBasis;

  /** Fixed or floating. */
  rateType: RateType;

  /** Spread matrix grid. */
  spreadMatrix: SpreadMatrix;

  /** Adjustment stack. */
  adjustments: Adjustment[];

  /** Prepay structure. */
  prepayStructure: PrepayStructure;

  /** Optional notes. */
  notes?: string;
}

/**
 * Create a LoanQuote from a manual entry form.
 *
 * The user is the provenance source with confidence 1.0 (verified human entry).
 *
 * @param form — validated manual entry form
 * @returns a LoanQuote ready for the store
 */
export function createManualQuote(form: ManualQuoteForm): LoanQuote {
  const now = new Date().toISOString();

  const provenance: BrokerClaimsProvenance = {
    source: 'manual_entry',
    date: now,
    confidence: 1.0,
    sourceId: form.enteredBy,
    context: `Manually entered by ${form.enteredBy}`,
  };

  return {
    id: `quote-manual-${Date.now()}`,
    orgId: form.orgId,
    lender: form.lender,
    program: form.program,
    quoteDate: form.quoteDate,
    expires: form.expires,
    indexBasis: form.indexBasis,
    rateType: form.rateType,
    spreadMatrix: form.spreadMatrix,
    adjustments: form.adjustments,
    prepayStructure: form.prepayStructure,
    brokerClaims: provenance,
    notes: form.notes,
    createdAt: now,
    updatedAt: now,
  };
}
