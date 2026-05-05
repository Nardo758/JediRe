/**
 * Florida Tax Ruleset
 *
 * Implements the TaxRuleset interface for Florida commercial (non-homestead) real estate.
 *
 * Key mechanics:
 * - Non-homestead SOH cap: 10% max annual assessed-value increase
 * - Reassessment on sale: full (purchase price becomes new assessed value)
 * - Miami-Dade county: inline fallback uses 1.05% combined rate when county not provided
 *   (safety net only — primary path uses county overlay + base 0.70% + 0.45% surtax)
 * - Acquisition doc stamps: 0.70% statewide / 1.05% Miami-Dade city-detection safety net
 * - Intangible tax on mortgage: 0.2% of loan amount
 * - Refi: doc stamps 0.35% + intangible tax 0.2% on new note
 *
 * Millage defaults (mills per $1,000 assessed value):
 *   Miami-Dade non-homestead: 23.09   (FY2024/25 blended; city-detection fallback)
 *   Statewide FL commercial:  20.00   (conservative statewide median)
 *
 * Section B (TPP): taxed=true, exemption=$25,000, form DR-405, deadline April 1
 *   Values loaded from fl-2026.json rate sheet.
 *
 * Section C (income tax): c_corp=5.5%, others=0%; conforms_to_bonus_dep=true
 *   Values loaded from fl-2026.json rate sheet.
 *
 * Sources: FL Statutes §193.155, §201.02, §199.133; FL DOR
 */

import type {
  TaxContext, TaxRuleset, ReTaxYear, TransferTaxResult,
  SpecialTax, AbatementProgram, TPPContext, TaxLineResult, TPPFiling,
  AssetClass, EntityType,
} from '../types';
import { getRateSheet } from '../rateSheets/loader';

const FL_SOH_CAP = 0.10;        // 10% non-homestead annual assessed-value cap
const FL_MARKET_GROWTH = 0.12; // 12%/yr appreciation assumption — exceeds cap so cap binds
const FL_MILLAGE_MIAMI_DADE = 23.09;  // mills per $1,000 assessed (FY2024/25) — city detection fallback
const FL_MILLAGE_STATEWIDE = 20.00;   // mills per $1,000 assessed

const FL_RATE_SHEET_YEAR = 2026;

/**
 * Fallback city set — only used when county is not resolvable.
 * Primary path: caller supplies ctx.county = 'Miami-Dade' via resolver.deriveCounty().
 * This set exists as a safety net for direct callers that bypass the standard resolver path.
 */
const MIAMI_DADE_CITIES_FALLBACK = new Set([
  'miami', 'miami beach', 'hialeah', 'coral gables', 'doral', 'miami gardens', 'homestead',
  'north miami', 'north miami beach', 'opa-locka', 'aventura', 'bal harbour',
  'florida city', 'golden beach', 'indian creek', 'key biscayne', 'medley', 'miami shores',
  'miami springs', 'north bay village', 'palmetto bay', 'pinecrest', 'south miami',
  'sunny isles beach', 'surfside', 'sweetwater', 'virginia gardens', 'west miami',
]);

