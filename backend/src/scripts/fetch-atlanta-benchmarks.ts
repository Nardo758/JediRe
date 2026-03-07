/**
 * Fetch Atlanta Benchmark Data from Atlanta GIS & Fulton County APIs
 * 
 * Usage:
 *   npx tsx backend/src/scripts/fetch-atlanta-benchmarks.ts
 */

import { AtlantaBenchmarkIngestionService } from '../services/atlanta-benchmark-ingestion.service';
import { getPool } from '../database/connection';

const pool = getPool();

async function main() {
  console.log('Atlanta Benchmark Ingestion\n');
  console.log('Fetching rezoning cases, SUPs, and development data from Atlanta GIS...\n');

  const service = new AtlantaBenchmarkIngestionService();
  
  try {
    const stats = await service.ingest();
    
    console.log('\n' + '='.repeat(60));
    console.log('RESULTS:');
    console.log('='.repeat(60));
    console.log(`  Parcels scanned: ${stats.parcelsScanned}`);
    console.log(`  Rezonings matched: ${stats.rezoningsMatched}`);
    console.log(`  SUPs matched: ${stats.supsMatched}`);
    console.log(`  Admin permits matched: ${stats.adminPermitsMatched}`);
    console.log(`  Districts linked: ${stats.districtsLinked}`);
    console.log(`  Total records upserted: ${stats.totalUpserted}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n  Errors encountered: ${stats.errors.length}`);
      console.log('  First 5 errors:');
      stats.errors.slice(0, 5).forEach(e => console.log(`    - ${e}`));
    }
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('\nFatal error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}
