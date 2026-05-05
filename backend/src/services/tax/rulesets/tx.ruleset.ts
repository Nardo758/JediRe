/**
 * Texas Tax Ruleset
 *
 * Implements TaxRuleset for Texas commercial real estate.
 *
 * Key mechanics:
 * - No state income tax, no doc stamps, no transfer tax at state level
 * - County recording fee: ~$25 flat (not percentage-based, modeled as zero for proforma)
 * - No SOH cap on commercial property
 * - Annual appraisal: assessed to market value each year
 * - Reassessment on sale: full
 *
 * Millage defaults (effective tax rate; live TX Comptroller rates injected upstream):
 *   Harris County (Houston):  22.00 mills — hardcoded fallback
 *   Dallas County:            20.00 mills
 *   Tarrant County:           20.50 mills
 *   Travis County (Austin):   19.50 mills
 *   Bexar County (SA):        20.00 mills
 *   Other TX:                 18.00 mills — conservative statewide
 *
 * Section B (Business Personal Property): taxed=true, form 50-144, deadline April 15
 *   Values loaded from tx-2026.json rate sheet.
 *
 * Section C: stateIncomeTaxRate=0 (no TX income tax); conformsToBonusDep=true
 *   TX franchise tax is explicitly out of v1 scope per spec.
 *
 * Sources: HCAD, DCAD, TAD; TX Tax Code Chapter 11, 23
 */

import type {
  TaxContext, TaxRuleset, ReTaxYear, TransferTaxResult,
  SpecialTax, AbatementProgram, TPPContext, TaxLineResult, TPPFiling,
  AssetClass, EntityType,
} from '../types';
import { getRateSheet } from '../rateSheets/loader';

const TX_EFFECTIVE_RATES: Record<string, number> = {
  'harris':  22.00,
  'dallas':  20.00,
  'tarrant': 20.50,
  'travis':  19.50,
  'bexar':   20.00,
};
const TX_DEFAULT_MILLAGE = 18.00;

const TX_RATE_SHEET_YEAR = 2026;

function getSheet() {
  return getRateSheet('tx', TX_RATE_SHEET_YEAR);
}

function resolveMillage(ctx: TaxContext): number {
  if (ctx.millageRateOverride != null) return ctx.millageRateOverride;
  const county = ctx.county?.toLowerCase().trim() ?? '';
  return TX_EFFECTIVE_RATES[county] ?? TX_DEFAULT_MILLAGE;
}

// ── Section B helpers ─────────────────────────────────────────────────────────

function tppExemption(): number {
  return getSheet()?.tpp?.exemption_amount ?? 0;
}

function tppFiling(): TPPFiling | null {
  const tpp = getSheet()?.tpp;
  if (!tpp?.filing_form || !tpp?.filing_deadline) return null;
  return {
    formName: tpp.filing_form,
    deadline: tpp.filing_deadline,
    penaltyPct: 0.10, // TX Tax Code §22.28: 10% rendition penalty
  };
}

// ── Section C helpers ─────────────────────────────────────────────────────────

function conformsBonusDep(): boolean {
  return getSheet()?.conforms_to_bonus_dep ?? true;
}

function conformsCostSeg(): boolean {
  return getSheet()?.conforms_to_cost_seg ?? true;
}

