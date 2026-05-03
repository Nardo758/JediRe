/**
 * M07 → M09 Projections Adapter
 *
 * Pure, stateless transformer that consumes pre-loaded dealContext data and
 * produces typed OccupancyLeasingBlock and ConcessionsBlock row arrays for any
 * hold timeline (3 / 5 / 7 / 10 years).
 *
 * Source mapping (spec §3):
 *   Physical Occupancy Y1 ← SubjectCurrentState.occupancy_rate (S1)
 *                           or startingState.current_occupancy (STABILIZED)
 *                           or startingState.absorption_curve (LEASE_UP)
 *   Loss-to-Lease Y1       ← SubjectCurrentState.loss_to_lease (S1)
 *                           or platform peer default (3%)
 *   Rent Growth            ← M05 submarket posterior or platform baseline (3%)
 *   Free Months            ← ConcessionEnvironmentOutput.per_year[n].free_months
 *   Concession %           ← free_months / 12 (annual gross revenue fraction)
 *
 * Three modes are supported:
 *   STABILIZED   — Y1 anchor + churn/trajectory formulas
 *   LEASE_UP     — absorption curve drives Physical Occupancy ramp;
 *                  concessions front-loaded with decay; mode-mismatch guard enforced
 *   REDEVELOPMENT — renovation dilution from M22 capex_schedule; bifurcated
 *                   rent growth; pre-reno retention concession logic
 *
 * Mode transitions (LEASE_UP → STABILIZED, REDEVELOPMENT → STABILIZED) are
 * resolved per-year and produce a UI transition badge ("LU→S" / "R→S").
 */

import { logger } from '../../utils/logger';
import {
  type ConcessionEnvironmentOutput,
  type PerYearConcessionEnv,
  type SubjectCurrentState,
  type SubjectObservedDynamics,
} from '../../types/traffic-calibration.types';
import {
  type OccupancyLeasingRow,
  type ConcessionsRow,
  type ProjectionsOutput,
  OVERRIDE_DOWNSTREAM,
  assertProjectionsInvariants,
} from './projections-dependency-graph';

// ── Re-export for consumers ──────────────────────────────────────────────────
export type { OccupancyLeasingRow, ConcessionsRow, ProjectionsOutput };

// ── Constants ────────────────────────────────────────────────────────────────

/** Platform baseline rent growth when no M05 submarket data available */
const BASELINE_RENT_GROWTH = 0.03;

/** Platform baseline loss-to-lease when no subject S1 data available */
const BASELINE_LOSS_TO_LEASE = 0.03;

/** Stabilized target occupancy (churn model attractor) */
const STABILIZED_TARGET_OCC = 0.95;

/** Speed at which physical occupancy reverts to stabilized target (per year) */
const OCC_REVERSION_SPEED = 0.20;

/** Default market rent per unit (used when no rent data available) */
const BASELINE_MARKET_RENT = 1_800;

/** LTL compression toward stabilized default — fraction of gap closed per year */
const LTL_COMPRESSION = 0.30;

/** Stabilized LTL attractor when no subject data is available */
const LTL_STABILIZED_DEFAULT = 0.025;

// ── Input context types ─────────────────────────────────────────────────────

export interface DealContextTraffic {
  starting_state?: {
    mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT';
    current_occupancy?: number;           // STABILIZED
    start_occupancy?: number;             // LEASE_UP
    target_occupancy?: number;            // LEASE_UP / REDEVELOPMENT
    absorption_curve?: number[];          // LEASE_UP: 24-element monthly curve
    months_to_stabilization_p50?: number; // LEASE_UP
    concession_intensity_curve?: number[];
    overall_occupancy?: number;           // REDEVELOPMENT
    phases?: Array<{
      phase_number: number;
      units_count: number;
      co_date_months_out: number;
      mini_lease_up_months: number;
    }>;
  };
  concession_environment?: ConcessionEnvironmentOutput | null;
  subject_history?: {
    tier: string;
    current_state: SubjectCurrentState | null;
    observed_dynamics?: SubjectObservedDynamics | null;
    confidence_weights?: Record<string, { weight: number }>;
    peer_set_values?: Record<string, number>;
  } | null;
  /** Platform rent growth rate from M05 (fraction, e.g. 0.03) */
  market_rent_growth?: number | null;
  /** Current market rent per unit from M05 or deal data */
  market_rent_per_unit?: number | null;
}

