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
 * - GA assesses at 40% of FMV; millage table stores the effective rate (mills × 0.40)
 *
 * Millage defaults (effective mills applied directly to FMV):
 *   Fulton County:  11.60 mills  (29 mills × 40% assessment ratio)
 *   DeKalb County:  13.20 mills
 *   Gwinnett County:10.80 mills
 *   Other GA:       10.80 mills — conservative statewide fallback
 *
 * Section B (TPP): taxed=true, exemption=$7,500, form PT-50R, deadline April 1
 *   Values loaded from ga-2026.json rate sheet.
 *
 * Section C: stateIncomeTaxRate(all)=5.39% (SB 56 flat rate); conformsToBonusDep=false
 *   GA decouples from IRC §168(k) — no federal bonus dep at state level.
 *   Values loaded from ga-2026.json rate sheet.
 *
 * Sources: Fulton County Tax Commissioner, GA DOR Property Tax Division
 */

import type {
  TaxContext, TaxRuleset, ReTaxYear, TransferTaxResult,
  SpecialTax, AbatementProgram, TPPContext, TaxLineResult, TPPFiling,
  AssetClass, EntityType,
} from '../types';
import { getRateSheet } from '../rateSheets/loader';

const GA_MILLAGE_RATES: Record<string, number> = {
  'fulton':   11.60,
  'dekalb':   13.20,
  'gwinnett': 10.80,
  'cobb':     10.00,
  'clayton':  13.00,
  'cherokee':  9.20,
};
const GA_DEFAULT_MILLAGE = 10.80;
const GA_DEED_TRANSFER_RATE = 0.001;  // $1.00 per $1,000 = 0.1%
const GA_ANNUAL_APPRECIATION = 0.04;

const GA_RATE_SHEET_YEAR = 2026;

function getSheet() {
  return getRateSheet('ga', GA_RATE_SHEET_YEAR);
}

function resolveMillage(ctx: TaxContext): number {
  if (ctx.millageRateOverride != null) return ctx.millageRateOverride;
  const county = ctx.county?.toLowerCase().trim() ?? '';
  return GA_MILLAGE_RATES[county] ?? GA_DEFAULT_MILLAGE;
}

// ── Section B helpers ─────────────────────────────────────────────────────────

function tppExemption(): number {
  return getSheet()?.tpp?.exemption_amount ?? 7500;
}

function tppFiling(): TPPFiling | null {
  const tpp = getSheet()?.tpp;
  if (!tpp?.filing_form || !tpp?.filing_deadline) return null;
  return {
    formName: tpp.filing_form,
    deadline: tpp.filing_deadline,
    penaltyPct: 0.10, // GA §48-5-300: 10% penalty for failure to file rendition
  };
}

// ── Section C helpers ─────────────────────────────────────────────────────────

function lookupStateIncomeRate(entityType: EntityType): number {
  const sheet = getSheet();
  if (!sheet?.state_income_tax_rate?.length) {
    throw new Error(
      `[gaRuleset] ga-${GA_RATE_SHEET_YEAR} rate sheet missing state_income_tax_rate. ` +
      `Ensure initRateSheets() ran at boot.`,
    );
  }
  const match = sheet.state_income_tax_rate.find(r => r.entity_type === entityType);
  if (!match) {
    throw new Error(
      `[gaRuleset] No state income tax rate for entity type "${entityType}" ` +
      `in ga-${GA_RATE_SHEET_YEAR}.json.`,
    );
  }
  return match.rate;
}

function conformsBonusDep(): boolean {
  // GA explicitly decouples from IRC §168(k); rate sheet stores false.
  return getSheet()?.conforms_to_bonus_dep ?? false;
}

function conformsCostSeg(): boolean {
  return getSheet()?.conforms_to_cost_seg ?? true;
}

