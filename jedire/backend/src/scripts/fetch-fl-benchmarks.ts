/**
 * Fetch Florida Benchmark Data from County ArcGIS APIs
 * 
 * Usage:
 *   npx tsx backend/src/scripts/fetch-fl-benchmarks.ts --county=miami-dade
 *   npx tsx backend/src/scripts/fetch-fl-benchmarks.ts --all
 *   npx tsx backend/src/scripts/fetch-fl-benchmarks.ts --list
 */

import { floridaBenchmarkIngestionService } from '../services/florida-benchmark-ingestion.service';

async function main() {
  const args: Record<string, string | boolean> = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--county=')) {
      args.county = arg.split('=')[1];
    } else if (arg === '--all') {
      args.all = true;
    } else if (arg === '--list') {
      args.list = true;
    }
  });

  console.log('Florida Benchmark Ingestion\n');

  if (args.list) {
    const counties = floridaBenchmarkIngestionService.getAvailableCounties();
    console.log(`Available counties (${counties.length}):`);
    counties.forEach(c => console.log(`  ${c}`));
    return;
  }

  if (args.county) {
    const countyId = args.county as string;
    console.log(`Ingesting benchmark data for ${countyId}...\n`);
    const stats = await floridaBenchmarkIngestionService.ingest(countyId);
    console.log('\nResults:');
    console.log(`  Hearings fetched: ${stats.hearingsFetched}`);
    console.log(`  Permits fetched: ${stats.permitsFetched}`);
    console.log(`  Records upserted: ${stats.recordsUpserted}`);
    console.log(`  Districts linked: ${stats.districtsLinked}`);
    if (stats.errors.length > 0) {
      console.log(`  Errors: ${stats.errors.length}`);
      stats.errors.slice(0, 5).forEach(e => console.log(`    - ${e}`));
    }
    return;
  }

  if (args.all) {
    const counties = floridaBenchmarkIngestionService.getAvailableCounties();
    console.log(`Ingesting all ${counties.length} counties...\n`);

    for (const countyId of counties) {
      console.log(`\n--- ${countyId} ---`);
      try {
        const stats = await floridaBenchmarkIngestionService.ingest(countyId);
        console.log(`  Hearings: ${stats.hearingsFetched}, Permits: ${stats.permitsFetched}, Upserted: ${stats.recordsUpserted}`);
        if (stats.errors.length > 0) {
          console.log(`  Errors: ${stats.errors.length}`);
        }
      } catch (err) {
        console.error(`  Failed: ${(err as Error).message}`);
      }
    }
    return;
  }

  console.error('Error: Must specify --county, --all, or --list');
  console.log('\nUsage:');
  console.log('  npx tsx backend/src/scripts/fetch-fl-benchmarks.ts --list');
  console.log('  npx tsx backend/src/scripts/fetch-fl-benchmarks.ts --county=miami-dade');
  console.log('  npx tsx backend/src/scripts/fetch-fl-benchmarks.ts --all');
  process.exit(1);
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nError:', error);
      process.exit(1);
    });
}
