/**
 * compositeResolver — buildTaxContext()
 *
 * Populates a full TaxContext from a deal record by combining:
 *   1. Deal DB row fields (state_code, city, deal_data.*)
 *   2. PropertyAppraiserFetcher output (ATTOM or tax bill PDF)
 *   3. Live millage service (TX Comptroller)
 *   4. User override values from per_year_overrides
 *
 * Each input is wrapped in a LayeredValue with provenance metadata.
 * The returned TaxContext is ready to pass directly to taxService.forecast().
 *
 * Falls back gracefully at every tier — the function never throws on
 * partial data. Callers receive a fully-populated TaxContext with
 * confidence = 'low' when data sources are unavailable.
 *
 * Usage (from proforma-adjustment.service.ts or API handlers):
 *   const { ctx, provenance, parcelResult } =
 *     await buildTaxContext(deal, overrides, options);
 *   const forecast = taxService.forecast(ctx);
 */

import { generalPropertyAppraiserFetcher } from './propertyAppraiserFetcher';
import { liveMillageService } from './liveMlillageService';
import { resolveRulesetStack, deriveCounty } from './resolver';
import { jurisdictionCacheGet, jurisdictionCacheSet } from './jurisdictionCache';
import { federalRuleset, federalIncomeTaxRate, federalCostSegAvailablePct } from './rulesets/federal.ruleset';
import { logger } from '../../utils/logger';
import type {
  TaxContext,
  LayeredValue,
  TaxForecastProvenance,
  PropertyAppraiserResult,
} from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Minimal shape of a deal row as returned by the DB (not full DealRow). */
export interface DealRowForTaxContext {
  id: string;
  state_code: string | null;
  city: string | null;
  target_units: number | null;
  budget: number | null;
  deal_data: Record<string, unknown> | null;
}

/** User-supplied tax overrides (subset of per_year_overrides). */
export interface TaxContextOverrides {
  assessedValueOverride?: number | null;
  millageRateOverride?: number | null;
  countyOverride?: boolean | null;
  loanAmount?: number | null;
  holdYears?: number;
  isRefi?: boolean;
  refiEnabled?: boolean;
  refiTriggerYear?: number;
  refiNewLoanType?: string | null;
  propertyType?: string;
  entityType?: string;
  placedInServiceYear?: number;
  landAllocationPct?: number;
  t12AnnualTax?: number | null;
}

/** Options for buildTaxContext. */
export interface BuildTaxContextOptions {
  parcelId?: string | null;
  fiscalYear?: number;
  /** Skip ATTOM / tax bill PDF lookup (e.g. during bulk recalculation). */
  skipFetch?: boolean;
}

