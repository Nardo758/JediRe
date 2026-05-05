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
import { resolveRulesetStack } from './resolver';
import { logger } from '../utils/logger';
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

function deriveCountyFromCity(city: string | null, state: string): string | null {
  if (!city || !state) return null;
  // Delegate to resolver's CITY_TO_COUNTY map via resolveRulesetStack —
  // we call with a dummy unknown county so the resolver falls through to city detection.
  // Actually, import the CITY_TO_COUNTY map directly to avoid creating a stack.
  const { CITY_TO_COUNTY } = require('./resolver') as { CITY_TO_COUNTY: Map<string, string> };
  const key = `${city.toLowerCase().trim()}|${state.toUpperCase()}`;
  return CITY_TO_COUNTY?.get(key) ?? null;
}

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
  const resolvedCounty = dealCountyRaw ?? deriveCountyFromCity(dealCity, dealState);

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
    // Try live millage service
    let liveMillage: number | null = null;
    try {
      const live = await liveMillageService.getLiveMillageRate(dealState, resolvedCounty);
      if (live) {
        liveMillage = live.millageRate;
        millageSource = 'live_millage_service';
      }
    } catch {
      // fall through
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
    (dd.land_allocation_pct != null ? Number(dd.land_allocation_pct) : undefined);

  // ── t12 annual tax ────────────────────────────────────────────────────────
  const t12FromParcel = parcel?.annual_tax ?? null;
  const t12FromDeal   = dd.t12_annual_tax != null ? Number(dd.t12_annual_tax) : null;
  const t12AnnualTax  = overrides.t12AnnualTax ?? t12FromParcel ?? t12FromDeal ?? null;

  // ── Platform annual tax provenance ────────────────────────────────────────
  // Computed after forecast; placeholder source set here.
  const platformAnnualTaxLayered: LayeredValue<number | null> = makeLayered(
    null,
    'tax_service_computed',
    stack.jurisdictionMapped ? (stack.county ? 'high' : 'medium') : 'low',
    {
      ruleset_version: rulesetVersion,
      formula: 'taxService.forecast() → reTax.platformAnnualTax',
    },
  );

  // ── State income tax rate provenance ─────────────────────────────────────
  const entityTypeForRate = sectionCEntityType ?? 'pass_through';
  let stateRate = 0;
  try {
    stateRate = stack.state.stateIncomeTaxRate(entityTypeForRate);
  } catch { /* use 0 on error */ }

  const stateRateLayered: LayeredValue<number> = makeLayered(
    stateRate,
    'tax_service_computed',
    stack.jurisdictionMapped ? 'high' : 'low',
    {
      ruleset_version: rulesetVersion,
      formula: `${stack.state.jurisdiction}.stateIncomeTaxRate(${entityTypeForRate})`,
      inputs: { entity_type: { value: entityTypeForRate, source: 'deal_data' } },
    },
  );

  // ── TPP exemption provenance ──────────────────────────────────────────────
  const tppExemptLayered: LayeredValue<number> = makeLayered(
    stack.state.tppExemptionAmount(),
    'tax_service_computed',
    stack.jurisdictionMapped ? 'high' : 'low',
    {
      ruleset_version: rulesetVersion,
      formula: `${stack.state.jurisdiction}.tppExemptionAmount()`,
    },
  );

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

  // ── Assemble provenance ───────────────────────────────────────────────────
  const provenance: TaxForecastProvenance = {
    computed_at: now,
    ruleset_version: rulesetVersion,
    parcel_source: parcel?.source ?? null,
    parcel_confidence: parcelResult?.confidence ?? null,
    assessed_value:       assessedValueLayered,
    millage_rate:         millageRateLayered,
    platform_annual_tax:  platformAnnualTaxLayered,
    state_income_tax_rate: stateRateLayered,
    tpp_exemption_amount:  tppExemptLayered,
  };

  return { ctx, provenance, parcelResult };
}
