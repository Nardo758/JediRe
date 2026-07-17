/**
 * quote-comparison.ts
 * Component 3: Multi-quote comparison engine types.
 *
 * The same deal, sized and priced against EVERY current org quote, ranked by
 * a chosen objective: lowest all-in · max proceeds · best levered IRR · best
 * DSCR headroom. Stale quotes are flagged, not silently included.
 *
 * This is the Bloomberg-terminal-caliber feature — "price my deal across my
 * lenders" — and the reason the store is org-scoped.
 */

import type { LoanQuote } from './loan-quote.types';
import { computeAllInRate, type PricingInput, type PricingResult, type PricingAbsence } from './pricing-resolver';
import type { ForwardCurve } from './forward-curve';
import { getRecommendedTerms } from '../module-wiring/capital-structure-adapter';

// ============================================================================
// Comparison Objective
// ============================================================================

/**
 * Objective function for ranking quotes.
 *
 * - 'lowest_all_in'      → minimize all-in rate (best for fixed-rate deals)
 * - 'max_proceeds'       → maximize loan amount (best leverage)
 * - 'best_levered_irr'   → maximize levered IRR (full model required)
 * - 'best_dscr_headroom' → maximize DSCR above floor (safest debt service)
 */
export type ComparisonObjective =
  | 'lowest_all_in'
  | 'max_proceeds'
  | 'best_levered_irr'
  | 'best_dscr_headroom';

// ============================================================================
// Comparison Input
// ============================================================================

/**
 * Input to the multi-quote comparison engine.
 */
export interface QuoteComparisonInput {
  /** Deal context: purchase price, NOI, target LTV, etc. */
  deal: {
    purchasePrice: number;
    noiY1: number;
    targetLtv: number;
    /** Optional: preferred term in years. */
    preferredTerm?: number;
    /** Optional: preferred program filter. */
    preferredProgram?: string;
  };

  /** Quotes to compare (already filtered to the org). */
  quotes: LoanQuote[];

  /** Ranking objective. */
  objective: ComparisonObjective;

  /** Forward curve for term-index lookup. If null/missing, pricing returns honest absence. */
  curve?: ForwardCurve | null;
}

// ============================================================================
// Comparison Result
// ============================================================================

/**
 * A single ranked quote: the quote, its pricing result, and a score.
 */
export interface RankedQuote {
  /** The original quote. */
  quote: LoanQuote;

  /** Pricing result (or absence) for this quote against the deal. */
  pricing: PricingResult | PricingAbsence;

  /**
   * Rank score (higher = better for the chosen objective).
   * For 'lowest_all_in', score is inverted rate (1 / rate) so lower rate wins.
   * For 'max_proceeds', score is loan amount.
   * For 'best_levered_irr', score is IRR (requires full model — stub).
   * For 'best_dscr_headroom', score is DSCR - floor.
   */
  rankScore: number;

  /** 1-based rank (1 = best). */
  rank: number;
}

/**
 * Output of the multi-quote comparison engine.
 */
export interface QuoteComparisonResult {
  /** Quotes successfully priced and ranked. */
  rankedQuotes: RankedQuote[];

  /** Quotes that are past expiry — flagged, not silently included. */
  staleQuotes: LoanQuote[];

  /** Quotes that failed pricing (missing tier/term, stale curve, etc.). */
  failedQuotes: Array<{ quote: LoanQuote; reason: string }>;

  /** The objective used for this comparison. */
  objective: ComparisonObjective;

  /** ISO 8601 timestamp of the comparison. */
  comparedAt: string;
}

// ============================================================================
// Comparison Engine
// ============================================================================

/**
 * Compare multiple quotes for a single deal, ranked by the chosen objective.
 *
 * Stale quotes are flagged and excluded from ranking (honest absence).
 * Failed quotes (missing matrix entry, stale curve) are captured separately.
 *
 * TODO: Integrate with full model for 'best_levered_irr' objective.
 */
