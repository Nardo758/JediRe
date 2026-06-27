/**
 * Reconciliation service — computes overlap variance when actuals boundary advances.
 *
 * Phase 4 of the timeline infrastructure.
 *
 * When a new month of actual operating data arrives (e.g., a new T12 statement),
 * the actuals boundary advances. The previously gap/projection values for that
 * month now have real actuals to compare against. This service computes the
 * variance between projected and actual, flags material differences, and triggers
 * re-base notifications.
 */

import type { ProFormaPeriodicSeed, PeriodicFieldSeries, PeriodLayeredValue } from './periodic-field.types';
import type { BoundaryContext } from './boundary.types';
import { logger } from '../../utils/logger';
import { deriveGapForSeed, DEFAULT_GAP_TRENDS } from './gap-bridge.service';
import type { GapTrendAssumptions } from './gap-bridge.service';

/** 5% material variance threshold (configurable). */
export const MATERIAL_VARIANCE_THRESHOLD = 0.05;

export interface VarianceResult {
  /** The field that varied. */
  fieldName: string;
  /** Month in which the variance occurred (YYYY-MM). */
  month: string;
  /** Projected value (from gap/projection). */
  projected: number | null;
  /** Actual value (newly arrived). */
  actual: number | null;
  /** Absolute difference. */
  absoluteDiff: number | null;
  /** Percentage difference vs projected. */
  variancePct: number | null;
  /** Whether this exceeds the material threshold. */
  material: boolean;
}

export interface ReconciliationReport {
  dealId: string;
  /** The month that was newly actualized. */
  reconciledMonth: string;
  /** Variances per field. */
  variances: VarianceResult[];
  /** Number of material variances. */
  materialCount: number;
  /** Whether any material variance was found. */
  hasMaterialVariance: boolean;
  /** Recommended action: 'rebase' | 'notify' | 'ignore'. */
  recommendation: 'rebase' | 'notify' | 'ignore';
}

/**
 * Compute overlap variance for a newly actualized month.
 *
 * @param periodicSeed  The current periodic seed (with old projection values)
 * @param newActuals    The newly arrived actual values for the month
 * @param month         The month being reconciled (YYYY-MM)
 * @param dealId        The deal ID (for logging)
 * @returns             Reconciliation report with variances and recommendation
 */
export function reconcileMonth(
  periodicSeed: ProFormaPeriodicSeed,
  newActuals: Record<string, number>,
  month: string,
  dealId: string,
): ReconciliationReport {
  const variances: VarianceResult[] = [];
  let materialCount = 0;

  for (const [fieldName, series] of Object.entries(periodicSeed.fields)) {
    const period = series.periods.find(p => p.month === month);
    if (!period) continue;

    const projected = period.resolved;
    const actual = newActuals[fieldName] ?? null;

    if (projected == null || actual == null) continue;

    const absoluteDiff = actual - projected;
    const variancePct = projected !== 0 ? absoluteDiff / projected : null;
    const material = variancePct != null && Math.abs(variancePct) > MATERIAL_VARIANCE_THRESHOLD;

    if (material) materialCount++;

    variances.push({
      fieldName,
      month,
      projected,
      actual,
      absoluteDiff,
      variancePct,
      material,
    });
  }

  const hasMaterialVariance = materialCount > 0;
  const recommendation: ReconciliationReport['recommendation'] = hasMaterialVariance
    ? 'rebase'
    : variances.length > 0
      ? 'notify'
      : 'ignore';

  logger.info('[Reconciliation] Month reconciled', {
    dealId,
    month,
    materialCount,
    recommendation,
  });

  return {
    dealId,
    reconciledMonth: month,
    variances,
    materialCount,
    hasMaterialVariance,
    recommendation,
  };
}

/**
 * Apply a re-base to the periodic seed after reconciliation.
 *
 * Re-base means: (1) replace the old projected/gap values for the reconciled month
 * with the actual values, (2) re-derive all forward (gap + projection) periods from
 * the new actual baseline using trend assumptions, (3) advance the boundary if needed.
 *
 * @param periodicSeed  The current periodic seed (with old projected values)
 * @param newActuals    The newly arrived actual values for the month
 * @param month         The month being reconciled (YYYY-MM)
 * @param trends        Optional trend assumptions for forward re-derivation
 * @returns             New periodic seed with actuals set and forward periods re-derived
 */
