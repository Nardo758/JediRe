/**
 * Stabilization resolution — W-B Phase 2.
 *
 * `months_to_stabilization` (and `stabilization_curve`, v1 = 'linear') follow
 * the four-layer precedence: user > agent > traffic_engine > platform_default.
 *
 * This is a deterministic layer only — no agent ever computes the ramp; the
 * 'agent' slot exists so a future agent tool can *write* an override, but
 * nothing here invokes an agent.
 *
 * Wiring depth v1 (A3): the seeder READS the traffic layer's stored output
 * (`proforma_assumptions.months_to_stabilization`, written by
 * `TrafficToProFormaService.persistPlatformLayer`) via `fetchTrafficEngineMonthsToStabilization`.
 * This is the ONE named seam — the seeder never invokes traffic computation inline.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export type StabilizationResolution = 'user' | 'agent' | 'traffic_engine' | 'platform_default';

export const PLATFORM_DEFAULT_MONTHS_TO_STABILIZATION = 24;
export const DEFAULT_STABILIZATION_CURVE = 'linear' as const;

export interface StabilizationLayeredValue {
  user: number | null;
  agent: number | null;
  traffic_engine: number | null;
  platform_default: number;
  resolved: number;
  resolution: StabilizationResolution;
}

export interface StabilizationCurveLayeredValue {
  user: string | null;
  agent: string | null;
  traffic_engine: string | null;
  platform_default: string;
  resolved: string;
  resolution: StabilizationResolution;
}

/**
 * Resolve `months_to_stabilization` following user > agent > traffic_engine > platform_default.
 * No layer is invoked here — callers supply already-fetched values for each layer.
 */
export function resolveMonthsToStabilization(inputs: {
  userOverride?: number | null;
  agentValue?: number | null;
  trafficEngineValue?: number | null;
}): StabilizationLayeredValue {
  const userOverride = inputs.userOverride ?? null;
  const agentValue = inputs.agentValue ?? null;
  const trafficEngineValue = inputs.trafficEngineValue ?? null;

  const base = {
    user: userOverride,
    agent: agentValue,
    traffic_engine: trafficEngineValue,
    platform_default: PLATFORM_DEFAULT_MONTHS_TO_STABILIZATION,
  };

  if (userOverride != null) {
    return { ...base, resolved: userOverride, resolution: 'user' };
  }
  if (agentValue != null) {
    return { ...base, resolved: agentValue, resolution: 'agent' };
  }
  if (trafficEngineValue != null) {
    return { ...base, resolved: trafficEngineValue, resolution: 'traffic_engine' };
  }
  return { ...base, resolved: PLATFORM_DEFAULT_MONTHS_TO_STABILIZATION, resolution: 'platform_default' };
}

/**
 * Resolve `stabilization_curve`. v1 only ever produces 'linear' (platform_default) —
 * user/agent/traffic_engine slots are wired for forward-compatibility but nothing
 * writes them yet.
 */
export function resolveStabilizationCurve(inputs: {
  userOverride?: string | null;
  agentValue?: string | null;
  trafficEngineValue?: string | null;
}): StabilizationCurveLayeredValue {
  const userOverride = inputs.userOverride ?? null;
  const agentValue = inputs.agentValue ?? null;
  const trafficEngineValue = inputs.trafficEngineValue ?? null;

  const base = {
    user: userOverride,
    agent: agentValue,
    traffic_engine: trafficEngineValue,
    platform_default: DEFAULT_STABILIZATION_CURVE as string,
  };

  if (userOverride != null) return { ...base, resolved: userOverride, resolution: 'user' };
  if (agentValue != null) return { ...base, resolved: agentValue, resolution: 'agent' };
  if (trafficEngineValue != null) return { ...base, resolved: trafficEngineValue, resolution: 'traffic_engine' };
  return { ...base, resolved: DEFAULT_STABILIZATION_CURVE, resolution: 'platform_default' };
}

/**
 * ONE named seam (A3): read the traffic layer's already-persisted output for this
 * deal. Does NOT invoke traffic computation — if `pushTrafficToProForma` has never
 * run for this deal (no property_id, or ran but property was already stabilized),
 * this returns null and the resolution chain falls through to platform_default.
 */
export async function fetchTrafficEngineMonthsToStabilization(dealId: string): Promise<number | null> {
  try {
    const r = await query(
      `SELECT months_to_stabilization FROM proforma_assumptions WHERE deal_id = $1`,
      [dealId]
    );
    const value = r.rows[0]?.months_to_stabilization;
    return typeof value === 'number' ? value : null;
  } catch (err) {
    logger.warn('[Stabilization] Failed to read traffic_engine months_to_stabilization (non-fatal, abstaining)', {
      dealId,
      error: (err as Error).message,
    });
    return null;
  }
}

/**
 * Linear ramp from `baseline` toward `stabilizedMonthly` over `monthsToStabilization`
 * months, then continues the existing compound trend from the stabilized level.
 *
 * No special-case degenerate branch: when baseline ≈ stabilizedMonthly, the formula
 * naturally degenerates to ≈stabilizedMonthly for the whole ramp window.
 *
 * @param baseline              Last actual/gap value (the ramp start point).
 * @param stabilizedMonthly     Target monthly NOI at stabilization (year1 stabilized NOI ÷ 12).
 * @param monthsFromBaseline    Months elapsed since baseline (1-indexed projection month).
 * @param monthsToStabilization Resolved months_to_stabilization.
 * @param postStabilizationTrend Compound monthly growth rate applied after stabilization.
 */
export function applyStabilizationRamp(
  baseline: number,
  stabilizedMonthly: number,
  monthsFromBaseline: number,
  monthsToStabilization: number,
  postStabilizationTrend: number,
): number {
  if (monthsToStabilization <= 0 || monthsFromBaseline >= monthsToStabilization) {
    const monthsPastStabilization = monthsToStabilization <= 0
      ? monthsFromBaseline
      : monthsFromBaseline - monthsToStabilization;
    return stabilizedMonthly * Math.pow(1 + postStabilizationTrend, monthsPastStabilization);
  }

  const t = monthsFromBaseline / monthsToStabilization;
  return baseline + (stabilizedMonthly - baseline) * t;
}
