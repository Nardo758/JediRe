/**
 * M07 → M09 Projections Adapter
 *
 * Pure, stateless transformer that consumes pre-loaded M07 dealContext data
 * and produces typed OccupancyLeasingBlock and ConcessionsBlock row arrays
 * for any hold timeline (1–30 years).
 *
 * ── M07-calibrated source mapping (spec §3) ──────────────────────────────────
 *
 *  Physical Occupancy Y1
 *    STABILIZED: subject_history.current_state.occupancy_rate (S1)
 *                → starting_state.current_occupancy (platform)
 *    LEASE_UP:   starting_state.absorption_curve[year * 12]  (spec §3 anchor)
 *                → target_occupancy when past curve end
 *    RDEV:       phase-weighted blended occ from M22 capex_schedule phases
 *                (pre-CO = 0, in-lease-up = linear ramp, stabilized = target)
 *
 *  Loss-to-Lease Y1
 *    subject_history.current_state.loss_to_lease (S1)
 *    → subject_history.observed_dynamics.loss_to_lease (S2+)
 *    → BASELINE_LOSS_TO_LEASE (3%)
 *
 *  Stabilized LTL attractor
 *    subject_history.observed_dynamics.loss_to_lease (S2+ longitudinal)
 *    → BASELINE_LOSS_TO_LEASE
 *
 *  Stabilized target occupancy
 *    starting_state (LeaseUp).target_occupancy
 *    → observed_dynamics.renewal_rate proxy
 *    → STABILIZED_TARGET_OCC (0.95)
 *
 *  Rent Growth
 *    traffic.market_rent_growth (M05 submarket posterior)
 *    → subject_history.observed_dynamics.new_lease_trade_out_pct (M07 S2+)
 *    → BASELINE_RENT_GROWTH (3%)
 *
 *  Base Market Rent per unit
 *    subject_history.current_state.avg_market_rent (M07 S1 observed)
 *    → traffic.market_rent_per_unit (deal context)
 *    → BASELINE_MARKET_RENT
 *
 *  Concessions
 *    ConcessionEnvironmentOutput.per_year[n]   (M07 Concession Engine)
 *    RDEV: untouched_free_months for pre-reno retention concessions
 *    → mode-based defaults
 *
 * ── Mode transitions ──────────────────────────────────────────────────────────
 *  Resolved per-year; UI badges "LU→S" / "R→S" emitted in the transition year.
 *  Unresolved deal_mode (null/undefined) auto-resolved from starting_state.mode
 *  with mode_auto_resolved field set for UI badging.
 *
 * ── REDEVELOPMENT without M22 capex_schedule ─────────────────────────────────
 *  renovation_pct = 0 (conservative); degraded_reason = 'M22_MISSING_CAPEX_SCHEDULE'.
 *  Rows are still produced — no silent fallback to STABILIZED behavior.
 */