export interface CapexSchedule {
  transition_month?: number;
  phases?: Array<{
    units?: number;
    co_months_out?: number;
    lease_up_months?: number;
    rent_uplift_pct?: number;
  }>;
  /** % of units under renovation at deal start (REDEVELOPMENT dilution) */
  renovation_pct?: number;
  /** Expected rent uplift post-renovation (fraction, e.g. 0.15 = +15%) */
  post_reno_rent_uplift?: number;
}

export interface ProjectionsDealContext {
  deal_id: string;
  deal_mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT';
  hold_years: number;
  traffic: DealContextTraffic;
  capex_schedule?: CapexSchedule | null;
  /** Cell-level user overrides (key: "<block>.<field>.<year>", value: override number) */
  user_overrides?: Record<string, number>;
  total_units?: number;
}

// ── Core adapter ─────────────────────────────────────────────────────────────

export class M07ProjectionsAdapter {

  // ──────────────────────────────────────────────────────────────────────────
  // Public interface
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Build both blocks and run invariant assertions.
   * Returns a fully validated ProjectionsOutput for the given dealContext.
   */
  build(ctx: ProjectionsDealContext): ProjectionsOutput {
    const holdYears = Math.max(1, Math.min(30, ctx.hold_years));
    const occRows = this.buildOccupancyLeasingBlock(ctx, holdYears);
    const concRows = this.buildConcessionsBlock(ctx, holdYears);

    const output: ProjectionsOutput = {
      deal_id:          ctx.deal_id,
      computed_at:      new Date().toISOString(),
      hold_years:       holdYears,
      deal_mode:        ctx.deal_mode,
      occupancy_leasing: occRows,
      concessions:       concRows,
      anchor_source:     this.resolveAnchorSource(ctx),
      subject_used:      this.subjectIsUsed(ctx),
      degraded_reason:   this.detectDegradation(ctx),
    };

    try {
      assertProjectionsInvariants(output);
    } catch (err: any) {
      logger.error('[M07→M09 ProjectionsAdapter] Invariant violation', {
        dealId: ctx.deal_id, error: err.message,
      });
      throw err;
    }

    return output;
  }

  /**
   * Build only the OccupancyLeasingBlock (Physical Occ, LTL, Rent Growth, Effective Rent).
   */
  buildOccupancyLeasingBlock(ctx: ProjectionsDealContext, holdYears: number): OccupancyLeasingRow[] {
    const rows: OccupancyLeasingRow[] = [];

    const marketRent  = ctx.traffic.market_rent_per_unit ?? BASELINE_MARKET_RENT;
    const rentGrowth  = ctx.traffic.market_rent_growth   ?? BASELINE_RENT_GROWTH;
    const overrides   = ctx.user_overrides ?? {};

    for (let year = 1; year <= holdYears; year++) {
      const resolvedMode = this.resolveMode(ctx, year);
      const transitionBadge = this.transitionBadge(ctx, year);

      const physOcc    = this.getOverride(overrides, 'occ.physical_occupancy', year)
                      ?? this.computePhysOcc(ctx, year, resolvedMode);
      const ltl        = this.getOverride(overrides, 'occ.loss_to_lease', year)
                      ?? this.computeLTL(ctx, year, resolvedMode, physOcc);
      const rg         = this.getOverride(overrides, 'occ.rent_growth', year)
                      ?? rentGrowth;
      const mr         = marketRent * Math.pow(1 + rg, year - 1);
      const effRent    = this.getOverride(overrides, 'occ.effective_rent', year)
                      ?? parseFloat((mr * (1 - ltl)).toFixed(2));

      rows.push({
        year,
        physical_occupancy: parseFloat(physOcc.toFixed(4)),
        loss_to_lease:      parseFloat(ltl.toFixed(4)),
        rent_growth:        parseFloat(rg.toFixed(4)),
        effective_rent:     effRent,
        market_rent:        parseFloat(mr.toFixed(2)),
        mode:               resolvedMode,
        transition_badge:   transitionBadge,
        source:             this.resolveAnchorSource(ctx),
      });
    }

    return rows;
  }