export function compareQuotes(input: QuoteComparisonInput): QuoteComparisonResult {
  const { deal, quotes, objective } = input;
  const now = Date.now();

  // ── Step 1: Flag stale quotes ─────────────────────────────────────────────
  const staleQuotes: LoanQuote[] = [];
  const activeQuotes: LoanQuote[] = [];

  for (const quote of quotes) {
    if (new Date(quote.expires).getTime() < now) {
      staleQuotes.push(quote);
    } else {
      activeQuotes.push(quote);
    }
  }

  // ── Step 2: Price each active quote via computeAllInRate ───────────────────
  const ranked: RankedQuote[] = [];
  const failed: Array<{ quote: LoanQuote; reason: string }> = [];

  for (const quote of activeQuotes) {
    const tier = Object.keys(quote.spreadMatrix.grid)[0] ?? 'unknown';
    const pricingInput: PricingInput = {
      dealAssumptions: {
        purchasePrice: deal.purchasePrice,
        noiY1: deal.noiY1,
        targetLtv: deal.targetLtv,
      },
      targetTier: tier,
      targetTerm: deal.preferredTerm ?? 10,
      targetProgram: quote.program,
      quote,
      curve: input.curve ?? null,
    };

    const pricing = computeAllInRate(pricingInput);

    if ('failureReason' in pricing && pricing.failureReason) {
      failed.push({ quote, reason: pricing.failureReason });
      continue;
    }

    const rankScore = computeRankScore(pricing as PricingResult, deal, objective);

    ranked.push({ quote, pricing: pricing as PricingResult, rankScore, rank: 0 }); // rank filled in Step 3
  }

  // ── Step 3: Sort by rank score (descending) and assign ranks ──────────────
  ranked.sort((a, b) => b.rankScore - a.rankScore);
  ranked.forEach((rq, idx) => {
    rq.rank = idx + 1;
  });

  return {
    rankedQuotes: ranked,
    staleQuotes,
    failedQuotes: failed,
    objective,
    comparedAt: new Date().toISOString(),
  };
}

/**
 * Flag quotes that are past their expiry date.
 * Returns the stale quotes; the caller decides whether to exclude or warn.
 *
 * Stale quotes are flagged, not silently included — engine invariant.
 */
export function flagStaleQuotes(quotes: LoanQuote[]): LoanQuote[] {
  const now = Date.now();
  return quotes.filter((q) => new Date(q.expires).getTime() < now);
}

// ============================================================================
// Rank Score Helpers
// ============================================================================

/**
 * Compute a rank score for a given pricing result and objective.
 * Higher score = better rank.
 */
function computeRankScore(
  pricing: PricingResult,
  deal: QuoteComparisonInput['deal'],
  objective: ComparisonObjective
): number {
  switch (objective) {
    case 'lowest_all_in':
      // Lower rate is better → invert so higher score wins
      return pricing.allInRate > 0 ? 1 / pricing.allInRate : 0;

    case 'max_proceeds': {
      // M11 sizing: maximize loan amount given NOI, purchase price, LTV, and the priced rate
      const sizing = getRecommendedTerms({
        noiY1: deal.noiY1,
        purchasePrice: deal.purchasePrice,
        ltv: deal.targetLtv,
        rate: pricing.allInRate,
      });
      return sizing.recommendedLoanAmount;
    }

    case 'best_dscr_headroom': {
      // M11 sizing: DSCR headroom above the 1.25 floor
      const sizing = getRecommendedTerms({
        noiY1: deal.noiY1,
        purchasePrice: deal.purchasePrice,
        ltv: deal.targetLtv,
        rate: pricing.allInRate,
      });
      const dscr = sizing.debtService > 0 ? deal.noiY1 / sizing.debtService : 0;
      return dscr - 1.25;
    }

    case 'best_levered_irr':
      // TODO: integrate with full model (requires levered IRR across hold period)
      // Stub: higher rate = worse IRR; scale by leverage
      return pricing.allInRate > 0 ? (1 / pricing.allInRate) * deal.targetLtv : 0;

    default:
      return 0;
  }
}
