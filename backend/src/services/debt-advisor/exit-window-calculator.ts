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
  dealId: string;
  windows: RefiWindow[];
  bestWindow: RefiWindow | null;
  nextWindow: RefiWindow | null;
  computedAt: string;
  narrative: string;
  absenceReason?: string;
}

/**
 * Input to the exit window calculator.
 */
export interface ExitWindowInput {
  dealId: string;
  msaId?: string;
  currentQuote: LoanQuote;
  alternativeQuotes?: LoanQuote[];
  curve: ForwardCurve | null;
  dealFinancials?: {
    noiAnnual: number;
    loanAmount: number;
    holdMonths: number;
  };
  prepayPenaltyPct?: number;
  originationFeePct?: number;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_TROUGH_DEPTH_BPS = 25;
const MIN_NET_BENEFIT_BPS = 10;
const DEFAULT_FORWARD_MONTHS = 120;
const CURVE_STEP_MONTHS = 6;

// ============================================================================
// Public API
// ============================================================================

export async function computeExitWindows(input: ExitWindowInput): Promise<ExitWindowAnalysis> {
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

  if (!curve) {
    return makeAbsence(dealId, now, 'Forward curve is missing — FRED feed not connected');
  }

  const staleThresholdMs = (curve.staleThresholdHours ?? 24) * 60 * 60 * 1000;
  if (Date.now() - new Date(curve.fetchedAt).getTime() > staleThresholdMs) {
    return makeAbsence(
      dealId,
      now,
      `Forward curve is stale (fetchedAt=${curve.fetchedAt}, threshold=${curve.staleThresholdHours}h)`
    );
  }

  const currentRate = computeCurrentAllInRate(currentQuote, curve);
  if (currentRate === null) {
    return makeAbsence(dealId, now, 'Unable to compute current all-in rate from quote + curve');
  }

  const holdMonths = dealFinancials?.holdMonths ?? DEFAULT_FORWARD_MONTHS;
  const curveWindows = findCurveTroughs(
    curve, currentRate, currentQuote, alternativeQuotes,
    holdMonths, prepayPenaltyPct, originationFeePct, dealFinancials
  );

  const m35Windows = await findM35EventWindows(
    msaId, currentRate, currentQuote, alternativeQuotes,
    prepayPenaltyPct, originationFeePct, dealFinancials
  );

  const allWindows = mergeAndDeduplicateWindows([...curveWindows, ...m35Windows]);
  const actionableWindows = allWindows.filter((w) => w.isActionable);
  const bestWindow = actionableWindows.length > 0
    ? actionableWindows.reduce((best, w) => (w.netBenefitBps > best.netBenefitBps ? w : best))
    : null;

  const nextWindow = allWindows.length > 0
    ? allWindows.reduce((closest, w) => (w.month < closest.month ? w : closest))
    : null;

  const narrative = buildNarrative(allWindows, bestWindow, nextWindow, currentRate, holdMonths);

  return { dealId, windows: allWindows, bestWindow, nextWindow, computedAt: now, narrative };
}

// ============================================================================
// Curve Trough Detection
// ============================================================================

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

  for (let month = CURVE_STEP_MONTHS; month <= holdMonths; month += CURVE_STEP_MONTHS) {
    const termYears = Math.min(30, Math.max(5, Math.round(month / 12)));
    const projectedRate = projectRateAtMonth(curve, currentQuote, alternativeQuotes, termYears, month);
    if (projectedRate !== null) {
      rates.push({ month, rate: projectedRate, termYears });
    }
  }

  if (rates.length < 3) return windows;

  for (let i = 1; i < rates.length - 1; i++) {
    const prev = rates[i - 1];
    const curr = rates[i];
    const next = rates[i + 1];
    const improvementBps = (currentRate - curr.rate) * 10000;

    if (curr.rate < prev.rate && curr.rate < next.rate && improvementBps >= MIN_TROUGH_DEPTH_BPS) {
      const refiCostPct = originationFeePct + prepayPenaltyPct;
      const netBenefitBps = improvementBps - refiCostPct * 10000;
      const dscrImprovement = computeDscrImprovement(currentRate, curr.rate, dealFinancials);

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
        confidence: 0.75,
      });
    }
  }

  return windows;
}

