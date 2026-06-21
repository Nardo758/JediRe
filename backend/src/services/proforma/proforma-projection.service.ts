/**
 * Pro Forma Projection Orchestrator (Tier 1 + 2 + 3 integration)
 * ==============================================================
 *
 * Composes the layered-growth helpers (Tier 1), the Tier 2 audit /
 * provenance scaffolding, and the Tier 3 refinement helpers into a single
 * pure function that produces a year-by-year revenue + OPEX + NOI growth
 * projection.
 *
 * This is the runtime entry point referenced by the spec — it consumes
 * everything Tier 1-3 ships and demonstrates the full composition:
 *
 *   • computeLayeredRentGrowth (Tier 1)
 *   • computeOpexLineGrowth + computeManagementFeeGrowth (Tier 1)
 *   • positionContributionForYear (Tier 3 §10) → injected into rent growth
 *   • applyTemplateGrowthTuning (Tier 3 §15) → wraps rent + OPEX growth
 *     so BTS Y3+ truncation and Flip Y1+ truncation are enforced
 *   • computeSimpleRevenue / computeMarkToMarketRevenue /
 *     computeRenewalAwareRevenue (Tier 3 §11) — dispatched from
 *     `revenueFormula` payload field
 *   • OPEX_LINE_ITEMS.cycleDriver (Tier 3 §14) — surfaced in the result
 *     so callers / dashboards can show which external indicator drives
 *     each line
 *   • noiGrowthIdentity (Tier 1) — emitted per year for the F9 collision
 *     view
 *
 * Pure module — no DB, no I/O. Designed for unit + integration testing.
 */

import { ProvenancedValue, provenanced } from '../../types/provenanced-value';
import {
  computeLayeredRentGrowth,
  type RentGrowthInputs,
} from './layered-growth/rent-growth';
import {
  computeOpexLineGrowth,
  computeManagementFeeGrowth,
  noiGrowthIdentity,
  OPEX_LINE_KEYS,
  DEFAULT_LINE_SHARES,
  type OpexLineInputs,
  type LayeredOpexLineResult,
} from './layered-growth/opex-growth';
import {
  positionContributionForYear,
  type PositionAdjustmentSpec,
} from './layered-growth/position-adjustment';
import {
  computeSimpleRevenue,
  computeMarkToMarketRevenue,
  computeRenewalAwareRevenue,
  lookupRenewalRateBaseline,
  type CommonRevenueInputs,
  type MarkToMarketInputs,
  type RenewalAwareInputs,
  type MarketType,
} from './revenue/revenue-formulas';
import {
  applyTemplateGrowthTuning,
  resolveSeasonalOccupancyFactor,
  OPEX_LINE_ITEMS,
  type ProFormaTemplateId,
  type RevenueFormulaId,
  type OpexLineKey,
} from './blueprint/proforma-blueprint';

// ────────────────────────────────────────────────────────────────────────────
// Inputs
// ────────────────────────────────────────────────────────────────────────────

export interface ProjectionInputs {
  templateId: ProFormaTemplateId;
  revenueFormula: RevenueFormulaId;
  horizonYears: number;

  /** Optional position adjustment spec — when present, the per-year delta
   *  is added to `RentGrowthInputs.position` for each year. */
  positionSpec?: PositionAdjustmentSpec;

  /** Base inputs for layered rent growth — `year` and `position` are
   *  filled in per year by the orchestrator. */
  rentGrowthBase: Omit<RentGrowthInputs, 'year' | 'position'>;

  /** Per-line OPEX inputs (without `year` — orchestrator stamps it). */
  opexBase: Partial<Record<OpexLineKey, Omit<OpexLineInputs, 'year' | 'line'>>>;

