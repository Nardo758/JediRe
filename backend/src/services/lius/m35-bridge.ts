/**
 * M35 Bridge — connects M35 key_events to the LIUS trajectory engine.
 *
 * Resolves TM-03 (window_months → hold_year mapping), EP-03 (LIUS trajectory
 * NOT_WIRED for M35 events), FA-02 (exit cap trajectory EVENT-BLIND), and
 * CE-01 Phase A (M35-event-driven component of exit cap adjustment).
 *
 * Phase A (this file): M35 event-driven adjustment to exit_cap_trajectory and
 *   Year-1 leaseUpAbsorption drag from competing multifamily_delivery events.
 *
 * Phase B (separate dispatch, gated on D2 M26 cap rate archive landing):
 *   Bayesian empirical trajectory from historical_observations.realized_cap_rate_change_t*.
 */

import { logger } from '../../utils/logger';
import {
  m35TrafficApiService,
  type LocationTarget,
  type M35ActiveEvent,
} from '../m35-traffic-api.service';
import { type TrajectoryEvent } from './types';

// ─── TM-03 Fix: window_months → hold_year mapping ───────────────────────────

/**
 * Bridge M35 forecast window_months to LIUS annual hold-year index.
 *
 * M35 uses forecast windows {3, 12, 24, 36} months.
 * LIUS projects in Year 1–10 annual increments (1-indexed).
 *
 * | window_months | hold_year |
 * |---|---|
 * | 3  | 1 (within-year impact) |
 * | 12 | 1 |
 * | 24 | 2 |
 * | 36 | 3 |
 * | N  | max(1, round(N / 12)) |
 */
export function windowToHoldYear(windowMonths: number): number {
  return Math.max(1, Math.round(windowMonths / 12));
}

// ─── Exit Cap Trajectory Constants ──────────────────────────────────────────

/**
 * Hardcoded baseline from trajectory-engine.ts DEFAULT_GROWTH_RATES.
 * This is the fallback when M35 signals are unavailable or location is absent.
 */
const EXIT_CAP_BASELINE = -0.0025;

/**
 * Scale factor: maps the -1..+1 M35 pipeline signal to a cap rate adjustment.
 * ±0.0010 = ±10bps/year maximum swing from the baseline.
 *
 * Sign convention:
 *   Positive pipeline signal (net demand catalyst: employer openings, infrastructure)
 *   → cap rates compress faster → more negative trajectory
 *   → adjustedRate = baseline - (signal × scale)
 *
 *   Negative pipeline signal (net demand suppressor: disasters, supply additions)
 *   → cap rates compress slower → less negative trajectory
 *   → adjustedRate = baseline - (signal × scale) [negative × negative = positive addition]
 */
