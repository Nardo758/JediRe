/**
 * FL Palm Beach County Overlay Ruleset
 *
 * County overlay for Palm Beach County, FL (West Palm Beach MSA).
 *
 * Overrides:
 *   - annualPropertyTax() → uses county millage from fl-palm-beach-2026.json (21.2765 mills)
 *
 * No county deed stamp surtax (Miami-Dade-specific; Palm Beach uses standard 0.70% state rate).
 *
 * Source: Palm Beach County Property Appraiser TRIM FY2025/26
 */

import type { TaxContext, CountyOverlayRuleset } from '../types';
import { flRuleset } from './fl.ruleset';
import { makeCountyOverlay } from './county-overlay.factory';
import { getRateSheet } from '../rateSheets/loader';

const RATE_SHEET_YEAR = 2026;
const COUNTY_KEY = 'fl-palm-beach';

function getPalmBeachMillage(ctx: TaxContext): number {
  if (ctx.millageRateOverride != null) return ctx.millageRateOverride;
  const sheet = getRateSheet(COUNTY_KEY, RATE_SHEET_YEAR);
  const agg = sheet?.millage?.aggregate;
  if (agg == null) {
    throw new Error(
      `[flPalmBeachRuleset] ${COUNTY_KEY}-${RATE_SHEET_YEAR} rate sheet missing millage.aggregate. ` +
      `Ensure initRateSheets() ran at boot.`,
    );
  }
  return agg;
}

export const flPalmBeachRuleset: CountyOverlayRuleset = makeCountyOverlay(
  'FL-Palm Beach',
  flRuleset,
  getPalmBeachMillage,
);