  /**
   * Build only the ConcessionsBlock (Free Months, Concession %, Source Blend).
   */
  buildConcessionsBlock(ctx: ProjectionsDealContext, holdYears: number): ConcessionsRow[] {
    const concEnv  = ctx.traffic.concession_environment;
    const overrides = ctx.user_overrides ?? {};
    const rows: ConcessionsRow[] = [];

    for (let year = 1; year <= holdYears; year++) {
      const resolvedMode    = this.resolveMode(ctx, year);
      const transitionBadge = this.transitionBadge(ctx, year);

      // Prefer the Concession Environment Engine output for this year
      const envRow: PerYearConcessionEnv | null =
        concEnv?.per_year?.find(r => r.year === year) ?? null;

      const freeMonths  = this.getOverride(overrides, 'conc.free_months', year)
                       ?? envRow?.free_months
                       ?? this.defaultFreeMonths(resolvedMode);

      const concPct     = this.getOverride(overrides, 'conc.concession_pct', year)
                       ?? envRow?.concession_pct
                       ?? parseFloat((freeMonths / 12).toFixed(4));

      const spModifier  = envRow?.supply_pressure_modifier ?? 1.0;
      const confidence  = envRow?.confidence ?? 'LOW';
      const sourceBlend = envRow?.source_blend ?? {
        class_default_weight: 1.0,
        submarket_weight: 0.0,
        subject_weight: 0.0,
      };

      rows.push({
        year,
        free_months:              parseFloat(freeMonths.toFixed(4)),
        concession_pct:           parseFloat(concPct.toFixed(4)),
        supply_pressure_modifier: parseFloat(spModifier.toFixed(4)),
        confidence,
        source_blend:             sourceBlend,
        mode:                     resolvedMode,
        transition_badge:         transitionBadge,
      });
    }

    return rows;
  }

  /**
   * Compute a single effective-rent row from dealContext and a market rent assumption.
   * Useful for quick sensitivity probing without rebuilding the full block.
   */
  buildEffectiveRentRow(
    ctx: ProjectionsDealContext,
    year: number,
    marketRentOverride?: number,
  ): { year: number; market_rent: number; effective_rent: number; loss_to_lease: number } {
    const rentGrowth = ctx.traffic.market_rent_growth ?? BASELINE_RENT_GROWTH;
    const baseRent   = marketRentOverride ?? ctx.traffic.market_rent_per_unit ?? BASELINE_MARKET_RENT;
    const mr         = baseRent * Math.pow(1 + rentGrowth, year - 1);
    const mode       = this.resolveMode(ctx, year);
    const physOcc    = this.computePhysOcc(ctx, year, mode);
    const ltl        = this.computeLTL(ctx, year, mode, physOcc);
    return {
      year,
      market_rent:    parseFloat(mr.toFixed(2)),
      effective_rent: parseFloat((mr * (1 - ltl)).toFixed(2)),
      loss_to_lease:  parseFloat(ltl.toFixed(4)),
    };
  }

