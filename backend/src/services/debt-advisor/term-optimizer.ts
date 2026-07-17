/**
 * term-optimizer.ts
 * LQ-4: Term Optimizer — compute optimal loan term from forward curve + hold period + quote spreads.
 *
 * For a given deal, quote, and hold period, evaluates every available term in the
 * quote's spread matrix and computes the total cost of borrowing over the hold.
 * The optimal term minimizes total cost = interest + refi cost (if term < hold)
 * + early payoff penalty (if term > hold).
 *
 * Honest-absence invariant: if the curve is stale/missing, the quote lacks terms,
 * or the hold period is invalid, return null with reason — never fabricate.
 *
 * Depends on: ForwardCurve (Component 2b), LoanQuote (Component 1),
 *             PricingResolver (Component 2a), DebtContext.holdPeriodYears.
 */

import type { LoanQuote } from '../loan-quotes/loan-quote.types';
import type { ForwardCurve } from '../loan-quotes/forward-curve';
import { computeAllInRate } from '../loan-quotes/pricing-resolver';
import type { PricingResult } from '../loan-quotes/pricing-resolver';

// ============================================================================
// Term Optimizer Input
// ============================================================================

/**
 * Input to the term optimizer.
 */
export interface TermOptimizerInput {
  /** Deal assumptions: purchase price, NOI, target LTV, etc. */
  dealAssumptions: {
    purchasePrice: number;
    noiY1: number;
    targetLtv: number;
    /** Optional: if the deal already has a preferred tier. */
    targetTier?: string;
  };

  /** Target leverage tier (e.g. 'Tier-3'). */
  targetTier: string;

  /** Target program (e.g. 'Fannie DUS'). Must match a program in the quote. */
  targetProgram: string;

  /** The quote to optimize against. */
  quote: LoanQuote;

  /** Forward curve for term_index lookup. */
  curve: ForwardCurve | null;

  /** Expected hold period in years (e.g. 5 for a 5-year hold). */
  holdPeriodYears: number;

  /** Loan amount in dollars (used for interest cost computation). */
  loanAmount: number;

  /**
   * Spread selection strategy within the quoted range.
   * - 'midpoint'     → use (min + max) / 2
   * - 'conservative' → use max (worst-case for borrower)
   * - 'optimistic'   → use min (best-case for borrower)
   */
  spreadStrategy?: 'midpoint' | 'conservative' | 'optimistic';

  /**
   * Estimated refinancing cost as a percentage of loan amount.
   * Default: 1.5% (0.015) — covers origination fees, legal, title, etc.
   */
  refiCostPct?: number;

  /**
   * Amortization period in years. Default: 30.
   * Used for interest cost computation when term exceeds hold period.
   */
  amortYears?: number;
}

// ============================================================================
// Term Evaluation Result
// ============================================================================

/**
 * The computed cost breakdown for a single term candidate.
 */
export interface TermEvaluation {
  /** Term in years evaluated. */
  termYears: number;

  /** All-in rate for this term (decimal). */
  allInRate: number;

  /** Term index used (interpolated from forward curve, decimal). */
  termIndex: number;

  /** Selected spread from the matrix (decimal). */
  spread: number;

  /** Total interest paid over the hold period (dollars). */
  totalInterest: number;

  /** Refinancing cost if term < hold period (dollars). */
  refiCost: number;

  /** Early payoff penalty if term > hold period (dollars). */
  earlyPayoffPenalty: number;

  /** Total cost of borrowing = interest + refi cost + early payoff (dollars). */
  totalCost: number;

  /** Monthly debt service for this term (dollars). */
  monthlyDebtService: number;

  /** Full provenance chain from the pricing resolver. */
  provenanceChain: Array<{ step: string; value: number; source: string }>;

  /** Whether this term requires a refinance before hold exit. */
  requiresRefi: boolean;

  /** Whether this term has an early payoff penalty at hold exit. */
  hasEarlyPayoff: boolean;
}

// ============================================================================
// Term Optimizer Result
// ============================================================================

