/**
 * Lifecycle Profile Detection Service
 *
 * Implements the Phase 1A detection algorithm that classifies every deal into
 * one of four canonical profiles:
 *   STABILIZED  — high-occupancy asset performing at or near market
 *   VALUE_ADD   — asset with meaningful renovation / improvement program
 *   DISTRESSED  — significantly under-occupied or operationally impaired
 *   DEVELOPMENT — ground-up or substantial rehab with construction timeline
 *
 * Priority order (first match wins):
 *   1. construction_months > 0           → DEVELOPMENT
 *   2. occupancy < 0.80                  → DISTRESSED
 *   3. renovation_budget_per_unit > 5000 → VALUE_ADD
 *   4. occupancy >= 0.92                 → STABILIZED
 *   5. fallback                          → DISTRESSED
 */

export type LifecycleProfile = 'STABILIZED' | 'VALUE_ADD' | 'DISTRESSED' | 'DEVELOPMENT';

export const LIFECYCLE_PROFILES: LifecycleProfile[] = [
  'STABILIZED',
  'VALUE_ADD',
  'DISTRESSED',
  'DEVELOPMENT',
];

export interface LifecycleDetectionInputs {
  constructionMonths: number | null;
  currentOccupancyPct: number | null;
  renovationBudgetPerUnit: number | null;
}

const RENOVATION_THRESHOLD_PER_UNIT = 5_000;
const DISTRESSED_OCCUPANCY_CEILING  = 0.80;
const STABILIZED_OCCUPANCY_FLOOR    = 0.92;

/**
 * Pure detection function — no DB I/O.
 * Returns the detected LifecycleProfile for the given inputs.
 */
export function detectLifecycleProfile(inputs: LifecycleDetectionInputs): LifecycleProfile {
  const { constructionMonths, currentOccupancyPct, renovationBudgetPerUnit } = inputs;

  if (constructionMonths != null && constructionMonths > 0) {
    return 'DEVELOPMENT';
  }

  if (currentOccupancyPct != null && currentOccupancyPct < DISTRESSED_OCCUPANCY_CEILING) {
    return 'DISTRESSED';
  }

  if (renovationBudgetPerUnit != null && renovationBudgetPerUnit > RENOVATION_THRESHOLD_PER_UNIT) {
    return 'VALUE_ADD';
  }

  if (currentOccupancyPct != null && currentOccupancyPct >= STABILIZED_OCCUPANCY_FLOOR) {
    return 'STABILIZED';
  }

  return 'DISTRESSED';
}

/**
 * Resolves effective lifecycle profile: operator override wins over detected.
 */
export function effectiveLifecycleProfile(
  detected: LifecycleProfile | null | undefined,
  override: LifecycleProfile | null | undefined,
): LifecycleProfile | null {
  return (override as LifecycleProfile | null | undefined) ?? (detected as LifecycleProfile | null | undefined) ?? null;
}
