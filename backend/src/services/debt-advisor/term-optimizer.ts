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

export interface TermOptimizerInput {
  dealAssumptions: {
    purchasePrice: number;
    noiY1: number;
    targetLtv: number;
    targetTier?: string;
  };
  targetTier: string;
  targetProgram: string;
  quote: LoanQuote;
  curve: ForwardCurve | null;
  holdPeriodYears: number;
  loanAmount: number;
  spreadStrategy?: 'midpoint' | 'conservative' | 'optimistic';
  refiCostPct?: number;
  amortYears?: number;
}

// ============================================================================
// Term Evaluation Result
// ============================================================================

export interface TermEvaluation {
  termYears: number;
  allInRate: number;
  termIndex: number;
  spread: number;
  totalInterest: number;
  refiCost: number;
  earlyPayoffPenalty: number;
  totalCost: number;
  monthlyDebtService: number;
  provenanceChain: Array<{ step: string; value: number; source: string }>;
  requiresRefi: boolean;
  hasEarlyPayoff: boolean;
}

// ============================================================================
// Term Optimizer Result
// ============================================================================

export interface TermOptimizerResult {
  optimalTerm: number;
  optimalEvaluation: TermEvaluation;
  rankedTerms: TermEvaluation[];
  holdPeriodYears: number;
  optimizedAt: string;
  candidatesEvaluated: number;
}

// ============================================================================
// Honest-Absence Result
// ============================================================================

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

  if (holdPeriodYears <= 0) {
    return makeAbsence(holdPeriodYears, 'Hold period must be greater than 0 years');
  }
  if (loanAmount <= 0) {
    return makeAbsence(holdPeriodYears, 'Loan amount must be greater than 0');
  }
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

  if (new Date(quote.expires).getTime() < now) {
    return makeAbsence(holdPeriodYears, `Quote expired on ${quote.expires}`);
  }

  const tierGrid = quote.spreadMatrix.grid[targetTier];
  if (!tierGrid) {
    return makeAbsence(
      holdPeriodYears,
      `Spread matrix lacks tier "${targetTier}" for program "${targetProgram}"`
    );
  }

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

  if (evaluations.length === 0) {
    return makeAbsence(
      holdPeriodYears,
      `No terms could be priced for tier "${targetTier}" — matrix may be incomplete or curve interpolation failed`
    );
  }

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

  let monthlyDebtService: number;
  if (monthlyRate === 0) {
    monthlyDebtService = loanAmount / amortMonths;
  } else {
    const factor = Math.pow(1 + monthlyRate, amortMonths);
    monthlyDebtService = (loanAmount * monthlyRate * factor) / (factor - 1);
  }

  if (termYears === holdPeriodYears) {
    const totalInterest = monthlyDebtService * holdMonths - loanAmount;
    return {
      termYears, allInRate, termIndex: pricing.termIndex, spread: pricing.spread,
      totalInterest: Math.max(0, totalInterest), refiCost: 0, earlyPayoffPenalty: 0,
      totalCost: Math.max(0, totalInterest), monthlyDebtService,
      provenanceChain: pricing.provenanceChain, requiresRefi: false, hasEarlyPayoff: false,
    };
  }

  if (termYears < holdPeriodYears) {
    const interestToTermEnd = monthlyDebtService * termMonths - loanAmount;
    const refiCost = loanAmount * refiCostPct;
    const remainingBalance = computeRemainingBalance(loanAmount, monthlyRate, amortMonths, termMonths);
    const remainingMonths = (holdPeriodYears - termYears) * 12;
    const interestAfterRefi = monthlyDebtService * remainingMonths - (loanAmount - remainingBalance);
    const totalInterest = interestToTermEnd + Math.max(0, interestAfterRefi);
    return {
      termYears, allInRate, termIndex: pricing.termIndex, spread: pricing.spread,
      totalInterest: Math.max(0, totalInterest), refiCost, earlyPayoffPenalty: 0,
      totalCost: Math.max(0, totalInterest + refiCost), monthlyDebtService,
      provenanceChain: pricing.provenanceChain, requiresRefi: true, hasEarlyPayoff: false,
    };
  }

  const interestToHoldExit = monthlyDebtService * holdMonths - loanAmount;
  const earlyPayoffPenalty = computeEarlyPayoffPenalty(quote, loanAmount, holdPeriodYears);
  return {
    termYears, allInRate, termIndex: pricing.termIndex, spread: pricing.spread,
    totalInterest: Math.max(0, interestToHoldExit), refiCost: 0, earlyPayoffPenalty,
    totalCost: Math.max(0, interestToHoldExit + earlyPayoffPenalty), monthlyDebtService,
    provenanceChain: pricing.provenanceChain, requiresRefi: false, hasEarlyPayoff: true,
  };
}

// ============================================================================
// Helpers
// ============================================================================

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

function computeEarlyPayoffPenalty(quote: LoanQuote, loanAmount: number, exitYear: number): number {
  const prepay = quote.prepayStructure;
  if (!prepay) return 0;
  switch (prepay.type) {
    case 'yield_maintenance': return loanAmount * 0.01;
    case 'defeasance': return loanAmount * 0.015;
    case 'step_down': {
      const schedule = prepay.terms.schedule as Array<{ year: number; penaltyPct: number }> | undefined;
      if (!schedule || !Array.isArray(schedule)) return 0;
      const entry = schedule.find((s) => s.year === Math.ceil(exitYear));
      return entry ? loanAmount * entry.penaltyPct : 0;
    }
    default: return 0;
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
// Batch optimize across multiple quotes
// ============================================================================

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
  results: Array<{ quote: LoanQuote; result: TermOptimizerResult }>;
  failures: Array<{ quote: LoanQuote; reason: string }>;
  overallOptimal: { quoteId: string; termYears: number; totalCost: number } | null;
  optimizedAt: string;
}

export function batchOptimizeTerms(input: BatchTermOptimizerInput): BatchTermOptimizerResult {
  const { dealAssumptions, targetTier, targetProgram, quotes, curve, holdPeriodYears, loanAmount, spreadStrategy = 'midpoint', refiCostPct = 0.015, amortYears = 30 } = input;

  const results: BatchTermOptimizerResult['results'] = [];
  const failures: BatchTermOptimizerResult['failures'] = [];

  for (const quote of quotes) {
    const result = computeOptimalTerm({ dealAssumptions, targetTier, targetProgram, quote, curve, holdPeriodYears, loanAmount, spreadStrategy, refiCostPct, amortYears });
    if ('failureReason' in result && result.failureReason) {
      failures.push({ quote, reason: result.failureReason });
    } else {
      results.push({ quote, result: result as TermOptimizerResult });
    }
  }

  let overallOptimal: BatchTermOptimizerResult['overallOptimal'] = null;
  for (const { quote, result } of results) {
    if (!overallOptimal || result.optimalEvaluation.totalCost < overallOptimal.totalCost) {
      overallOptimal = { quoteId: quote.id, termYears: result.optimalTerm, totalCost: result.optimalEvaluation.totalCost };
    }
  }

  return { results, failures, overallOptimal, optimizedAt: new Date().toISOString() };
}
