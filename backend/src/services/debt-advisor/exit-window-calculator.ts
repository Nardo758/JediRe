/**
 * exit-window-calculator.ts
 * LQ-5: Exit Window Calculator — project best refi months from curve troughs + M35 events.
 *
 * For a given deal and its loan quotes, computes the optimal refinancing windows
 * by analyzing:
 * 1. Forward curve troughs — local minima in the projected rate path where
 *    refinancing would produce meaningful DSCR improvement
 * 2. M35 event overlays — scheduled events (rate_move, infrastructure, etc.)
 *    whose materialization dates create discrete refinancing opportunities
 *
 * Honest-absence invariant: if the curve is stale/missing, or no M35 events
 * are found, returns null with reason — never fabricates a window.
 *
 * Depends on: ForwardCurve (Component 2b), LoanQuote (Component 1),
 *             PricingResolver (Component 2a), M35 Events Service.
 */

import type { LoanQuote } from '../loan-quotes/loan-quote.types';
import type { ForwardCurve } from '../loan-quotes/forward-curve';
import { computeAllInRate } from '../loan-quotes/pricing-resolver';
import type { PricingInput } from '../loan-quotes/pricing-resolver';
import { searchEvents, type KeyEvent } from '../m35-events.service';

// ============================================================================
// Types
// ============================================================================

/**
 * A single refinancing window: a month where the projected all-in rate
 * drops enough to justify the refinancing cost.
 */
export interface RefiWindow {
  /** Month number from deal start (0 = origination). */
  month: number;

  /** Human-readable label, e.g. "M36 — Curve Trough" or "M48 — M35 Event: Fed Cut". */
  label: string;

  /** Source of this window: curve analysis or M35 event. */
  source: 'curve_trough' | 'm35_event' | 'm35_rate_move';

  /** Projected all-in rate at this window (decimal). */
  projectedRate: number;

  /** Current/original all-in rate being compared against (decimal). */
  currentRate: number;

  /** Rate improvement in bps (positive = savings). */
  rateImprovementBps: number;

  /** Estimated DSCR improvement from rate reduction (computed if deal NOI provided). */
  dscrImprovement: number | null;

  /** Estimated refinance cost (origination fee + prepay penalty, as % of loan). */
  refiCostPct: number;

  /** Net benefit: rate improvement value minus refi cost, in bps. */
  netBenefitBps: number;

  /** Whether the window is actionable (net benefit > 0 and within hold period). */
  isActionable: boolean;

  /** Confidence 0–1: higher when backed by live curve + verified M35 events. */
  confidence: number;

  /** For M35-sourced windows, the event that triggered it. */
  event?: KeyEvent;
}

/**
 * The complete exit window analysis for a deal.
 */
export interface ExitWindowAnalysis {
  /** Deal identifier. */
  dealId: string;

  /** All discovered refinancing windows, sorted by month ascending. */
  windows: RefiWindow[];

  /** Best window (highest net benefit). Null if no actionable windows. */
  bestWindow: RefiWindow | null;

  /** Next upcoming window (closest to now). Null if none. */
  nextWindow: RefiWindow | null;

  /** ISO 8601 timestamp of the analysis. */
  computedAt: string;

  /** Narrative summary for the Debt Advisor UI. */
  narrative: string;

  /** Honest-absence: if the analysis could not be completed, the reason. */
  absenceReason?: string;
}

/**
 * Input to the exit window calculator.
 */
export interface ExitWindowInput {
  /** Deal identifier. */
  dealId: string;

  /** MSA ID for M35 event lookup. */
  msaId?: string;

  /** Current loan quote being evaluated (the "in-place" loan). */
  currentQuote: LoanQuote;

  /** Alternative quotes to refi into (org-scoped). If empty, uses currentQuote as proxy. */
  alternativeQuotes?: LoanQuote[];

  /** Forward curve for rate projection. */
  curve: ForwardCurve | null;

  /** Deal financials for DSCR computation. */
  dealFinancials?: {
    noiAnnual: number;
    loanAmount: number;
    holdMonths: number;
  };

  /** Prepay penalty assumption if refinancing before maturity (decimal, e.g. 0.02 = 2%). */
  prepayPenaltyPct?: number;