export const txRuleset: TaxRuleset = {
  jurisdiction: 'TX',

  // ── Section A ─────────────────────────────────────────────────────────────────

  annualPropertyTax(ctx: TaxContext, year: number, prevAssessedValue: number): ReTaxYear {
    const millageRate = resolveMillage(ctx);
    const baseAssessed = ctx.assessedValueOverride ?? ctx.purchasePrice ?? 0;
    const isReassessment = year === 1;
    const assessedValue = year === 1
      ? Math.round(baseAssessed)
      : Math.round(prevAssessedValue * 1.03);
    const taxAmount = Math.round(assessedValue * (millageRate / 1000));
    return { year, assessedValue, millageRate, taxAmount, sohCapBinding: false, reassessmentEvent: isReassessment };
  },

  acquisitionTransferTax(ctx: TaxContext): TransferTaxResult {
    return {
      isMiamiDade: false, miamiDadeRatePct: 0, statewideFlatRatePct: 0,
      appliedRatePct: 0, docStampAmount: null, intangibleTaxAmount: null,
      loanAmount: ctx.loanAmount, totalTransferTax: null,
      refi: { enabled: ctx.refiEnabled, triggerYear: ctx.refiTriggerYear, newLoanType: ctx.refiNewLoanType, refiLoanAmount: null, refiDocStampAmount: null, refiIntangibleTaxAmount: null, refiTotalTax: null },
    };
  },

  dispositionTransferTax(_salePrice: number, _ctx: TaxContext): number { return 0; },
  reassessmentOnSale(_ctx: TaxContext): 'full' | 'capped' | 'none' { return 'full'; },
  annualAssessmentCap(): number | null { return null; },
  specialTaxes(_ctx: TaxContext): SpecialTax[] { return []; },

  abatementEligibility(_ctx: TaxContext): AbatementProgram[] {
    return [
      { name: 'Chapter 313 / Economic Development Abatement', description: 'TX local government may grant ad valorem tax abatement for qualifying projects.', estimatedAnnualSavings: null, eligibilityUrl: 'https://comptroller.texas.gov/taxes/property-tax/' },
      { name: 'HCAD / DCAD Protest Window', description: 'Annual property appraisal can be protested before appraisal review board (ARB). Typically May deadline.', estimatedAnnualSavings: null, eligibilityUrl: 'https://www.hcad.org/appeals/' },
    ];
  },

  // ── Section B — TX BPP (TX Tax Code §22; form 50-144; April 15 deadline) ──

  taxesTPP(): boolean {
    return getSheet()?.tpp?.taxed ?? true;
  },

  tppTax(ctx: TPPContext, year: number): TaxLineResult {
    if (!this.taxesTPP()) {
      return { amount: 0, formula: 'taxesTPP()=false', inputs: {}, reassessmentEventInYear: false, confidence: 'low', notes: [] };
    }
    const exemption = tppExemption();
    const millage = resolveMillage({ millageRateOverride: null, county: ctx.county } as TaxContext);
    const ffEBase = ctx.ffEAssessedValue ?? (ctx.units > 0 ? ctx.units * 3500 : 0);
    const depRate = Math.max(0, 1 - (ctx.ffEAgeYears / 10));
    const taxableBase = Math.max(0, Math.round(ffEBase * depRate) - exemption);
    const amount = Math.round(taxableBase * (millage / 1000));
    return {
      amount,
      formula: `max(0, ffEBase × depRate - exemption) × (millage / 1000)`,
      inputs: {
        ffEBase: { value: ffEBase, source: ctx.ffEAssessedValue != null ? 'user-supplied' : 'platform-estimate ($3.5k/unit)' },
        depRate: { value: depRate, source: `1 - ageYears(${ctx.ffEAgeYears}) / 10 (TX 10yr schedule)` },
        exemption: { value: exemption, source: `tx-${TX_RATE_SHEET_YEAR}.json tpp.exemption_amount` },
        millage: { value: millage, source: 'tx.ruleset county millage' },
        year: { value: year, source: 'hold year' },
      },
      reassessmentEventInYear: year === 1,
      confidence: ctx.ffEAssessedValue != null ? 'medium' : 'low',
      notes: ctx.ffEAssessedValue == null ? ['FF&E assessed value not provided — using $3.5k/unit estimate'] : [],
    };
  },

  tppExemptionAmount(): number { return tppExemption(); },

  tppMillage(ctx: TaxContext): number { return resolveMillage(ctx); },

  tppFilingRequirement(): TPPFiling | null { return tppFiling(); },

  // ── Section C — TX has no state income tax ────────────────────────────────

  depreciationLife(_propertyType: AssetClass): number { return 0; }, // federal owns dep life
  bonusDepreciationPct(_year: number): number { return 0; },          // federal owns bonus dep
  costSegEligible(_propertyType: AssetClass): boolean { return false; }, // federal owns cost seg

  stateIncomeTaxRate(_entityType: EntityType): number { return 0; },

  conformsToBonusDep(): boolean { return conformsBonusDep(); },
  conformsToCostSeg(): boolean { return conformsCostSeg(); },

  // ── Metadata ─────────────────────────────────────────────────────────────────

  requiresInputs(): string[] { return ['purchasePrice', 'county', 'holdYears']; },
  dataSourceHints(): string[] {
    return [
      'Harris County Appraisal District: https://www.hcad.org/',
      'Dallas Central Appraisal District: https://www.dcad.org/',
      'TX Comptroller Property Tax: https://comptroller.texas.gov/taxes/property-tax/',
    ];
  },
};
