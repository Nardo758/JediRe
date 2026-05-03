/**
 * M07 → M09 Projections Adapter
 *
 * Pure, stateless transformer that consumes pre-loaded dealContext data and
 * produces typed OccupancyLeasingBlock and ConcessionsBlock row arrays for any
 * hold timeline (3 / 5 / 7 / 10 years).
 *
 * Source mapping (spec §3):
 *   Physical Occupancy Y1 ←
 *     STABILIZED:    startingState.current_occupancy (S1 subject overrides)
 *     LEASE_UP:      absorption_curve[year * 12]  (curve index for end-of-year)
 *     REDEVELOPMENT: overall_occupancy × (1 − renovation_dilution)
 *   Loss-to-Lease Y1 ← SubjectCurrentState.loss_to_lease (S1) or platform 3%
 *   Rent Growth      ← market_rent_growth (M05) or platform baseline 3%
 *   Free Months      ← ConcessionEnvironmentOutput.per_year[n].free_months
 *   Concession %     ← per_year[n].concession_pct (engine output) or free_months/12
 *
 * Mode transitions (LEASE_UP → STABILIZED, REDEVELOPMENT → STABILIZED):
 *   Resolved per-year; produces UI badges "LU→S" / "R→S" in transition year.
 *
 * REDEVELOPMENT + missing M22 capex_schedule:
 *   renovation_dilution = 0 (conservative floor); degraded_reason set.
 */

import { logger } from '../../utils/logger';
import type {
  StartingState,
  StabilizedState,
  LeaseUpState,
  RedevelopmentState,
  RedevelopmentPhase,
  ConcessionEnvironmentOutput,
  PerYearConcessionEnv,
  SubjectTrafficHistory,
} from '../../types/traffic-calibration.types';
import {
  OVERRIDE_DOWNSTREAM,
  assertProjectionsInvariants,
} from './projections-dependency-graph';

// ── Re-export core types for consumers ──────────────────────────────────────
export type {
  OccupancyLeasingRow,
  ConcessionsRow,
  ProjectionsOutput,
} from './projections-dependency-graph';

import type {
  OccupancyLeasingRow,
  ConcessionsRow,
  ProjectionsOutput,
} from './projections-dependency-graph';

// ── Constants ────────────────────────────────────────────────────────────────

const BASELINE_RENT_GROWTH    = 0.03;
const BASELINE_LOSS_TO_LEASE  = 0.03;
const STABILIZED_TARGET_OCC   = 0.95;
const OCC_REVERSION_SPEED     = 0.20;
const BASELINE_MARKET_RENT    = 1_800;
const LTL_COMPRESSION         = 0.30;
const LTL_STABILIZED_FLOOR    = 0.025;

// ── Input types ─────────────────────────────────────────────────────────────

export interface CapexSchedule {
  /** Month number at which LEASE_UP transitions to STABILIZED (default 24) */
  transition_month?: number;
  phases?: Array<{
    units?: number;
    co_months_out?: number;
    lease_up_months?: number;
    rent_uplift_pct?: number;
  }>;
  /** Fraction of units under renovation at deal start (REDEVELOPMENT only) */
  renovation_pct?: number;
  /** Expected rent uplift post-renovation, e.g. 0.12 = +12% (REDEVELOPMENT) */
  post_reno_rent_uplift?: number;
}

export interface DealContextTraffic {
  starting_state?: StartingState | null;
  concession_environment?: ConcessionEnvironmentOutput | null;
  subject_history?: SubjectTrafficHistory | null;
  /** Platform rent growth rate from M05 (fraction, e.g. 0.03) */
  market_rent_growth?: number | null;
  /** Current market rent per unit from M05 or deal data */
  market_rent_per_unit?: number | null;
}

export interface ProjectionsDealContext {
  deal_id: string;
  deal_mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT';
  hold_years: number;
  traffic: DealContextTraffic;
  capex_schedule?: CapexSchedule | null;
  /** Cell-level user overrides: key = "<block>.<field>.<year>", value = override */
  user_overrides?: Record<string, number>;
  total_units?: number;
}

// ── Adapter ──────────────────────────────────────────────────────────────────