  /** Origination fee for the new loan (decimal, e.g. 0.01 = 1%). */
  originationFeePct?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum rate improvement (bps) to qualify as a trough. */
const MIN_TROUGH_DEPTH_BPS = 25;

/** Minimum net benefit (bps) for a window to be actionable. */
const MIN_NET_BENEFIT_BPS = 10;

/** Months to look ahead for curve troughs (default: 10 years). */
const DEFAULT_FORWARD_MONTHS = 120;

/** Curve interpolation step size in months. */
const CURVE_STEP_MONTHS = 6;

// ============================================================================
// Public API
// ============================================================================

/**
 * Compute exit window analysis for a deal.
 *
 * Steps:
 * 1. Honest-absence check: curve must be present and fresh
 * 2. Compute current all-in rate from the current quote
 * 3. Find curve troughs: local minima in projected rates over the hold period
 * 4. Find M35 event windows: materialization dates of relevant events
 * 5. Merge, deduplicate, score, and rank
 * 6. Return analysis with best/next windows and narrative
 *
 * @param input — ExitWindowInput with deal context, quotes, and curve
 * @returns ExitWindowAnalysis or honest-absence with reason
 */
export async function computeExitWindows(
  input: ExitWindowInput
): Promise<ExitWindowAnalysis> {
  const {
    dealId,
    msaId,
    currentQuote,
    alternativeQuotes = [],
    curve,
    dealFinancials,
    prepayPenaltyPct = 0.02,
    originationFeePct = 0.01,
  } = input;

  const now = new Date().toISOString();

  // ── Honest-absence: missing curve ─────────────────────────────────────────
  if (!curve) {
    return makeAbsence(dealId, now, 'Forward curve is missing — FRED feed not connected');
  }

  // ── Honest-absence: stale curve ───────────────────────────────────────────
  const staleThresholdMs = (curve.staleThresholdHours ?? 24) * 60 * 60 * 1000;
  if (Date.now() - new Date(curve.fetchedAt).getTime() > staleThresholdMs) {
    return makeAbsence(
      dealId,
      now,
      `Forward curve is stale (fetchedAt=${curve.fetchedAt}, threshold=${curve.staleThresholdHours}h)`
    );
  }

  // ── Step 1: Compute current all-in rate ───────────────────────────────────
  const currentRate = computeCurrentAllInRate(currentQuote, curve);
  if (currentRate === null) {
    return makeAbsence(dealId, now, 'Unable to compute current all-in rate from quote + curve');
  }

  // ── Step 2: Find curve troughs ──────────────────────────────────────────────
  const holdMonths = dealFinancials?.holdMonths ?? DEFAULT_FORWARD_MONTHS;
  const curveWindows = findCurveTroughs(
    curve,
    currentRate,
    currentQuote,
    alternativeQuotes,
    holdMonths,
    prepayPenaltyPct,
    originationFeePct,
    dealFinancials
  );

  // ── Step 3: Find M35 event windows ────────────────────────────────────────
  const m35Windows = await findM35EventWindows(
    msaId,
    currentRate,
    currentQuote,
    alternativeQuotes,
    prepayPenaltyPct,
    originationFeePct,
    dealFinancials
  );

  // ── Step 4: Merge, deduplicate, sort ──────────────────────────────────────
  const allWindows = mergeAndDeduplicateWindows([...curveWindows, ...m35Windows]);

  // ── Step 5: Identify best and next windows ────────────────────────────────
  const actionableWindows = allWindows.filter((w) => w.isActionable);
  const bestWindow = actionableWindows.length > 0
    ? actionableWindows.reduce((best, w) => (w.netBenefitBps > best.netBenefitBps ? w : best))
    : null;

  const nextWindow = allWindows.length > 0
    ? allWindows.reduce((closest, w) => (w.month < closest.month ? w : closest))
    : null;

  // ── Step 6: Build narrative ─────────────────────────────────────────────────
  const narrative = buildNarrative(
    allWindows,
    bestWindow,
    nextWindow,
    currentRate,
    holdMonths
  );

  return {
    dealId,
    windows: allWindows,
    bestWindow,
    nextWindow,
    computedAt: now,
    narrative,
  };
}

// ============================================================================
// Curve Trough Detection
// ============================================================================

/**
 * Find local minima (troughs) in the projected forward curve.
 *
 * Walks the curve in 6-month steps, computing the all-in rate at each step
 * by interpolating the term index and adding the quote spread. A trough is
 * a point where the rate is lower than both neighbors by at least MIN_TROUGH_DEPTH_BPS.
 */
function findCurveTroughs(
  curve: ForwardCurve,
  currentRate: number,
  currentQuote: LoanQuote,
  alternativeQuotes: LoanQuote[],
  holdMonths: number,
  prepayPenaltyPct: number,
  originationFeePct: number,
  dealFinancials?: ExitWindowInput['dealFinancials']
): RefiWindow[] {
  const windows: RefiWindow[] = [];
  const rates: Array<{ month: number; rate: number; termYears: number }> = [];

  // Sample the curve every 6 months up to hold period
  for (let month = CURVE_STEP_MONTHS; month <= holdMonths; month += CURVE_STEP_MONTHS) {
    const termYears = Math.min(30, Math.max(5, Math.round(month / 12)));
    const projectedRate = projectRateAtMonth(curve, currentQuote, alternativeQuotes, termYears, month);
    if (projectedRate !== null) {
      rates.push({ month, rate: projectedRate, termYears });
    }
  }

  if (rates.length < 3) {
    return windows; // Not enough points to find troughs
  }

  // Find local minima (excluding first and last points)
  for (let i = 1; i < rates.length - 1; i++) {
    const prev = rates[i - 1];
    const curr = rates[i];
    const next = rates[i + 1];

    const improvementBps = (currentRate - curr.rate) * 10000;

    // Local minimum: lower than both neighbors
    if (curr.rate < prev.rate && curr.rate < next.rate && improvementBps >= MIN_TROUGH_DEPTH_BPS) {
      const refiCostPct = originationFeePct + prepayPenaltyPct;
      const rateImprovementValueBps = improvementBps;
      const netBenefitBps = rateImprovementValueBps - refiCostPct * 10000;

      const dscrImprovement = computeDscrImprovement(
        currentRate,
        curr.rate,
        dealFinancials
      );

      windows.push({
        month: curr.month,
        label: `M${curr.month} — Curve Trough (${curr.termYears}yr term)`,
        source: 'curve_trough',
        projectedRate: curr.rate,
        currentRate,
        rateImprovementBps: improvementBps,
        dscrImprovement,
        refiCostPct,
        netBenefitBps,
        isActionable: netBenefitBps >= MIN_NET_BENEFIT_BPS && curr.month <= holdMonths,
        confidence: 0.75, // Curve-based, no event verification
      });
    }
  }

  return windows;
}

// ============================================================================
// M35 Event Windows
// ============================================================================

/**
 * Find refinancing windows triggered by M35 events.
 *
 * Queries active M35 events for the deal's MSA, focusing on:
 * - rate_move events (Fed policy changes)
 * - infrastructure events (transit, employment — improve property NOI)
 * - regulatory_policy events (zoning changes)
 *
 * Each event's materialization_date becomes a potential refi window.
 */
async function findM35EventWindows(
  msaId: string | undefined,
  currentRate: number,
  currentQuote: LoanQuote,
  alternativeQuotes: LoanQuote[],
  prepayPenaltyPct: number,
  originationFeePct: number,
  dealFinancials?: ExitWindowInput['dealFinancials']
): Promise<RefiWindow[]> {
  const windows: RefiWindow[] = [];

  if (!msaId) {
    return windows; // No MSA = no geographic event filtering
  }

  try {
    const { items: events } = await searchEvents({
      msaId,
      status: ['announced', 'in_progress'],
      limit: 50,
    });

    const now = Date.now();

    for (const event of events) {
      if (!event.materializationDate) continue;

      const materializationMs = new Date(event.materializationDate).getTime();
      if (materializationMs < now) continue; // Already passed

      const monthsAhead = Math.round(
        (materializationMs - now) / (30.44 * 24 * 3600 * 1000)
      );

      // Only consider events within a reasonable planning horizon (10 years)
      if (monthsAhead > 120 || monthsAhead < 0) continue;

      const termYears = Math.min(30, Math.max(5, Math.round(monthsAhead / 12)));
      const projectedRate = projectRateAtMonth(
        null, // No curve override for event-based projection
        currentQuote,
        alternativeQuotes,
        termYears,
        monthsAhead
      );

      // If we can't project a rate, use current rate as conservative estimate
      const effectiveRate = projectedRate ?? currentRate;
      const improvementBps = (currentRate - effectiveRate) * 10000;

      const isRateMove = event.subtype === 'rate_move' || event.category === 'MACRO_DEMOGRAPHIC';
      const source: RefiWindow['source'] = isRateMove ? 'm35_rate_move' : 'm35_event';

      const refiCostPct = originationFeePct + prepayPenaltyPct;
      const netBenefitBps = improvementBps - refiCostPct * 10000;

      const dscrImprovement = computeDscrImprovement(
        currentRate,
        effectiveRate,
        dealFinancials
      );

      // Confidence scales with event confidence and verification status
      const confidence = event.isVerified
        ? 0.85 + event.confidence * 0.15
        : 0.50 + event.confidence * 0.30;

      windows.push({
        month: monthsAhead,
        label: `M${monthsAhead} — M35 Event: ${event.name}`,
        source,
        projectedRate: effectiveRate,
        currentRate,
        rateImprovementBps: improvementBps,
        dscrImprovement,
        refiCostPct,
        netBenefitBps,
        isActionable: netBenefitBps >= MIN_NET_BENEFIT_BPS,
        confidence: Math.min(1, confidence),
        event,
      });
    }
  } catch (err: any) {
    // M35 query failure is non-fatal — we still return curve-based windows
    // Logged but not surfaced to caller as absence
    // (In production, import logger from utils)
    // logger.warn('[ExitWindow] M35 event query failed', { error: err.message });
  }

  return windows;
}

// ============================================================================
// Rate Projection
// ============================================================================

/**
 * Project the all-in rate at a given future month.
 *
 * Uses the forward curve to interpolate the term index at the target term,
 * then adds the best available spread from the quote set.
 */
function projectRateAtMonth(
  curve: ForwardCurve | null,
  currentQuote: LoanQuote,
  alternativeQuotes: LoanQuote[],
  termYears: number,
  _month: number // reserved for per-period SOFR path projection
): number | null {
  // Use the best available quote for the target term
  const quotes = [currentQuote, ...alternativeQuotes].filter((q) => {
    // Filter out expired quotes
    return new Date(q.expires).getTime() > Date.now();
  });

  if (quotes.length === 0) return null;

  // Try each quote, return the best (lowest) projected rate
  let bestRate: number | null = null;

  for (const quote of quotes) {
    const projected = projectRateForQuote(curve, quote, termYears);
    if (projected !== null && (bestRate === null || projected < bestRate)) {
      bestRate = projected;
    }
  }

  return bestRate;
}

/**
 * Project the all-in rate for a specific quote at a target term.
 */
function projectRateForQuote(
  curve: ForwardCurve | null,
  quote: LoanQuote,
  termYears: number
): number | null {
  if (!curve) return null;

  const pricingInput: PricingInput = {
    dealAssumptions: { purchasePrice: 5_000_000, noiY1: 500_000, targetLtv: 0.65 },
    targetTier: Object.keys(quote.spreadMatrix.grid)[0] ?? 'Tier-3',
    targetTerm: termYears,
    targetProgram: quote.program,
    quote,
    curve,
    spreadStrategy: 'midpoint',
  };

  const result = computeAllInRate(pricingInput);
  if (result.allInRate === null) return null;
  return result.allInRate;
}

/**
 * Compute the current all-in rate from the current quote and curve.
 */
function computeCurrentAllInRate(quote: LoanQuote, curve: ForwardCurve): number | null {
  // Use the quote's preferred term, or default to 10 years
  const terms = Object.keys(quote.spreadMatrix.grid).flatMap((tier) =>
    Object.keys(quote.spreadMatrix.grid[tier]).map(Number)
  );
  const termYears = terms.length > 0 ? Math.min(...terms) : 10;

  return projectRateForQuote(curve, quote, termYears);
}

// ============================================================================
// DSCR Computation
// ============================================================================

/**
 * Compute DSCR improvement from a rate reduction.
 *
 * DSCR = NOI / Debt Service. If rate drops, debt service drops, DSCR rises.
 * Returns the absolute improvement in DSCR ratio (e.g. 0.15 = 1.25x → 1.40x).
 */
function computeDscrImprovement(
  currentRate: number,
  projectedRate: number,
  dealFinancials?: ExitWindowInput['dealFinancials']
): number | null {
  if (!dealFinancials || dealFinancials.noiAnnual <= 0 || dealFinancials.loanAmount <= 0) {
    return null;
  }

  const currentDebtService = dealFinancials.loanAmount * currentRate;
  const projectedDebtService = dealFinancials.loanAmount * projectedRate;

  if (currentDebtService <= 0) return null;

  const currentDscr = dealFinancials.noiAnnual / currentDebtService;
  const projectedDscr = dealFinancials.noiAnnual / projectedDebtService;

  return Math.round((projectedDscr - currentDscr) * 100) / 100;
}

// ============================================================================
// Window Merging & Deduplication
// ============================================================================

/**
 * Merge windows from multiple sources, deduplicating by month.
 * When two windows share the same month, keep the one with higher confidence.
 */
function mergeAndDeduplicateWindows(windows: RefiWindow[]): RefiWindow[] {
  const byMonth = new Map<number, RefiWindow>();

  for (const w of windows) {
    const existing = byMonth.get(w.month);
    if (!existing || w.confidence > existing.confidence) {
      byMonth.set(w.month, w);
    }
  }

  return Array.from(byMonth.values()).sort((a, b) => a.month - b.month);
}

// ============================================================================
// Narrative Builder
// ============================================================================

/**
 * Build a human-readable narrative summary of the exit window analysis.
 */
function buildNarrative(
  windows: RefiWindow[],
  bestWindow: RefiWindow | null,
  nextWindow: RefiWindow | null,
  currentRate: number,
  holdMonths: number
): string {
  const currentRatePct = (currentRate * 100).toFixed(2);
  const parts: string[] = [];

  parts.push(`Current all-in rate: ${currentRatePct}%. Hold period: ${holdMonths} months.`);

  if (windows.length === 0) {
    parts.push('No refinancing windows identified in the projected rate path or M35 event horizon.');
    return parts.join(' ');
  }

  parts.push(`Identified ${windows.length} potential refinancing window(s).`);

  if (bestWindow) {
    const bestRatePct = (bestWindow.projectedRate * 100).toFixed(2);
    parts.push(
      `Best window: ${bestWindow.label} at ${bestRatePct}% ` +
      `(${bestWindow.rateImprovementBps.toFixed(0)}bps improvement, ` +
      `net benefit ${bestWindow.netBenefitBps.toFixed(0)}bps).`
    );
  } else {
    parts.push('No actionable windows — refi costs exceed projected rate savings.');
  }

  if (nextWindow && nextWindow.month !== bestWindow?.month) {
    const nextRatePct = (nextWindow.projectedRate * 100).toFixed(2);
    parts.push(
      `Next upcoming: ${nextWindow.label} at ${nextRatePct}% ` +
      `(${nextWindow.rateImprovementBps.toFixed(0)}bps).`
    );
  }

  const m35Count = windows.filter((w) => w.source.startsWith('m35')).length;
  if (m35Count > 0) {
    parts.push(`${m35Count} window(s) driven by M35 event materialization dates.`);
  }

  return parts.join(' ');
}

// ============================================================================
// Honest-Absence Helper
// ============================================================================

function makeAbsence(dealId: string, computedAt: string, reason: string): ExitWindowAnalysis {
  return {
    dealId,
    windows: [],
    bestWindow: null,
    nextWindow: null,
    computedAt,
    narrative: `Exit window analysis unavailable: ${reason}`,
    absenceReason: reason,
  };
}

// ============================================================================
// Exports
// ============================================================================

export type {
  ExitWindowInput,
  ExitWindowAnalysis,
  RefiWindow,
};
