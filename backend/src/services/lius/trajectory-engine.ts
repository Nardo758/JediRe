/**
 * Trajectory Engine — Event-based year-over-year projection for LIUS.
 *
 * Produces year-by-year projections for every line item using three
 * event primitives (rate_delta, level_reset, discrete_spike) composed
 * per the LIUS v0.2 composition rules.
 *
 * Composition rules:
 *  1. Rate deltas compose multiplicatively (two active rate events compound)
 *  2. Level resets replace, not stack (latter wins if overlap)
 *  3. Discrete spikes add (one-time, do not affect subsequent levels)
 *  4. Lifecycle phase transitions generate events automatically
 */

import {
  type LIUSchema,
  type TrajectoryEvent,
  type TrajectoryPrimitive,
} from './types';

// ─── Public Types ───────────────────────────────────────────────────────────

export interface LifecyclePhaseTimeline {
  phase: string;
  startMonth: number;  // 0-based from acquisition
  endMonth: number;
}

export interface TrajectoryContext {
  holdPeriodYears: number;
  lifecycleTimeline: LifecyclePhaseTimeline[];
  profileEvents?: TrajectoryEvent[];
  pcaEvents?: TrajectoryEvent[];
  userEvents?: TrajectoryEvent[];
}

export interface YearProjection {
  year: number;
  value: number;
  growth: number;
  driver: string;
  events: TrajectoryEvent[];
  confidence: number;
}

// ─── Phase Transition Definitions ───────────────────────────────────────────

const PHASE_TRANSITIONS: Record<string, { start: string; end: string }> = {
  lease_up_to_transition: { start: 'lease_up', end: 'transition' },
  transition_to_stabilized: { start: 'transition', end: 'stabilized' },
  stabilized_to_disposition_prep: { start: 'stabilized', end: 'disposition_prep' },
};

interface PhaseTransition {
  from: string;
  to: string;
  month: number;
}

function getTransitions(timeline: LifecyclePhaseTimeline[]): PhaseTransition[] {
  const transitions: PhaseTransition[] = [];
  for (let i = 0; i < timeline.length - 1; i++) {
    if (timeline[i].endMonth === timeline[i + 1].startMonth) {
      transitions.push({
        from: timeline[i].phase,
        to: timeline[i + 1].phase,
        month: timeline[i].endMonth,
      });
    }
  }
  return transitions;
}

// ─── Default Growth Rates ───────────────────────────────────────────────────

// D2 (CE-01): `exit_cap_trajectory` removed from this table. The hardcoded
// constant `-0.0025` was the audit's structurally-misaligned finding — a
// flat compression bias that could not align with the Debt module's
// dynamic rate classification. The exit-cap trajectory is now produced by
// the LIUS resolution cascade for `exit.exitCapRate`, which sources from
// historical_observations (corpus) and falls through to the loud
// going-in+25bps Tier 5 fallback when the corpus has no rows for the
// submarket. The trajectory engine no longer carries an exit-cap default.
const DEFAULT_GROWTH_RATES: Record<string, number> = {
  cpi: 0.03,           // standard CPI
  m26_tax_growth: 0.03,  // property tax trend
  m26_insurance_growth: 0.08, // insurance inflation
  rent_growth_index: 0.035,  // market rent growth
  wage_growth: 0.04,       // admin/payroll inflation
  utility_inflation: 0.035,
  replacement_reserve_growth: 0.025,
};

function resolveGrowthRate(driver: string): number {
  const key = driver.toLowerCase().replace(/[^a-z0-9_]/g, '');
  // D2 (CE-01): exit_cap_trajectory used to live in DEFAULT_GROWTH_RATES with
  // a value of -0.0025. It was removed. Any caller that still passes
  // 'exit_cap_trajectory' as the growth driver hits the 0.03 generic fallback
  // here — which is not what we want for exit cap, but it's also not silent
  // (it's the same generic miss every unrecognized driver gets). The correct
  // path is for the LIUS resolution to compute the exit cap year by year
  // rather than projecting forward via a single annual growth rate; this
  // function's contract is only for archetype-A linear growth, which the
  // exit cap schema no longer claims to be.
  return DEFAULT_GROWTH_RATES[key] ?? 0.03;
}

// ─── Core Engine ────────────────────────────────────────────────────────────

/**
 * Generate lifecycle transition events for a schema.
 * Returns only the events that the schema declares sensitivity to.
 */