export class M07ProjectionsAdapter {

  // ── Public: Full build ───────────────────────────────────────────────────

  build(ctx: ProjectionsDealContext): ProjectionsOutput {
    const holdYears = Math.max(1, Math.min(30, ctx.hold_years));
    const degradedReason = this.detectDegradation(ctx);
    const occRows  = this.buildOccupancyLeasingBlock(ctx, holdYears);
    const concRows = this.buildConcessionsBlock(ctx, holdYears);

    const output: ProjectionsOutput = {
      deal_id:           ctx.deal_id,
      computed_at:       new Date().toISOString(),
      hold_years:        holdYears,
      deal_mode:         ctx.deal_mode,
      occupancy_leasing: occRows,
      concessions:       concRows,
      anchor_source:     this.resolveAnchorSource(ctx),
      subject_used:      ctx.traffic.subject_history != null,
      degraded_reason:   degradedReason,
    };

    assertProjectionsInvariants(output);
    return output;
  }

  buildOccupancyLeasingBlock(ctx: ProjectionsDealContext, holdYears: number): OccupancyLeasingRow[] {
    const marketRentBase = ctx.traffic.market_rent_per_unit ?? BASELINE_MARKET_RENT;
    const rentGrowth     = ctx.traffic.market_rent_growth   ?? BASELINE_RENT_GROWTH;
    const overrides      = ctx.user_overrides ?? {};
    const rows: OccupancyLeasingRow[] = [];

    for (let year = 1; year <= holdYears; year++) {
      const resolvedMode    = this.resolveMode(ctx, year);
      const transitionBadge = this.transitionBadge(ctx, year);
      const marketRent      = marketRentBase * Math.pow(1 + rentGrowth, year - 1);

      const physOcc = this.getOverride(overrides, 'occ.physical_occupancy', year)
                   ?? this.computePhysOcc(ctx, year, resolvedMode);
      const ltl     = this.getOverride(overrides, 'occ.loss_to_lease', year)
                   ?? this.computeLTL(ctx, year, resolvedMode);
      const rg      = this.getOverride(overrides, 'occ.rent_growth', year)
                   ?? rentGrowth;
      const effRent = this.getOverride(overrides, 'occ.effective_rent', year)
                   ?? roundTo2(marketRent * (1 - ltl));

      rows.push({
        year,
        physical_occupancy: roundTo4(Math.min(1, Math.max(0, physOcc))),
        loss_to_lease:      roundTo4(Math.min(0.30, Math.max(0, ltl))),
        rent_growth:        roundTo4(rg),
        effective_rent:     effRent,
        market_rent:        roundTo2(marketRent),
        mode:               resolvedMode,
        transition_badge:   transitionBadge,
        source:             this.resolveAnchorSource(ctx),
        degraded:           ctx.deal_mode === 'REDEVELOPMENT' && ctx.capex_schedule == null,
        degraded_reason:    ctx.deal_mode === 'REDEVELOPMENT' && ctx.capex_schedule == null
                              ? 'M22_MISSING_CAPEX_SCHEDULE'
                              : null,
      });
    }

    return rows;
  }

  buildConcessionsBlock(ctx: ProjectionsDealContext, holdYears: number): ConcessionsRow[] {
    const concEnv  = ctx.traffic.concession_environment;
    const overrides = ctx.user_overrides ?? {};
    const rows: ConcessionsRow[] = [];

    for (let year = 1; year <= holdYears; year++) {
      const resolvedMode    = this.resolveMode(ctx, year);
      const transitionBadge = this.transitionBadge(ctx, year);

      const envRow: PerYearConcessionEnv | undefined =
        concEnv?.per_year?.find(r => r.year === year);

      const freeMonths  = this.getOverride(overrides, 'conc.free_months', year)
                       ?? envRow?.free_months
                       ?? this.defaultFreeMonths(resolvedMode);
      const concPct     = this.getOverride(overrides, 'conc.concession_pct', year)
                       ?? envRow?.concession_pct
                       ?? roundTo4(freeMonths / 12);
      const spModifier  = envRow?.supply_pressure_modifier ?? 1.0;
      const confidence  = envRow?.confidence ?? 'LOW';
      const sourceBlend = envRow?.source_blend ?? {
        class_default_weight: 1.0,
        submarket_weight: 0.0,
        subject_weight: 0.0,
      };

      rows.push({
        year,
        free_months:              roundTo4(Math.max(0, freeMonths)),
        concession_pct:           roundTo4(Math.max(0, concPct)),
        supply_pressure_modifier: roundTo4(spModifier),
        confidence,
        source_blend:             sourceBlend,
        mode:                     resolvedMode,
        transition_badge:         transitionBadge,
      });
    }

    return rows;
  }

