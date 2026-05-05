/**
 * Tax Service — Main Entry Point
 *
 * Single entry point for all tax forecast calculations.
 * Callers never import a ruleset directly; they call taxService.forecast().
 *
 * Usage:
 *   import { taxService } from '../tax/taxService';
 *   const forecast = taxService.forecast(ctx);
 *
 * The returned TaxForecast maps directly onto the taxes.reTax and
 * taxes.transferTax sections of DealFinancials — no shape changes needed
 * at the call site in proforma-adjustment.service.ts.
 *
 * Three-layer stack composition (per spec §7):
 *   federal  → Section C (depreciation lives, bonus dep, federal income tax brackets)
 *   state    → Section A (cap logic, doc stamps, transfer tax), Section B (TPP), Section D
 *   county   → Section A millage override; Miami-Dade adds county surtax
 *
 * When state is unmapped (no FL/GA/TX ruleset matches), TaxForecast.jurisdictionMapped
 * is false and confidence = 'low'. Callers (e.g. proforma-adjustment.service.ts) should
 * emit a `jurisdiction_unmapped` Kafka event so the Research Agent can queue onboarding.
 */

import { resolveRulesetStack } from './resolver';
import { federalRuleset, federalIncomeTaxRate, federalCostSegAvailablePct } from './rulesets/federal.ruleset';
import type { TaxContext, TaxForecast, ReTaxYear, SectionCForecast } from './types';

/**
 * Fixed year used as the default placed-in-service year when TaxContext omits it.
 * Must match the active federal rate sheet year (federal-2026.json) so that
 * identical inputs always produce byte-identical outputs (determinism requirement).
 */
const FEDERAL_RATE_SHEET_YEAR = 2026;

export { TaxContext, TaxForecast } from './types';