function normalizeCounty(s: string): string {
  return s.toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\bcounty\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const MIAMI_DADE_COUNTY_VARIANTS = new Set([
  'miami dade', 'miami-dade', 'dade', 'miami dade county',
]);

function resolveIsMiamiDade(ctx: TaxContext): boolean {
  if (ctx.countyOverride !== null) return ctx.countyOverride;
  if (ctx.county != null) {
    const normalized = normalizeCounty(ctx.county);
    return MIAMI_DADE_COUNTY_VARIANTS.has(normalized) || normalized.includes('miami dade');
  }
  if (ctx.city) return MIAMI_DADE_CITIES_FALLBACK.has(ctx.city.toLowerCase().trim());
  return false;
}

function resolveMillage(ctx: TaxContext, isMiamiDade: boolean): number {
  if (ctx.millageRateOverride != null) return ctx.millageRateOverride;
  return isMiamiDade ? FL_MILLAGE_MIAMI_DADE : FL_MILLAGE_STATEWIDE;
}

// ── Section B helpers (load from rate sheet) ──────────────────────────────────

function getSheet() {
  return getRateSheet('fl', FL_RATE_SHEET_YEAR);
}

function tppExemption(): number {
  return getSheet()?.tpp?.exemption_amount ?? 0;
}

function tppFiling(): TPPFiling | null {
  const tpp = getSheet()?.tpp;
  if (!tpp?.filing_form || !tpp?.filing_deadline) return null;
  return {
    formName: tpp.filing_form,
    deadline: tpp.filing_deadline,
    penaltyPct: 0.25, // FL §193.072: 25% penalty for late rendition
  };
}

// ── Section C helpers (load from rate sheet) ──────────────────────────────────

function lookupStateIncomeRate(entityType: EntityType): number {
  const sheet = getSheet();
  if (!sheet?.state_income_tax_rate?.length) {
    throw new Error(
      `[flRuleset] fl-${FL_RATE_SHEET_YEAR} rate sheet missing state_income_tax_rate. ` +
      `Ensure initRateSheets() ran at boot.`,
    );
  }
  const match = sheet.state_income_tax_rate.find(r => r.entity_type === entityType);
  if (!match) {
    throw new Error(
      `[flRuleset] No state income tax rate for entity type "${entityType}" ` +
      `in fl-${FL_RATE_SHEET_YEAR}.json.`,
    );
  }
  return match.rate;
}

function conformsBonusDep(): boolean {
  return getSheet()?.conforms_to_bonus_dep ?? true;
}

function conformsCostSeg(): boolean {
  return getSheet()?.conforms_to_cost_seg ?? true;
}

export const flRuleset: TaxRuleset = {
  jurisdiction: 'FL',

  // ── Section A ─────────────────────────────────────────────────────────────────

  annualPropertyTax(ctx: TaxContext, year: number, prevAssessedValue: number): ReTaxYear {
    const isMiamiDade = resolveIsMiamiDade(ctx);
    const millageRate = resolveMillage(ctx, isMiamiDade);
    const baseAssessed = ctx.assessedValueOverride ?? ctx.purchasePrice ?? 0;

    const isReassessment = year === 1;
    const marketValue = baseAssessed * Math.pow(1 + FL_MARKET_GROWTH, year - 1);
    let assessedValue: number;
    let sohCapBinding = false;
    let rawAssessedValue: number;

    if (year === 1) {
      rawAssessedValue = baseAssessed;
      assessedValue = baseAssessed;
    } else {
      const capLimited = Math.min(marketValue, prevAssessedValue * (1 + FL_SOH_CAP));
      sohCapBinding = marketValue > capLimited + 1;
      rawAssessedValue = capLimited;
      assessedValue = Math.round(capLimited);
    }

    const taxAmount = Math.round(assessedValue * (millageRate / 1000));
    return { year, assessedValue, _rawAssessedValue: rawAssessedValue, millageRate, taxAmount, sohCapBinding, reassessmentEvent: isReassessment };
  },

  acquisitionTransferTax(ctx: TaxContext): TransferTaxResult {
    const isMiamiDade = resolveIsMiamiDade(ctx);
    const miamiDadeRatePct = 0.0105;
    const statewideFlatRatePct = 0.0070;
    // When county is explicitly provided, the county overlay handles the surtax separately.
    // Only use the combined 1.05% rate when Miami-Dade is detected via city (safety net path).
    const appliedRatePct = (isMiamiDade && ctx.county == null) ? miamiDadeRatePct : statewideFlatRatePct;
    const docStampAmount = ctx.purchasePrice != null ? Math.round(ctx.purchasePrice * appliedRatePct) : null;
    const intangibleTaxAmount = ctx.loanAmount != null ? Math.round(ctx.loanAmount * 0.002) : null;
    const totalTransferTax = ((docStampAmount ?? 0) + (intangibleTaxAmount ?? 0)) || null;

    let refi: TransferTaxResult['refi'] = null;
    if (ctx.refiEnabled) {
      const refiLoanAmount = ctx.loanAmount;
      const refiDocStampAmount = refiLoanAmount != null ? Math.round(refiLoanAmount * 0.0035) : null;
      const refiIntangibleTaxAmount = refiLoanAmount != null ? Math.round(refiLoanAmount * 0.002) : null;
      const refiTotalTax = ((refiDocStampAmount ?? 0) + (refiIntangibleTaxAmount ?? 0)) || null;
      refi = { enabled: ctx.refiEnabled, triggerYear: ctx.refiTriggerYear, newLoanType: ctx.refiNewLoanType, refiLoanAmount, refiDocStampAmount, refiIntangibleTaxAmount, refiTotalTax };
    } else {
      refi = { enabled: false, triggerYear: ctx.refiTriggerYear, newLoanType: ctx.refiNewLoanType, refiLoanAmount: null, refiDocStampAmount: null, refiIntangibleTaxAmount: null, refiTotalTax: null };
    }

    return { isMiamiDade, miamiDadeRatePct, statewideFlatRatePct, appliedRatePct, docStampAmount, intangibleTaxAmount, loanAmount: ctx.loanAmount, totalTransferTax, refi };
  },

  dispositionTransferTax(salePrice: number, ctx: TaxContext): number {
    const isMiamiDade = resolveIsMiamiDade(ctx);
    // Same rule: use base 0.70% when county is provided (overlay handles surtax separately)
    const rate = (isMiamiDade && ctx.county == null) ? 0.0105 : 0.0070;
    return Math.round(salePrice * rate);
  },

  reassessmentOnSale(_ctx: TaxContext): 'full' | 'capped' | 'none' { return 'full'; },
  annualAssessmentCap(): number | null { return FL_SOH_CAP; },

  specialTaxes(ctx: TaxContext): SpecialTax[] {
    const taxes: SpecialTax[] = [];
    if (ctx.loanAmount != null && ctx.loanAmount > 0) {
      taxes.push({ name: 'Intangible Tax on Mortgage', description: 'FL §199.133 — 0.2% of mortgage note amount, paid at closing', amount: Math.round(ctx.loanAmount * 0.002), trigger: 'acquisition' });
    }
    return taxes;
  },

  abatementEligibility(_ctx: TaxContext): AbatementProgram[] {
    return [{
      name: 'Chapter 196 Economic Development Exemption',
      description: 'FL commercial real property may qualify for partial ad valorem exemption for new or expanding businesses (county-level approval required).',
      estimatedAnnualSavings: null,
      eligibilityUrl: 'https://floridarevenue.com/property/Pages/LocalOption_ExemptionsClassifications.aspx',
    }];
  },

  // ── Section B — TPP (FL §193.052; form DR-405; $25,000 exemption) ─────────

  taxesTPP(): boolean {
    return getSheet()?.tpp?.taxed ?? true;
  },

  tppTax(ctx: TPPContext, year: number): TaxLineResult {
    if (!this.taxesTPP()) {
      return { amount: 0, formula: 'taxesTPP()=false', inputs: {}, reassessmentEventInYear: false, confidence: 'low', notes: [] };
    }
    const exemption = tppExemption();
    const millage = ctx.county?.toLowerCase().includes('miami') ? FL_MILLAGE_MIAMI_DADE : FL_MILLAGE_STATEWIDE;
    const ffEBase = ctx.ffEAssessedValue ?? (ctx.units > 0 ? ctx.units * 5000 : 0);
    const depRate = Math.max(0, 1 - (ctx.ffEAgeYears / 20));
    const taxableBase = Math.max(0, Math.round(ffEBase * depRate) - exemption);
    const amount = Math.round(taxableBase * (millage / 1000));
    return {
      amount,
      formula: `max(0, ffEBase × depRate - exemption) × (millage / 1000)`,
      inputs: {
        ffEBase: { value: ffEBase, source: ctx.ffEAssessedValue != null ? 'user-supplied' : 'platform-estimate ($5k/unit)' },
        depRate: { value: depRate, source: `1 - ageYears(${ctx.ffEAgeYears}) / 20` },
        exemption: { value: exemption, source: `fl-${FL_RATE_SHEET_YEAR}.json tpp.exemption_amount` },
        millage: { value: millage, source: 'fl.ruleset default millage' },
        year: { value: year, source: 'hold year' },
      },
      reassessmentEventInYear: year === 1,
      confidence: ctx.ffEAssessedValue != null ? 'medium' : 'low',
      notes: ctx.ffEAssessedValue == null ? ['FF&E assessed value not provided — using $5k/unit estimate'] : [],
    };
  },

  tppExemptionAmount(): number { return tppExemption(); },

  tppMillage(ctx: TaxContext): number {
    return resolveMillage(ctx, resolveIsMiamiDade(ctx));
  },

  tppFilingRequirement(): TPPFiling | null { return tppFiling(); },

  // ── Section C — state income tax rates from rate sheet ────────────────────

  depreciationLife(_propertyType: AssetClass): number { return 0; }, // federal owns dep life
  bonusDepreciationPct(_year: number): number { return 0; },          // federal owns bonus dep
  costSegEligible(_propertyType: AssetClass): boolean { return false; }, // federal owns cost seg

  stateIncomeTaxRate(entityType: EntityType): number {
    return lookupStateIncomeRate(entityType);
  },

  conformsToBonusDep(): boolean { return conformsBonusDep(); },
  conformsToCostSeg(): boolean { return conformsCostSeg(); },

  // ── Metadata ─────────────────────────────────────────────────────────────────

  requiresInputs(): string[] { return ['purchasePrice', 'loanAmount', 'city', 'county', 'holdYears']; },
  dataSourceHints(): string[] {
    return [
      'Miami-Dade Property Appraiser: https://www.miamidade.gov/pa/',
      'FL Truth in Millage (TRIM): county property appraiser website',
      'FL DOR Ad Valorem Statistics: https://floridarevenue.com/property',
    ];
  },
};