  buildEffectiveRentRow(
    ctx: ProjectionsDealContext,
    year: number,
    marketRentOverride?: number,
  ): { year: number; market_rent: number; effective_rent: number; loss_to_lease: number } {
    const rentGrowth = ctx.traffic.market_rent_growth ?? BASELINE_RENT_GROWTH;
    const baseRent   = marketRentOverride ?? ctx.traffic.market_rent_per_unit ?? BASELINE_MARKET_RENT;
    const mr         = baseRent * Math.pow(1 + rentGrowth, year - 1);
    const mode       = this.resolveMode(ctx, year);
    const ltl        = this.computeLTL(ctx, year, mode);
    return {
      year,
      market_rent:    roundTo2(mr),
      effective_rent: roundTo2(mr * (1 - ltl)),
      loss_to_lease:  roundTo4(ltl),
    };
  }

  /**
   * Cheap-path override: selectively recompute only the downstream-dependent
   * fields for the overridden year, driven by PROJECTIONS_DEPENDENCY_GRAPH.
   *
   * Does NOT rebuild the entire block — only the overridden cell and its
   * direct graph descendants in the same year are updated.
   */
  recomputeRowOnOverride(
    current: ProjectionsOutput,
    overrideKey: string,
    overrideValue: number,
    ctx: ProjectionsDealContext,
  ): ProjectionsOutput {
    const parts = overrideKey.split('.');
    if (parts.length < 3) {
      logger.warn('[M07→M09] recomputeRowOnOverride: malformed key', { overrideKey });
      return current;
    }

    const [block, field, yearStr] = parts;
    const year = parseInt(yearStr, 10);
    if (isNaN(year) || year < 1 || year > current.hold_years) {
      logger.warn('[M07→M09] recomputeRowOnOverride: invalid year', { overrideKey });
      return current;
    }

    const blockField = `${block}.${field}`;
    const downstream = OVERRIDE_DOWNSTREAM[blockField] ?? [];

    // Work on shallow clones of the row arrays — only the target year row is mutated
    const occRows  = [...current.occupancy_leasing];
    const concRows = [...current.concessions];

    if (block === 'occ') {
      const base = { ...occRows[year - 1] };

      // Apply override
      if (field === 'physical_occupancy') {
        base.physical_occupancy = roundTo4(Math.min(1, Math.max(0, overrideValue)));
      } else if (field === 'loss_to_lease') {
        base.loss_to_lease = roundTo4(Math.min(0.30, Math.max(0, overrideValue)));
      } else if (field === 'rent_growth') {
        base.rent_growth = roundTo4(overrideValue);
        // Recompute market_rent for this year from growth chain
        const baseRent   = ctx.traffic.market_rent_per_unit ?? BASELINE_MARKET_RENT;
        base.market_rent = roundTo2(baseRent * Math.pow(1 + overrideValue, year - 1));
      } else if (field === 'effective_rent') {
        base.effective_rent = roundTo2(overrideValue);
      }

      // Recompute downstream fields from the dependency graph
      for (const downstreamKey of downstream) {
        const [, dField] = downstreamKey.split('.');
        if (dField === 'loss_to_lease') {
          // Re-derive LTL from the new physical_occupancy using STABILIZED formula
          base.loss_to_lease = roundTo4(this.computeLTL(ctx, year, base.mode));
        } else if (dField === 'effective_rent') {
          if (base.market_rent != null) {
            base.effective_rent = roundTo2(base.market_rent * (1 - base.loss_to_lease));
          }
        }
      }

      occRows[year - 1] = base;

    } else if (block === 'conc') {
      const base = { ...concRows[year - 1] };

      if (field === 'free_months') {
        base.free_months = roundTo4(Math.max(0, overrideValue));
      } else if (field === 'concession_pct') {
        base.concession_pct = roundTo4(Math.max(0, overrideValue));
      }

      // Downstream: free_months → concession_pct
      if (downstream.includes('conc.concession_pct') && field !== 'concession_pct') {
        base.concession_pct = roundTo4(Math.max(0, base.free_months / 12));
      }

      concRows[year - 1] = base;
    }

    const updated: ProjectionsOutput = {
      ...current,
      occupancy_leasing: occRows,
      concessions:       concRows,
    };

    assertProjectionsInvariants(updated);

    logger.debug('[M07→M09] recomputeRowOnOverride', {
      dealId: ctx.deal_id, overrideKey, overrideValue, downstream,
    });

    return updated;
  }

