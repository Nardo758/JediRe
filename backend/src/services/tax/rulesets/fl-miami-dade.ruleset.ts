/**
 * FL Miami-Dade County Overlay Ruleset
 *
 * County overlay for Miami-Dade County, FL.
 *
 * Overrides:
 *   - annualPropertyTax()  → uses county millage from fl-miami-dade-2026.json (19.8344 mills)
 *   - countySurtax()       → Miami-Dade documentary stamp surtax: $0.45/$100 (0.45%)
 *                            FL §201.031; added to the 0.70% state deed stamp by taxService
 *
 * All other methods delegate to flRuleset (SOH cap logic, TPP, income tax, etc.).
 *
 * Transfer tax composition when this overlay is active:
 *   State deed stamp (fl.ruleset): $0.70/$100 = $350K on $50M
 *   County surtax (this overlay):  $0.45/$100 = $225K on $50M
 *   Total:                         $1.15/$100 = $575K on $50M
 *
 * Source: FL DOR §201.031; Miami-Dade County Office of the Property Appraiser TRIM FY2025/26
 */

import type { TaxContext, CountyOverlayRuleset } from '../types';
import { flRuleset } from './fl.ruleset';
import { makeCountyOverlay } from './county-overlay.factory';
import { getRateSheet } from '../rateSheets/loader';

const RATE_SHEET_YEAR = 2026;
const COUNTY_KEY = 'fl-miami-dade';
const COUNTY_SURTAX_RATE = 0.0045; // $0.45/$100

function getMiamiDadeMillage(ctx: TaxContext): number {
  if (ctx.millageRateOverride != null) return ctx.millageRateOverride;
  const sheet = getRateSheet(COUNTY_KEY, RATE_SHEET_YEAR);
  const agg = sheet?.millage?.aggregate;
  if (agg == null) {
    throw new Error(
      `[flMiamiDadeRuleset] ${COUNTY_KEY}-${RATE_SHEET_YEAR} rate sheet missing millage.aggregate. ` +
      `Ensure initRateSheets() ran at boot.`,
    );
  }
  return agg;
}

export const flMiamiDadeRuleset: CountyOverlayRuleset = makeCountyOverlay(
  'FL-Miami-Dade',
  flRuleset,
  getMiamiDadeMillage,
  (salePrice: number) => salePrice > 0 ? Math.round(salePrice * COUNTY_SURTAX_RATE) : null,
);