export const gaRuleset: TaxRuleset = {
  jurisdiction: 'GA',

  // ── Section A ─────────────────────────────────────────────────────────────────

  annualPropertyTax(ctx: TaxContext, year: number, prevAssessedValue: number): ReTaxYear {
    const millageRate = resolveMillage(ctx);
    const baseAssessed = ctx.assessedValueOverride ?? ctx.purchasePrice ?? 0;
    const isReassessment = year === 1;
    const assessedValue = year === 1
      ? Math.round(baseAssessed)
      : Math.round(prevAssessedValue * (1 + GA_ANNUAL_APPRECIATION));
    const taxAmount = Math.round(assessedValue * (millageRate / 1000));
    return { year, assessedValue, millageRate, taxAmount, sohCapBinding: false, reassessmentEvent: isReassessment };
  },

  acquisitionTransferTax(ctx: TaxContext): TransferTaxResult {
    const docStampAmount = ctx.purchasePrice != null
      ? Math.round(ctx.purchasePrice * GA_DEED_TRANSFER_RATE) : null;
    return {
      isMiamiDade: false, miamiDadeRatePct: 0, statewideFlatRatePct: GA_DEED_TRANSFER_RATE,
      appliedRatePct: GA_DEED_TRANSFER_RATE, docStampAmount, intangibleTaxAmount: null,
      loanAmount: ctx.loanAmount, totalTransferTax: docStampAmount,
      refi: { enabled: ctx.refiEnabled, triggerYear: ctx.refiTriggerYear, newLoanType: ctx.refiNewLoanType, refiLoanAmount: null, refiDocStampAmount: null, refiIntangibleTaxAmount: null, refiTotalTax: null },
    };
  },

  dispositionTransferTax(salePrice: number, _ctx: TaxContext): number {
    return Math.round(salePrice * GA_DEED_TRANSFER_RATE);
  },

  reassessmentOnSale(_ctx: TaxContext): 'full' | 'capped' | 'none' { return 'full'; },
  annualAssessmentCap(): number | null { return null; },

  specialTaxes(_ctx: TaxContext): SpecialTax[] { return []; },

  abatementEligibility(_ctx: TaxContext): AbatementProgram[] {
    return [
      { name: 'GA Freeport Exemption', description: 'Business inventory held for export may qualify for partial exemption (primarily industrial/warehouse).', estimatedAnnualSavings: null, eligibilityUrl: 'https://dor.georgia.gov/local-government-services/digest-compliance/freeport-exemption' },
      { name: 'Conservation Use Valuation', description: 'Land in bona fide conservation use may qualify for preferential assessment. Primarily applies to undeveloped land.', estimatedAnnualSavings: null, eligibilityUrl: 'https://dor.georgia.gov/conservation-use' },
    ];
  },

  // ── Section B — TPP (GA §48-5-7; form PT-50R; $7,500 exemption) ──────────

  taxesTPP(): boolean {
    return getSheet()?.tpp?.taxed ?? true;
  },

  tppTax(ctx: TPPContext, year: number): TaxLineResult {
    if (!this.taxesTPP()) {
      return { amount: 0, formula: 'taxesTPP()=false', inputs: {}, reassessmentEventInYear: false, confidence: 'low', notes: [] };
    }
    const exemption = tppExemption();
    const millage = resolveMillage({ millageRateOverride: null, county: ctx.county } as TaxContext);
    const ffEBase = ctx.ffEAssessedValue ?? (ctx.units > 0 ? ctx.units * 4000 : 0);
    const depRate = Math.max(0, 1 - (ctx.ffEAgeYears / 20));
    const taxableBase = Math.max(0, Math.round(ffEBase * depRate) - exemption);
    const amount = Math.round(taxableBase * (millage / 1000));
    return {
      amount,
      formula: `max(0, ffEBase × depRate - exemption) × (millage / 1000)`,
      inputs: {
        ffEBase: { value: ffEBase, source: ctx.ffEAssessedValue != null ? 'user-supplied' : 'platform-estimate ($4k/unit)' },
        depRate: { value: depRate, source: `1 - ageYears(${ctx.ffEAgeYears}) / 20` },
        exemption: { value: exemption, source: `ga-${GA_RATE_SHEET_YEAR}.json tpp.exemption_amount` },
        millage: { value: millage, source: 'ga.ruleset county millage' },
        year: { value: year, source: 'hold year' },
      },
      reassessmentEventInYear: year === 1,
      confidence: ctx.ffEAssessedValue != null ? 'medium' : 'low',
      notes: ctx.ffEAssessedValue == null ? ['FF&E assessed value not provided — using $4k/unit estimate'] : [],
    };
  },

  tppExemptionAmount(): number { return tppExemption(); },

  tppMillage(ctx: TaxContext): number { return resolveMillage(ctx); },

  tppFilingRequirement(): TPPFiling | null { return tppFiling(); },

  // ── Section C ─────────────────────────────────────────────────────────────

  depreciationLife(_propertyType: AssetClass): number { return 0; }, // federal owns dep life
  bonusDepreciationPct(_year: number): number { return 0; },          // federal owns bonus dep
  costSegEligible(_propertyType: AssetClass): boolean { return false; }, // federal owns cost seg

  stateIncomeTaxRate(entityType: EntityType): number {
    return lookupStateIncomeRate(entityType);
  },

  conformsToBonusDep(): boolean { return conformsBonusDep(); },
  conformsToCostSeg(): boolean { return conformsCostSeg(); },

  // ── Metadata ─────────────────────────────────────────────────────────────────

  requiresInputs(): string[] { return ['purchasePrice', 'county', 'holdYears']; },
  dataSourceHints(): string[] {
    return [
      'Fulton County Tax Commissioner: https://www.fultoncountytaxes.org/',
      'DeKalb County Tax Commissioner: https://www.dekalbcountyga.gov/tax-commissioner',
      'GA Department of Revenue: https://dor.georgia.gov/local-government-services',
    ];
  },
};