  // ── Mode resolution ──────────────────────────────────────────────────────

  resolveMode(
    ctx: ProjectionsDealContext,
    year: number,
  ): 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT' {
    if (ctx.deal_mode === 'STABILIZED') return 'STABILIZED';

    if (ctx.deal_mode === 'LEASE_UP') {
      const transitionMonth = ctx.capex_schedule?.transition_month ?? 24;
      // Year N is fully STABILIZED when the transition falls before it starts
      if (transitionMonth < (year - 1) * 12 + 1) return 'STABILIZED';
      return 'LEASE_UP';
    }

    if (ctx.deal_mode === 'REDEVELOPMENT') {
      const lastStabMonth = this.lastRedevStabilizationMonth(ctx);
      if ((year - 1) * 12 + 1 > lastStabMonth) return 'STABILIZED';
      return 'REDEVELOPMENT';
    }

    return 'STABILIZED';
  }

  private transitionBadge(
    ctx: ProjectionsDealContext,
    year: number,
  ): 'LU→S' | 'R→S' | undefined {
    if (ctx.deal_mode === 'LEASE_UP') {
      const tm = ctx.capex_schedule?.transition_month ?? 24;
      const ys = (year - 1) * 12 + 1;
      const ye = year * 12;
      if (tm >= ys && tm < ye) return 'LU→S';
    }
    if (ctx.deal_mode === 'REDEVELOPMENT') {
      const last = this.lastRedevStabilizationMonth(ctx);
      const ys   = (year - 1) * 12 + 1;
      const ye   = year * 12;
      if (last >= ys && last < ye) return 'R→S';
    }
    return undefined;
  }

  /** Last month at which REDEVELOPMENT fully stabilizes (last phase CO + lease-up). */
  private lastRedevStabilizationMonth(ctx: ProjectionsDealContext): number {
    const capexPhases = ctx.capex_schedule?.phases ?? [];
    const ssPhases: RedevelopmentPhase[] = (() => {
      const ss = ctx.traffic.starting_state;
      if (ss?.mode === 'REDEVELOPMENT') return ss.phases;
      return [];
    })();

    // Prefer capex_schedule phases; fall back to starting_state phases
    const phases = capexPhases.length > 0 ? capexPhases : ssPhases;

    if (phases.length === 0) return 36; // conservative default

    return Math.max(
      ...phases.map(p => {
        const co   = (p as { co_months_out?: number; co_date_months_out?: number }).co_months_out
                  ?? (p as { co_date_months_out?: number }).co_date_months_out
                  ?? 12;
        const lu   = (p as { lease_up_months?: number; mini_lease_up_months?: number }).lease_up_months
                  ?? (p as { mini_lease_up_months?: number }).mini_lease_up_months
                  ?? 18;
        return co + lu;
      }),
    );
  }

  // ── Physical occupancy ───────────────────────────────────────────────────

  private computePhysOcc(
    ctx: ProjectionsDealContext,
    year: number,
    mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT',
  ): number {
    if (mode === 'STABILIZED') return this.physOccStabilized(ctx, year);
    if (mode === 'LEASE_UP')   return this.physOccLeaseUp(ctx, year);
    return this.physOccRedevelopment(ctx, year);
  }

  private physOccStabilized(ctx: ProjectionsDealContext, year: number): number {
    const ss      = ctx.traffic.starting_state;
    const subject = ctx.traffic.subject_history;

    // Y1 anchor: subject S1 > startingState.current_occupancy > default
    const y1: number = (() => {
      const subjectOcc = subject?.current_state?.occupancy_rate;
      if (typeof subjectOcc === 'number') return subjectOcc;
      if (ss?.mode === 'STABILIZED') return ss.current_occupancy;
      if (ss?.mode === 'REDEVELOPMENT') return ss.overall_occupancy;
      return 0.92;
    })();

    if (year === 1) return y1;

    // YN: mean-revert toward STABILIZED_TARGET_OCC
    let occ = y1;
    for (let y = 2; y <= year; y++) {
      occ = occ + (STABILIZED_TARGET_OCC - occ) * OCC_REVERSION_SPEED;
    }
    return occ;
  }

  /**
   * LEASE_UP occupancy: Y1 = absorption_curve[year*12], YN = absorption_curve[year*12].
   * Spec §3 anchors each year-end at curve[year * 12].  When the index falls beyond
   * the curve length the year is treated as fully stabilized (target_occupancy).
   */
  private physOccLeaseUp(ctx: ProjectionsDealContext, year: number): number {
    const ss = ctx.traffic.starting_state;
    if (ss?.mode !== 'LEASE_UP') {
      // Degraded path: no LEASE_UP starting state — fall back to STABILIZED model
      return this.physOccStabilized(ctx, year);
    }

    const curve       = ss.absorption_curve;
    const targetOcc   = ss.target_occupancy;
    const curveIndex  = year * 12;   // spec §3: Y1 = curve[12], Y2 = curve[24], …

    if (curveIndex >= curve.length) {
      // Past the end of the curve → fully stabilized
      return targetOcc;
    }

    return Math.min(targetOcc, Math.max(ss.start_occupancy, curve[curveIndex]));
  }

  /**
   * REDEVELOPMENT occupancy: occupied fraction diluted by renovation offline units.
   * When M22 capex_schedule is absent: dilution = 0 (conservative; degraded_reason set).
   */
  private physOccRedevelopment(ctx: ProjectionsDealContext, year: number): number {
    const ss = ctx.traffic.starting_state;

    const overallOcc: number = (() => {
      if (ss?.mode === 'REDEVELOPMENT') return ss.overall_occupancy;
      if (ss?.mode === 'STABILIZED')    return ss.current_occupancy;
      return 0.90;
    })();

    // Without M22 capex_schedule: no dilution applied (degraded, conservative)
    if (ctx.capex_schedule == null) {
      logger.warn('[M07→M09] REDEVELOPMENT without capex_schedule — no dilution applied', {
        dealId: ctx.deal_id,
      });
      return overallOcc;
    }

    const renovPct = ctx.capex_schedule.renovation_pct ?? 0;
    // Dilution fraction decreases linearly as phases complete
    const dilution = Math.max(0, renovPct * (1 - (year - 1) / 4));
    return Math.min(1, Math.max(0, overallOcc * (1 - dilution)));
  }

  // ── Loss-to-Lease ────────────────────────────────────────────────────────

  private computeLTL(
    ctx: ProjectionsDealContext,
    year: number,
    mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT',
  ): number {
    const subject = ctx.traffic.subject_history;

    // Y1 anchor: prefer subject S1, then platform default
    const y1LTL: number = (() => {
      const sLTL = subject?.current_state?.loss_to_lease;
      return typeof sLTL === 'number' ? sLTL : BASELINE_LOSS_TO_LEASE;
    })();

    if (mode === 'STABILIZED') {
      if (year === 1) return Math.min(0.30, Math.max(0, y1LTL));
      // Compress toward stabilized floor
      let ltl = y1LTL;
      for (let y = 2; y <= year; y++) {
        ltl = ltl + (LTL_STABILIZED_FLOOR - ltl) * LTL_COMPRESSION;
      }
      return Math.min(0.30, Math.max(0, ltl));
    }

    if (mode === 'LEASE_UP') {
      // Front-loaded: peak LTL decays by 20% per year as occupancy ramps
      const decayed = y1LTL * Math.pow(0.80, year - 1);
      return Math.min(0.30, Math.max(0, decayed));
    }

    if (mode === 'REDEVELOPMENT') {
      const renovPct = ctx.capex_schedule?.renovation_pct ?? 0;
      const uplift   = ctx.capex_schedule?.post_reno_rent_uplift ?? 0;
      // Blended: unrenovated = y1LTL; renovated = max(0, y1LTL − uplift)
      const blended  = y1LTL * (1 - renovPct) + Math.max(0, y1LTL - uplift) * renovPct;
      return Math.min(0.30, Math.max(0, blended));
    }

    return BASELINE_LOSS_TO_LEASE;
  }

  // ── Concession defaults ──────────────────────────────────────────────────

  private defaultFreeMonths(mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT'): number {
    switch (mode) {
      case 'LEASE_UP':      return 1.5;
      case 'REDEVELOPMENT': return 1.0;
      default:              return 0.5;
    }
  }

  // ── Override helper ──────────────────────────────────────────────────────

  private getOverride(overrides: Record<string, number>, blockField: string, year: number): number | null {
    const val = overrides[`${blockField}.${year}`];
    return typeof val === 'number' && isFinite(val) ? val : null;
  }

  // ── Metadata ─────────────────────────────────────────────────────────────

  private resolveAnchorSource(ctx: ProjectionsDealContext): string {
    const tier = ctx.traffic.subject_history?.tier;
    if (tier) return `subject_history:${tier.toLowerCase()}`;
    if (ctx.traffic.starting_state) return 'platform';
    return 'baseline';
  }

  private detectDegradation(ctx: ProjectionsDealContext): string | null {
    if (!ctx.traffic.starting_state) return 'NO_STARTING_STATE';
    if (ctx.deal_mode === 'REDEVELOPMENT' && ctx.capex_schedule == null) {
      return 'M22_MISSING_CAPEX_SCHEDULE';
    }
    return null;
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────

function roundTo4(n: number): number { return Math.round(n * 10000) / 10000; }
function roundTo2(n: number): number { return Math.round(n * 100) / 100; }

// ── Singleton ─────────────────────────────────────────────────────────────────

export const m07ProjectionsAdapter = new M07ProjectionsAdapter();

// ── Wire functions ────────────────────────────────────────────────────────────

export async function wireM07ToM09Projections(
  dealId: string,
  ctx: ProjectionsDealContext,
): Promise<ProjectionsOutput | null> {
  try {
    const output = m07ProjectionsAdapter.build(ctx);

    try {
      const { dataFlowRouter } = require('./data-flow-router') as {
        dataFlowRouter: { publishModuleData: (mod: string, id: string, data: Record<string, unknown>) => void };
      };
      dataFlowRouter.publishModuleData('M09', dealId, {
        projections:              output,
        projections_computed_at:  output.computed_at,
      });
    } catch (routerErr: unknown) {
      logger.debug('[M07→M09] DataFlowRouter publish skipped', {
        error: routerErr instanceof Error ? routerErr.message : String(routerErr),
      });
    }

    logger.info('[M07→M09] Projections built', {
      dealId,
      holdYears:    output.hold_years,
      dealMode:     output.deal_mode,
      anchorSource: output.anchor_source,
      degraded:     output.degraded_reason,
    });

    return output;
  } catch (err: unknown) {
    logger.error('[M07→M09] Projections build failed', {
      dealId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function wireM07ToM09Override(
  current: ProjectionsOutput,
  overrideKey: string,
  overrideValue: number,
  ctx: ProjectionsDealContext,
): ProjectionsOutput {
  try {
    return m07ProjectionsAdapter.recomputeRowOnOverride(current, overrideKey, overrideValue, ctx);
  } catch (err: unknown) {
    logger.error('[M07→M09] Override recompute failed', {
      dealId: ctx.deal_id,
      overrideKey,
      error: err instanceof Error ? err.message : String(err),
    });
    return current;
  }
}
