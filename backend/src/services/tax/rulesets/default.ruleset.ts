/**
 * Default Tax Ruleset — Generic Fallback
 *
 * Used when the deal's jurisdiction doesn't match any specific ruleset.
 *
 * Uses a conservative generic ad valorem estimate:
 * - 1.2% effective tax rate on assessed value (purchase price)
 * - 0.1% deed recording / transfer tax at acquisition
 * - No intangible tax on mortgage
 * - No SOH cap (annual assessment grows at modest 3%/yr estimate)
 *
 * This ruleset is intentionally conservative. When a deal is in a new market,
 * the CashFlow Agent will flag that jurisdiction-specific data isn't available
 * and recommend uploading the actual tax bill for accurate projection.
 */

import type { TaxContext, TaxRuleset, ReTaxYear, TransferTaxResult, SpecialTax, AbatementProgram } from '../types';

const DEFAULT_MILLAGE = 12.00;      // mills — proxy for 1.2% effective rate (12/1000 = 1.2%)
const DEFAULT_TRANSFER_RATE = 0.001; // 0.1% deed recording fee
const DEFAULT_ANNUAL_GROWTH = 0.03; // 3%/yr assessed value growth assumption

export const defaultRuleset: TaxRuleset = {
  jurisdiction: 'default',

  annualPropertyTax(ctx: TaxContext, year: number, prevAssessedValue: number): ReTaxYear {
    const millageRate = ctx.millageRateOverride ?? DEFAULT_MILLAGE;
    const baseAssessed = ctx.assessedValueOverride ?? ctx.purchasePrice ?? 0;

    const isReassessment = year === 1;
    const assessedValue = year === 1
      ? Math.round(baseAssessed)
      : Math.round(prevAssessedValue * (1 + DEFAULT_ANNUAL_GROWTH));

    const taxAmount = Math.round(assessedValue * (millageRate / 1000));
    return { year, assessedValue, millageRate, taxAmount, sohCapBinding: false, reassessmentEvent: isReassessment };
  },

  acquisitionTransferTax(ctx: TaxContext): TransferTaxResult {
    const docStampAmount = ctx.purchasePrice != null
      ? Math.round(ctx.purchasePrice * DEFAULT_TRANSFER_RATE)
      : null;

    return {
      isMiamiDade: false,
      miamiDadeRatePct: 0,
      statewideFlatRatePct: DEFAULT_TRANSFER_RATE,
      appliedRatePct: DEFAULT_TRANSFER_RATE,
      docStampAmount,
      intangibleTaxAmount: null,
      loanAmount: ctx.loanAmount,
      totalTransferTax: docStampAmount,
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
    return Math.round(salePrice * DEFAULT_TRANSFER_RATE);
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
    return [];
  },

  requiresInputs(): string[] {
    return ['purchasePrice', 'holdYears'];
  },

  dataSourceHints(): string[] {
    return [
      'Upload actual tax bill PDF for accurate jurisdiction-specific projection.',
      'County assessor website for current millage rates.',
    ];
  },
};
