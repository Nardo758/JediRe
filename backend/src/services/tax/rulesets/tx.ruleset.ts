/**
 * Texas Tax Ruleset
 *
 * Implements TaxRuleset for Texas commercial real estate.
 *
 * Key mechanics:
 * - No state income tax
 * - No doc stamps or transfer tax at state level
 * - County recording fee: ~$25 flat (not percentage-based, so modeled as zero for proforma)
 * - No SOH cap on commercial property (10% cap is homestead only)
 * - Annual appraisal: assessed to market value each year (no multi-year cap for commercial)
 * - Reassessment on sale: full (appraisal district resets to purchase price)
 * - Chapter 313 / 313 successor abatement: placeholder for eligibility check
 *
 * Millage defaults (effective tax rate proxy; live TX Comptroller rates injected
 * upstream via liveMlillageService.ts before this ruleset runs):
 *   Harris County (Houston):  ~2.20% effective rate (hardcoded fallback)
 *   Dallas County:            ~2.00% effective rate
 *   Other TX:                 ~1.80% effective rate — conservative statewide
 *
 * Override via ctx.millageRateOverride (rate expressed as mills per $1,000).
 *
 * Section B (Business Personal Property) and Section C are stubbed as safe defaults.
 * Phase 3 will populate: taxesTPP()=true (TX BPP rendition), stateIncomeTaxRate=0,
 * conformsToBonusDep=true.
 * TX franchise tax is out of v1 scope per spec.
 *
 * Sources: HCAD, DCAD, TAD annual publications; TX Tax Code Chapter 11, 23, 313
 */

import type {
  TaxContext, TaxRuleset, ReTaxYear, TransferTaxResult,
  SpecialTax, AbatementProgram, TPPContext, TaxLineResult,
  AssetClass, EntityType,
} from '../types';

const TX_EFFECTIVE_RATES: Record<string, number> = {
  'harris':  22.00,  // mills (2.20%) — hardcoded fallback; live rates from liveMlillageService
  'dallas':  20.00,  // mills (2.00%)
  'tarrant': 20.50,  // mills (2.05%) — Fort Worth area
  'travis':  19.50,  // mills (1.95%) — Austin area
  'bexar':   20.00,  // mills (2.00%) — San Antonio area
};
const TX_DEFAULT_MILLAGE = 18.00;  // mills — conservative statewide fallback (1.80%)

function resolveMillage(ctx: TaxContext): number {
  if (ctx.millageRateOverride != null) return ctx.millageRateOverride;
  const county = ctx.county?.toLowerCase().trim() ?? '';
  return TX_EFFECTIVE_RATES[county] ?? TX_DEFAULT_MILLAGE;
}

const ZERO_TPP_RESULT: TaxLineResult = {
  amount: 0,
  formula: 'taxesTPP()=false for TX (Phase 1 stub; Phase 3 will enable BPP rendition)',
  inputs: {},
  reassessmentEventInYear: false,
  confidence: 'low',
  notes: ['TX Business Personal Property tax not yet wired — Phase 3 expansion pending'],
};

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
      { name: 'Chapter 313 / Economic Development Abatement', description: 'TX local government may grant ad valorem tax abatement for qualifying projects. Successor program post-2022 expiration varies by county.', estimatedAnnualSavings: null, eligibilityUrl: 'https://comptroller.texas.gov/taxes/property-tax/' },
      { name: 'HCAD / DCAD Protest Window', description: 'Annual property appraisal can be protested before appraisal review board (ARB). Typically May deadline.', estimatedAnnualSavings: null, eligibilityUrl: 'https://www.hcad.org/appeals/' },
    ];
  },

  // ── Section B (Phase 1 safe defaults — Phase 3 will enable TX BPP rendition) ─

  taxesTPP(): boolean { return false; },
  tppTax(_ctx: TPPContext, _year: number): TaxLineResult { return ZERO_TPP_RESULT; },
  tppExemptionAmount(): number { return 0; },
  tppMillage(_ctx: TaxContext): number { return 0; },
  tppFilingRequirement() { return null; },

  // ── Section C (TX: no state income tax; correct even in Phase 1) ──────────────

  depreciationLife(_propertyType: AssetClass): number { return 27.5; },
  bonusDepreciationPct(_year: number): number { return 0; },
  costSegEligible(_propertyType: AssetClass): boolean { return false; },
  stateIncomeTaxRate(_entityType: EntityType): number { return 0; },
  conformsToBonusDep(): boolean { return true; },
  conformsToCostSeg(): boolean { return true; },

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
