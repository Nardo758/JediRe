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
 * Pass 4 — Time-series report (--time-series):
 *   Prints quarterly P50 cap rates for the Atlanta metro core to validate date
 *   preservation. Uses propertySalesService.getCapRateTimeSeries at two reference
 *   points — Atlanta urban core (33.7490, -84.3880) and South Atlanta / DeKalb
 *   border (33.6877, -84.3516) — with a 25-mile radius and 20-quarter lookback.
 *   No DB writes; dry-run flag is ignored for this pass.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/synthesize-implied-cap-rates.ts
 *   npx ts-node --transpile-only scripts/synthesize-implied-cap-rates.ts --dry-run
 *   npx ts-node --transpile-only scripts/synthesize-implied-cap-rates.ts --limit=1000
 *   npx ts-node --transpile-only scripts/synthesize-implied-cap-rates.ts --time-series
 */

import '../src/database/connection';
import { propertySalesService } from '../src/services/property-entity/property-sales.service';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const timeSeries = args.includes('--time-series');
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

  if (timeSeries) {
    console.log('\n── Pass 4 (time-series): Cap rate by quarter — date preservation check ──');
    const REFERENCE_POINTS = [
      { label: 'Atlanta Urban Core', lat: 33.7490, lng: -84.3880 },
      { label: 'South Atlanta / DeKalb border', lat: 33.6877, lng: -84.3516 },
    ];
    for (const pt of REFERENCE_POINTS) {
      console.log(`\n  Reference: ${pt.label} (${pt.lat}, ${pt.lng}) — 25mi radius, last 20 quarters`);
      const series = await propertySalesService.getCapRateTimeSeries({
        lat: pt.lat,
        lng: pt.lng,
        radiusMiles: 25,
        quartersBack: 20,
      });
      if (series.length === 0) {
        console.log('    (no data — run synthesize passes first to populate implied_cap_rate)');
      } else {
        console.log('    Quarter    P50 cap   N comps');
        console.log('    ─────────  ────────  ───────');
        for (const row of series) {
          const pct = row.p50CapRate != null ? (row.p50CapRate * 100).toFixed(2) + '%' : '  —   ';
          console.log(`    ${row.quarter.padEnd(9)}  ${pct.padStart(7)}  ${String(row.n).padStart(7)}`);
        }
      }
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[synthesize-implied-cap-rates] Fatal error:', err);
  process.exit(1);
});