const PIPELINE_SIGNAL_SCALE = 0.0010;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface M35TrajectorySignals {
  /**
   * Adjusted exit cap trajectory rate to use instead of the hardcoded -0.0025.
   * = EXIT_CAP_BASELINE - (pipelineSignal × PIPELINE_SIGNAL_SCALE)
   *
   * Example values:
   *   signal =  1.0 → -0.0035 (35bps/yr compression — strong demand market)
   *   signal =  0.0 → -0.0025 (25bps/yr — neutral, same as old constant)
   *   signal = -1.0 → -0.0015 (15bps/yr compression — supply-pressured market)
   */
  adjustedExitCapRate: number;

  /** Raw pipeline signal (-1..+1). Stored for Evidence Panel provenance. */
  pipelineSignal: number;

  /**
   * Fractional drag on Year-1 leaseUp.leaseUpAbsorption from competing
   * multifamily_delivery events within 5 miles.
   * 0.0 = no active competing deliveries.
   * 0.25 = maximum drag cap (reduces Y1 absorption by up to 25%).
   * Always 0 when no multifamily_delivery events are active near the location.
   */
  absorptionDragFactor: number;

  /** Number of active multifamily_delivery events found within 5mi. */
  competingDeliveryCount: number;

  /**
   * Minimum confidence across all competing delivery events.
   * Used as the confidence for injected trajectory events.
   */
  competingDeliveryConfidence: number;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Fetch M35 signals for LIUS trajectory enrichment.
 *
 * Called once per deal (before the line-item loop in runLIUSEngine).
 * Fetches both the pipeline signal (for exit cap) and competing delivery
 * events (for lease-up absorption drag) in parallel.
 *
 * Returns safe defaults (baseline rate, zero drag) if M35 data is unavailable.
 *
 * @param location   — submarket, msaId, and/or lat/lng for event proximity
 * @param subjectUnits — deal total unit count; scales competing-delivery drag
 */
export async function fetchM35TrajectorySignals(
  location: LocationTarget,
  subjectUnits?: number | null,
): Promise<M35TrajectorySignals> {
  try {
    const now = new Date();
    const horizon = new Date(now);
    horizon.setFullYear(horizon.getFullYear() + 3);

    const [pipelineSignal, allEvents] = await Promise.all([
      m35TrafficApiService.computeEventPipelineSignal(location, 18),
      m35TrafficApiService.getActiveEvents({
        location,
        radiusMi: 5,
        window: { start: now, end: horizon },
      }),
    ]);

    const deliveryEvents = allEvents.filter(
      e => e.subtype === 'multifamily_delivery',
    );

    const adjustedExitCapRate =
      EXIT_CAP_BASELINE - pipelineSignal * PIPELINE_SIGNAL_SCALE;

    const absorptionDragFactor = computeAbsorptionDrag(
      deliveryEvents,
      subjectUnits,
    );

    const competingDeliveryConfidence =
      deliveryEvents.length > 0
        ? Math.min(...deliveryEvents.map(e => e.confidence))
        : 1.0;

    logger.debug(
      `[M35 Bridge] location=${JSON.stringify(location)} ` +
        `pipelineSignal=${pipelineSignal.toFixed(4)} ` +
        `adjustedExitCapRate=${adjustedExitCapRate.toFixed(4)} ` +
        `deliveries=${deliveryEvents.length} ` +
        `absorptionDrag=${absorptionDragFactor.toFixed(3)}`,
    );

    return {
      adjustedExitCapRate,
      pipelineSignal,
      absorptionDragFactor,
      competingDeliveryCount: deliveryEvents.length,
      competingDeliveryConfidence,
    };
  } catch (err) {
    logger.warn(
      `[M35 Bridge] Failed to fetch M35 trajectory signals — using hardcoded baseline: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return safeDefaults();
  }
}

/**
 * Convert M35TrajectorySignals to a growth rate overrides map for TrajectoryContext.
 * Only produces an entry for exit_cap_trajectory when the adjusted rate differs
 * meaningfully from the baseline (avoids injecting no-op overrides).
 */
export function toGrowthRateOverrides(
  signals: M35TrajectorySignals,
): Record<string, number> {
  const overrides: Record<string, number> = {};
  if (Math.abs(signals.adjustedExitCapRate - EXIT_CAP_BASELINE) > 1e-6) {
    overrides['exit_cap_trajectory'] = signals.adjustedExitCapRate;
  }
  return overrides;
}

/**
 * Build a discrete_spike TrajectoryEvent for leaseUp.leaseUpAbsorption Year 1
 * from M35 trajectory signals.
 *
 * Returns null when absorptionDragFactor is 0 (no competing deliveries).
 * The returned event is injected as a pcaEvent in the trajectory context,
 * superseding the placeholder null-value spike in leaseUpAbsorption.yaml.
 *
 * @param signals       — output of fetchM35TrajectorySignals
 * @param baselineValue — resolved absorption rate (units/month) from source resolver
 */
export function buildAbsorptionSpikeEvent(
  signals: M35TrajectorySignals,
  baselineValue: number,
): TrajectoryEvent | null {
  if (signals.absorptionDragFactor <= 0 || baselineValue <= 0) return null;

  const dragValue = -(baselineValue * signals.absorptionDragFactor);

  return {
    primitive: 'discrete_spike',
    year: 1,
    description:
      `Competing supply drag: ${signals.competingDeliveryCount} active ` +
      `multifamily_delivery event(s) within 5mi (M35 key_events). ` +
      `Drag factor: ${(signals.absorptionDragFactor * 100).toFixed(1)}%.`,
    value: Math.round(dragValue * 100) / 100,
    deltaPct: null,
    source: 'm35',
    confidence: signals.competingDeliveryConfidence,
    binding: false,
  };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Compute the fractional Y1 absorption drag from competing delivery events.
 *
 * A single max-magnitude event (magnitudeScore = 1.0) produces a 15% drag.
 * Aggregate drag is capped at 25%.
 *
 * When subject unit count is known, drag is modulated by relative size:
 * a 100-unit competitor against a 300-unit subject has 1/3 the impact
 * of a 100-unit competitor against a 100-unit subject.
 */
function computeAbsorptionDrag(
  deliveryEvents: M35ActiveEvent[],
  subjectUnits?: number | null,
): number {
  if (deliveryEvents.length === 0) return 0;

  const totalMagnitude = deliveryEvents.reduce(
    (sum, e) => sum + e.magnitudeScore,
    0,
  );

  const rawDrag = Math.min(0.25, totalMagnitude * 0.15);

  if (subjectUnits && subjectUnits > 0) {
    return Math.min(0.25, rawDrag * (100 / Math.max(100, subjectUnits)));
  }

  return rawDrag;
}

function safeDefaults(): M35TrajectorySignals {
  return {
    adjustedExitCapRate: EXIT_CAP_BASELINE,
    pipelineSignal: 0,
    absorptionDragFactor: 0,
    competingDeliveryCount: 0,
    competingDeliveryConfidence: 1.0,
  };
}