/** Full result of buildTaxContext. */
export interface TaxContextResult {
  ctx: TaxContext;
  provenance: TaxForecastProvenance;
  parcelResult: PropertyAppraiserResult | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_ASSET_CLASSES = new Set(['multifamily', 'sfr', 'retail', 'office', 'industrial', 'hospitality']);
const VALID_ENTITY_TYPES  = new Set(['individual', 'pass_through', 'c_corp', 'reit', 'partnership']);

function makeLayered<T>(
  value: T,
  source: string,
  confidence: 'high' | 'medium' | 'low',
  meta?: Partial<TaxForecastProvenance['assessed_value']['metadata']>,
): LayeredValue<T> {
  return {
    value,
    source,
    metadata: {
      confidence,
      computed_at: new Date().toISOString(),
      ...meta,
    },
  };
}

// deriveCounty imported from resolver — uses the same CITY_TO_COUNTY record that
// the resolver uses for stack resolution, keeping county derivation consistent.


// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Build a fully-provenance-annotated TaxContext from a deal DB row.
 *
 * @param deal      - Deal row from the `deals` table
 * @param overrides - User-supplied overrides from per_year_overrides
 * @param options   - Optional parcelId, fiscalYear, skipFetch
 */
export async function buildTaxContext(
  deal: DealRowForTaxContext,
  overrides: TaxContextOverrides = {},
  options: BuildTaxContextOptions = {},
): Promise<TaxContextResult> {
  const now = new Date().toISOString();
  const { parcelId, fiscalYear, skipFetch = false } = options;

  // ── Deal data extraction ─────────────────────────────────────────────────
  const dd = (deal.deal_data ?? {}) as Record<string, unknown>;
  const dealState = (deal.state_code ?? '').toUpperCase().trim();
  const dealCountyRaw = (dd.county ?? dd.property_county ?? null) as string | null;
  const dealCity = deal.city ?? null;
  const resolvedCounty = dealCountyRaw ?? deriveCounty(dealCity, dealState);

  const purchasePrice: number | null =
    dd.purchase_price != null ? Number(dd.purchase_price) :
    deal.budget != null ? Number(deal.budget) : null;

  const totalUnits = Number(deal.target_units ?? dd.units ?? 1) || 1;

  const stack = resolveRulesetStack(dealState, resolvedCounty);
  const rulesetVersion = `${dealState || 'DEFAULT'}-${fiscalYear ?? new Date().getUTCFullYear()}`;

  // ── PropertyAppraiserFetcher ─────────────────────────────────────────────
  let parcelResult: PropertyAppraiserResult | null = null;
  if (!skipFetch) {
    try {
      parcelResult = await generalPropertyAppraiserFetcher.fetch({
        dealId: deal.id,
        parcelId: parcelId ?? (dd.parcel_id as string | null) ?? null,
        state: dealState,
        county: resolvedCounty,
        fiscalYear,
      });
    } catch (err: any) {
      logger.warn('[buildTaxContext] PropertyAppraiserFetcher error', {
        dealId: deal.id,
        err: err?.message,
      });
    }
  }

  const parcel = parcelResult?.parcel ?? null;

  // ── Assessed value provenance ─────────────────────────────────────────────
  let assessedValueLayered: LayeredValue<number | null>;
  if (overrides.assessedValueOverride != null) {
    assessedValueLayered = makeLayered(
      overrides.assessedValueOverride,
      'user_override',
      'high',
      { ruleset_version: rulesetVersion, formula: 'user-supplied override' },
    );
  } else if (parcel?.assessed_value != null) {
    assessedValueLayered = makeLayered(
      parcel.assessed_value,
      parcel.source,
      parcelResult?.confidence ?? 'medium',
      {
        ruleset_version: rulesetVersion,
        formula: `${parcel.source} assessed_value as of tax_year ${parcel.tax_year}`,
        inputs: {
          just_value: { value: parcel.just_value, source: parcel.source },
          exemptions: { value: parcel.exemptions_total, source: parcel.source },
        },
      },
    );
  } else {
    assessedValueLayered = makeLayered(
      purchasePrice,
      'fallback',
      'low',
      {
        ruleset_version: rulesetVersion,
        formula: 'purchasePrice used as assessed value (no parcel data)',
        inputs: { purchase_price: { value: purchasePrice, source: 'deal_data' } },
      },
    );
  }

  // ── Millage rate provenance ───────────────────────────────────────────────
  let millageRateLayered: LayeredValue<number | null>;
  let effectiveMillageOverride: number | null = overrides.millageRateOverride ?? null;
  let millageSource = 'user_override';

  if (effectiveMillageOverride != null) {
    millageRateLayered = makeLayered(
      effectiveMillageOverride,
      'user_override',
      'high',
      { ruleset_version: rulesetVersion, formula: 'user-supplied millage override' },
    );
  } else if (parcel?.millage_rate != null) {
    effectiveMillageOverride = parcel.millage_rate;
    millageSource = parcel.source;
    millageRateLayered = makeLayered(
      parcel.millage_rate,
      parcel.source,
      parcelResult?.confidence ?? 'medium',
      {
        ruleset_version: rulesetVersion,
        formula: `${parcel.source} millage_rate computed from tax/assessed`,
      },
    );
  } else {
    // Try jurisdiction cache first, then live millage service, then ruleset default.
    const jurisdictionKey = resolvedCounty
      ? `${dealState}-${resolvedCounty}`
      : dealState;
    const cachedMillage = await jurisdictionCacheGet<number>(
      jurisdictionKey, 'millage_rate', fiscalYear,
    );

    if (cachedMillage != null) {
      effectiveMillageOverride = cachedMillage;
      millageSource = 'jurisdiction_cache';
      millageRateLayered = makeLayered(
        cachedMillage,
        'jurisdiction_cache',
        'medium',
        { ruleset_version: rulesetVersion, formula: 'jurisdiction_tax_cache read-through' },
      );
    } else {
      let liveMillage: number | null = null;
      try {
        const live = await liveMillageService.getLiveMillageRate(dealState, resolvedCounty);
        if (live) {
          liveMillage = live.millageRate;
          millageSource = 'live_millage_service';
          // Store in jurisdiction cache so subsequent forecasts skip the HTTP call.
          await jurisdictionCacheSet(
            jurisdictionKey, 'millage_rate', fiscalYear ?? new Date().getUTCFullYear(),
            liveMillage, 'live_millage_service',
          );
        }
      } catch {
        // fall through to ruleset default
      }

      if (liveMillage != null) {
        effectiveMillageOverride = liveMillage;
        millageRateLayered = makeLayered(
          liveMillage,
          'live_millage_service',
          'medium',
          { ruleset_version: rulesetVersion, formula: 'TX Comptroller live county rates' },
        );
      } else {
        millageRateLayered = makeLayered(
          null,
          'ruleset_default',
          'medium',
          { ruleset_version: rulesetVersion, formula: 'ruleset hardcoded default millage' },
        );
      }
    }
  }

  // ── Section C fields ──────────────────────────────────────────────────────
  const rawAssetClass = (dd.asset_class ?? dd.property_type ?? overrides.propertyType ?? '').toString().toLowerCase().trim();
  const sectionCPropertyType = VALID_ASSET_CLASSES.has(rawAssetClass)
    ? (rawAssetClass as import('./types').AssetClass) : undefined;

  const rawEntityType = (dd.entity_type ?? overrides.entityType ?? '').toString().toLowerCase().trim();
  const sectionCEntityType = VALID_ENTITY_TYPES.has(rawEntityType)
    ? (rawEntityType as import('./types').EntityType) : undefined;

  const closeYear = (() => {
    const raw = dd.close_date ?? null;
    if (!raw) return overrides.placedInServiceYear;
    const yr = new Date(String(raw)).getFullYear();
    return isFinite(yr) && yr >= 2020 && yr <= 2040 ? yr : undefined;
  })();

  const landAllocPct = overrides.landAllocationPct ??
    (dd.land_allocation_pct != null ? Number(dd.land_allocation_pct) : undefined) ?? 0.20;

  // ── t12 annual tax ────────────────────────────────────────────────────────
  const t12FromParcel = parcel?.annual_tax ?? null;
  const t12FromDeal   = dd.t12_annual_tax != null ? Number(dd.t12_annual_tax) : null;
  const t12AnnualTax  = overrides.t12AnnualTax ?? t12FromParcel ?? t12FromDeal ?? null;

  // ── Section C derivations (mirrors taxService.forecast() Section C block) ──
  // Computed here so provenance wrappers can reference actual values.
  const entityTypeForRate  = sectionCEntityType ?? 'pass_through';
  const propertyTypeForDep = sectionCPropertyType ?? 'multifamily';
  const placedInSvcYear    = closeYear ?? (fiscalYear ?? new Date().getUTCFullYear());

  let stateRate = 0;
  try { stateRate = stack.state.stateIncomeTaxRate(entityTypeForRate); } catch { /* 0 */ }
  const fedRate        = federalIncomeTaxRate(entityTypeForRate);
  const depreciationLife = federalRuleset.depreciationLife(propertyTypeForDep);
  const depreciableBase  = purchasePrice != null
    ? Math.round(purchasePrice * (1 - landAllocPct)) : null;
  const annualDepreciation = depreciableBase != null
    ? Math.round(depreciableBase / depreciationLife) : null;
  const bonusDepPct    = federalRuleset.bonusDepreciationPct(placedInSvcYear);
  const costSegPct     = federalRuleset.costSegEligible(propertyTypeForDep)
    ? federalCostSegAvailablePct() : 0;
  const tppExempt      = stack.state.tppExemptionAmount();
  const confBase: 'high' | 'medium' | 'low' = stack.jurisdictionMapped ? 'high' : 'low';

  // ── Transfer tax provenance (acquisition only) ────────────────────────────
  // Actual dollar amounts are computed by taxService.forecast(); these are
  // source annotations only — values are null at context-build time.
  const transferConfidence: 'high' | 'medium' | 'low' =
    stack.jurisdictionMapped ? (stack.county ? 'high' : 'medium') : 'low';

  // ── Assemble TaxContext ───────────────────────────────────────────────────
  const ctx: TaxContext = {
    state:       dealState,
    county:      resolvedCounty,
    city:        dealCity,
    purchasePrice,
    loanAmount:  overrides.loanAmount ?? null,
    assessedValueOverride: overrides.assessedValueOverride ?? null,
    millageRateOverride:   effectiveMillageOverride,
    countyOverride:        overrides.countyOverride ?? null,
    units:       totalUnits,
    t12AnnualTax,
    holdYears:   overrides.holdYears ?? 10,
    isRefi:      overrides.isRefi ?? false,
    refiEnabled: overrides.refiEnabled ?? false,
    refiTriggerYear: overrides.refiTriggerYear ?? 3,
    refiNewLoanType: overrides.refiNewLoanType ?? null,
    propertyType:    sectionCPropertyType,
    entityType:      sectionCEntityType,
    placedInServiceYear: closeYear,
    landAllocationPct: landAllocPct,
    dealId: deal.id,
  };

  // ── t12 assessed value & delta (preview; definitive values come from forecast) ─
  const defaultMillage = (stack.county ?? stack.state)
    .annualPropertyTax(ctx, 1, 0).millageRate;
  const resolvedMillage = effectiveMillageOverride ?? defaultMillage;
  const t12AssessedValuePrev = t12AnnualTax != null && resolvedMillage > 0
    ? Math.round(t12AnnualTax / (resolvedMillage / 1000)) : null;

  // ── Assemble provenance ───────────────────────────────────────────────────
  const provenance: TaxForecastProvenance = {
    computed_at: now,
    ruleset_version: rulesetVersion,
    parcel_source: parcel?.source ?? null,
    parcel_confidence: parcelResult?.confidence ?? null,

    // Section A
    assessed_value: assessedValueLayered,
    millage_rate:   millageRateLayered,
    platform_annual_tax: makeLayered(
      null, 'tax_service_computed',
      stack.jurisdictionMapped ? (stack.county ? 'high' : 'medium') : 'low',
      { ruleset_version: rulesetVersion, formula: 'taxService.forecast() → reTax.platformAnnualTax' },
    ),
    t12_assessed_value: makeLayered(
      t12AssessedValuePrev, 'tax_service_computed', 'medium',
      {
        ruleset_version: rulesetVersion,
        formula: 't12AnnualTax / (resolvedMillage / 1000)',
        inputs: { t12_annual_tax: { value: t12AnnualTax, source: 't12FromParcel or deal_data' },
                  millage_rate:   { value: resolvedMillage, source: millageSource } },
      },
    ),
    t12_millage_rate: makeLayered(
      resolvedMillage, millageSource, 'medium',
      { ruleset_version: rulesetVersion, formula: 'millageRateOverride ?? parcel.millage_rate ?? live ?? ruleset_default' },
    ),
    t12_annual_tax: makeLayered(
      t12AnnualTax,
      t12AnnualTax != null ? (parcel?.annual_tax != null ? parcel.source : 'deal_data') : 'fallback',
      t12AnnualTax != null ? 'medium' : 'low',
      { ruleset_version: rulesetVersion, formula: 'overrides.t12AnnualTax ?? parcel.annual_tax ?? deal_data.t12_annual_tax' },
    ),
    delta_vs_t12_pct: makeLayered(
      null, 'tax_service_computed',
      stack.jurisdictionMapped ? 'medium' : 'low',
      { ruleset_version: rulesetVersion, formula: '(platformAnnualTax - t12AnnualTax) / t12AnnualTax' },
    ),
    assessment_growth_pct: makeLayered(
      0, 'tax_service_computed', confBase,
      { ruleset_version: rulesetVersion, formula: '(yr2.assessedValue - yr1.assessedValue) / yr1.assessedValue' },
    ),
    soh_cap_pct: makeLayered(
      stack.state.annualAssessmentCap() ?? 0, 'tax_service_computed', confBase,
      {
        ruleset_version: rulesetVersion,
        formula: `${stack.state.jurisdiction}.annualAssessmentCap()`,
      },
    ),

    // Transfer taxes
    doc_stamp_amount: makeLayered(
      null, 'tax_service_computed', transferConfidence,
      { ruleset_version: rulesetVersion, formula: 'stateRuleset.acquisitionTransferTax(ctx).docStampAmount' },
    ),
    intangible_tax_amount: makeLayered(
      null, 'tax_service_computed', transferConfidence,
      { ruleset_version: rulesetVersion, formula: 'stateRuleset.acquisitionTransferTax(ctx).intangibleTaxAmount' },
    ),
    county_surtax_amount: makeLayered(
      null, stack.county ? 'tax_service_computed' : 'not_applicable', transferConfidence,
      { ruleset_version: rulesetVersion, formula: 'countyOverlay?.countySurtax(purchasePrice)' },
    ),
    total_transfer_tax: makeLayered(
      null, 'tax_service_computed', transferConfidence,
      { ruleset_version: rulesetVersion, formula: 'docStamp + intangible + countySurtax' },
    ),

    // Section C
    land_allocation_pct: makeLayered(
      landAllocPct,
      landAllocPct !== 0.20 ? 'deal_data' : 'ruleset_default',
      landAllocPct !== 0.20 ? 'high' : 'medium',
      { ruleset_version: rulesetVersion, formula: 'overrides.landAllocationPct ?? deal_data.land_allocation_pct ?? 0.20' },
    ),
    depreciable_base: makeLayered(
      depreciableBase, 'tax_service_computed', purchasePrice != null ? 'high' : 'low',
      {
        ruleset_version: rulesetVersion,
        formula: 'purchasePrice × (1 − landAllocationPct)',
        inputs: { purchase_price: { value: purchasePrice, source: 'deal_data' },
                  land_allocation_pct: { value: landAllocPct, source: 'deal_data' } },
      },
    ),
    annual_depreciation: makeLayered(
      annualDepreciation, 'tax_service_computed', depreciableBase != null ? 'high' : 'low',
      {
        ruleset_version: rulesetVersion,
        formula: `depreciableBase / ${depreciationLife} (${propertyTypeForDep} life)`,
        inputs: { depreciable_base: { value: depreciableBase, source: 'tax_service_computed' } },
      },
    ),
    bonus_depreciation_pct: makeLayered(
      bonusDepPct, 'tax_service_computed', 'high',
      {
        ruleset_version: rulesetVersion,
        formula: `federalRuleset.bonusDepreciationPct(${placedInSvcYear})`,
        inputs: { placed_in_service_year: { value: placedInSvcYear, source: 'deal_data' } },
      },
    ),
    cost_seg_available_pct: makeLayered(
      costSegPct, 'tax_service_computed', 'high',
      { ruleset_version: rulesetVersion, formula: `federalRuleset.costSegEligible(${propertyTypeForDep}) → federalCostSegAvailablePct()` },
    ),
    federal_income_tax_rate: makeLayered(
      fedRate, 'tax_service_computed', 'high',
      {
        ruleset_version: rulesetVersion,
        formula: `federalIncomeTaxRate(${entityTypeForRate})`,
        inputs: { entity_type: { value: entityTypeForRate, source: 'deal_data' } },
      },
    ),
    state_income_tax_rate: makeLayered(
      stateRate, 'tax_service_computed', confBase,
      {
        ruleset_version: rulesetVersion,
        formula: `${stack.state.jurisdiction}.stateIncomeTaxRate(${entityTypeForRate})`,
        inputs: { entity_type: { value: entityTypeForRate, source: 'deal_data' } },
      },
    ),
    effective_combined_rate: makeLayered(
      fedRate + stateRate, 'tax_service_computed', confBase,
      { ruleset_version: rulesetVersion, formula: 'federalRate + stateRate', inputs: { federal: { value: fedRate, source: 'federal_ruleset' }, state: { value: stateRate, source: 'state_ruleset' } } },
    ),

    // Section B
    tpp_exemption_amount: makeLayered(
      tppExempt, 'tax_service_computed', confBase,
      { ruleset_version: rulesetVersion, formula: `${stack.state.jurisdiction}.tppExemptionAmount()` },
    ),
  };

  return { ctx, provenance, parcelResult };
}