  /**
   * Cheap-path override: recompute only the rows downstream of the overridden field.
   *
   * @param current  Previously built ProjectionsOutput (full rebuild not required)
   * @param overrideKey  "<block>.<field>.<year>" — e.g. "occ.loss_to_lease.2"
   * @param overrideValue  New value set by the user
   * @param ctx  Original deal context (with the new override merged in)
   * @returns  Mutated copy of `current` with only affected rows updated
   */
  recomputeRowOnOverride(
    current: ProjectionsOutput,
    overrideKey: string,
    overrideValue: number,
    ctx: ProjectionsDealContext,
  ): ProjectionsOutput {
    // Parse key: "<block>.<field>.<year>"
    const parts = overrideKey.split('.');
    if (parts.length < 3) {
      logger.warn('[M07→M09] recomputeRowOnOverride: invalid key format', { overrideKey });
      return current;
    }
    const [block, field, yearStr] = parts;
    const year = parseInt(yearStr, 10);
    if (isNaN(year) || year < 1 || year > current.hold_years) {
      logger.warn('[M07→M09] recomputeRowOnOverride: invalid year', { overrideKey, year });
      return current;
    }

    // Build the context with the override merged
    const mergedCtx: ProjectionsDealContext = {
      ...ctx,
      user_overrides: {
        ...(ctx.user_overrides ?? {}),
        [overrideKey]: overrideValue,
      },
    };

    // Identify which fields need recomputing downstream
    const blockField = `${block}.${field}`;
    const downstream = OVERRIDE_DOWNSTREAM[blockField] ?? [];

    // Clone output
    const updated: ProjectionsOutput = {
      ...current,
      occupancy_leasing: [...current.occupancy_leasing],
      concessions:       [...current.concessions],
    };

    // Rebuild only the affected year's rows from scratch (cheap: single-year recompute)
    if (block === 'occ') {
      const newOccRows = this.buildOccupancyLeasingBlock(mergedCtx, current.hold_years);
      updated.occupancy_leasing[year - 1] = newOccRows[year - 1];
      // Downstream occ fields in the same year are already recomputed in the row above
    } else if (block === 'conc') {
      const newConcRows = this.buildConcessionsBlock(mergedCtx, current.hold_years);
      updated.concessions[year - 1] = newConcRows[year - 1];
    }

    logger.debug('[M07→M09] recomputeRowOnOverride', {
      dealId: ctx.deal_id, overrideKey, overrideValue, downstream,
    });

    // Re-run invariants (loud failure on violation)
    assertProjectionsInvariants(updated);
    return updated;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Mode resolution
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Resolve the effective deal mode for a given year.
   *
   * LEASE_UP → STABILIZED transition: occurs at deal_data.capex_schedule.transition_month.
   * Year N is fully STABILIZED when N*12 <= transition_month would be incorrect —
   * instead: transition is complete when (year-1)*12 >= transition_month.
   *
   * REDEVELOPMENT → STABILIZED: post final-phase CO date.
   */
  private resolveMode(
    ctx: ProjectionsDealContext,
    year: number,
  ): 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT' {
    const dealMode = ctx.deal_mode;
    if (dealMode === 'STABILIZED') return 'STABILIZED';

    if (dealMode === 'LEASE_UP') {
      const transitionMonth = ctx.capex_schedule?.transition_month ?? 24;
      const yearStartMonth  = (year - 1) * 12 + 1;
      // If transition is before year start, this year is fully STABILIZED
      if (transitionMonth < yearStartMonth) return 'STABILIZED';
      return 'LEASE_UP';
    }

    if (dealMode === 'REDEVELOPMENT') {
      // Determine last phase CO date
      const phases = ctx.capex_schedule?.phases ?? ctx.traffic.starting_state?.phases ?? [];
      const lastCoMonths = phases.length > 0
        ? Math.max(...phases.map((p: any) => (p.co_months_out ?? p.co_date_months_out ?? 12) + (p.lease_up_months ?? p.mini_lease_up_months ?? 18)))
        : 36;
      const yearStartMonth = (year - 1) * 12 + 1;
      if (yearStartMonth > lastCoMonths) return 'STABILIZED';
      return 'REDEVELOPMENT';
    }

    return 'STABILIZED';
  }