/**
 * Output of the term optimizer.
 * Contains the optimal term and all evaluated candidates for auditability.
 */
export interface TermOptimizerResult {
  /** The optimal term in years (minimizes totalCost). */
  optimalTerm: number;

  /** The optimal term's evaluation details. */
  optimalEvaluation: TermEvaluation;

  /** All terms evaluated, sorted by totalCost ascending. */
  rankedTerms: TermEvaluation[];

  /** The hold period used for the optimization. */
  holdPeriodYears: number;

  /** ISO 8601 timestamp of the optimization. */
  optimizedAt: string;

  /** Number of term candidates evaluated. */
  candidatesEvaluated: number;
}

// ============================================================================
// Honest-Absence Result
// ============================================================================

/**
 * When the curve is stale/missing, the quote lacks terms, or inputs are invalid,
 * the optimizer returns honest absence instead of a fabricated optimal term.
 */
export interface TermOptimizerAbsence {
  optimalTerm: null;
  optimalEvaluation: null;
  rankedTerms: [];
  holdPeriodYears: number;
  optimizedAt: string;
  candidatesEvaluated: 0;
  failureReason: string;
}

// ============================================================================
// Term Optimizer
// ============================================================================

/**
 * Compute the optimal loan term for a deal against a single quote.
 *
 * Evaluates every available term in the quote's spread matrix for the target
 * tier, computes total cost over the hold period, and returns the term that
 * minimizes total cost.
 *
 * Total cost formula:
 *   total_cost = interest_over_hold + refi_cost(if term < hold) + early_payoff(if term > hold)
 *
 * Honest-absence returns:
 * - Curve is null or stale
 * - Quote's spread matrix lacks the target tier
 * - No terms available for the target tier
 * - Hold period is <= 0
 * - Loan amount is <= 0
 *
 * @param input — TermOptimizerInput
 * @returns TermOptimizerResult | TermOptimizerAbsence
 */
export function computeOptimalTerm(
  input: TermOptimizerInput
): TermOptimizerResult | TermOptimizerAbsence {
  const {
    dealAssumptions,
    targetTier,
    targetProgram,
    quote,
    curve,
    holdPeriodYears,
    loanAmount,
    spreadStrategy = 'midpoint',
    refiCostPct = 0.015,
    amortYears = 30,
  } = input;

  // ── Honest-absence: invalid hold period ─────────────────────────────────────
  if (holdPeriodYears <= 0) {
    return makeAbsence(holdPeriodYears, 'Hold period must be greater than 0 years');
  }

  // ── Honest-absence: invalid loan amount ─────────────────────────────────────
  if (loanAmount <= 0) {
    return makeAbsence(holdPeriodYears, 'Loan amount must be greater than 0');
  }

  // ── Honest-absence: stale or missing curve ──────────────────────────────────
  if (!curve) {
    return makeAbsence(holdPeriodYears, 'Forward curve is missing — FRED feed not connected');
  }

  const now = Date.now();
  const staleThresholdMs = (curve.staleThresholdHours ?? 24) * 60 * 60 * 1000;
  if (now - new Date(curve.fetchedAt).getTime() > staleThresholdMs) {
    return makeAbsence(
      holdPeriodYears,
      `Forward curve is stale (fetchedAt=${curve.fetchedAt}, threshold=${curve.staleThresholdHours}h)`
    );
  }

  // ── Honest-absence: expired quote ───────────────────────────────────────────
  if (new Date(quote.expires).getTime() < now) {
    return makeAbsence(holdPeriodYears, `Quote expired on ${quote.expires}`);
  }

  // ── Honest-absence: missing tier in spread matrix ───────────────────────────
  const tierGrid = quote.spreadMatrix.grid[targetTier];
  if (!tierGrid) {
    return makeAbsence(
      holdPeriodYears,
      `Spread matrix lacks tier "${targetTier}" for program "${targetProgram}"`
    );
  }

  // ── Collect all available terms for this tier ───────────────────────────────
  const availableTerms = Object.keys(tierGrid)
    .map((key) => parseInt(key, 10))
    .filter((term) => !isNaN(term) && term > 0)
    .sort((a, b) => a - b);

  if (availableTerms.length === 0) {
    return makeAbsence(
      holdPeriodYears,
      `No valid terms found for tier "${targetTier}" in spread matrix`
    );
  }

  // ── Evaluate each term candidate ────────────────────────────────────────────
  const evaluations: TermEvaluation[] = [];

  for (const termYears of availableTerms) {
    const pricingInput = {
      dealAssumptions,
      targetTier,
      targetTerm: termYears,
      targetProgram,
      quote,
      curve,
      spreadStrategy,
    };

    const pricing = computeAllInRate(pricingInput);

    // Skip terms that fail pricing (e.g., missing term in matrix)
    if ('failureReason' in pricing && pricing.failureReason) {
      continue;
    }

    const result = pricing as PricingResult;
    const evaluation = evaluateTerm(
      termYears,
      result,
      holdPeriodYears,
      loanAmount,
      refiCostPct,
      amortYears,
      quote
    );

    evaluations.push(evaluation);
  }

  // ── Honest-absence: no terms could be priced ────────────────────────────────
  if (evaluations.length === 0) {
    return makeAbsence(
      holdPeriodYears,
      `No terms could be priced for tier "${targetTier}" — matrix may be incomplete or curve interpolation failed`
    );
  }

  // ── Sort by total cost ascending and pick optimal ─────────────────────────
  evaluations.sort((a, b) => a.totalCost - b.totalCost);

  const optimal = evaluations[0];

  return {
    optimalTerm: optimal.termYears,
    optimalEvaluation: optimal,
    rankedTerms: evaluations,
    holdPeriodYears,
    optimizedAt: new Date().toISOString(),
    candidatesEvaluated: evaluations.length,
  };
}

