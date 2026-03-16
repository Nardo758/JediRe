import { Pool } from 'pg';
import { DotFetcherService } from '../services/dot-fetcher.service';
import { DotAggregatorService } from '../services/dot-aggregator.service';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

interface BackfillOptions {
  states: string[];
  startYear: number;
  endYear: number;
  skipFetch: boolean;
  skipAggregate: boolean;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {
    states: ['FL', 'GA', 'TX', 'NC'],
    startYear: 2018,
    endYear: 2025,
    skipFetch: false,
    skipAggregate: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--states':
        options.states = args[++i].split(',').map(s => s.trim().toUpperCase());
        break;
      case '--start-year':
        options.startYear = parseInt(args[++i], 10);
        break;
      case '--end-year':
        options.endYear = parseInt(args[++i], 10);
        break;
      case '--skip-fetch':
        options.skipFetch = true;
        break;
      case '--skip-aggregate':
        options.skipAggregate = true;
        break;
      case '--help':
        console.log(`
DOT AADT Backfill Script
========================
Fetches historical AADT data from state DOT portals and aggregates to metro geography.

Usage: npx ts-node backend/src/scripts/backfill-dot-aadt.ts [options]

Options:
  --states FL,GA        Comma-separated state codes (default: FL,GA,TX,NC)
  --start-year 2018     Start year for historical data (default: 2018)
  --end-year 2025       End year for historical data (default: 2025)
  --skip-fetch          Skip fetching, only aggregate existing data
  --skip-aggregate      Skip aggregation step
  --help                Show this help message

Environment:
  DATABASE_URL          Required. PostgreSQL connection string.
  No API keys required — all DOT data sources are publicly accessible.

Examples:
  npx ts-node backend/src/scripts/backfill-dot-aadt.ts
  npx ts-node backend/src/scripts/backfill-dot-aadt.ts --states FL --start-year 2020
  npx ts-node backend/src/scripts/backfill-dot-aadt.ts --skip-fetch
        `);
        process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const pool = new Pool({ connectionString: DATABASE_URL });

  console.log('====================================');
  console.log('DOT AADT Historical Backfill');
  console.log('====================================');
  console.log(`States: ${options.states.join(', ')}`);
  console.log(`Years: ${options.startYear}–${options.endYear}`);
  console.log(`Skip fetch: ${options.skipFetch}`);
  console.log(`Skip aggregate: ${options.skipAggregate}`);
  console.log('====================================\n');

  const fetcher = new DotFetcherService(pool);
  const aggregator = new DotAggregatorService(pool);

  if (!options.skipFetch) {
    console.log('Phase 1: Fetching AADT data from DOT portals...\n');

    for (const state of options.states) {
      const config = fetcher.getStateConfig(state);
      if (!config) {
        console.log(`  [SKIP] No configuration for state: ${state}`);
        continue;
      }

      console.log(`  [${state}] ${config.name}`);
      let totalInserted = 0;
      let totalFetched = 0;

      for (let year = options.startYear; year <= options.endYear; year++) {
        process.stdout.write(`    ${year}: `);
        const result = await fetcher.fetchAndIngest(state, year);
        totalFetched += result.fetched;
        totalInserted += result.inserted;

        if (result.errors.length > 0 && result.fetched === 0) {
          console.log(`no data (${result.errors[0].substring(0, 80)})`);
        } else {
          console.log(`${result.fetched} fetched, ${result.inserted} inserted, ${result.skipped} skipped (${result.durationMs}ms)`);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      console.log(`  [${state}] Total: ${totalFetched} fetched, ${totalInserted} inserted\n`);
    }
  }

  if (!options.skipAggregate) {
    console.log('Phase 2: Aggregating station data to metro geographies...\n');

    for (const state of options.states) {
      process.stdout.write(`  [${state}] Aggregating... `);
      const result = await aggregator.aggregateToGeographies(state);
      console.log(`${result.msasProcessed} MSAs, ${result.timeSeriesUpserted} AADT points, ${result.yoyComputed} YoY values (${result.durationMs}ms)`);

      if (result.errors.length > 0) {
        for (const err of result.errors) {
          console.log(`    [ERROR] ${err}`);
        }
      }
    }
  }

  const status = await fetcher.getIngestionStatus();
  console.log('\n====================================');
  console.log('Final Status');
  console.log('====================================');
  console.log(`Total ADT records: ${status.totalRecords}`);
  for (const s of status.states) {
    if (s.totalStations > 0) {
      console.log(`  ${s.state} (${s.name}): ${s.totalStations} stations, years ${s.yearRange?.min}–${s.yearRange?.max}`);
    }
  }

  const tsResult = await pool.query(`
    SELECT metric_id, COUNT(*) as count, COUNT(DISTINCT geography_id) as geos
    FROM metric_time_series
    WHERE metric_id IN ('T_AADT', 'T_AADT_YOY')
    GROUP BY metric_id
  `);
  for (const row of tsResult.rows) {
    console.log(`  ${row.metric_id}: ${row.count} data points across ${row.geos} geographies`);
  }

  console.log('\nBackfill complete.');
  await pool.end();
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
