/**
 * Florida Tax Ruleset
 *
 * Implements the TaxRuleset interface for Florida commercial (non-homestead) real estate.
 *
 * Key mechanics:
 * - Non-homestead SOH cap: 10% max annual assessed-value increase
 * - Reassessment on sale: full (purchase price becomes new assessed value)
 * - Miami-Dade county: higher millage + Miami-Dade doc stamp rate
 * - Acquisition doc stamps: 0.70% statewide / 1.05% Miami-Dade
 * - Intangible tax on mortgage: 0.2% of loan amount
 * - Refi: doc stamps 0.35% + intangible tax 0.2% on new note
 *
 * Millage defaults (mills per $1,000 assessed value):
 *   Miami-Dade non-homestead: 23.09   (FY2024/25 blended)
 *   Statewide FL commercial:  20.00   (conservative statewide median)
 *
 * These defaults fire only when no county millage data is available from the DB.
 * Override via ctx.millageRateOverride.
 *
 * Source: FL Statutes §193.155, §201.02, §199.133; Miami-Dade TRIM notices
 */

import type { TaxContext, TaxRuleset, ReTaxYear, TransferTaxResult, SpecialTax, AbatementProgram } from '../types';

const FL_SOH_CAP = 0.10;        // 10% non-homestead annual assessed-value cap
const FL_MARKET_GROWTH = 0.12; // 12%/yr appreciation assumption — exceeds cap so cap binds
const FL_MILLAGE_MIAMI_DADE = 23.09;  // mills per $1,000 assessed (FY2024/25)
const FL_MILLAGE_STATEWIDE = 20.00;   // mills per $1,000 assessed

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

/**
 * Determine if a deal is in Miami-Dade county.
 *
 * Resolution order:
 * 1. countyOverride (explicit user override: 1=Miami-Dade, 0=statewide)
 * 2. ctx.county field (preferred — resolved upstream via resolver.deriveCounty())
 * 3. City-name fallback (safety net when county resolution fails)
 */
function resolveIsMiamiDade(ctx: TaxContext): boolean {
  if (ctx.countyOverride !== null) return ctx.countyOverride;
  if (ctx.county != null) return ctx.county.toLowerCase().includes('miami-dade');
  if (ctx.city) return MIAMI_DADE_CITIES_FALLBACK.has(ctx.city.toLowerCase().trim());
  return false;
}

function resolveMillage(ctx: TaxContext, isMiamiDade: boolean): number {
  if (ctx.millageRateOverride != null) return ctx.millageRateOverride;
  return isMiamiDade ? FL_MILLAGE_MIAMI_DADE : FL_MILLAGE_STATEWIDE;
}

