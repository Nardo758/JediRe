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
 */

import { resolveRuleset } from './resolver';
import type { TaxContext, TaxForecast, ReTaxYear } from './types';

export { TaxContext, TaxForecast } from './types';

export const taxService = {
  /**
   * Produce a full tax forecast for a deal.
   *
   * @param ctx  All deal-level tax inputs. See TaxContext for field docs.
   * @returns    TaxForecast — per-year RE tax schedule + transfer taxes + special taxes
   */
  forecast(ctx: TaxContext): TaxForecast {
    const ruleset = resolveRuleset(ctx.state, ctx.county);
    const holdYears = ctx.holdYears;

    // Derive t12 millage from existing data (best-effort, ruleset may override)
    const defaultMillage = ruleset.annualPropertyTax(ctx, 1, 0).millageRate;
    const t12MillageRate = ctx.millageRateOverride ?? defaultMillage;
    const t12AnnualTax = ctx.t12AnnualTax;
    const t12AssessedValue = t12AnnualTax != null && t12MillageRate > 0
      ? Math.round(t12AnnualTax / (t12MillageRate / 1000))
      : null;

    // Platform assessed value = purchase price (post-acquisition reassessment)
    const platformAssessedValue = ctx.assessedValueOverride ?? ctx.purchasePrice;

    // Build per-year schedule (minimum 10 years for grid completeness).
    // Carryforward uses _rawAssessedValue (unrounded) when available to avoid
    // cumulative rounding drift in jurisdictions with annual assessment caps (FL SOH).
    const perYear: ReTaxYear[] = [];
    let prevAssessedValue = platformAssessedValue ?? 0;
    for (let yr = 1; yr <= Math.max(holdYears, 10); yr++) {
      const yearRecord = ruleset.annualPropertyTax(ctx, yr, prevAssessedValue);
      perYear.push(yearRecord);
      prevAssessedValue = yearRecord._rawAssessedValue ?? yearRecord.assessedValue;
    }

    const y1TaxAmt = perYear[0]?.taxAmount ?? null;
    const platformAnnualTax = y1TaxAmt;
    const deltaVsT12Pct = y1TaxAmt != null && t12AnnualTax != null && t12AnnualTax > 0
      ? (y1TaxAmt - t12AnnualTax) / t12AnnualTax
      : null;

    // Transfer taxes (acquisition)
    const transferTax = ruleset.acquisitionTransferTax(ctx);

    // isMiamiDade — FL-specific field; false for all other rulesets
    const isMiamiDade = transferTax.isMiamiDade;

    const sohCapPct = ruleset.annualAssessmentCap() ?? 0;

    // Derive a human-readable county label and the assessment growth rate used
    // by this ruleset so the frontend can render jurisdiction-correct UI strings.
    const countyLabel: string | null = ctx.county ? `${ctx.county} County` : null;
    // Estimate assessment growth from the Y2 vs Y1 assessed value ratio (if purchasePrice > 0).
    // This lets the frontend client-side projection use the same growth assumption as the ruleset
    // without needing to import ruleset-internal constants.
    let assessmentGrowthPct = 0;
    if (perYear.length >= 2 && perYear[0].assessedValue > 0) {
      assessmentGrowthPct = (perYear[1].assessedValue - perYear[0].assessedValue) / perYear[0].assessedValue;
      if (!isFinite(assessmentGrowthPct) || assessmentGrowthPct < 0) assessmentGrowthPct = 0;
    }

    return {
      jurisdiction: `${ctx.state || 'unknown'}${ctx.county ? `-${ctx.county}` : ''}`,
      rulesetUsed: ruleset.jurisdiction,
      countyLabel,
      assessmentGrowthPct,
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
      /**
       * sectionC — Income Tax & Depreciation.
       * Returned as null in Phase 1. Phase 2 (federal ruleset) will populate
       * this using the ruleset's Section C methods and the federal-2026.json
       * rate sheet. Existing callers that don't read sectionC are unaffected.
       */
      sectionC: null,
      specialTaxes: ruleset.specialTaxes(ctx),
      abatementPrograms: ruleset.abatementEligibility(ctx),
    };
  },
};
