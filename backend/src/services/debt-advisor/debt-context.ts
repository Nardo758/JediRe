/**
 * debt-context.ts
 * B6a: Define DebtContext type and interfaces.
 *
 * R4 — DebtContext assembler: the canonical context object consumed by
 * downstream DEBT_LAYER agents (S1 distress, refinance advisor, etc.).
 */

import type { RecommendedTerms } from '../module-wiring/capital-structure-adapter';
import type { ModelAssumptions } from '../deterministic/run-full-model';

// ============================================================================
// In-Place Loan (from debt_positions)
// ============================================================================

export interface InPlaceLoan {
  loanAmount: number;
  rate: number;
  termMonths: number;
  amortMonths: number;
  ioPeriodMonths: number;
  originationDate?: string;
  maturityDate?: string;
}

// ============================================================================
// Distress Flags (S1 computed)
// ============================================================================

export interface DistressFlags {
  ioExpiryShock: boolean;
  underwaterEquity: boolean;
  cashInRefi: boolean;
}

// ============================================================================
// Market Rates (FRED)
// ============================================================================

export interface MarketRates {
  dgs10: number | null;
  sofr: number | null;
}

// ============================================================================
// Loan Product (from ruleset)
// ============================================================================

export interface LoanProductContext {
  termYears: number;
  amortYears: number;
  maxIOYears: number;
  provenance: string;
}

// ============================================================================
// M11 Sizing (from capital-structure-adapter)
// ============================================================================

export interface M11Sizing {
  recommendedLoanAmount: number;
  bindingConstraint: 'ltv' | 'dscr' | 'io' | 'user_override';
  constraintDetails: string;
}

// ============================================================================
// DebtContext — canonical output of the assembler
// ============================================================================

export interface DebtContext {
  dealId: string;
  inPlaceLoan?: InPlaceLoan;
  distressFlags: DistressFlags;
  marketRates: MarketRates;
  loanProduct: LoanProductContext | null;
  m11Sizing: M11Sizing | null;
  dealContextFinancials?: Record<string, any>;
  /** Loan Quote scaffold integration: org-scoped quotes for this deal */
  loanQuotes?: LoanQuote[];
  /** LQ-4: Term optimization result for optimal loan term selection */
  termOptimization?: import('./term-optimizer').TermOptimizerResult | null;
  /** LQ-5: Exit window analysis for optimal refi timing */
  exitWindows?: import('./exit-window-calculator').ExitWindowAnalysis | null;
  assembledAt: string;
}

// ============================================================================
// DebtContextInput — what the assembler needs to build a DebtContext
// ============================================================================

export interface DebtContextInput {
  assumptions: ModelAssumptions;
  m11Result: RecommendedTerms;
  dealContextFinancials?: Record<string, any> | null;
  inPlaceLoan?: InPlaceLoan;
  distressFlags: DistressFlags;
  marketRates: MarketRates;
  loanProduct?: LoanProductContext | null;
  /** Loan Quote scaffold integration */
  loanQuotes?: LoanQuote[];
  /** LQ-4: Optional term optimization pre-computed for this context */
  termOptimization?: import('./term-optimizer').TermOptimizerResult | null;
  /** LQ-5: Optional exit window analysis pre-computed for this context */
  exitWindows?: import('./exit-window-calculator').ExitWindowAnalysis | null;
}
