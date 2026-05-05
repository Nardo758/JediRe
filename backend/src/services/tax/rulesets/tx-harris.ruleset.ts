/**
 * TX Harris County Overlay Ruleset
 *
 * County overlay for Harris County, TX (Houston MSA).
 *
 * Overrides:
 *   - annualPropertyTax() → uses county millage from tx-harris-2026.json (22.00 mills)
 *                           Combined: HCAD county + City of Houston + Houston ISD + MUD/Other
 *
 * Note: liveMlillageService.ts provides live HCAD rates injected upstream as
 * ctx.millageRateOverride when available. This overlay's rate sheet value is the
 * hardcoded fallback when the live service fails or is unavailable.
 *
 * No county deed stamp surtax (TX has no state or county transfer tax).
 *
 * Source: HCAD FY2025 certified tax rates; TX Comptroller county rates levies xlsx
 */

import type { TaxContext, CountyOverlayRuleset } from '../types';
import { txRuleset } from './tx.ruleset';
import { makeCountyOverlay } from './county-overlay.factory';
import { getRateSheet } from '../rateSheets/loader';

const RATE_SHEET_YEAR = 2026;
const COUNTY_KEY = 'tx-harris';

function getHarrisMillage(ctx: TaxContext): number {
  if (ctx.millageRateOverride != null) return ctx.millageRateOverride;
  const sheet = getRateSheet(COUNTY_KEY, RATE_SHEET_YEAR);
  const agg = sheet?.millage?.aggregate;
  if (agg == null) {
    throw new Error(
      `[txHarrisRuleset] ${COUNTY_KEY}-${RATE_SHEET_YEAR} rate sheet missing millage.aggregate. ` +
      `Ensure initRateSheets() ran at boot.`,
    );
  }
  return agg;
}

export const txHarrisRuleset: CountyOverlayRuleset = makeCountyOverlay(
  'TX-Harris',
  txRuleset,
  getHarrisMillage,
);
