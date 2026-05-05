/**
 * County Overlay Factory
 *
 * Produces a CountyOverlayRuleset that:
 *   1. Overrides `annualPropertyTax()` to use county-specific millage from the rate sheet.
 *   2. Implements `countySurtax()` (Miami-Dade only; others return null).
 *   3. Delegates ALL other methods to the parent state ruleset.
 *
 * Usage:
 *   export const flBrowardRuleset = makeCountyOverlay('FL-Broward', flRuleset, getMillage);
 */

import type {
  TaxContext, TaxRuleset, ReTaxYear, TransferTaxResult,
  SpecialTax, AbatementProgram, TPPContext, TaxLineResult,
  AssetClass, EntityType, CountyOverlayRuleset,
} from '../types';

/**
 * Build a county overlay that delegates everything to `stateRuleset` except millage.
 *
 * @param jurisdiction     e.g. 'FL-Miami-Dade', 'GA-Fulton'
 * @param stateRuleset     The parent state ruleset to delegate non-millage methods to.
 * @param countyMillageFn  Returns the county-specific aggregate millage (mills per $1,000).
 *                         Called only when ctx.millageRateOverride is null.
 * @param countySurtaxFn   Optional; returns the county surtax dollar amount for a given
 *                         sale price. Only Miami-Dade passes this. Others return null.
 */
export function makeCountyOverlay(
  jurisdiction: string,
  stateRuleset: TaxRuleset,
  countyMillageFn: (ctx: TaxContext) => number,
  countySurtaxFn?: (salePrice: number) => number | null,
): CountyOverlayRuleset {
  return {
    jurisdiction,

    // ── Section A — use county-specific millage; delegate cap logic to state ──

    annualPropertyTax(ctx: TaxContext, year: number, prevAssessedValue: number): ReTaxYear {
      const mill = ctx.millageRateOverride ?? countyMillageFn(ctx);
      return stateRuleset.annualPropertyTax(
        { ...ctx, millageRateOverride: mill },
        year,
        prevAssessedValue,
      );
    },

    // County surtax (Miami-Dade only — all others return null) ─────────────────
    countySurtax(salePrice: number): number | null {
      return countySurtaxFn ? countySurtaxFn(salePrice) : null;
    },

    // Delegate all remaining methods to the state ruleset ─────────────────────

    acquisitionTransferTax(ctx: TaxContext): TransferTaxResult {
      return stateRuleset.acquisitionTransferTax(ctx);
    },
    dispositionTransferTax(salePrice: number, ctx: TaxContext): number {
      return stateRuleset.dispositionTransferTax(salePrice, ctx);
    },
    reassessmentOnSale(ctx: TaxContext): 'full' | 'capped' | 'none' {
      return stateRuleset.reassessmentOnSale(ctx);
    },
    annualAssessmentCap(): number | null {
      return stateRuleset.annualAssessmentCap();
    },
    specialTaxes(ctx: TaxContext): SpecialTax[] {
      return stateRuleset.specialTaxes(ctx);
    },
    abatementEligibility(ctx: TaxContext): AbatementProgram[] {
      return stateRuleset.abatementEligibility(ctx);
    },

    // Section B — state owns TPP rules ────────────────────────────────────────
    taxesTPP(): boolean { return stateRuleset.taxesTPP(); },
    tppTax(ctx: TPPContext, year: number): TaxLineResult { return stateRuleset.tppTax(ctx, year); },
    tppExemptionAmount(): number { return stateRuleset.tppExemptionAmount(); },
    tppMillage(ctx: TaxContext): number { return stateRuleset.tppMillage(ctx); },
    tppFilingRequirement() { return stateRuleset.tppFilingRequirement(); },

    // Section C — federal owns Section C; state owns conformity flags ─────────
    depreciationLife(propertyType: AssetClass): number { return stateRuleset.depreciationLife(propertyType); },
    bonusDepreciationPct(year: number): number { return stateRuleset.bonusDepreciationPct(year); },
    costSegEligible(propertyType: AssetClass): boolean { return stateRuleset.costSegEligible(propertyType); },
    stateIncomeTaxRate(entityType: EntityType): number { return stateRuleset.stateIncomeTaxRate(entityType); },
    conformsToBonusDep(): boolean { return stateRuleset.conformsToBonusDep(); },
    conformsToCostSeg(): boolean { return stateRuleset.conformsToCostSeg(); },

    // Metadata ─────────────────────────────────────────────────────────────────
    requiresInputs(): string[] { return stateRuleset.requiresInputs(); },
    dataSourceHints(): string[] { return stateRuleset.dataSourceHints(); },
  };
}
