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
 * Millage defaults (effective tax rate proxy):
 *   Harris County (Houston):  ~2.20% effective rate (blended city + county + HISD + MUD)
 *   Dallas County:            ~2.00% effective rate (blended city + county + DISD)
 *   Other TX:                 ~1.80% effective rate (conservative statewide commercial estimate)
 *
 * Override via ctx.millageRateOverride (rate expressed as mills per $1,000).
 *
 * Sources: HCAD, DCAD, TAD annual publications; TX Tax Code Chapter 11, 23, 313
 */

import type { TaxContext, TaxRuleset, ReTaxYear, TransferTaxResult, SpecialTax, AbatementProgram } from '../types';

const TX_EFFECTIVE_RATES: Record<string, number> = {
  'harris': 22.00,    // mills (2.20%)
  'dallas': 20.00,    // mills (2.00%)
  'tarrant': 20.50,   // mills (2.05%) — Fort Worth area
  'travis': 19.50,    // mills (1.95%) — Austin area
  'bexar': 20.00,     // mills (2.00%) — San Antonio area
};
const TX_DEFAULT_MILLAGE = 18.00;  // mills — conservative statewide fallback (1.80%)

function resolveMillage(ctx: TaxContext): number {
  if (ctx.millageRateOverride != null) return ctx.millageRateOverride;
  const county = ctx.county?.toLowerCase().trim() ?? '';
  return TX_EFFECTIVE_RATES[county] ?? TX_DEFAULT_MILLAGE;
}

export const txRuleset: TaxRuleset = {
  jurisdiction: 'TX',

  annualPropertyTax(ctx: TaxContext, year: number, prevAssessedValue: number): ReTaxYear {
    const millageRate = resolveMillage(ctx);
    const baseAssessed = ctx.assessedValueOverride ?? ctx.purchasePrice ?? 0;

    const isReassessment = year === 1;
    let assessedValue: number;

    if (year === 1) {
      assessedValue = Math.round(baseAssessed);
    } else {
      assessedValue = Math.round(prevAssessedValue * 1.03);
    }

    const sohCapBinding = false;
    const taxAmount = Math.round(assessedValue * (millageRate / 1000));
    return { year, assessedValue, millageRate, taxAmount, sohCapBinding, reassessmentEvent: isReassessment };
  },

  acquisitionTransferTax(ctx: TaxContext): TransferTaxResult {
    return {
      isMiamiDade: false,
      miamiDadeRatePct: 0,
      statewideFlatRatePct: 0,
      appliedRatePct: 0,
      docStampAmount: null,
      intangibleTaxAmount: null,
      loanAmount: ctx.loanAmount,
      totalTransferTax: null,
      refi: {
        enabled: ctx.refiEnabled,
        triggerYear: ctx.refiTriggerYear,
        newLoanType: ctx.refiNewLoanType,
        refiLoanAmount: null,
        refiDocStampAmount: null,
        refiIntangibleTaxAmount: null,
        refiTotalTax: null,
      },
    };
  },

  dispositionTransferTax(_salePrice: number, _ctx: TaxContext): number {
    return 0;
  },

  reassessmentOnSale(_ctx: TaxContext): 'full' | 'capped' | 'none' {
    return 'full';
  },

  annualAssessmentCap(): number | null {
    return null;
  },

  specialTaxes(_ctx: TaxContext): SpecialTax[] {
    return [];
  },

  abatementEligibility(_ctx: TaxContext): AbatementProgram[] {
    return [
      {
        name: 'Chapter 313 / Economic Development Abatement',
        description: 'TX local government may grant ad valorem tax abatement for qualifying projects. Successor program post-2022 expiration varies by county.',
        estimatedAnnualSavings: null,
        eligibilityUrl: 'https://comptroller.texas.gov/taxes/property-tax/',
      },
      {
        name: 'HCAD / DCAD Protest Window',
        description: 'Annual property appraisal can be protested before appraisal review board (ARB). Typically May deadline.',
        estimatedAnnualSavings: null,
        eligibilityUrl: 'https://www.hcad.org/appeals/',
      },
    ];
  },

  requiresInputs(): string[] {
    return ['purchasePrice', 'county', 'holdYears'];
  },

  dataSourceHints(): string[] {
    return [
      'Harris County Appraisal District: https://www.hcad.org/',
      'Dallas Central Appraisal District: https://www.dcad.org/',
      'TX Comptroller Property Tax: https://comptroller.texas.gov/taxes/property-tax/',
    ];
  },
};