export const flRuleset: TaxRuleset = {
  jurisdiction: 'FL',

  annualPropertyTax(ctx: TaxContext, year: number, prevAssessedValue: number): ReTaxYear {
    const isMiamiDade = resolveIsMiamiDade(ctx);
    const millageRate = resolveMillage(ctx, isMiamiDade);
    const baseAssessed = ctx.assessedValueOverride ?? ctx.purchasePrice ?? 0;

    const isReassessment = year === 1;
    const marketValue = baseAssessed * Math.pow(1 + FL_MARKET_GROWTH, year - 1);
    let assessedValue: number;
    let sohCapBinding = false;

    if (year === 1) {
      assessedValue = baseAssessed;
    } else {
      const capLimited = Math.min(marketValue, prevAssessedValue * (1 + FL_SOH_CAP));
      sohCapBinding = marketValue > capLimited + 1;
      assessedValue = Math.round(capLimited);
    }

    const taxAmount = Math.round(assessedValue * (millageRate / 1000));
    return { year, assessedValue, millageRate, taxAmount, sohCapBinding, reassessmentEvent: isReassessment };
  },

  acquisitionTransferTax(ctx: TaxContext): TransferTaxResult {
    const isMiamiDade = resolveIsMiamiDade(ctx);
    const millageRate = resolveMillage(ctx, isMiamiDade);
    const miamiDadeRatePct = 0.0105;
    const statewideFlatRatePct = 0.0070;
    const appliedRatePct = isMiamiDade ? miamiDadeRatePct : statewideFlatRatePct;
    const docStampAmount = ctx.purchasePrice != null ? Math.round(ctx.purchasePrice * appliedRatePct) : null;
    const intangibleTaxAmount = ctx.loanAmount != null ? Math.round(ctx.loanAmount * 0.002) : null;
    const totalTransferTax = ((docStampAmount ?? 0) + (intangibleTaxAmount ?? 0)) || null;

    let refi: TransferTaxResult['refi'] = null;
    if (ctx.refiEnabled) {
      const refiLoanAmount = ctx.loanAmount;
      const refiDocStampAmount = refiLoanAmount != null ? Math.round(refiLoanAmount * 0.0035) : null;
      const refiIntangibleTaxAmount = refiLoanAmount != null ? Math.round(refiLoanAmount * 0.002) : null;
      const refiTotalTax = ((refiDocStampAmount ?? 0) + (refiIntangibleTaxAmount ?? 0)) || null;
      refi = {
        enabled: ctx.refiEnabled,
        triggerYear: ctx.refiTriggerYear,
        newLoanType: ctx.refiNewLoanType,
        refiLoanAmount,
        refiDocStampAmount,
        refiIntangibleTaxAmount,
        refiTotalTax,
      };
    } else {
      refi = {
        enabled: false,
        triggerYear: ctx.refiTriggerYear,
        newLoanType: ctx.refiNewLoanType,
        refiLoanAmount: null,
        refiDocStampAmount: null,
        refiIntangibleTaxAmount: null,
        refiTotalTax: null,
      };
    }

    return {
      isMiamiDade,
      miamiDadeRatePct,
      statewideFlatRatePct,
      appliedRatePct,
      docStampAmount,
      intangibleTaxAmount,
      loanAmount: ctx.loanAmount,
      totalTransferTax,
      refi,
    };
  },

  dispositionTransferTax(salePrice: number, ctx: TaxContext): number {
    const isMiamiDade = resolveIsMiamiDade(ctx);
    const rate = isMiamiDade ? 0.0105 : 0.0070;
    return Math.round(salePrice * rate);
  },

  reassessmentOnSale(_ctx: TaxContext): 'full' | 'capped' | 'none' {
    return 'full';
  },

  annualAssessmentCap(): number | null {
    return FL_SOH_CAP;
  },

  specialTaxes(ctx: TaxContext): SpecialTax[] {
    const taxes: SpecialTax[] = [];
    if (ctx.loanAmount != null && ctx.loanAmount > 0) {
      taxes.push({
        name: 'Intangible Tax on Mortgage',
        description: 'FL §199.133 — 0.2% of mortgage note amount, paid at closing',
        amount: Math.round(ctx.loanAmount * 0.002),
        trigger: 'acquisition',
      });
    }
    return taxes;
  },

  abatementEligibility(_ctx: TaxContext): AbatementProgram[] {
    return [
      {
        name: 'Chapter 196 Economic Development Exemption',
        description: 'FL commercial real property may qualify for partial ad valorem exemption for new or expanding businesses (county-level approval required).',
        estimatedAnnualSavings: null,
        eligibilityUrl: 'https://floridarevenue.com/property/Pages/LocalOption_ExemptionsClassifications.aspx',
      },
    ];
  },

  requiresInputs(): string[] {
    return ['purchasePrice', 'loanAmount', 'city', 'county', 'holdYears'];
  },

  dataSourceHints(): string[] {
    return [
      'Miami-Dade Property Appraiser: https://www.miamidade.gov/pa/',
      'FL Truth in Millage (TRIM): county property appraiser website',
      'FL DOR Ad Valorem Statistics: https://floridarevenue.com/property',
    ];
  },
};