export function generateLifecycleEvents(
  schema: LIUSchema,
  timeline: LifecyclePhaseTimeline[],
): TrajectoryEvent[] {
  const events: TrajectoryEvent[] = [];
  if (!schema.lifecycleOverrides?.length) return events;

  const transitions = getTransitions(timeline);

  for (const override of schema.lifecycleOverrides) {
    // Find the transition that leads INTO this phase
    const transition = transitions.find(t => t.to === override.phase);
    if (!transition) continue;

    // Map lifecycle sensitivity to trajectory event
    const year = Math.ceil(transition.month / 12);

    // If sourcePreference changes, that's a structural shift — emit as level_reset
    if (override.sourcePreference) {
      events.push({
        primitive: 'level_reset',
        year,
        description: `Phase transition: ${transition.from} → ${transition.to}`,
        value: null, // value is computed from the new source preference
        deltaPct: null,
        source: 'lifecycle',
        confidence: 0.8,
        binding: false,
      });
    }
  }

  return events;
}

/**
 * Generate events from building profile data.
 * Uses profile cluster medians for component replacement schedules.
 */
export async function generateProfileDerivedEvents(
  schema: LIUSchema,
  profileFingerprint: string,
): Promise<TrajectoryEvent[]> {
  if (!schema.trajectory?.profileDerivedEvents) return [];

  // Profile-derived events are generated by the Building Profiles service.
  // For LIUS Week 2, we provide the structure; the profile service integration
  // is a Week 3 task. Return empty for now.
  return [];
}

/**
 * Project a line item's trajectory across the hold period.
 *
 * 1. Initialize level = baselineValue
 * 2. For each year in hold period:
 *    a. Apply growth_rate_delta events
 *    b. Apply level_reset events
 *    c. Apply discrete_spike events
 *    d. Apply lifecycle phase events
 *    e. Compute final value
 */