import { logger } from '../../utils/logger';
import type {
  StartingState,
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

// ── Re-export core types ──────────────────────────────────────────────────────
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

// ── Constants (fallbacks when M07 data absent) ────────────────────────────────

/** Used only when no M05/M07 market rent growth data is available */
const BASELINE_RENT_GROWTH      = 0.03;
/** Used only when no subject S1 loss_to_lease is available */
const BASELINE_LOSS_TO_LEASE    = 0.03;
/** Used only when no LeaseUpState.target_occupancy or observed_dynamics available */
const STABILIZED_TARGET_OCC     = 0.95;
/** Speed of mean-reversion toward target occ per year (STABILIZED mode) */
const OCC_REVERSION_SPEED       = 0.20;
/** Used only when no subject current_state.avg_market_rent or context value */
const BASELINE_MARKET_RENT      = 1_800;
/** Fraction of gap closed per year during LTL compression (STABILIZED mode) */
const LTL_COMPRESSION           = 0.30;

// ── Input types ───────────────────────────────────────────────────────────────

export interface CapexSchedule {
  /** Month at which LEASE_UP transitions to STABILIZED (default 24) */
  transition_month?: number;
  phases?: Array<{
    units?: number;
    co_months_out?: number;
    lease_up_months?: number;
    rent_uplift_pct?: number;
  }>;
  /** Fraction of total units under renovation at deal start */
  renovation_pct?: number;
  /** Rent uplift post-renovation (fraction, e.g. 0.12 = +12%) */
  post_reno_rent_uplift?: number;
}

export interface DealContextTraffic {
  starting_state?: StartingState | null;
  concession_environment?: ConcessionEnvironmentOutput | null;
  subject_history?: SubjectTrafficHistory | null;
  /** M05 submarket posterior rent growth (fraction, e.g. 0.03) */
  market_rent_growth?: number | null;
  /** Deal-context market rent per unit; overridden by subject S1 avg_market_rent */
  market_rent_per_unit?: number | null;
}

export interface ProjectionsDealContext {
  deal_id: string;
  /** Null/undefined triggers auto-resolution from starting_state.mode */
  deal_mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT' | null | undefined;
  hold_years: number;
  traffic: DealContextTraffic;
  capex_schedule?: CapexSchedule | null;
  /** Cell-level user overrides: "<block>.<field>.<year>" → override value */
  user_overrides?: Record<string, number>;
  total_units?: number;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class M07ProjectionsAdapter {

  // ── Public interface ────────────────────────────────────────────────────

  build(ctx: ProjectionsDealContext): ProjectionsOutput {
    const holdYears     = Math.max(1, Math.min(30, ctx.hold_years));
    const resolvedMode  = this.normalizeMode(ctx);
    const modeAutoResolved = this.modeAutoResolvedFrom(ctx);

    const normalizedCtx: ProjectionsDealContext = { ...ctx, deal_mode: resolvedMode };

    const occRows  = this.buildOccupancyLeasingBlock(normalizedCtx, holdYears);
    const concRows = this.buildConcessionsBlock(normalizedCtx, holdYears);

    const output: ProjectionsOutput = {
      deal_id:            ctx.deal_id,
      computed_at:        new Date().toISOString(),
      hold_years:         holdYears,
      deal_mode:          resolvedMode,
      occupancy_leasing:  occRows,
      concessions:        concRows,
      anchor_source:      this.anchorSource(ctx),
      subject_used:       ctx.traffic.subject_history != null,
      degraded_reason:    this.detectDegradation(ctx, resolvedMode),
      mode_auto_resolved: modeAutoResolved,
    };

    assertProjectionsInvariants(output);
    return output;
  }

  buildOccupancyLeasingBlock(ctx: ProjectionsDealContext, holdYears: number): OccupancyLeasingRow[] {
    const overrides  = ctx.user_overrides ?? {};
    const rentGrowth = this.resolveRentGrowth(ctx);
    const baseRent   = this.resolveBaseMarketRent(ctx);
    const rows: OccupancyLeasingRow[] = [];

    for (let year = 1; year <= holdYears; year++) {
      const mode   = this.resolveMode(ctx, year);
      const badge  = this.transitionBadge(ctx, year);

      const physOcc = this.getOverride(overrides, 'occ.physical_occupancy', year)
                   ?? this.computePhysOcc(ctx, year, mode);

      const ltl     = this.getOverride(overrides, 'occ.loss_to_lease', year)
                   ?? this.computeLTL(ctx, year, mode, physOcc);

      const rg      = this.getOverride(overrides, 'occ.rent_growth', year)
                   ?? rentGrowth;

      const marketRent = this.computeMarketRent(ctx, year, mode, baseRent, rg);
      const effRent    = this.getOverride(overrides, 'occ.effective_rent', year)
                      ?? r2(marketRent * (1 - ltl));

      const degraded = (ctx.deal_mode === 'REDEVELOPMENT' && ctx.capex_schedule == null);

      rows.push({
        year,
        physical_occupancy: r4(clamp01(physOcc)),
        loss_to_lease:      r4(clampLTL(ltl)),
        rent_growth:        r4(rg),
        effective_rent:     effRent,
        market_rent:        r2(marketRent),
        mode,
        transition_badge:   badge,
        source:             this.anchorSource(ctx),
        degraded,
        degraded_reason:    degraded ? 'M22_MISSING_CAPEX_SCHEDULE' : null,
      });
    }

    return rows;
  }

  buildConcessionsBlock(ctx: ProjectionsDealContext, holdYears: number): ConcessionsRow[] {
    const concEnv  = ctx.traffic.concession_environment;
    const overrides = ctx.user_overrides ?? {};
    const rows: ConcessionsRow[] = [];

    for (let year = 1; year <= holdYears; year++) {
      const mode  = this.resolveMode(ctx, year);
      const badge = this.transitionBadge(ctx, year);

      const envRow: PerYearConcessionEnv | undefined =
        concEnv?.per_year?.find(r => r.year === year);

      // REDEVELOPMENT: prefer untouched_free_months for pre-reno retention concession
      const freeMonths = (() => {
        const ov = this.getOverride(overrides, 'conc.free_months', year);
        if (ov !== null) return ov;
        if (envRow) {
          // Use renovation-specific fields when available
          if (mode === 'REDEVELOPMENT') {
            return envRow.untouched_free_months ?? envRow.free_months;
          }
          return envRow.free_months;
        }
        return this.defaultFreeMonths(mode);
      })();

      const concPct   = this.getOverride(overrides, 'conc.concession_pct', year)
                     ?? envRow?.concession_pct
                     ?? r4(freeMonths / 12);

      rows.push({
        year,
        free_months:              r4(Math.max(0, freeMonths)),
        concession_pct:           r4(Math.max(0, concPct)),
        supply_pressure_modifier: r4(envRow?.supply_pressure_modifier ?? 1.0),
        confidence:               envRow?.confidence ?? 'LOW',
        source_blend:             envRow?.source_blend ?? DEFAULT_SOURCE_BLEND,
        mode,
        transition_badge: badge,
      });
    }

    return rows;
  }

  buildEffectiveRentRow(
    ctx: ProjectionsDealContext,
    year: number,
    marketRentOverride?: number,
  ): { year: number; market_rent: number; effective_rent: number; loss_to_lease: number } {
    const mode    = this.resolveMode(ctx, year);
    const base    = marketRentOverride ?? this.resolveBaseMarketRent(ctx);
    const rg      = this.resolveRentGrowth(ctx);
    const mr      = this.computeMarketRent(ctx, year, mode, base, rg);
    const physOcc = this.computePhysOcc(ctx, year, mode);
    const ltl     = this.computeLTL(ctx, year, mode, physOcc);
    return {
      year,
      market_rent:    r2(mr),
      effective_rent: r2(mr * (1 - ltl)),
      loss_to_lease:  r4(ltl),
    };
  }

  /**
   * Dependency-graph-driven cheap-path override.
   *
   * Applies the override to exactly one cell, then walks OVERRIDE_DOWNSTREAM
   * to recompute only the affected downstream fields in the same year.
   * Does NOT rebuild the full block — all other years are untouched.
   *
   * LTL recompute for LEASE_UP mode uses the overridden physOcc value so
   * the declared dependency occ.physical_occupancy → occ.loss_to_lease is
   * faithfully honored.
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
      logger.warn('[M07→M09] recomputeRowOnOverride: invalid year', { overrideKey, year });
      return current;
    }

    const blockField = `${block}.${field}`;
    const downstream = OVERRIDE_DOWNSTREAM[blockField] ?? [];

    const occRows  = [...current.occupancy_leasing];
    const concRows = [...current.concessions];

    if (block === 'occ') {
      const row = { ...occRows[year - 1] };

      // 1. Apply override to the target field
      if (field === 'physical_occupancy') {
        row.physical_occupancy = r4(clamp01(overrideValue));
      } else if (field === 'loss_to_lease') {
        row.loss_to_lease = r4(clampLTL(overrideValue));
      } else if (field === 'rent_growth') {
        row.rent_growth = r4(overrideValue);
        // Recompute market_rent for this year from the new growth rate
        const base = this.resolveBaseMarketRent(ctx);
        row.market_rent = r2(this.computeMarketRent(ctx, year, row.mode, base, overrideValue));
      } else if (field === 'effective_rent') {
        row.effective_rent = r2(overrideValue);
      }

      // 2. Recompute downstream fields declared in the graph
      //    occ.physical_occupancy → occ.loss_to_lease: honor physOcc-aware LTL
      if (downstream.includes('occ.loss_to_lease')) {
        // Pass the (possibly overridden) physOcc so LEASE_UP LTL interpolation is correct
        row.loss_to_lease = r4(clampLTL(
          this.computeLTL(ctx, year, row.mode, row.physical_occupancy),
        ));
      }

      //    occ.loss_to_lease → occ.effective_rent (or occ.rent_growth → effective_rent)
      if (downstream.includes('occ.effective_rent') && row.market_rent != null) {
        row.effective_rent = r2(row.market_rent * (1 - row.loss_to_lease));
      }

      occRows[year - 1] = row;

    } else if (block === 'conc') {
      const row = { ...concRows[year - 1] };

      if (field === 'free_months') {
        row.free_months = r4(Math.max(0, overrideValue));
      } else if (field === 'concession_pct') {
        row.concession_pct = r4(Math.max(0, overrideValue));
      }

      // conc.free_months → conc.concession_pct
      if (downstream.includes('conc.concession_pct') && field !== 'concession_pct') {
        row.concession_pct = r4(Math.max(0, row.free_months / 12));
      }

      concRows[year - 1] = row;
    }

    const updated: ProjectionsOutput = { ...current, occupancy_leasing: occRows, concessions: concRows };
    assertProjectionsInvariants(updated);

    logger.debug('[M07→M09] recomputeRowOnOverride applied', {
      dealId: ctx.deal_id, overrideKey, overrideValue, downstream,
    });

    return updated;
  }

  // ── Mode resolution ─────────────────────────────────────────────────────

  /**
   * Normalize deal_mode from context.  Handles null/undefined by auto-resolving
   * from starting_state.mode.  Unrecognized strings default to STABILIZED.
   */
  normalizeMode(ctx: ProjectionsDealContext): 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT' {
    const dm = ctx.deal_mode;
    if (dm === 'STABILIZED' || dm === 'LEASE_UP' || dm === 'REDEVELOPMENT') return dm;
    // Auto-resolve from starting_state when deal_mode is absent or unrecognized
    const ssMode = ctx.traffic.starting_state?.mode;
    if (ssMode === 'STABILIZED' || ssMode === 'LEASE_UP' || ssMode === 'REDEVELOPMENT') return ssMode;
    return 'STABILIZED';
  }

  private modeAutoResolvedFrom(ctx: ProjectionsDealContext): string | null {
    const dm = ctx.deal_mode;
    if (dm === 'STABILIZED' || dm === 'LEASE_UP' || dm === 'REDEVELOPMENT') return null;
    const resolved = this.normalizeMode(ctx);
    return `auto:${resolved}(from_starting_state)`;
  }

  /**
   * Per-year effective mode: handles LEASE_UP → STABILIZED and
   * REDEVELOPMENT → STABILIZED transitions.
   * Assumes ctx.deal_mode is already normalized.
   */
  resolveMode(
    ctx: ProjectionsDealContext,
    year: number,
  ): 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT' {
    const dm = ctx.deal_mode as 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT';

    if (dm === 'STABILIZED') return 'STABILIZED';

    if (dm === 'LEASE_UP') {
      const transitionMonth = ctx.capex_schedule?.transition_month ?? 24;
      if (transitionMonth < (year - 1) * 12 + 1) return 'STABILIZED';
      return 'LEASE_UP';
    }

    if (dm === 'REDEVELOPMENT') {
      const lastMonth = this.lastRedevStabMonth(ctx);
      if ((year - 1) * 12 + 1 > lastMonth) return 'STABILIZED';
      return 'REDEVELOPMENT';
    }

    return 'STABILIZED';
  }

  private transitionBadge(
    ctx: ProjectionsDealContext,
    year: number,
  ): 'LU→S' | 'R→S' | undefined {
    const dm = ctx.deal_mode as 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT' | null | undefined;

    if (dm === 'LEASE_UP') {
      const tm = ctx.capex_schedule?.transition_month ?? 24;
      const ys = (year - 1) * 12 + 1;
      const ye = year * 12;
      if (tm >= ys && tm < ye) return 'LU→S';
    }

    if (dm === 'REDEVELOPMENT') {
      const last = this.lastRedevStabMonth(ctx);
      const ys   = (year - 1) * 12 + 1;
      const ye   = year * 12;
      if (last >= ys && last < ye) return 'R→S';
    }

    return undefined;
  }

  /** Last month at which all REDEVELOPMENT phases are fully stabilized. */
  private lastRedevStabMonth(ctx: ProjectionsDealContext): number {
    // capex_schedule phases take precedence over starting_state phases
    const capexPhases = ctx.capex_schedule?.phases ?? [];
    const ssPhases: RedevelopmentPhase[] = (() => {
      const ss = ctx.traffic.starting_state;
      return ss?.mode === 'REDEVELOPMENT' ? ss.phases : [];
    })();

    const phases = capexPhases.length > 0 ? capexPhases : ssPhases;
    if (phases.length === 0) return 36;

    return Math.max(
      ...phases.map(p => {
        const co = (p as { co_months_out?: number; co_date_months_out?: number }).co_months_out
                ?? (p as { co_date_months_out?: number }).co_date_months_out
                ?? 12;
        const lu = (p as { lease_up_months?: number; mini_lease_up_months?: number }).lease_up_months
                ?? (p as { mini_lease_up_months?: number }).mini_lease_up_months
                ?? 18;
        return co + lu;
      }),
    );
  }

  // ── Physical occupancy ──────────────────────────────────────────────────

  computePhysOcc(
    ctx: ProjectionsDealContext,
    year: number,
    mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT',
  ): number {
    if (mode === 'STABILIZED')    return this.physOccStabilized(ctx, year);
    if (mode === 'LEASE_UP')      return this.physOccLeaseUp(ctx, year);
    return this.physOccRedevelopment(ctx, year);
  }

  private physOccStabilized(ctx: ProjectionsDealContext, year: number): number {
    const ss      = ctx.traffic.starting_state;
    const subject = ctx.traffic.subject_history;
    const target  = this.resolveStabilizedTargetOcc(ctx);

    // Y1 anchor: subject S1 occ_rate → starting_state → default
    const y1: number = (() => {
      const sOcc = subject?.current_state?.occupancy_rate;
      if (typeof sOcc === 'number') return sOcc;
      if (ss?.mode === 'STABILIZED') return ss.current_occupancy;
      if (ss?.mode === 'REDEVELOPMENT') return ss.overall_occupancy;
      return 0.92;
    })();

    if (year === 1) return y1;

    // YN: mean-reversion toward calibrated target
    let occ = y1;
    for (let y = 2; y <= year; y++) {
      occ = occ + (target - occ) * OCC_REVERSION_SPEED;
    }
    return occ;
  }

  /**
   * LEASE_UP occupancy via spec §3 absorption_curve anchor:
   *   Y(n) = absorption_curve[n * 12]   (0-indexed)
   *   Past curve end → target_occupancy (fully stabilized)
   */
  private physOccLeaseUp(ctx: ProjectionsDealContext, year: number): number {
    const ss = ctx.traffic.starting_state;
    if (ss?.mode !== 'LEASE_UP') {
      // Degraded: no LeaseUpState — fall back to stabilized model
      return this.physOccStabilized(ctx, year);
    }

    const curve      = ss.absorption_curve;
    const target     = ss.target_occupancy;
    const curveIndex = year * 12;  // spec §3: Y1 = curve[12], Y2 = curve[24], …

    if (curveIndex >= curve.length) return target;

    return Math.min(target, Math.max(ss.start_occupancy, curve[curveIndex]));
  }

  /**
   * REDEVELOPMENT occupancy: true phase-aware blending.
   *
   * For each phase from M22 capex_schedule (or starting_state.phases):
   *   pre-CO:     offline  → occ = 0
   *   in lease-up: linear ramp from phase.start_occupancy → phase.target_occupancy
   *   stabilized: phase.target_occupancy
   *
   * When M22 capex_schedule is absent: conservative occ = overall_occupancy
   * (no dilution applied) + degraded flag set on output.
   */
  private physOccRedevelopment(ctx: ProjectionsDealContext, year: number): number {
    const ss = ctx.traffic.starting_state;

    if (ctx.capex_schedule == null) {
      // No M22 — conservative: use overall_occupancy without dilution
      logger.warn('[M07→M09] REDEVELOPMENT without capex_schedule — degraded path', {
        dealId: ctx.deal_id,
      });
      if (ss?.mode === 'REDEVELOPMENT') return ss.overall_occupancy;
      if (ss?.mode === 'STABILIZED')    return ss.current_occupancy;
      return 0.90;
    }

    // Prefer M22 capex_schedule phases; fall back to starting_state phases
    const capexPhases = ctx.capex_schedule.phases ?? [];
    const ssPhases: RedevelopmentPhase[] = ss?.mode === 'REDEVELOPMENT' ? ss.phases : [];
    const phases = capexPhases.length > 0 ? capexPhases : ssPhases;

    if (phases.length === 0) {
      // No phase data: use simple dilution model
      const overallOcc = ss?.mode === 'REDEVELOPMENT' ? ss.overall_occupancy : 0.90;
      const renovPct   = ctx.capex_schedule.renovation_pct ?? 0;
      const dilution   = Math.max(0, renovPct * (1 - (year - 1) / 4));
      return clamp01(overallOcc * (1 - dilution));
    }

    // Phase-weighted blended occupancy
    const yearEndMonth = year * 12;
    let weightedOcc = 0;
    let totalUnits  = 0;

    for (const phase of phases) {
      const units   = (phase as { units_count?: number; units?: number }).units_count
                   ?? (phase as { units?: number }).units
                   ?? 0;
      const coMonth = (phase as { co_date_months_out?: number; co_months_out?: number }).co_date_months_out
                   ?? (phase as { co_months_out?: number }).co_months_out
                   ?? 12;
      const luMonths = (phase as { mini_lease_up_months?: number; lease_up_months?: number }).mini_lease_up_months
                    ?? (phase as { lease_up_months?: number }).lease_up_months
                    ?? 18;
      const startOcc  = (phase as { start_occupancy?: number }).start_occupancy ?? 0;
      const targetOcc = (phase as { target_occupancy?: number }).target_occupancy ?? 0.93;

      let phaseOcc: number;
      if (yearEndMonth < coMonth) {
        phaseOcc = 0;  // still under renovation
      } else if (yearEndMonth < coMonth + luMonths) {
        const monthsIntoLU = yearEndMonth - coMonth;
        const fraction     = Math.min(1, monthsIntoLU / luMonths);
        phaseOcc = startOcc + fraction * (targetOcc - startOcc);
      } else {
        phaseOcc = targetOcc;  // fully stabilized
      }

      weightedOcc += phaseOcc * units;
      totalUnits  += units;
    }

    return totalUnits > 0 ? clamp01(weightedOcc / totalUnits) : 0;
  }

  // ── Loss-to-Lease ───────────────────────────────────────────────────────

  /**
   * Compute LTL for a given year and mode.
   *
   * @param physOccOverride  When physOcc was overridden, pass the new value so
   *                         LEASE_UP mode can interpolate LTL correctly along
   *                         the occupancy-progress axis.  This ensures the
   *                         declared dependency occ.physical_occupancy →
   *                         occ.loss_to_lease is faithfully honored.
   */
  computeLTL(
    ctx: ProjectionsDealContext,
    year: number,
    mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT',
    physOccOverride?: number,
  ): number {
    const subject = ctx.traffic.subject_history;

    // Y1 anchor: subject S1 LTL → observed_dynamics S2+ LTL → baseline
    const y1LTL: number = (() => {
      const sLTL = subject?.current_state?.loss_to_lease;
      if (typeof sLTL === 'number') return sLTL;
      return BASELINE_LOSS_TO_LEASE;
    })();

    // Longitudinal LTL floor from S2+ observed dynamics
    const ltlFloor: number = (() => {
      const oDyn = subject?.observed_dynamics?.loss_to_lease;
      if (typeof oDyn === 'number') return Math.max(0, oDyn);
      return BASELINE_LOSS_TO_LEASE;
    })();

    if (mode === 'STABILIZED') {
      if (year === 1) return clampLTL(y1LTL);
      let ltl = y1LTL;
      for (let y = 2; y <= year; y++) {
        ltl = ltl + (ltlFloor - ltl) * LTL_COMPRESSION;
      }
      return clampLTL(ltl);
    }

    if (mode === 'LEASE_UP') {
      const ss = ctx.traffic.starting_state;
      const luSS: LeaseUpState | null = ss?.mode === 'LEASE_UP' ? ss : null;

      const startOcc  = luSS?.start_occupancy  ?? 0;
      const targetOcc = luSS?.target_occupancy  ?? 0.93;

      // Use physOccOverride if provided (honors the physOcc → LTL dependency)
      const currentOcc = physOccOverride ?? this.computePhysOcc(ctx, year, mode);

      // LTL interpolates from y1LTL at start_occupancy down to ltlFloor at target_occupancy
      // as occupancy ramps up — physOcc-aware model
      const occupancyRange    = Math.max(0.01, targetOcc - startOcc);
      const occupancyProgress = Math.min(1, Math.max(0, (currentOcc - startOcc) / occupancyRange));
      return clampLTL(y1LTL + (ltlFloor - y1LTL) * occupancyProgress);
    }

    if (mode === 'REDEVELOPMENT') {
      // Bifurcated: unrenovated cohort = y1LTL; renovated cohort = y1LTL − uplift
      const renovPct = ctx.capex_schedule?.renovation_pct ?? 0;
      const uplift   = ctx.capex_schedule?.post_reno_rent_uplift ?? 0;
      const renovLTL = Math.max(0, y1LTL - uplift);
      return clampLTL(y1LTL * (1 - renovPct) + renovLTL * renovPct);
    }

    return BASELINE_LOSS_TO_LEASE;
  }

  // ── Market rent ─────────────────────────────────────────────────────────

  /**
   * Compute annual market_rent for a given year.
   *
   * REDEVELOPMENT: applies bifurcated rent growth — renovated cohort carries
   * post_reno_rent_uplift on top of compound growth; blended by unit weight.
   */
  private computeMarketRent(
    ctx: ProjectionsDealContext,
    year: number,
    mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT',
    baseRent: number,
    rentGrowth: number,
  ): number {
    const growthMult = Math.pow(1 + rentGrowth, year - 1);

    if (mode !== 'REDEVELOPMENT' || ctx.capex_schedule == null) {
      return baseRent * growthMult;
    }

    // Bifurcated rent growth for REDEVELOPMENT
    const uplift      = ctx.capex_schedule.post_reno_rent_uplift ?? 0;
    const yearEndMonth = year * 12;
    const capexPhases  = ctx.capex_schedule.phases ?? [];
    const ssPhases: RedevelopmentPhase[] = (() => {
      const ss = ctx.traffic.starting_state;
      return ss?.mode === 'REDEVELOPMENT' ? ss.phases : [];
    })();
    const phases = capexPhases.length > 0 ? capexPhases : ssPhases;

    if (phases.length === 0) {
      // No phase detail — simple uplift on fraction of units
      const renovPct = ctx.capex_schedule.renovation_pct ?? 0;
      const renovRent = baseRent * (1 + uplift) * growthMult;
      const unrenRent = baseRent * growthMult;
      return renovPct * renovRent + (1 - renovPct) * unrenRent;
    }

    let renovatedUnits = 0;
    let unrenovatedUnits = 0;
    for (const phase of phases) {
      const units   = (phase as { units_count?: number; units?: number }).units_count
                   ?? (phase as { units?: number }).units ?? 0;
      const coMonth = (phase as { co_date_months_out?: number; co_months_out?: number }).co_date_months_out
                   ?? (phase as { co_months_out?: number }).co_months_out ?? 12;
      if (yearEndMonth >= coMonth) {
        renovatedUnits    += units;
      } else {
        unrenovatedUnits  += units;
      }
    }
    const totalUnits = renovatedUnits + unrenovatedUnits;
    if (totalUnits === 0) return baseRent * growthMult;

    const renovRent = baseRent * (1 + uplift) * growthMult;
    const unrenRent = baseRent * growthMult;
    return (renovatedUnits * renovRent + unrenovatedUnits * unrenRent) / totalUnits;
  }

  // ── M07-calibrated value resolution ────────────────────────────────────

  /**
   * Market rent base per unit.
   *   Priority: subject_history.current_state.avg_market_rent (M07 S1 observed)
   *           → traffic.market_rent_per_unit (deal context)
   *           → BASELINE_MARKET_RENT
   */
  private resolveBaseMarketRent(ctx: ProjectionsDealContext): number {
    const subjectRent = ctx.traffic.subject_history?.current_state?.avg_market_rent;
    if (typeof subjectRent === 'number' && subjectRent > 0) return subjectRent;
    if (typeof ctx.traffic.market_rent_per_unit === 'number' && ctx.traffic.market_rent_per_unit > 0) {
      return ctx.traffic.market_rent_per_unit;
    }
    return BASELINE_MARKET_RENT;
  }

  /**
   * Annual rent growth rate.
   *   Priority: traffic.market_rent_growth (M05 submarket posterior)
   *           → observed_dynamics.new_lease_trade_out_pct (M07 S2+ longitudinal)
   *           → BASELINE_RENT_GROWTH
   */
  private resolveRentGrowth(ctx: ProjectionsDealContext): number {
    if (typeof ctx.traffic.market_rent_growth === 'number') return ctx.traffic.market_rent_growth;
    const tradeOut = ctx.traffic.subject_history?.observed_dynamics?.new_lease_trade_out_pct;
    if (typeof tradeOut === 'number') return Math.max(0, tradeOut);
    return BASELINE_RENT_GROWTH;
  }

  /**
   * Stabilized target occupancy.
   *   Priority: LeaseUpState.target_occupancy (already calibrated by platform)
   *           → observed_dynamics.renewal_rate proxy
   *             (high renewal → high stabilized occ; model: 0.90 + rate × 0.07, cap 0.97)
   *           → STABILIZED_TARGET_OCC (0.95)
   */
  private resolveStabilizedTargetOcc(ctx: ProjectionsDealContext): number {
    const ss = ctx.traffic.starting_state;
    if (ss?.mode === 'LEASE_UP') return ss.target_occupancy;
    const renewalRate = ctx.traffic.subject_history?.observed_dynamics?.renewal_rate;
    if (typeof renewalRate === 'number') {
      return Math.min(0.97, 0.90 + renewalRate * 0.07);
    }
    return STABILIZED_TARGET_OCC;
  }

  // ── Concession defaults ─────────────────────────────────────────────────

  private defaultFreeMonths(mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT'): number {
    switch (mode) {
      case 'LEASE_UP':      return 1.5;
      case 'REDEVELOPMENT': return 1.0;
      default:              return 0.5;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private getOverride(overrides: Record<string, number>, blockField: string, year: number): number | null {
    const val = overrides[`${blockField}.${year}`];
    return typeof val === 'number' && isFinite(val) ? val : null;
  }

  private anchorSource(ctx: ProjectionsDealContext): string {
    const tier = ctx.traffic.subject_history?.tier;
    if (tier) return `subject_history:${tier.toLowerCase()}`;
    if (ctx.traffic.starting_state) return 'platform';
    return 'baseline';
  }

  private detectDegradation(
    ctx: ProjectionsDealContext,
    mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT',
  ): string | null {
    if (!ctx.traffic.starting_state) return 'NO_STARTING_STATE';
    if (mode === 'REDEVELOPMENT' && ctx.capex_schedule == null) {
      return 'M22_MISSING_CAPEX_SCHEDULE';
    }
    return null;
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function r4(n: number): number { return Math.round(n * 10000) / 10000; }
function r2(n: number): number { return Math.round(n * 100) / 100; }
function clamp01(n: number): number { return Math.min(1, Math.max(0, n)); }
function clampLTL(n: number): number { return Math.min(0.30, Math.max(0, n)); }

const DEFAULT_SOURCE_BLEND = {
  class_default_weight: 1.0,
  submarket_weight:     0.0,
  subject_weight:       0.0,
};

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
        dataFlowRouter: { publishModuleData: (m: string, id: string, d: Record<string, unknown>) => void };
      };
      dataFlowRouter.publishModuleData('M09', dealId, {
        projections:             output,
        projections_computed_at: output.computed_at,
      });
    } catch (routerErr: unknown) {
      logger.debug('[M07→M09] DataFlowRouter publish skipped', {
        error: routerErr instanceof Error ? routerErr.message : String(routerErr),
      });
    }

    logger.info('[M07→M09] Projections built', {
      dealId,
      holdYears:        output.hold_years,
      dealMode:         output.deal_mode,
      anchorSource:     output.anchor_source,
      degradedReason:   output.degraded_reason,
      modeAutoResolved: output.mode_auto_resolved,
    });

    return output;
  } catch (err: unknown) {
    logger.error('[M07→M09] Build failed', {
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