  /** Revenue formula parameters. Only the fields required by the chosen
   *  formula are read. */
  revenueParams: {
    units: number;
    inPlaceRent: number;
    /** Year-1 market rent. The orchestrator trends this each year using
     *  the layered rent growth. */
    marketRentYear1: number;
    /** Mark-to-market only — annual escalator on in-place leases. */
    escalator?: number;
    /** Mark-to-market / renewal-aware — renewal rate (decimal, 0-1).
     *  When omitted, the orchestrator falls back to
     *  `lookupRenewalRateBaseline(assetClass, marketType)` (Tier 3 §11). */
    renewalRate?: number;
    /** Renewal-aware only — renewal-specific growth (decimal). */
    renewalGrowth?: number;
    /** Market context used to resolve the renewal-rate baseline when
     *  `renewalRate` is not supplied. Defaults to 'suburban' for the
     *  asset class. */
    marketType?: MarketType;
  };

  /** Dollar share by OPEX line. Sums need not equal 1 — normalised internally.
   *  When omitted, falls back to DEFAULT_LINE_SHARES (FL-calibrated national
   *  averages). Pass state-specific shares when available. */
  lineShares?: Partial<Record<OpexLineKey, number>>;

  /** NOI margin (year-1) used in the noiGrowthIdentity emission. */
  noiMargin: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Outputs
// ────────────────────────────────────────────────────────────────────────────

export interface OpexLineYearResult {
  line: OpexLineKey;
  /** Tuned growth (post template-truncation). */
  growthTuned: number;
  /** Raw growth from the layered-growth engine, pre template tuning. */
  growthRaw: number;
  /**
   * The structured cycle driver attached to this line in the blueprint
   * (Tier 3 §14). Surfaced verbatim so callers can render which BLS /
   * platform indicator drives the cycle component.
   */
  cycleDriver: typeof OPEX_LINE_ITEMS[number]['cycleDriver'];
}

export interface ProjectionYearResult {
  year: number;
  /** Effective rent growth after position contribution + template tuning. */
  rentGrowth: ProvenancedValue<number>;
  /** Per-year position contribution (Tier 3 §10). 0 when no spec supplied. */
  positionContribution: number;
  /** OPEX growth per line (tuned). */
  opex: OpexLineYearResult[];
  /** Year-t market rent after trending by the resolved growth path. */
  marketRentT: number;
  /** Revenue computed via the selected formula (Tier 3 §11). */
  revenue: ProvenancedValue<number>;
  /**
   * Algebraic NOI growth identity (Tier 1) — derived from the year's
   * resolved rent growth and the opex-share-weighted opex growth. Returned
   * as a ProvenancedValue so the cross-check carries through provenance and
   * `missing()` semantics when inputs are unavailable.
   */
  noiGrowthCheck: ProvenancedValue<number>;
  /**
   * Renewal rate actually used for the year's revenue computation. When
   * `revenueParams.renewalRate` is unset, this is the asset-class × market
   * baseline from `lookupRenewalRateBaseline()` (Tier 3 §11) — surfaced so
   * the F9 collision view can show "renewal rate from baseline" provenance.
   * Null when the formula doesn't consume a renewal rate (in_place_compounding).
   */
  renewalRateUsed: number | null;
  /**
   * Monthly seasonal-occupancy breakdown for STR templates only (Tier 3 §15).
   * Each entry is `{ month: 1-12, factor, revenueShare }` where `factor` is
   * the multiplier from `STRATEGY_TEMPLATE_TUNING.str_shortterm.seasonalOccupancyFactors`
   * and `revenueShare` is the seasonally-adjusted slice of the year's revenue
   * (sum of revenueShare ≈ revenue.value when factors average to 1.0).
   * Empty for non-STR templates.
   */
  seasonalMonthly: Array<{ month: number; factor: number; revenueShare: number }>;
}

// ────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ────────────────────────────────────────────────────────────────────────────

export function projectProforma(inputs: ProjectionInputs): ProjectionYearResult[] {
  const out: ProjectionYearResult[] = [];

  // Lookup table for cycle drivers, keyed by line.
  const cycleDriverByLine = Object.fromEntries(
    OPEX_LINE_ITEMS.map((l) => [l.key, l.cycleDriver]),
  ) as Record<OpexLineKey, typeof OPEX_LINE_ITEMS[number]['cycleDriver']>;

  let marketRentT = inputs.revenueParams.marketRentYear1;

  for (let year = 1; year <= inputs.horizonYears; year++) {
    // ── 1. RENT GROWTH (Tier 1 + Tier 3 position + Tier 3 template tuning)
    const positionPV = inputs.positionSpec
      ? positionContributionForYear(inputs.positionSpec, year)
      : null;

    const rgResult = computeLayeredRentGrowth({
      ...inputs.rentGrowthBase,
      year,
      position: positionPV,
    });

    const rawRentGrowth = rgResult.growth.value ?? 0;
    const tunedRentGrowth = applyTemplateGrowthTuning(
      inputs.templateId,
      year,
      rawRentGrowth,
    );

    const rentGrowthPV: ProvenancedValue<number> = {
      ...rgResult.growth,
      value: tunedRentGrowth,
      rationale:
        tunedRentGrowth === rawRentGrowth
          ? rgResult.growth.rationale ?? null
          : `template-tuned (${inputs.templateId} Y${year}): ${rawRentGrowth.toFixed(4)} → ${tunedRentGrowth.toFixed(4)}`,
    };

    // ── 2. OPEX (Tier 1 + Tier 3 cycle drivers + Tier 3 template tuning)
    const opexResults: OpexLineYearResult[] = [];
    let dollarWeightedOpexGrowth = 0;
    let totalOpexShare = 0;
    let opexConfidenceMin = 1;
    let opexHasAnySignal = false;

    for (const lineKey of OPEX_LINE_KEYS) {
      const baseInputs = inputs.opexBase[lineKey];
      let lineRes: LayeredOpexLineResult;

      if (lineKey === 'managementFee') {
        // Mgmt fee auto-couples to revenue growth (Tier 1 helper).
        lineRes = computeManagementFeeGrowth(year, rentGrowthPV);
      } else if (baseInputs) {
        lineRes = computeOpexLineGrowth({
          ...baseInputs,
          line: lineKey,
          year,
        });
      } else {
        // No inputs supplied for this line — emit a zero-growth row so the
        // result remains exhaustive over OPEX_LINE_KEYS.
        lineRes = {
          line: lineKey,
          year,
          growth: provenanced(0, 'platform', 0.5, 'derived', 'no inputs supplied'),
          contributions: { momentum: 0, cycle: 0, anchor: 0, eventDeltas: 0, structuralOverride: 0 },
          weights: { momentum: 0, cycle: 0, anchor: 1 },
          ceilingApplied: false,
        };
      }

      const rawOpexG = lineRes.growth.value ?? 0;
      const tunedOpexG = applyTemplateGrowthTuning(
        inputs.templateId,
        year,
        rawOpexG,
      );

      // Share-weighted aggregation using inputs.lineShares (or DEFAULT_LINE_SHARES
      // fallback) so the NOI identity cross-check reflects each line's dollar
      // share of total OPEX. Pass state-specific shares when available.
      const shares = inputs.lineShares ?? DEFAULT_LINE_SHARES;
      const share = shares[lineKey] ?? 0;
      dollarWeightedOpexGrowth += tunedOpexG * share;
      totalOpexShare += share;

      // Track per-line confidence for the aggregate OPEX PV used in the
      // NOI identity cross-check. Lines with no signal default to a neutral
      // 0.5 confidence (already set in the synthetic row above).
      if (lineRes.growth.value !== null) {
        opexHasAnySignal = true;
        opexConfidenceMin = Math.min(opexConfidenceMin, lineRes.growth.confidence);
      }

      opexResults.push({
        line: lineKey,
        growthTuned: tunedOpexG,
        growthRaw: rawOpexG,
        cycleDriver: cycleDriverByLine[lineKey],
      });
    }

    const avgOpexGrowth = totalOpexShare > 0 ? dollarWeightedOpexGrowth : 0;
    const opexAggregatePV = provenanced(
      avgOpexGrowth,
      'platform',
      opexHasAnySignal ? opexConfidenceMin : 0.5,
      'derived',
      `equal-weighted average of ${OPEX_LINE_KEYS.length} tuned per-line OPEX growths`,
    );

    // ── 3. REVENUE (Tier 3 formula dispatcher)
    // Trend market rent year-over-year using the tuned rent growth so the
    // year-t value passed to the formula matches the contract.
    if (year > 1) marketRentT = marketRentT * (1 + tunedRentGrowth);

    const common: CommonRevenueInputs = {
      year,
      units: inputs.revenueParams.units,
      inPlaceRent: inputs.revenueParams.inPlaceRent,
      marketRent: marketRentT,
      marketGrowth: tunedRentGrowth,
    };

    // Revenue formula dispatcher — keys MUST be canonical RevenueFormulaId
    // values from the blueprint (mark_to_market / in_place_compounding /
    // renewal_aware / rent_ramp_value_add / gpr_minus_loss_to_lease). The
    // `in_place_compounding` formula is the legacy "year-1 in-place rent
    // compounded by rent_growth" path implemented by `computeSimpleRevenue`.
    // Formulas without a closed-form implementation here (rent_ramp_value_add
    // requires a month-by-month renovation schedule; gpr_minus_loss_to_lease
    // requires GPR + loss-to-lease %) fall back to in-place compounding so
    // callers always get a numeric projection — see follow-up #460 for full
    // formula coverage.
    // Asset-class × market-type baseline lookup — used as the contextual
    // default whenever the caller omits `renewalRate`. Spec §11 + §14.
    const marketType: MarketType = inputs.revenueParams.marketType ?? 'suburban';
    const baselineRenewalRate = lookupRenewalRateBaseline(
      inputs.rentGrowthBase.assetClass,
      marketType,
    );
    const resolvedRenewalRate =
      inputs.revenueParams.renewalRate ?? baselineRenewalRate;

    let revenue: ProvenancedValue<number>;
    let renewalRateUsed: number | null = null;
    switch (inputs.revenueFormula) {
      case 'mark_to_market': {
        renewalRateUsed = resolvedRenewalRate;
        const m: MarkToMarketInputs = {
          ...common,
          renewalRate: resolvedRenewalRate,
          escalator: inputs.revenueParams.escalator ?? 0.025,
        };
        revenue = computeMarkToMarketRevenue(m);
        break;
      }
      case 'renewal_aware': {
        renewalRateUsed = resolvedRenewalRate;
        const r: RenewalAwareInputs = {
          ...common,
          renewalRate: resolvedRenewalRate,
          renewalGrowth: inputs.revenueParams.renewalGrowth ?? 0.02,
        };
        revenue = computeRenewalAwareRevenue(r);
        break;
      }
      case 'in_place_compounding':
      case 'rent_ramp_value_add':
      case 'gpr_minus_loss_to_lease':
      default:
        revenue = computeSimpleRevenue(common);
    }

    // ── 3a. STR seasonal occupancy breakdown (Tier 3 §15)
    // For STR templates, decompose the year's revenue into 12 monthly
    // shares using the seasonal-occupancy multipliers. The breakdown is
    // empty for non-STR templates. Sum of `revenueShare` ≈ revenue.value
    // when factors average to 1.0 (which the sun-belt default does).
    const seasonalMonthly: Array<{ month: number; factor: number; revenueShare: number }> = [];
    if (inputs.templateId === 'str_shortterm' && (revenue.value ?? 0) > 0) {
      const monthlyShare = (revenue.value ?? 0) / 12;
      for (let m = 1; m <= 12; m++) {
        const factor = resolveSeasonalOccupancyFactor(inputs.templateId, m);
        seasonalMonthly.push({
          month: m,
          factor,
          revenueShare: monthlyShare * factor,
        });
      }
    }

    // ── 4. NOI growth identity (Tier 1 cross-check) — must receive
    //    ProvenancedValue<number> envelopes per the helper contract.
    const noiGrowthCheck = noiGrowthIdentity(
      rentGrowthPV,
      opexAggregatePV,
      inputs.noiMargin,
    );

    out.push({
      year,
      rentGrowth: rentGrowthPV,
      positionContribution: positionPV?.value ?? 0,
      opex: opexResults,
      marketRentT,
      revenue,
      noiGrowthCheck,
      renewalRateUsed,
      seasonalMonthly,
    });
  }

  return out;
}
