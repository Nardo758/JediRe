/**
 * synthesize-implied-cap-rates.ts
 * Phase 5 — Property Plumbing Refactor
 *
 * Derives implied cap rates for property_sales rows where:
 *   - implied_cap_rate IS NULL
 *   - sale_price IS NOT NULL
 *   - A matching property_operating_data TTM row exists within 12 months of sale_date
 *
 * Formula: implied_cap_rate = noi / sale_price
 * Sanity range: 1% – 25% (outside = skip + log)
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

  const result = await propertySalesService.synthesizeImpliedCapRates({ limit, dryRun });

  console.log('\n── Results ──────────────────────────────────');
  console.log(`  Updated (implied_cap_rate written): ${result.updated}`);
  console.log(`  Skipped (out of sanity range):      ${result.skipped}`);
  console.log(`  Insufficient (no NOI data):         ${result.insufficient}`);
  console.log(`  dry-run (no DB writes):             ${dryRun}`);

  process.exit(0);
}

main().catch(err => {
  console.error('[synthesize-implied-cap-rates] Fatal error:', err);
  process.exit(1);
});