export function projectTrajectory(
  schema: LIUSchema,
  baselineValue: number,
  ctx: TrajectoryContext,
): YearProjection[] {
  const years = ctx.holdPeriodYears || 10;
  if (baselineValue <= 0) return [];

  const baseGrowthRate = resolveGrowthRate(
    schema.trajectory?.baseGrowth ?? 'cpi',
  );

  // Collect all events
  const schemaEvents = [...(schema.trajectory?.scheduledEvents ?? [])];
  const lifecycleEvents = generateLifecycleEvents(schema, ctx.lifecycleTimeline);
  const profileEvents = ctx.profileEvents ?? [];
  const pcaEvents = ctx.pcaEvents ?? [];
  const userEvents = ctx.userEvents ?? [];

  // Merge all event sources (order: pca > user > schema > lifecycle > profile)
  const allEvents = [
    ...schemaEvents.map(e => ({ ...e, _source: 'schema' as const })),
    ...lifecycleEvents.map(e => ({ ...e, _source: 'lifecycle' as const })),
    ...profileEvents.map(e => ({ ...e, _source: 'profile' as const })),
    ...pcaEvents.map(e => ({ ...e, _source: 'pca' as const })),
    ...userEvents.map(e => ({ ...e, _source: 'user' as const })),
  ];

  // De-duplicate: user overrides > pca > schema > lifecycle > profile
  const deduped = new Map<string, TrajectoryEvent>();
  for (const event of allEvents) {
    // Group by (primitive, year) for dedup
    const key = `${event.primitive}:${event.year}`;
    const sourcePriority = { user: 5, pca: 4, schema: 3, lifecycle: 2, profile: 1 };
    const existing = deduped.get(key);
    if (!existing || sourcePriority[(event as any)._source] >= sourcePriority[(existing as any)._source]) {
      deduped.set(key, event);
    }
  }
  const finalEvents = Array.from(deduped.values());

  // Compose projections year by year
  const projections: YearProjection[] = [];
  let currentValue = baselineValue;

  for (let year = 1; year <= years; year++) {
    // Find events firing this year
    const yearEvents = finalEvents.filter(e => e.year === year);

    // Step 1: Calculate effective growth rate for this year
    let effectiveGrowth = baseGrowthRate;
    const rateDeltaEvents = yearEvents.filter(
      e => e.primitive === 'rate_delta' && e.deltaPct != null,
    );
    // Rate deltas compose multiplicatively
    for (const rde of rateDeltaEvents) {
      effectiveGrowth = effectiveGrowth * (1 + rde.deltaPct!);
    }

    // Step 2: Apply lifecycle phase growth adjustment
    const phaseEvent = yearEvents.find(e => e.primitive === 'level_reset' && e.source === 'lifecycle');
    const spikeEvents = yearEvents.filter(e => e.primitive === 'discrete_spike' && e.value != null);
    const resetEvents = yearEvents.filter(
      e => e.primitive === 'level_reset' && e.source !== 'lifecycle' && e.value != null,
    );

    let yearValue: number;

    // Step 3: Apply level_reset first (replaces current level)
    if (resetEvents.length > 0) {
      // Latter wins on overlap
      const lastReset = resetEvents[resetEvents.length - 1];
      currentValue = lastReset.value!;
    } else if (phaseEvent) {
      // Phase transition — apply source preference change effect
      // Default: apply -15% for lease_up→transition, +20% for stabilized→disposition_prep
      if (yearEvents.some(e => e.description?.includes('lease_up') && e.primitive === 'level_reset')) {
        currentValue = currentValue * 0.85;
      } else if (yearEvents.some(e => e.description?.includes('disposition') && e.primitive === 'level_reset')) {
        currentValue = currentValue * 1.20;
      }
    }

    // Step 4: Apply growth from prior year (compounds)
    if (projections.length > 0) {
      currentValue = currentValue * (1 + effectiveGrowth);
    }

    // Step 5: Apply discrete spikes (add to this year only)
    let spikeSum = 0;
    for (const spike of spikeEvents) {
      spikeSum += spike.value!;
    }

    yearValue = currentValue + spikeSum;

    // Step 6: Build event drivers list
    const yearDrivers: string[] = [];
    if (resetEvents.length > 0) yearDrivers.push(`${schema.trajectory?.baseGrowth ?? 'cpi'}+reset`);
    else if (rateDeltaEvents.length > 0) yearDrivers.push(`${schema.trajectory?.baseGrowth ?? 'cpi'}+rate_delta`);
    else yearDrivers.push(schema.trajectory?.baseGrowth ?? 'cpi');
    if (spikeSum > 0) yearDrivers.push('spike');
    if (phaseEvent) yearDrivers.push('phase_transition');

    // Step 7: Compute confidence for this year's projection
    const eventConfidences = yearEvents.map(e => e.confidence);
    const baseConfidence = 0.85;
    const avgEventConfidence = eventConfidences.length > 0
      ? eventConfidences.reduce((a, b) => a + b, 0) / eventConfidences.length
      : 1;
    // Confidence decays slightly with distance from baseline year
    const timeDecay = Math.max(0.6, 1 - (year - 1) * 0.02);
    const yearConfidence = baseConfidence * avgEventConfidence * timeDecay;

    projections.push({
      year,
      value: Math.round(yearValue * 100) / 100,
      growth: Math.round(effectiveGrowth * 10000) / 10000,
      driver: yearDrivers.join('+'),
      events: yearEvents,
      confidence: Math.round(Math.min(1, Math.max(0, yearConfidence)) * 100) / 100,
    });
  }

  return projections;
}

/**
 * Generate sensitivity scenarios for a line item.
 * Used for what-if analysis (best/worst case).
 */
export function projectSensitivity(
  schema: LIUSchema,
  baselineValue: number,
  ctx: TrajectoryContext,
): { base: YearProjection[]; optimistic: YearProjection[]; pessimistic: YearProjection[] } {
  const base = projectTrajectory(schema, baselineValue, ctx);

  // Optimistic: remove all binding:false events, reduce growth by 20%
  const optimisticCtx: TrajectoryContext = {
    ...ctx,
    userEvents: (ctx.userEvents ?? []).filter(e => !e.binding),
  };
  const optimisticSchema: LIUSchema = {
    ...schema,
    trajectory: {
      ...schema.trajectory!,
      scheduledEvents: (schema.trajectory?.scheduledEvents ?? []).filter(e => e.binding === true),
    },
  };
  const optimistic = projectTrajectory(optimisticSchema, baselineValue * 0.95, optimisticCtx);

  // Pessimistic: add all events, inflate growth by 30%
  const pessimistic = projectTrajectory(schema, baselineValue * 1.10, {
    ...ctx,
    userEvents: [
      ...(ctx.userEvents ?? []),
      {
        primitive: 'level_reset',
        year: 2,
        description: 'Sensitivity: conservative override',
        value: baselineValue * 1.15,
        deltaPct: null,
        source: 'sensitivity',
        confidence: 0.5,
        binding: false,
      },
    ],
  });

  return { base, optimistic, pessimistic };
}

export default {
  projectTrajectory,
  projectSensitivity,
  generateLifecycleEvents,
  generateProfileDerivedEvents,
};
