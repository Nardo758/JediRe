/**
 * Federal Tax Ruleset
 *
 * Implements the federal-level Section C (Income Tax & Depreciation) methods.
 * All rates are sourced exclusively from `federal-2026.json` via the rate sheet
 * loader — no numeric rates are hardcoded here.
 *
 * Section A (property tax) and Section D (transfer tax) methods return safe
 * zero-values because those are assessed by state/county jurisdictions, not
 * the federal government. This ruleset is composed by taxService.forecast()
 * alongside the resolved state ruleset.
 *
 * Section B (TPP) also returns false / zeros — TPP is a state/county levy.
 */

import type {
  TaxContext,
  TaxRuleset,
  ReTaxYear,
  TransferTaxResult,
  SpecialTax,
  AbatementProgram,
  TPPContext,
  TaxLineResult,
  AssetClass,
  EntityType,
} from '../types';
import { getRateSheet } from '../rateSheets/loader';

const RATE_SHEET_YEAR = 2026;

const ZERO_TPP_RESULT: TaxLineResult = {
  amount: 0,
  formula: 'federal ruleset — TPP is a state/county levy; not applicable',
  inputs: {},
  reassessmentEventInYear: false,
  confidence: 'high',
  notes: ['Federal government does not levy tangible personal property tax'],
};

const ZERO_TRANSFER_TAX: TransferTaxResult = {
  isMiamiDade: false,
  miamiDadeRatePct: 0,
  statewideFlatRatePct: 0,
  appliedRatePct: 0,
  docStampAmount: null,
  intangibleTaxAmount: null,
  loanAmount: null,
  totalTransferTax: null,
  refi: null,
};

// ── Internal helpers ───────────────────────────────────────────────────────────

function getSheet() {
  return getRateSheet('federal', RATE_SHEET_YEAR);
}

/**
 * Look up depreciation life for an asset class from the federal rate sheet.
 * Throws when the rate sheet is unavailable or the asset class is absent —
 * rate-sheet data is the sole authoritative source; no numeric fallbacks.
 */
function lookupDepreciationLife(propertyType: AssetClass): number {
  const sheet = getSheet();
  if (!sheet?.depreciation_lives) {
    throw new Error(
      `[federalRuleset] federal-${RATE_SHEET_YEAR} rate sheet missing depreciation_lives. ` +
      `Ensure initRateSheets() ran at boot.`,
    );
  }
  const val = (sheet.depreciation_lives as Record<string, number | undefined>)[propertyType];
  if (val == null) {
    throw new Error(
      `[federalRuleset] No depreciation life found for asset class "${propertyType}" ` +
      `in federal-${RATE_SHEET_YEAR}.json. Add the entry to the rate sheet.`,
    );
  }
  return val;
}

/**
 * Look up bonus depreciation percentage for a placed-in-service year.
 * Returns 0 when the year is not in the schedule (e.g. 2028+).
 */
function lookupBonusPct(placedInServiceYear: number): number {
  const sheet = getSheet();
  const schedule = sheet?.bonus_depreciation ?? [];
  const entry = schedule.find(e => e.year === placedInServiceYear);
  return entry?.pct ?? 0;
}

/**
 * Look up the federal income tax rate for an entity type.
 * The sheet stores a single flat rate per entity type (no bracket math needed
 * at this phase — the brackets array uses min/max_income for future expansion).
 * Throws when the rate sheet or bracket entry is missing — no numeric fallbacks.
 */
function lookupFederalRate(entityType: EntityType): number {
  const sheet = getSheet();
  if (!sheet?.federal_income_tax_brackets?.length) {
    throw new Error(
      `[federalRuleset] federal-${RATE_SHEET_YEAR} rate sheet missing federal_income_tax_brackets. ` +
      `Ensure initRateSheets() ran at boot.`,
    );
  }
  const match = sheet.federal_income_tax_brackets.find(b => b.entity_type === entityType);
  if (!match) {
    throw new Error(
      `[federalRuleset] No federal income tax bracket found for entity type "${entityType}" ` +
      `in federal-${RATE_SHEET_YEAR}.json. Add the entry to the rate sheet.`,
    );
  }
  return match.rate;
}

// ── Ruleset implementation ─────────────────────────────────────────────────────

