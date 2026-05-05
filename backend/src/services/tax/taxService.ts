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
import type { TaxContext, TaxForecast, ReTaxYear, SectionCForecast, TaxForecastProvenance, LayeredValue } from './types';

/**
 * Fixed year used as the default placed-in-service year when TaxContext omits it.
 * Must match the active federal rate sheet year (federal-2026.json) so that
 * identical inputs always produce byte-identical outputs (determinism requirement).
 */
const FEDERAL_RATE_SHEET_YEAR = 2026;

export { TaxContext, TaxForecast, TaxForecastProvenance, LayeredValue } from './types';

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
   * @param ctx               All deal-level tax inputs. See TaxContext for field docs.
   * @param externalProvenance Optional provenance from buildTaxContext() carrying
   *                           parcel-sourced field annotations (ATTOM, tax bill PDF,
   *                           county adapter). When provided, parcel-sourced LayeredValue
   *                           fields are merged into the internally-computed provenance
   *                           so the final forecast reflects the actual data tier used.
   *                           Existing callers omit this param — fully backward-compatible.
   * @returns                  TaxForecast with jurisdictionMapped + confidence flags
   */
  forecast(ctx: TaxContext, externalProvenance?: TaxForecastProvenance): TaxForecast {
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

    // ── Phase 4 provenance ─────────────────────────────────────────────────
    // Computed inline when no external buildTaxContext provenance was injected.
    // All raw fields on TaxForecast remain unchanged — these are additive only.
    const computedAt = new Date().toISOString();
    const rulesetVersion = `${ctx.state || 'DEFAULT'}-${FEDERAL_RATE_SHEET_YEAR}`;

    const lv = <T>(
      value: T,
      source: string,
      conf: 'high' | 'medium' | 'low',
      formula: string,
      inputs?: Record<string, { value: unknown; source: string }>,
    ): import('./types').LayeredValue<T> => ({
      value,
      source,
      // computed_at intentionally omitted from per-field metadata to preserve
      // byte-identical outputs for identical TaxContext inputs (determinism contract).
      // The forecast-level timestamp lives in provenance.computed_at only.
      metadata: { ruleset_version: rulesetVersion, formula, ...(inputs ? { inputs } : {}), confidence: conf },
    });

    const provenance: import('./types').TaxForecastProvenance = {
      computed_at: computedAt,
      ruleset_version: rulesetVersion,
      parcel_source: null,
      parcel_confidence: null,

      // Section A
      assessed_value: lv(
        platformAssessedValue ?? null,
        ctx.assessedValueOverride != null ? 'user_override' : platformAssessedValue != null ? 'tax_service_computed' : 'fallback',
        confidence,
        ctx.assessedValueOverride != null ? 'user-supplied assessedValueOverride' : 'purchasePrice used as post-acquisition assessed value',
        { purchase_price: { value: ctx.purchasePrice, source: 'deal_data' } },
      ),
      millage_rate: lv(
        t12MillageRate ?? null,
        ctx.millageRateOverride != null ? 'user_override' : 'tax_service_computed',
        confidence,
        `${activeRuleset.jurisdiction}.annualPropertyTax(ctx, 1, 0).millageRate`,
      ),
      platform_annual_tax: lv(
        platformAnnualTax ?? null, 'tax_service_computed', confidence,
        'millageRate × assessedValue / 1000',
        { assessed_value: { value: platformAssessedValue, source: 'tax_service_computed' },
          millage_rate_mills: { value: t12MillageRate, source: 'tax_service_computed' } },
      ),
      t12_assessed_value: lv(
        t12AssessedValue ?? null, 'tax_service_computed', confidence,
        't12AnnualTax / (t12MillageRate / 1000)',
        { t12_annual_tax: { value: t12AnnualTax, source: 'context' },
          t12_millage_rate: { value: t12MillageRate, source: 'tax_service_computed' } },
      ),
      t12_millage_rate: lv(
        t12MillageRate ?? null,
        ctx.millageRateOverride != null ? 'user_override' : 'tax_service_computed',
        confidence,
        `${activeRuleset.jurisdiction}.annualPropertyTax(ctx, 1, 0).millageRate`,
      ),
      t12_annual_tax: lv(
        t12AnnualTax ?? null,
        ctx.t12AnnualTax != null ? 'context' : 'fallback',
        ctx.t12AnnualTax != null ? confidence : 'low',
        'ctx.t12AnnualTax (from overrides or deal_data)',
      ),
      delta_vs_t12_pct: lv(
        deltaVsT12Pct ?? null, 'tax_service_computed', confidence,
        '(platformAnnualTax - t12AnnualTax) / t12AnnualTax',
        { platform_annual_tax: { value: platformAnnualTax, source: 'tax_service_computed' },
          t12_annual_tax: { value: t12AnnualTax, source: 'context' } },
      ),
      assessment_growth_pct: lv(
        assessmentGrowthPct, 'tax_service_computed', confidence,
        '(yr2.assessedValue - yr1.assessedValue) / yr1.assessedValue',
      ),
      soh_cap_pct: lv(
        sohCapPct, 'tax_service_computed', confidence,
        `${stateRuleset.jurisdiction}.annualAssessmentCap()`,
      ),

      // Transfer taxes
      doc_stamp_amount: lv(
        transferTax.docStampAmount ?? null, 'tax_service_computed',
        jurisdictionMapped ? (countyOverlay ? 'high' : 'medium') : 'low',
        'stateRuleset.acquisitionTransferTax(ctx).docStampAmount',
        { purchase_price: { value: ctx.purchasePrice, source: 'deal_data' } },
      ),
      intangible_tax_amount: lv(
        transferTax.intangibleTaxAmount ?? null, 'tax_service_computed',
        jurisdictionMapped ? (countyOverlay ? 'high' : 'medium') : 'low',
        'stateRuleset.acquisitionTransferTax(ctx).intangibleTaxAmount',
        { loan_amount: { value: ctx.loanAmount, source: 'deal_data' } },
      ),
      county_surtax_amount: lv(
        transferTax.countySurtaxAmount ?? null,
        countyOverlay ? 'tax_service_computed' : 'not_applicable',
        jurisdictionMapped ? 'high' : 'low',
        'countyOverlay?.countySurtax(purchasePrice)',
      ),
      total_transfer_tax: lv(
        transferTax.totalTransferTax ?? null, 'tax_service_computed',
        jurisdictionMapped ? (countyOverlay ? 'high' : 'medium') : 'low',
        'docStampAmount + intangibleTaxAmount + countySurtaxAmount',
      ),

      // Section C
      land_allocation_pct: lv(
        landAllocationPct,
        ctx.landAllocationPct != null ? 'deal_data' : 'ruleset_default',
        ctx.landAllocationPct != null ? 'high' : 'medium',
        'ctx.landAllocationPct ?? 0.20',
      ),
      depreciable_base: lv(
        depreciableBase, 'tax_service_computed',
        ctx.purchasePrice != null ? 'high' : 'low',
        'purchasePrice × (1 − landAllocationPct)',
        { purchase_price: { value: ctx.purchasePrice, source: 'deal_data' },
          land_allocation_pct: { value: landAllocationPct, source: 'deal_data' } },
      ),
      annual_depreciation: lv(
        annualDepreciation, 'tax_service_computed',
        depreciableBase != null ? 'high' : 'low',
        `depreciableBase / ${federalRuleset.depreciationLife(propertyType)} (${propertyType} life)`,
        { depreciable_base: { value: depreciableBase, source: 'tax_service_computed' } },
      ),
      bonus_depreciation_pct: lv(
        bonusDepreciationCurrentYearPct, 'tax_service_computed', 'high',
        `federalRuleset.bonusDepreciationPct(${placedInServiceYear})`,
        { placed_in_service_year: { value: placedInServiceYear, source: 'deal_data' } },
      ),
      cost_seg_available_pct: lv(
        costSegAvailablePct, 'tax_service_computed', 'high',
        `federalRuleset.costSegEligible(${propertyType}) → federalCostSegAvailablePct()`,
      ),
      federal_income_tax_rate: lv(
        fedRate, 'tax_service_computed', 'high',
        `federalIncomeTaxRate(${entityType})`,
        { entity_type: { value: entityType, source: 'deal_data' } },
      ),
      state_income_tax_rate: lv(
        stateRate, 'tax_service_computed', confidence,
        `${stateRuleset.jurisdiction}.stateIncomeTaxRate(${entityType})`,
        { entity_type: { value: entityType, source: 'deal_data' } },
      ),
      effective_combined_rate: lv(
        fedRate + stateRate, 'tax_service_computed', confidence,
        'federalIncomeTaxRate + stateIncomeTaxRate',
        { federal_rate: { value: fedRate, source: 'federal_ruleset' },
          state_rate:   { value: stateRate, source: 'state_ruleset' } },
      ),

      // Section B
      tpp_exemption_amount: lv(
        stateRuleset.tppExemptionAmount(), 'tax_service_computed', confidence,
        `${stateRuleset.jurisdiction}.tppExemptionAmount()`,
      ),

      // Per-year time series — covers all numeric leaves in reTax.perYear
      per_year: lv(
        perYear, 'tax_service_computed', confidence,
        `${activeRuleset.jurisdiction}.annualPropertyTax(ctx, yr, prev) × ${perYear.length} years`,
        { assessed_value: { value: platformAssessedValue, source: 'tax_service_computed' },
          millage_rate_mills: { value: t12MillageRate, source: 'tax_service_computed' },
          soh_cap_pct: { value: sohCapPct, source: 'tax_service_computed' } },
      ),
    };

    // ── Merge external provenance (from buildTaxContext) ──────────────────────
    // When the caller built the TaxContext via buildTaxContext(), it will supply
    // externalProvenance carrying parcel_source, parcel_confidence, and
    // LayeredValue annotations derived from the actual data tier (ATTOM, PDF,
    // county adapter).  We overwrite the corresponding internal fields so the
    // final forecast reflects the real data lineage rather than the default
    // 'tax_service_computed' / null placeholders.
    //
    // Only parcel-sourced fields are merged — computed fields (transfer tax
    // amounts, depreciation, etc.) keep their internally-computed values since
    // taxService holds the definitive runtime numbers at this point.
    //
    // Existing callers that omit externalProvenance see no change (backward compat).
    const PARCEL_SOURCES = new Set(['attom', 'tax_bill_pdf', 'county_adapter', 'live_millage_service', 'jurisdiction_cache']);
    const isParcelSource = (src: string) => PARCEL_SOURCES.has(src);

    const finalProvenance: import('./types').TaxForecastProvenance = {
      ...provenance,
      // Always adopt parcel identification from external when available
      parcel_source:     externalProvenance?.parcel_source     ?? provenance.parcel_source,
      parcel_confidence: externalProvenance?.parcel_confidence ?? provenance.parcel_confidence,
      // Merge LayeredValue fields where external has a higher-trust parcel source
      assessed_value:
        externalProvenance && isParcelSource(externalProvenance.assessed_value.source)
          ? externalProvenance.assessed_value : provenance.assessed_value,
      millage_rate:
        externalProvenance && isParcelSource(externalProvenance.millage_rate.source)
          ? externalProvenance.millage_rate : provenance.millage_rate,
      t12_annual_tax:
        externalProvenance && isParcelSource(externalProvenance.t12_annual_tax.source)
          ? externalProvenance.t12_annual_tax : provenance.t12_annual_tax,
      t12_millage_rate:
        externalProvenance && isParcelSource(externalProvenance.t12_millage_rate.source)
          ? externalProvenance.t12_millage_rate : provenance.t12_millage_rate,
      t12_assessed_value:
        externalProvenance && isParcelSource(externalProvenance.t12_assessed_value.source)
          ? externalProvenance.t12_assessed_value : provenance.t12_assessed_value,
    };

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
      provenance: finalProvenance,
    };
  },
};