export const taxService = {
  /**
   * Produce a full tax forecast for a deal.
   *
   * Uses a three-layer stack { federal, state, county } for composition:
   *   - annualPropertyTax: county overlay millage when present, else state millage
   *   - transferTax: state handles doc stamps; county adds surtax (Miami-Dade)
   *   - TPP (Section B): always state
   *   - Income/depreciation (Section C): always federal
   *
   * @param ctx  All deal-level tax inputs. See TaxContext for field docs.
   * @returns    TaxForecast with jurisdictionMapped + confidence flags
   */
  forecast(ctx: TaxContext): TaxForecast {
    const stack = resolveRulesetStack(ctx.state, ctx.county);
    const { federal: _federal, state: stateRuleset, county: countyOverlay } = stack;
    const holdYears = ctx.holdYears;

    // Derive t12 millage from existing data (best-effort)
    const activeRuleset = countyOverlay ?? stateRuleset;
    const defaultMillage = activeRuleset.annualPropertyTax(ctx, 1, 0).millageRate;
    const t12MillageRate = ctx.millageRateOverride ?? defaultMillage;
    const t12AnnualTax = ctx.t12AnnualTax;
    const t12AssessedValue = t12AnnualTax != null && t12MillageRate > 0
      ? Math.round(t12AnnualTax / (t12MillageRate / 1000))
      : null;

    // Platform assessed value = purchase price (post-acquisition reassessment)
    const platformAssessedValue = ctx.assessedValueOverride ?? ctx.purchasePrice;

    // Build per-year schedule (minimum 10 years for grid completeness).
    // Uses county overlay when present (provides correct county millage);
    // otherwise uses state ruleset (handles SOH cap, annual growth, etc.).
    // Carryforward uses _rawAssessedValue (unrounded) when available to avoid
    // cumulative rounding drift in jurisdictions with annual assessment caps (FL SOH).
    const perYear: ReTaxYear[] = [];
    let prevAssessedValue = platformAssessedValue ?? 0;
    for (let yr = 1; yr <= Math.max(holdYears, 10); yr++) {
      const yearRecord = activeRuleset.annualPropertyTax(ctx, yr, prevAssessedValue);
      perYear.push(yearRecord);
      prevAssessedValue = yearRecord._rawAssessedValue ?? yearRecord.assessedValue;
    }

    const y1TaxAmt = perYear[0]?.taxAmount ?? null;
    const platformAnnualTax = y1TaxAmt;
    const deltaVsT12Pct = y1TaxAmt != null && t12AnnualTax != null && t12AnnualTax > 0
      ? (y1TaxAmt - t12AnnualTax) / t12AnnualTax
      : null;

    // ── Transfer taxes (acquisition) ──────────────────────────────────────────
    // State handles doc stamps and intangible tax.
    // County overlay adds surtax (Miami-Dade $0.45/$100 = $225K on $50M).
    const baseTransferTax = stateRuleset.acquisitionTransferTax(ctx);
    const countySurtaxAmount = countyOverlay
      ? countyOverlay.countySurtax(ctx.purchasePrice ?? 0)
      : null;
    const transferTax = {
      ...baseTransferTax,
      countySurtaxAmount,
      totalTransferTax:
        baseTransferTax.totalTransferTax != null && countySurtaxAmount != null
          ? baseTransferTax.totalTransferTax + countySurtaxAmount
          : baseTransferTax.totalTransferTax,
    };

    const isMiamiDade = transferTax.isMiamiDade;
    const sohCapPct = stateRuleset.annualAssessmentCap() ?? 0;

    const countyLabel: string | null = ctx.county ? `${ctx.county} County` : null;
    let assessmentGrowthPct = 0;
    if (perYear.length >= 2 && perYear[0].assessedValue > 0) {
      assessmentGrowthPct = (perYear[1].assessedValue - perYear[0].assessedValue) / perYear[0].assessedValue;
      if (!isFinite(assessmentGrowthPct) || assessmentGrowthPct < 0) assessmentGrowthPct = 0;
    }

    // ── Section C — Income Tax & Depreciation (always federal) ──────────────
    // Defaults must be deterministic (no runtime Date calls) so that identical
    // TaxContext inputs always produce byte-identical TaxForecast outputs.
    const propertyType   = ctx.propertyType   ?? 'multifamily';
    const entityType     = ctx.entityType     ?? 'pass_through';
    const placedInServiceYear = ctx.placedInServiceYear ?? FEDERAL_RATE_SHEET_YEAR;
    const landAllocationPct   = ctx.landAllocationPct   ?? 0.20;

    const depreciationLife  = federalRuleset.depreciationLife(propertyType);
    const depreciableBase   = ctx.purchasePrice != null
      ? Math.round(ctx.purchasePrice * (1 - landAllocationPct))
      : null;
    const annualDepreciation = depreciableBase != null
      ? Math.round(depreciableBase / depreciationLife)
      : null;
    const bonusDepreciationCurrentYearPct = federalRuleset.bonusDepreciationPct(placedInServiceYear);
    const costSegAvailablePct = federalRuleset.costSegEligible(propertyType)
      ? federalCostSegAvailablePct()
      : 0;
    const fedRate   = federalIncomeTaxRate(entityType);
    // State income tax rate: from the state ruleset (0 for TX, 5.5% FL c_corp, 5.39% GA all)
    const stateRate = stateRuleset.stateIncomeTaxRate(entityType);

    const sectionC: SectionCForecast = {
      landAllocationPct,
      depreciableBase,
      annualDepreciation,
      bonusDepreciationCurrentYearPct,
      costSegAvailablePct,
      federalIncomeTaxRate: fedRate,
      stateIncomeTaxRate:   stateRate,
      effectiveCombinedRate: fedRate + stateRate,
      conformsToBonusDep: stateRuleset.conformsToBonusDep(),
      conformsToCostSeg:  stateRuleset.conformsToCostSeg(),
    };

    // ── Confidence / jurisdiction mapping ─────────────────────────────────────
    const jurisdictionMapped = stack.jurisdictionMapped;
    const confidence: 'high' | 'medium' | 'low' = !jurisdictionMapped
      ? 'low'
      : countyOverlay
        ? 'high'
        : 'medium';

    return {
      jurisdiction: `${ctx.state || 'unknown'}${ctx.county ? `-${ctx.county}` : ''}`,
      rulesetUsed: activeRuleset.jurisdiction,
      countyLabel,
      assessmentGrowthPct,
      jurisdictionMapped,
      confidence,
      reTax: {
        t12AssessedValue,
        t12MillageRate,
        t12AnnualTax,
        platformAssessedValue: platformAssessedValue ?? null,
        platformAnnualTax,
        isMiamiDade,
        sohCapPct,
        perYear,
        deltaVsT12Pct,
      },
      transferTax,
      specialTaxes: stateRuleset.specialTaxes(ctx),
      abatementPrograms: stateRuleset.abatementEligibility(ctx),
      sectionC,
    };
  },
};