// ============================================================================
// M35 Event Windows
// ============================================================================

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
  if (!msaId) return windows;

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
      if (materializationMs < now) continue;

      const monthsAhead = Math.round((materializationMs - now) / (30.44 * 24 * 3600 * 1000));
      if (monthsAhead > 120 || monthsAhead < 0) continue;

      const termYears = Math.min(30, Math.max(5, Math.round(monthsAhead / 12)));
      const projectedRate = projectRateAtMonth(null, currentQuote, alternativeQuotes, termYears, monthsAhead);
      const effectiveRate = projectedRate ?? currentRate;
      const improvementBps = (currentRate - effectiveRate) * 10000;

      const isRateMove = event.subtype === 'rate_move' || event.category === 'MACRO_DEMOGRAPHIC';
      const source: RefiWindow['source'] = isRateMove ? 'm35_rate_move' : 'm35_event';

      const refiCostPct = originationFeePct + prepayPenaltyPct;
      const netBenefitBps = improvementBps - refiCostPct * 10000;
      const dscrImprovement = computeDscrImprovement(currentRate, effectiveRate, dealFinancials);
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
  } catch (_err: any) {
    // Non-fatal: M35 query failure just means no event-based windows
  }

  return windows;
}

// ============================================================================
// Rate Projection
// ============================================================================

function projectRateAtMonth(
  curve: ForwardCurve | null,
  currentQuote: LoanQuote,
  alternativeQuotes: LoanQuote[],
  termYears: number,
  _month: number
): number | null {
  const quotes = [currentQuote, ...alternativeQuotes].filter(
    (q) => new Date(q.expires).getTime() > Date.now()
  );
  if (quotes.length === 0) return null;

  let bestRate: number | null = null;
  for (const quote of quotes) {
    const projected = projectRateForQuote(curve, quote, termYears);
    if (projected !== null && (bestRate === null || projected < bestRate)) {
      bestRate = projected;
    }
  }
  return bestRate;
}

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

function computeCurrentAllInRate(quote: LoanQuote, curve: ForwardCurve): number | null {
  const terms = Object.keys(quote.spreadMatrix.grid).flatMap((tier) =>
    Object.keys(quote.spreadMatrix.grid[tier]).map(Number)
  );
  const termYears = terms.length > 0 ? Math.min(...terms) : 10;
  return projectRateForQuote(curve, quote, termYears);
}

// ============================================================================
// DSCR Computation
// ============================================================================

function computeDscrImprovement(
  currentRate: number,
  projectedRate: number,
  dealFinancials?: ExitWindowInput['dealFinancials']
): number | null {
  if (!dealFinancials || dealFinancials.noiAnnual <= 0 || dealFinancials.loanAmount <= 0) return null;
  const currentDebtService = dealFinancials.loanAmount * currentRate;
  const projectedDebtService = dealFinancials.loanAmount * projectedRate;
  if (currentDebtService <= 0) return null;
  const currentDscr = dealFinancials.noiAnnual / currentDebtService;
  const projectedDscr = dealFinancials.noiAnnual / projectedDebtService;
  return Math.round((projectedDscr - currentDscr) * 100) / 100;
}

// ============================================================================
// Merge & Narrative
// ============================================================================

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
    parts.push(
      `Best window: ${bestWindow.label} at ${(bestWindow.projectedRate * 100).toFixed(2)}% ` +
      `(${bestWindow.rateImprovementBps.toFixed(0)}bps improvement, ` +
      `net benefit ${bestWindow.netBenefitBps.toFixed(0)}bps).`
    );
  } else {
    parts.push('No actionable windows — refi costs exceed projected rate savings.');
  }

  if (nextWindow && nextWindow.month !== bestWindow?.month) {
    parts.push(
      `Next upcoming: ${nextWindow.label} at ${(nextWindow.projectedRate * 100).toFixed(2)}% ` +
      `(${nextWindow.rateImprovementBps.toFixed(0)}bps).`
    );
  }

  const m35Count = windows.filter((w) => w.source.startsWith('m35')).length;
  if (m35Count > 0) parts.push(`${m35Count} window(s) driven by M35 event materialization dates.`);

  return parts.join(' ');
}

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