export const federalRuleset: TaxRuleset = {
  jurisdiction: 'federal',

  // ── Section A — Property tax (not a federal levy) ─────────────────────────

  annualPropertyTax(_ctx: TaxContext, year: number, _prevAssessedValue: number): ReTaxYear {
    return {
      year,
      assessedValue: 0,
      millageRate: 0,
      taxAmount: 0,
      sohCapBinding: false,
      reassessmentEvent: false,
    };
  },

  acquisitionTransferTax(_ctx: TaxContext): TransferTaxResult {
    return ZERO_TRANSFER_TAX;
  },

  dispositionTransferTax(_salePrice: number, _ctx: TaxContext): number {
    return 0;
  },

  reassessmentOnSale(_ctx: TaxContext): 'full' | 'capped' | 'none' {
    return 'none';
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

  // ── Section B — TPP (not a federal levy) ─────────────────────────────────

  taxesTPP(): boolean { return false; },
  tppTax(_ctx: TPPContext, _year: number): TaxLineResult { return ZERO_TPP_RESULT; },
  tppExemptionAmount(): number { return 0; },
  tppMillage(_ctx: TaxContext): number { return 0; },
  tppFilingRequirement(): null { return null; },

  // ── Section C — Income Tax & Depreciation ────────────────────────────────

  /**
   * Federal depreciation life for a given asset class (years).
   * Source: IRS Publication 946, GDS recovery periods.
   * Values read from federal-2026.json → depreciation_lives.
   */
  depreciationLife(propertyType: AssetClass): number {
    return lookupDepreciationLife(propertyType);
  },

  /**
   * Federal bonus depreciation percentage for the given placed-in-service year.
   * Source: IRS Publication 946 / TCJA phase-down schedule.
   * Values read from federal-2026.json → bonus_depreciation[].
   */
  bonusDepreciationPct(placedInServiceYear: number): number {
    return lookupBonusPct(placedInServiceYear);
  },

  /**
   * Cost segregation is available for all income-producing real property
   * under federal tax law (Rev. Proc. 87-56; TAM 9411016).
   * All supported asset classes are eligible.
   */
  costSegEligible(_propertyType: AssetClass): boolean {
    return true;
  },

  /**
   * Federal ruleset does not model state income tax — returns 0.
   * State rulesets override this in Phase 3.
   */
  stateIncomeTaxRate(_entityType: EntityType): number {
    return 0;
  },

  /**
   * Federal law defines the bonus depreciation schedule; federal ruleset
   * is always "conforming" by definition.
   */
  conformsToBonusDep(): boolean { return true; },

  /**
   * Federal law defines cost segregation treatment.
   */
  conformsToCostSeg(): boolean { return true; },

  // ── Metadata ─────────────────────────────────────────────────────────────

  requiresInputs(): string[] {
    return ['purchasePrice', 'propertyType', 'entityType', 'placedInServiceYear', 'landAllocationPct'];
  },

  dataSourceHints(): string[] {
    return [
      'IRS Publication 946 — federal depreciation recovery periods and bonus schedule.',
      'Entity type (pass_through, c_corp, reit) drives federal income tax bracket lookup.',
    ];
  },
};

/**
 * Compute the federal income tax rate for a given entity type.
 * Exported separately so taxService can call it without going through the TaxRuleset interface.
 */
export function federalIncomeTaxRate(entityType: EntityType): number {
  return lookupFederalRate(entityType);
}

/**
 * Return the conventional cost segregation available percentage from the federal rate sheet.
 * Throws when the rate sheet is unavailable or the field is absent — no numeric fallback.
 */
export function federalCostSegAvailablePct(): number {
  const sheet = getSheet();
  if (!sheet) {
    throw new Error(
      `[federalRuleset] federal-${RATE_SHEET_YEAR} rate sheet not loaded. ` +
      `Ensure initRateSheets() ran at boot.`,
    );
  }
  if (sheet.cost_seg_available_pct == null) {
    throw new Error(
      `[federalRuleset] federal-${RATE_SHEET_YEAR}.json is missing cost_seg_available_pct. ` +
      `Add the field to the rate sheet.`,
    );
  }
  return sheet.cost_seg_available_pct;
}
