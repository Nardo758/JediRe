/**
 * synthesize-implied-cap-rates.ts
 * Phase 5 — Property Plumbing Refactor
 *
 * Pass 1 — NOI-based synthesis:
 *   Derives implied cap rates for property_sales rows where:
 *     - implied_cap_rate IS NULL
 *     - sale_price IS NOT NULL
 *     - A matching property_operating_data TTM row exists within 12 months of sale_date
 *   Formula: implied_cap_rate = noi / sale_price
 *   Sanity range: 1% – 25%
 *
 * Pass 2 — Source cap rate back-fill:
 *   For broker_comp rows whose source_id is `msc::<uuid>`, copies the cap_rate
 *   already recorded in market_sale_comps (percentage → decimal) into
 *   property_sales.implied_cap_rate. Activates the Phase 5 shadow path when
 *   property_operating_data is sparse.
 *
 * Pass 3 — Coordinate back-fill:
 *   Properties resolved from market_sale_comps often lack lat/lng (the resolver
 *   creates the row without geocoding). Copies latitude/longitude from the linked
 *   market_sale_comps record so that the Phase 5 spatial query (ST_DWithin) finds
 *   the comps and new_path_n > 0 in the shadow log.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/synthesize-implied-cap-rates.ts
 *   npx ts-node --transpile-only scripts/synthesize-implied-cap-rates.ts --dry-run
 *   npx ts-node --transpile-only scripts/synthesize-implied-cap-rates.ts --limit=1000
 */

import '../src/database/connection';
import { propertySalesService } from '../src/services/property-entity/property-sales.service';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 5000;

  console.log('[synthesize-implied-cap-rates] Starting');
  console.log(`  dry-run: ${dryRun}`);
  console.log(`  limit:   ${limit}`);

  console.log('\n── Pass 1: NOI-based synthesis (property_operating_data) ────────');
  const noiResult = await propertySalesService.synthesizeImpliedCapRates({ limit, dryRun });

  console.log(`  Updated (implied_cap_rate written): ${noiResult.updated}`);
  console.log(`  Skipped (out of sanity range):      ${noiResult.skipped}`);
  console.log(`  Insufficient (no NOI data):         ${noiResult.insufficient}`);

  console.log('\n── Pass 2: Source cap rate back-fill (market_sale_comps) ────────');
  const srcResult = await propertySalesService.synthesizeFromSourceCapRates({ dryRun });

  console.log(`  Updated (implied_cap_rate written): ${srcResult.updated}`);
  console.log(`  Skipped (out of sanity range):      ${srcResult.skipped}`);

  console.log('\n── Pass 3: Coordinate back-fill (properties.lat/lng) ────────────');
  const coordResult = await propertySalesService.backfillPropertyCoordinatesFromComps({ dryRun });

  console.log(`  Updated (lat/lng written):          ${coordResult.updated}`);

  const totalUpdated = noiResult.updated + srcResult.updated;
  console.log('\n── Totals ───────────────────────────────────────────────────────');
  console.log(`  Total rows with implied_cap_rate written: ${totalUpdated}`);
  console.log(`  Properties with coordinates back-filled:  ${coordResult.updated}`);
  console.log(`  dry-run (no DB writes):                   ${dryRun}`);

  process.exit(0);
}

main().catch(err => {
  console.error('[synthesize-implied-cap-rates] Fatal error:', err);
  process.exit(1);
});
