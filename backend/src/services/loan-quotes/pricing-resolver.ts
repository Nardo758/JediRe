/**
 * pricing-resolver.ts
 * Component 2a: Pricing resolver types and contract.
 *
 * For a deal sized to tier T, term N, program P:
 *   all_in_rate = term_index(N) + matrixed_spread(P,T,N) + applicable_adjustments
 *
 * The sizing↔pricing fixed-point problem:
 * The rate depends on the leverage tier the loan is sized to, and the sizing
 * depends on the rate. M11 must iterate to a fixed point, OR the user picks a
 * tier and the resolver prices that tier. The tier a deal lands in IS the
 * binding constraint (R5) — this is why the debt arc's binding-constraint
 * reporting is a prerequisite.
 *
 * Honest-absence invariant: if the curve is stale/missing, return null with
 * reason — never silently fall back to spot or flat-rate assumption.
 *
 * Depends on: ForwardCurve (Component 2b), LoanQuote (Component 1),
 *             DebtContext.marketRates (B6), RecommendedTerms (B4/B5).
 */

import type { LoanQuote, SpreadRange, Adjustment, IndexBasis } from './loan-quote.types';
import type { ForwardCurve } from './forward-curve';

// ============================================================================
// Pricing Input
// ============================================================================

/**
 * Everything the resolver needs to compute an all-in rate for a specific
 * deal × quote × tier × term combination.
 */
export interface PricingInput {
  /** Deal assumptions: purchase price, NOI, LTV target, etc. */
  dealAssumptions: {
    purchasePrice: number;
    noiY1: number;
    targetLtv: number;
    /** Optional: if the deal already has a preferred tier. */
    targetTier?: string;
  };

  /** Target leverage tier (e.g. 'Tier-3'). If omitted, resolver may pick. */
  targetTier: string;

  /** Target term in years (e.g. 7). */
  targetTerm: number;

  /** Target program (e.g. 'Fannie DUS'). Must match a program in the quote. */
  targetProgram: string;

  /** The quote to price against. */
  quote: LoanQuote;

  /** Forward curve for term_index lookup. */
  curve: ForwardCurve | null;

  /**
   * Spread selection strategy within the quoted range.
   * - 'midpoint'     → use (min + max) / 2
   * - 'conservative' → use max (worst-case for borrower)
   * - 'optimistic'   → use min (best-case for borrower)
   *
   * Open question #1 in spec: default to midpoint pending product decision.
   */
  spreadStrategy?: 'midpoint' | 'conservative' | 'optimistic';
}

// ============================================================================
// Pricing Result
// ============================================================================

/**
 * The result of pricing a deal against a single quote.
 * Includes the full provenance chain so every basis point is auditable.
 */
export interface PricingResult {
  /** All-in rate (decimal, e.g. 0.055 for 5.50%). */
  allInRate: number;

  /** Term index used (interpolated from forward curve, decimal). */
  termIndex: number;

  /** Selected spread from the matrix (decimal). */
  spread: number;

  /** Adjustments applied (each with provenance). */
  adjustments: Adjustment[];

  /** Total basis points from adjustments (decimal). */
  totalBps: number;

  /**
   * Full provenance chain: every number that contributed to allInRate,
   * in order, with source and value.
   */
  provenanceChain: Array<{
    step: string;
    value: number;
    source: string;
  }>;

  /** The tier that was actually priced (may differ from target if matrix lacks it). */
  resolvedTier: string;

  /** The term that was actually priced (may differ from target if interpolated). */
  resolvedTerm: number;

  /** If pricing failed, the reason (honest-absence). */
  failureReason?: string;
}

// ============================================================================
// Honest-Absence Result
// ============================================================================

/**
 * When the curve is stale or missing, the resolver returns honest absence
 * instead of a fabricated rate.
 */
export interface PricingAbsence {
  allInRate: null;
  termIndex: null;
  spread: null;
  adjustments: [];
  totalBps: 0;
  provenanceChain: [];
  resolvedTier: string;
  resolvedTerm: number;
  failureReason: string;
}

// ============================================================================
// Pricing Resolver
// ============================================================================

/**
 * Compute the all-in rate for a deal against a single quote.
 *
 * Formula: all_in_rate = term_index(N) + matrixed_spread(P,T,N) + adjustments
 *
 * Returns honest-absence (null rate) if:
 * - The forward curve is null or stale
 * - The quote's spread matrix lacks the requested (tier, term) combination
 * - The quote has expired
 *
 * TODO: Integrate with M11 fixed-point iteration once B5 binding-constraint
 * reporting is proven end-to-end. For now, the caller supplies targetTier.
 */