export function applyRebase(
  periodicSeed: ProFormaPeriodicSeed,
  newActuals: Record<string, number>,
  month: string,
  trends: GapTrendAssumptions = DEFAULT_GAP_TRENDS,
): ProFormaPeriodicSeed {
  // Step 1: Set the reconciled month to actual values
  const newFields: Record<string, PeriodicFieldSeries> = {};

  for (const [fieldName, series] of Object.entries(periodicSeed.fields)) {
    const newPeriods = series.periods.map((period): PeriodLayeredValue => {
      if (period.month !== month) return period;

      const actualValue = newActuals[fieldName];
      if (actualValue == null) return period;

      return {
        ...period,
        resolved: actualValue,
        resolution: 'actual',
        source: 'reconciliation_rebase',
        zone: 'actual',
        raw: actualValue,
        updated_at: new Date().toISOString(),
      };
    });

    newFields[fieldName] = {
      ...series,
      periods: newPeriods,
    };
  }

  let rebased: ProFormaPeriodicSeed = {
    ...periodicSeed,
    fields: newFields,
    last_seeded_at: new Date().toISOString(),
  };

  // Step 2: Re-derive forward projection from the new actual baseline
  // After setting actuals for `month`, all subsequent gap/projection periods
  // should be re-trended from the new actual baseline. This is a full forward
  // re-derivation: gap gets trended from actuals, projection gets trended from gap.
  rebased = deriveGapForSeed(rebased, trends);

  // Step 3: Advance the actuals boundary if the reconciled month is later than
  // the current boundary
  const newBoundary = { ...rebased.boundary };
  if (!newBoundary.actuals_through_month || month > newBoundary.actuals_through_month) {
    newBoundary.actuals_through_month = month;
    newBoundary.has_actuals = true;
    // Recompute gap from new boundary
    const gapStart = addOneMonth(month);
    if (newBoundary.acquisition_date && gapStart) {
      const gapEnd = newBoundary.acquisition_date.slice(0, 7);
      if (gapStart <= gapEnd) {
        newBoundary.gap_start_month = gapStart;
        newBoundary.gap_end_month = gapEnd;
      } else {
        newBoundary.gap_start_month = null;
        newBoundary.gap_end_month = null;
      }
    }
  }
  rebased = { ...rebased, boundary: newBoundary };

  return rebased;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addOneMonth(ym: string): string | null {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return null;
  const d = new Date(y, m, 1); // m is 1-12, new Date(y, m, 1) = month m+1 (0-indexed)
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

/**
 * Build a summary of the reconciliation for user notification.
 */
export function buildReconciliationNotification(report: ReconciliationReport): {
  title: string;
  body: string;
  urgency: 'high' | 'medium' | 'low';
} {
  const { materialCount, reconciledMonth, variances } = report;

  if (materialCount === 0) {
    return {
      title: `Operating data for ${reconciledMonth} aligned with projections`,
      body: `No material variances detected. All fields within ${(MATERIAL_VARIANCE_THRESHOLD * 100).toFixed(0)}% of projected.`,
      urgency: 'low',
    };
  }

  const topVariances = variances
    .filter(v => v.material)
    .sort((a, b) => Math.abs(b.variancePct ?? 0) - Math.abs(a.variancePct ?? 0))
    .slice(0, 3);

  const varianceLines = topVariances.map(v => {
    const direction = (v.variancePct ?? 0) > 0 ? 'above' : 'below';
    const pct = Math.abs(v.variancePct ?? 0) * 100;
    return `• ${v.fieldName}: ${pct.toFixed(1)}% ${direction} projection`;
  }).join('\n');

  return {
    title: `${materialCount} material variance${materialCount > 1 ? 's' : ''} in ${reconciledMonth} actuals`,
    body: `Projected vs actual comparison shows the following fields exceeded the ${(MATERIAL_VARIANCE_THRESHOLD * 100).toFixed(0)}% threshold:\n${varianceLines}`,
    urgency: 'high',
  };
}