  /**
   * Return the UI transition badge string when a mode boundary occurs in this year.
   * Returns undefined when the year is fully within a single mode.
   */
  private transitionBadge(
    ctx: ProjectionsDealContext,
    year: number,
  ): 'LU→S' | 'R→S' | undefined {
    if (ctx.deal_mode === 'LEASE_UP') {
      const transitionMonth = ctx.capex_schedule?.transition_month ?? 24;
      const yearStartMonth  = (year - 1) * 12 + 1;
      const yearEndMonth    = year * 12;
      if (transitionMonth >= yearStartMonth && transitionMonth < yearEndMonth) return 'LU→S';
    }
    if (ctx.deal_mode === 'REDEVELOPMENT') {
      const phases = ctx.capex_schedule?.phases ?? ctx.traffic.starting_state?.phases ?? [];
      const lastCoMonths = phases.length > 0
        ? Math.max(...phases.map((p: any) => (p.co_months_out ?? p.co_date_months_out ?? 12) + (p.lease_up_months ?? p.mini_lease_up_months ?? 18)))
        : 36;
      const yearStartMonth  = (year - 1) * 12 + 1;
      const yearEndMonth    = year * 12;
      if (lastCoMonths >= yearStartMonth && lastCoMonths < yearEndMonth) return 'R→S';
    }
    return undefined;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Physical occupancy computation
  // ──────────────────────────────────────────────────────────────────────────

  private computePhysOcc(
    ctx: ProjectionsDealContext,
    year: number,
    mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT',
  ): number {
    const ss = ctx.traffic.starting_state;
    const subject = ctx.traffic.subject_history;

    if (mode === 'STABILIZED') {
      // Y1 anchor: prefer subject S1 occupancy_rate, then startingState.current_occupancy
      const y1Anchor = subject?.current_state?.occupancy_rate
                    ?? (ss as any)?.current_occupancy
                    ?? 0.92;
      if (year === 1) return Math.min(1, Math.max(0, y1Anchor));

      // YN: revert toward STABILIZED_TARGET_OCC using simple reversion model
      const prev = this.computePhysOcc(ctx, year - 1, mode);
      const gap  = STABILIZED_TARGET_OCC - prev;
      return Math.min(1, Math.max(0, parseFloat((prev + gap * OCC_REVERSION_SPEED).toFixed(4))));
    }

    if (mode === 'LEASE_UP') {
      const luState = ss as any;
      const startOcc   = luState?.start_occupancy ?? 0;
      const targetOcc  = luState?.target_occupancy ?? 0.93;
      const curve      = luState?.absorption_curve ?? this.defaultAbsorptionCurve();

      // Cumulative net leases over year's 12 months from absorption curve
      const startIdx   = (year - 1) * 12;
      const sliceRaw   = curve.slice(startIdx, startIdx + 12);
      const slice      = sliceRaw.length > 0 ? sliceRaw : [targetOcc];

      // Avg monthly absorption in year = cumulative gain / units
      const avgMonthly = slice.reduce((a: number, b: number) => a + b, 0) / slice.length;
      const cumOcc     = startOcc + avgMonthly;

      return Math.min(targetOcc, Math.max(startOcc, parseFloat(cumOcc.toFixed(4))));
    }

    if (mode === 'REDEVELOPMENT') {
      // REDEVELOPMENT: occupied fraction = (total - offline) / total with reno dilution
      const renoState = ss as any;
      const overallOcc = renoState?.overall_occupancy ?? 0;
      const renovPct   = ctx.capex_schedule?.renovation_pct ?? 0.5;

      // Y1: blended occupancy (renovated = 0, unrenovated = overallOcc)
      // Later years: dilution decreases as phases complete
      const dilutionFactor = Math.max(0, renovPct * (1 - (year - 1) * 0.25));
      const effectiveOcc   = overallOcc * (1 - dilutionFactor);
      return Math.min(1, Math.max(0, parseFloat(effectiveOcc.toFixed(4))));
    }

    return 0.92;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Loss-to-Lease computation
  // ──────────────────────────────────────────────────────────────────────────

  private computeLTL(
    ctx: ProjectionsDealContext,
    year: number,
    mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT',
    physOcc: number,
  ): number {
    const subject = ctx.traffic.subject_history;

    if (mode === 'STABILIZED') {
      // Y1 anchor: prefer subject S1 loss_to_lease, then platform default
      const y1LTL = subject?.current_state?.loss_to_lease ?? BASELINE_LOSS_TO_LEASE;
      if (year === 1) return Math.min(0.30, Math.max(0, y1LTL));

      // YN: compress toward LTL_STABILIZED_DEFAULT
      const prev = this.computeLTL(ctx, year - 1, mode, physOcc);
      const gap  = LTL_STABILIZED_DEFAULT - prev;
      return Math.min(0.30, Math.max(0, parseFloat((prev + gap * LTL_COMPRESSION).toFixed(4))));
    }

    if (mode === 'LEASE_UP') {
      // LEASE_UP: LTL is front-loaded — higher early (occupancy ramp drives discounting)
      // Higher occupancy pressure → less LTL. Simple model: LTL decays with physOcc.
      const peakLTL = subject?.current_state?.loss_to_lease ?? 0.06;
      const decayed = peakLTL * Math.pow(0.80, year - 1);
      return Math.min(0.30, Math.max(0, parseFloat(decayed.toFixed(4))));
    }

    if (mode === 'REDEVELOPMENT') {
      // Pre-reno units: higher LTL due to retention concessions
      const baseLTL   = subject?.current_state?.loss_to_lease ?? BASELINE_LOSS_TO_LEASE;
      const renovPct  = ctx.capex_schedule?.renovation_pct ?? 0.5;
      const uplift    = ctx.capex_schedule?.post_reno_rent_uplift ?? 0;
      // Blended: unrenovated keeps base LTL; renovated cohort gets uplift → lower LTL
      const blended   = baseLTL * (1 - renovPct) + Math.max(0, baseLTL - uplift) * renovPct;
      return Math.min(0.30, Math.max(0, parseFloat(blended.toFixed(4))));
    }

    return BASELINE_LOSS_TO_LEASE;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Concession defaults
  // ──────────────────────────────────────────────────────────────────────────

  private defaultFreeMonths(mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT'): number {
    switch (mode) {
      case 'LEASE_UP':     return 1.5;
      case 'REDEVELOPMENT': return 1.0;
      default:              return 0.5;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Override helper
  // ──────────────────────────────────────────────────────────────────────────

  private getOverride(
    overrides: Record<string, number>,
    blockField: string,
    year: number,
  ): number | null {
    const key = `${blockField}.${year}`;
    const val = overrides[key];
    return typeof val === 'number' && isFinite(val) ? val : null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Source / degradation metadata
  // ──────────────────────────────────────────────────────────────────────────

  private resolveAnchorSource(ctx: ProjectionsDealContext): string {
    const tier = ctx.traffic.subject_history?.tier;
    if (tier) return `subject_history:${tier.toLowerCase()}`;
    if (ctx.traffic.starting_state) return 'platform';
    return 'baseline';
  }

  private subjectIsUsed(ctx: ProjectionsDealContext): boolean {
    return ctx.traffic.subject_history != null;
  }

  private detectDegradation(ctx: ProjectionsDealContext): string | null {
    if (!ctx.traffic.starting_state) {
      return 'NO_STARTING_STATE';
    }
    if (ctx.deal_mode === 'REDEVELOPMENT' && !ctx.capex_schedule) {
      return 'M22_MISSING_REDEVELOPMENT';
    }
    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: Defaults
  // ──────────────────────────────────────────────────────────────────────────

  private defaultAbsorptionCurve(): number[] {
    // 24-month curve approaching 0.93 target (simplified linear ramp)
    return Array.from({ length: 24 }, (_, i) => Math.min(0.93, 0.05 + i * 0.04));
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

export const m07ProjectionsAdapter = new M07ProjectionsAdapter();

// ── Wire functions (for event bus subscriptions in p2-service-adapters) ─────

/**
 * Build projections for a deal and publish to the DataFlowRouter under M09.
 * Called by the M07→M09 trigger subscriptions on every relevant event.
 */
export async function wireM07ToM09Projections(
  dealId: string,
  ctx: ProjectionsDealContext,
): Promise<ProjectionsOutput | null> {
  try {
    const output = m07ProjectionsAdapter.build(ctx);

    // Publish to data flow router so downstream M10/M11/M12 modules can consume
    try {
      const { dataFlowRouter } = require('./data-flow-router');
      dataFlowRouter.publishModuleData('M09', dealId, {
        projections: output,
        projections_computed_at: output.computed_at,
      });
    } catch (routerErr: any) {
      logger.debug('[M07→M09] DataFlowRouter publish skipped', { error: routerErr.message });
    }

    logger.info('[M07→M09] Projections built', {
      dealId,
      holdYears: output.hold_years,
      dealMode:  output.deal_mode,
      anchorSource: output.anchor_source,
      degraded: output.degraded_reason,
    });

    return output;
  } catch (err: any) {
    logger.error('[M07→M09] Projections build failed', { dealId, error: err.message });
    return null;
  }
}

/**
 * Cheap-path override: recompute only the downstream-dependent rows for a
 * single assumption cell edit.  Wraps recomputeRowOnOverride with error handling.
 */
export function wireM07ToM09Override(
  current: ProjectionsOutput,
  overrideKey: string,
  overrideValue: number,
  ctx: ProjectionsDealContext,
): ProjectionsOutput {
  try {
    return m07ProjectionsAdapter.recomputeRowOnOverride(current, overrideKey, overrideValue, ctx);
  } catch (err: any) {
    logger.error('[M07→M09] Override recompute failed', {
      dealId: ctx.deal_id, overrideKey, error: err.message,
    });
    // Return current unchanged — caller must decide whether to trigger full rebuild
    return current;
  }
}
