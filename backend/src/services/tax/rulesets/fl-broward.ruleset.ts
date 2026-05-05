/**
 * FL Broward County Overlay Ruleset
 *
 * County overlay for Broward County, FL (Fort Lauderdale MSA).
 *
 * Overrides:
 *   - annualPropertyTax() → uses county millage from fl-broward-2026.json (19.5073 mills)
 *
 * No county deed stamp surtax (Miami-Dade-specific; Broward uses standard 0.70% state rate).
 *
 * Source: Broward County Property Appraiser TRIM FY2025/26
 */

import type { TaxContext, CountyOverlayRuleset } from '../types';
import { flRuleset } from './fl.ruleset';
import { makeCountyOverlay } from './county-overlay.factory';
import { getRateSheet } from '../rateSheets/loader';

const RATE_SHEET_YEAR = 2026;
const COUNTY_KEY = 'fl-broward';

function getBrowardMillage(ctx: TaxContext): number {
  if (ctx.millageRateOverride != null) return ctx.millageRateOverride;
  const sheet = getRateSheet(COUNTY_KEY, RATE_SHEET_YEAR);
  const agg = sheet?.millage?.aggregate;
  if (agg == null) {
    throw new Error(
      `[flBrowardRuleset] ${COUNTY_KEY}-${RATE_SHEET_YEAR} rate sheet missing millage.aggregate. ` +
      `Ensure initRateSheets() ran at boot.`,
    );
  }
  return agg;
}

export const flBrowardRuleset: CountyOverlayRuleset = makeCountyOverlay(
  'FL-Broward',
  flRuleset,
  getBrowardMillage,
);
