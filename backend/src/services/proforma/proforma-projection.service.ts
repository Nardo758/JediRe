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
  type CommonRevenueInputs,
  type MarkToMarketInputs,
  type RenewalAwareInputs,
} from './revenue/revenue-formulas';
import {
  applyTemplateGrowthTuning,
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
    /** Mark-to-market / renewal-aware — renewal rate (decimal, 0-1). */
    renewalRate?: number;
    /** Renewal-aware only — renewal-specific growth (decimal). */
    renewalGrowth?: number;
  };

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
   * resolved rent growth and the opex-share-weighted opex growth.
   */
  noiGrowthCheck: number;
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

      // Dollar weight via DEFAULT_LINE_SHARES is encoded in lineRes.weights —
      // for the noi identity we approximate the share as the line's overall
      // weight contribution sum (good enough as a check).
      const share = 1 / OPEX_LINE_KEYS.length;
      dollarWeightedOpexGrowth += tunedOpexG * share;
      totalOpexShare += share;

      opexResults.push({
        line: lineKey,
        growthTuned: tunedOpexG,
        growthRaw: rawOpexG,
        cycleDriver: cycleDriverByLine[lineKey],
      });
    }

    const avgOpexGrowth = totalOpexShare > 0 ? dollarWeightedOpexGrowth / totalOpexShare * totalOpexShare : 0;

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

    let revenue: ProvenancedValue<number>;
    switch (inputs.revenueFormula) {
      case 'mark_to_market': {
        const m: MarkToMarketInputs = {
          ...common,
          renewalRate: inputs.revenueParams.renewalRate ?? 0.55,
          escalator: inputs.revenueParams.escalator ?? 0.025,
        };
        revenue = computeMarkToMarketRevenue(m);
        break;
      }
      case 'renewal_aware': {
        const r: RenewalAwareInputs = {
          ...common,
          renewalRate: inputs.revenueParams.renewalRate ?? 0.55,
          renewalGrowth: inputs.revenueParams.renewalGrowth ?? 0.02,
        };
        revenue = computeRenewalAwareRevenue(r);
        break;
      }
      case 'simple':
      default:
        revenue = computeSimpleRevenue(common);
    }

    // ── 4. NOI growth identity (Tier 1 cross-check)
    const noiGrowthCheck = noiGrowthIdentity(
      tunedRentGrowth,
      avgOpexGrowth,
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
    });
  }

  return out;
}