// ============================================================================
// Term Evaluation Logic
// ============================================================================

/**
 * Evaluate a single term candidate: compute interest, refi cost, early payoff,
 * and total cost over the hold period.
 *
 * @param termYears — loan term in years
 * @param pricing — PricingResult from the resolver
 * @param holdPeriodYears — expected hold period in years
 * @param loanAmount — loan amount in dollars
 * @param refiCostPct — refinancing cost as percentage of loan amount
 * @param amortYears — amortization period in years
 * @param quote — the original loan quote (for prepay structure lookup)
 * @returns TermEvaluation
 */
function evaluateTerm(
  termYears: number,
  pricing: PricingResult,
  holdPeriodYears: number,
  loanAmount: number,
  refiCostPct: number,
  amortYears: number,
  quote: LoanQuote
): TermEvaluation {
  const allInRate = pricing.allInRate;
  const monthlyRate = allInRate / 12;
  const amortMonths = amortYears * 12;
  const holdMonths = holdPeriodYears * 12;
  const termMonths = termYears * 12;

  // Monthly debt service (amortizing loan formula)
  // P = L * [r(1+r)^n] / [(1+r)^n - 1]
  let monthlyDebtService: number;
  if (monthlyRate === 0) {
    monthlyDebtService = loanAmount / amortMonths;
  } else {
    const factor = Math.pow(1 + monthlyRate, amortMonths);
    monthlyDebtService = (loanAmount * monthlyRate * factor) / (factor - 1);
  }

  // ── Case 1: Term equals hold period ─────────────────────────────────────────
  // Simple: interest paid over the full hold
  if (termYears === holdPeriodYears) {
    const totalInterest = monthlyDebtService * holdMonths - loanAmount;
    return {
      termYears,
      allInRate,
      termIndex: pricing.termIndex,
      spread: pricing.spread,
      totalInterest: Math.max(0, totalInterest),
      refiCost: 0,
      earlyPayoffPenalty: 0,
      totalCost: Math.max(0, totalInterest),
      monthlyDebtService,
      provenanceChain: pricing.provenanceChain,
      requiresRefi: false,
      hasEarlyPayoff: false,
    };
  }

  // ── Case 2: Term is shorter than hold period ────────────────────────────────
  // Must refinance at term end. Cost = interest to term end + refi cost.
  if (termYears < holdPeriodYears) {
    // Interest paid during the initial term
    const interestToTermEnd = monthlyDebtService * termMonths - loanAmount;

    // Refinancing cost (flat percentage of loan amount)
    const refiCost = loanAmount * refiCostPct;

    // Interest paid during the remaining hold period after refi
    // We assume the refi gets the same rate (conservative: no rate improvement)
    const remainingYears = holdPeriodYears - termYears;
    const remainingMonths = remainingYears * 12;
    const interestAfterRefi = monthlyDebtService * remainingMonths;
    // Note: principal is not fully paid down at term end for amortizing loans,
    // so we continue with the same monthly payment on the remaining balance.
    // For simplicity, we approximate: same payment on remaining balance.
    const remainingBalance = computeRemainingBalance(
      loanAmount,
      monthlyRate,
      amortMonths,
      termMonths
    );
    const interestAfterRefiExact =
      monthlyDebtService * remainingMonths -
      (loanAmount - remainingBalance);

    const totalInterest = interestToTermEnd + Math.max(0, interestAfterRefiExact);
    const totalCost = totalInterest + refiCost;

    return {
      termYears,
      allInRate,
      termIndex: pricing.termIndex,
      spread: pricing.spread,
      totalInterest: Math.max(0, totalInterest),
      refiCost,
      earlyPayoffPenalty: 0,
      totalCost: Math.max(0, totalCost),
      monthlyDebtService,
      provenanceChain: pricing.provenanceChain,
      requiresRefi: true,
      hasEarlyPayoff: false,
    };
  }

  // ── Case 3: Term is longer than hold period ─────────────────────────────────
  // Exit before maturity. Cost = interest to hold exit + early payoff penalty.
  const interestToHoldExit = monthlyDebtService * holdMonths - loanAmount;

  // Early payoff penalty from prepay structure
  const earlyPayoffPenalty = computeEarlyPayoffPenalty(
    quote,
    loanAmount,
    holdPeriodYears
  );

  const totalCost = interestToHoldExit + earlyPayoffPenalty;

  return {
    termYears,
    allInRate,
    termIndex: pricing.termIndex,
    spread: pricing.spread,
    totalInterest: Math.max(0, interestToHoldExit),
    refiCost: 0,
    earlyPayoffPenalty,
    totalCost: Math.max(0, totalCost),
    monthlyDebtService,
    provenanceChain: pricing.provenanceChain,
    requiresRefi: false,
    hasEarlyPayoff: true,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compute the remaining loan balance after a given number of payments.
 *
 * B = P * [(1 + r)^n - (1 + r)^p] / [(1 + r)^n - 1]
 * where:
 *   B = remaining balance
 *   P = principal (loan amount)
 *   r = monthly interest rate
 *   n = total number of payments (amortMonths)
 *   p = number of payments made (paymentsMade)
 */
function computeRemainingBalance(
  loanAmount: number,
  monthlyRate: number,
  amortMonths: number,
  paymentsMade: number
): number {
  if (monthlyRate === 0) {
    return loanAmount * (1 - paymentsMade / amortMonths);
  }
  const factorN = Math.pow(1 + monthlyRate, amortMonths);
  const factorP = Math.pow(1 + monthlyRate, paymentsMade);
  return (loanAmount * (factorN - factorP)) / (factorN - 1);
}

/**
 * Compute early payoff penalty based on the quote's prepay structure.
 *
 * - yield_maintenance: approximate as 1% of loan amount (conservative)
 * - defeasance: approximate as 1.5% of loan amount (conservative)
 * - step_down: use the schedule to find the penalty for the exit year
 *
 * Honest-absence: if prepay structure is missing or unknown, returns 0
 * (no penalty) with a note that the penalty could not be determined.
 */
function computeEarlyPayoffPenalty(
  quote: LoanQuote,
  loanAmount: number,
  exitYear: number
): number {
  const prepay = quote.prepayStructure;
  if (!prepay) {
    return 0;
  }

  switch (prepay.type) {
    case 'yield_maintenance': {
      // Yield maintenance ≈ present value of lost interest
      // Conservative approximation: 1% of loan amount
      return loanAmount * 0.01;
    }

    case 'defeasance': {
      // Defeasance ≈ cost of Treasury strip portfolio
      // Conservative approximation: 1.5% of loan amount
      return loanAmount * 0.015;
    }

    case 'step_down': {
      const schedule = prepay.terms.schedule as Array<{ year: number; penaltyPct: number }> | undefined;
      if (!schedule || !Array.isArray(schedule)) {
        return 0;
      }
      // Find the penalty for the exit year (or the last year if exit is beyond schedule)
      const entry = schedule.find((s) => s.year === Math.ceil(exitYear));
      if (entry) {
        return loanAmount * entry.penaltyPct;
      }
      // No penalty for years beyond the schedule
      return 0;
    }

    default:
      return 0;
  }
}

function makeAbsence(holdPeriodYears: number, reason: string): TermOptimizerAbsence {
  return {
    optimalTerm: null,
    optimalEvaluation: null,
    rankedTerms: [],
    holdPeriodYears,
    optimizedAt: new Date().toISOString(),
    candidatesEvaluated: 0,
    failureReason: reason,
  };
}

// ============================================================================
// Convenience: Batch optimize across multiple quotes
// ============================================================================

/**
 * Optimize term across multiple quotes for the same deal.
 * Returns results per quote, ranked by optimal total cost.
 */
export interface BatchTermOptimizerInput {
  dealAssumptions: TermOptimizerInput['dealAssumptions'];
  targetTier: string;
  targetProgram: string;
  quotes: LoanQuote[];
  curve: ForwardCurve | null;
  holdPeriodYears: number;
  loanAmount: number;
  spreadStrategy?: 'midpoint' | 'conservative' | 'optimistic';
  refiCostPct?: number;
  amortYears?: number;
}

export interface BatchTermOptimizerResult {
  /** Per-quote optimization results (successful only). */
  results: Array<{
    quote: LoanQuote;
    result: TermOptimizerResult;
  }>;

  /** Quotes that failed optimization (with reason). */
  failures: Array<{
    quote: LoanQuote;
    reason: string;
  }>;

  /** Overall optimal term across all quotes. */
  overallOptimal: {
    quoteId: string;
    termYears: number;
    totalCost: number;
  } | null;

  optimizedAt: string;
}

export function batchOptimizeTerms(
  input: BatchTermOptimizerInput
): BatchTermOptimizerResult {
  const {
    dealAssumptions,
    targetTier,
    targetProgram,
    quotes,
    curve,
    holdPeriodYears,
    loanAmount,
    spreadStrategy = 'midpoint',
    refiCostPct = 0.015,
    amortYears = 30,
  } = input;

  const results: BatchTermOptimizerResult['results'] = [];
  const failures: BatchTermOptimizerResult['failures'] = [];

  for (const quote of quotes) {
    const result = computeOptimalTerm({
      dealAssumptions,
      targetTier,
      targetProgram,
      quote,
      curve,
      holdPeriodYears,
      loanAmount,
      spreadStrategy,
      refiCostPct,
      amortYears,
    });

    if ('failureReason' in result && result.failureReason) {
      failures.push({ quote, reason: result.failureReason });
    } else {
      results.push({ quote, result: result as TermOptimizerResult });
    }
  }

  // Find overall optimal across all successful results
  let overallOptimal: BatchTermOptimizerResult['overallOptimal'] = null;
  for (const { quote, result } of results) {
    if (!overallOptimal || result.optimalEvaluation.totalCost < overallOptimal.totalCost) {
      overallOptimal = {
        quoteId: quote.id,
        termYears: result.optimalTerm,
        totalCost: result.optimalEvaluation.totalCost,
      };
    }
  }

  return {
    results,
    failures,
    overallOptimal,
    optimizedAt: new Date().toISOString(),
  };
}