export function computeAllInRate(input: PricingInput): PricingResult | PricingAbsence {
  const { dealAssumptions, targetTier, targetTerm, targetProgram, quote, curve, spreadStrategy = 'midpoint' } = input;

  // ── Honest-absence: stale or missing curve ────────────────────────────────
  if (!curve) {
    return makeAbsence(targetTier, targetTerm, 'Forward curve is missing — FRED feed not connected');
  }

  const now = Date.now();
  const staleThresholdMs = (curve.staleThresholdHours ?? 24) * 60 * 60 * 1000;
  if (now - new Date(curve.fetchedAt).getTime() > staleThresholdMs) {
    return makeAbsence(targetTier, targetTerm, `Forward curve is stale (fetchedAt=${curve.fetchedAt}, threshold=${curve.staleThresholdHours}h)`);
  }

  // ── Honest-absence: expired quote ─────────────────────────────────────────
  if (new Date(quote.expires).getTime() < now) {
    return makeAbsence(targetTier, targetTerm, `Quote expired on ${quote.expires}`);
  }

  // ── Step 1: term_index(N) from forward curve ──────────────────────────────
  const ti = termIndex(targetTerm, curve);
  if (ti === null) {
    return makeAbsence(targetTier, targetTerm, `Term index interpolation failed for ${targetTerm}yr`);
  }

  // ── Step 2: matrixed_spread(P,T,N) ────────────────────────────────────────
  const tierGrid = quote.spreadMatrix.grid[targetTier];
  if (!tierGrid) {
    return makeAbsence(targetTier, targetTerm, `Spread matrix lacks tier "${targetTier}" for program "${targetProgram}"`);
  }

  const spreadRange: SpreadRange | undefined = tierGrid[targetTerm];
  if (!spreadRange) {
    return makeAbsence(targetTier, targetTerm, `Spread matrix lacks term ${targetTerm}yr for tier "${targetTier}"`);
  }

  const spread = selectSpread(spreadRange, spreadStrategy);

  // ── Step 3: applicable_adjustments ────────────────────────────────────────
  const applicableAdjustments = quote.adjustments.filter((adj) =>
    // TODO: Filter adjustments by deal eligibility (green, MAH, size, etc.)
    // For the stub, all adjustments are considered applicable.
    true
  );
  const totalBps = applicableAdjustments.reduce((sum, adj) => sum + adj.bps, 0);
  const totalBpsDecimal = totalBps / 10_000;

  // ── Step 4: assemble all-in rate ──────────────────────────────────────────
  const allInRate = ti + spread + totalBpsDecimal;

  const provenanceChain: PricingResult['provenanceChain'] = [
    { step: 'term_index', value: ti, source: `${curve.source} ${targetTerm}yr interpolated` },
    { step: 'spread', value: spread, source: `${quote.lender} ${targetProgram} ${targetTier} ${targetTerm}yr (${spreadStrategy})` },
    { step: 'adjustments', value: totalBpsDecimal, source: `${applicableAdjustments.length} adjustment(s) from quote` },
    { step: 'all_in_rate', value: allInRate, source: 'pricing_resolver_v1' },
  ];

  return {
    allInRate,
    termIndex: ti,
    spread,
    adjustments: applicableAdjustments,
    totalBps: totalBpsDecimal,
    provenanceChain,
    resolvedTier: targetTier,
    resolvedTerm: targetTerm,
  };
}

/**
 * Interpolate the term index from the forward curve tenor grid.
 * Uses linear interpolation between the nearest tenor points.
 *
 * Returns null if the target term falls outside the available tenor range
 * and extrapolation is not safe.
 */
export function termIndex(termYears: number, curve: ForwardCurve): number | null {
  const points = curve.tenorPoints;
  if (points.length === 0) return null;

  // Sort by tenorYears ascending
  const sorted = [...points].sort((a, b) => a.tenorYears - b.tenorYears);

  // Exact match
  const exact = sorted.find((p) => p.tenorYears === termYears);
  if (exact) return exact.rate;

  // Below minimum — don't extrapolate below shortest tenor
  if (termYears < sorted[0].tenorYears) return null;

  // Above maximum — don't extrapolate above longest tenor
  if (termYears > sorted[sorted.length - 1].tenorYears) return null;

  // Find bracketing points
  let lower = sorted[0];
  let upper = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (termYears >= sorted[i].tenorYears && termYears <= sorted[i + 1].tenorYears) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }

  // Linear interpolation
  const t = (termYears - lower.tenorYears) / (upper.tenorYears - lower.tenorYears);
  return lower.rate + t * (upper.rate - lower.rate);
}

// ============================================================================
// Helpers
// ============================================================================

function selectSpread(range: SpreadRange, strategy: 'midpoint' | 'conservative' | 'optimistic'): number {
  switch (strategy) {
    case 'conservative':
      return range.max;
    case 'optimistic':
      return range.min;
    case 'midpoint':
    default:
      return (range.min + range.max) / 2;
  }
}

function makeAbsence(resolvedTier: string, resolvedTerm: number, reason: string): PricingAbsence {
  return {
    allInRate: null,
    termIndex: null,
    spread: null,
    adjustments: [],
    totalBps: 0,
    provenanceChain: [],
    resolvedTier,
    resolvedTerm,
    failureReason: reason,
  };
}
