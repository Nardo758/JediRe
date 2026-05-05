/**
 * GA Fulton County Overlay Ruleset
 *
 * County overlay for Fulton County, GA (Atlanta MSA).
 *
 * Overrides:
 *   - annualPropertyTax() → uses county millage from ga-fulton-2026.json (11.60 mills effective)
 *
 * Millage notes:
 *   GA assesses property at 40% of FMV. The rate sheet stores the effective rate
 *   (assessed mills × 0.40) so it can be applied directly to FMV (purchase price).
 *   11.60 mills = 29 mills (on assessed) × 40% assessment ratio.
 *
 * All other methods delegate to gaRuleset (Section B TPP, income tax, etc.).
 *
 * Source: Fulton County Tax Commissioner FY2025 millage rates
 */

import type { TaxContext, CountyOverlayRuleset } from '../types';
import { gaRuleset } from './ga.ruleset';
import { makeCountyOverlay } from './county-overlay.factory';
import { getRateSheet } from '../rateSheets/loader';

const RATE_SHEET_YEAR = 2026;
const COUNTY_KEY = 'ga-fulton';

function getFultonMillage(ctx: TaxContext): number {
  if (ctx.millageRateOverride != null) return ctx.millageRateOverride;
  const sheet = getRateSheet(COUNTY_KEY, RATE_SHEET_YEAR);
  const agg = sheet?.millage?.aggregate;
  if (agg == null) {
    throw new Error(
      `[gaFultonRuleset] ${COUNTY_KEY}-${RATE_SHEET_YEAR} rate sheet missing millage.aggregate. ` +
      `Ensure initRateSheets() ran at boot.`,
    );
  }
  return agg;
}

export const gaFultonRuleset: CountyOverlayRuleset = makeCountyOverlay(
  'GA-Fulton',
  gaRuleset,
  getFultonMillage,
);
