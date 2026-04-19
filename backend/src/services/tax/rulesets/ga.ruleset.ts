/**
 * Georgia Tax Ruleset
 *
 * Implements TaxRuleset for Georgia commercial real estate.
 *
 * Key mechanics:
 * - State deed transfer tax: $1.00 per $1,000 of purchase price (0.1%)
 * - No intangible tax on new mortgages for commercial property
 * - Annual assessment: typically annual, no cap for commercial
 * - Reassessment on sale: full
 * - No SOH cap equivalent for commercial property
 *
 * Millage defaults (mills per $1,000 of assessed value at 40% of FMV):
 *   GA assesses at 40% of fair market value (FMV). Effective tax rate = millage × 0.40.
 *   Fulton County:  ~29 mills on assessed (= ~1.16% effective on FMV)
 *   DeKalb County:  ~33 mills on assessed (= ~1.32% effective on FMV)
 *   Gwinnett County:~27 mills on assessed (= ~1.08% effective on FMV)
 *   Other GA:       ~27 mills on assessed (= ~1.08% effective on FMV) — conservative fallback
 *
 * Note: GA assessed value = 40% of appraised fair market value.
 * We apply the millage to the full purchase price for simplicity (equivalent to 40% × 2.5× millage).
 * Override via ctx.millageRateOverride.
 *
 * Sources: Fulton County Tax Commissioner, DeKalb County Tax Commissioner,
 *          GA Department of Revenue Property Tax Division
 */

import type { TaxContext, TaxRuleset, ReTaxYear, TransferTaxResult, SpecialTax, AbatementProgram } from '../types';

const GA_MILLAGE_RATES: Record<string, number> = {
  'fulton':   11.60,  // mills applied to FMV (= 29 mills × 40% assessment ratio)
  'dekalb':   13.20,  // mills applied to FMV (= 33 mills × 40%)
  'gwinnett': 10.80,  // mills applied to FMV (= 27 mills × 40%)
  'cobb':     10.00,  // mills applied to FMV (= 25 mills × 40%)
  'clayton':  13.00,  // mills applied to FMV
  'cherokee':  9.20,  // mills applied to FMV
};
const GA_DEFAULT_MILLAGE = 10.80; // mills applied to FMV — conservative statewide fallback

const GA_DEED_TRANSFER_RATE = 0.001;  // $1.00 per $1,000 = 0.1%
const GA_ANNUAL_APPRECIATION = 0.04;  // 4%/yr assessment growth assumption

function resolveMillage(ctx: TaxContext): number {
  if (ctx.millageRateOverride != null) return ctx.millageRateOverride;
  const county = ctx.county?.toLowerCase().trim() ?? '';
  return GA_MILLAGE_RATES[county] ?? GA_DEFAULT_MILLAGE;
}

export const gaRuleset: TaxRuleset = {
  jurisdiction: 'GA',

  annualPropertyTax(ctx: TaxContext, year: number, prevAssessedValue: number): ReTaxYear {
    const millageRate = resolveMillage(ctx);
    const baseAssessed = ctx.assessedValueOverride ?? ctx.purchasePrice ?? 0;

    const isReassessment = year === 1;
    let assessedValue: number;

    if (year === 1) {
      assessedValue = Math.round(baseAssessed);
    } else {
      assessedValue = Math.round(prevAssessedValue * (1 + GA_ANNUAL_APPRECIATION));
    }

    const sohCapBinding = false;
    const taxAmount = Math.round(assessedValue * (millageRate / 1000));
    return { year, assessedValue, millageRate, taxAmount, sohCapBinding, reassessmentEvent: isReassessment };
  },

  acquisitionTransferTax(ctx: TaxContext): TransferTaxResult {
    const docStampAmount = ctx.purchasePrice != null
      ? Math.round(ctx.purchasePrice * GA_DEED_TRANSFER_RATE)
      : null;
    const totalTransferTax = docStampAmount;

    return {
      isMiamiDade: false,
      miamiDadeRatePct: 0,
      statewideFlatRatePct: GA_DEED_TRANSFER_RATE,
      appliedRatePct: GA_DEED_TRANSFER_RATE,
      docStampAmount,
      intangibleTaxAmount: null,
      loanAmount: ctx.loanAmount,
      totalTransferTax,
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

  dispositionTransferTax(salePrice: number, _ctx: TaxContext): number {
    return Math.round(salePrice * GA_DEED_TRANSFER_RATE);
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
        name: 'GA Freeport Exemption',
        description: 'Business inventory held for export may qualify for partial exemption (primarily industrial/warehouse).',
        estimatedAnnualSavings: null,
        eligibilityUrl: 'https://dor.georgia.gov/local-government-services/digest-compliance/freeport-exemption',
      },
      {
        name: 'Conservation Use Valuation',
        description: 'Land in bona fide conservation use may qualify for preferential assessment. Primarily applies to undeveloped land.',
        estimatedAnnualSavings: null,
        eligibilityUrl: 'https://dor.georgia.gov/conservation-use',
      },
    ];
  },

  requiresInputs(): string[] {
    return ['purchasePrice', 'county', 'holdYears'];
  },

  dataSourceHints(): string[] {
    return [
      'Fulton County Tax Commissioner: https://www.fultoncountytaxes.org/',
      'DeKalb County Tax Commissioner: https://www.dekalbcountyga.gov/tax-commissioner',
      'GA Department of Revenue: https://dor.georgia.gov/local-government-services',
    ];
  },
};
