import { AtlantaUrlDiscoveryService } from '../services/atlanta-url-discovery.service';
import { getPool } from '../database/connection';

const pool = getPool();

async function main() {
  console.log('Atlanta Property Assessor URL Discovery Pipeline\n');
  console.log('Discovering assessor portal URLs for Fulton and DeKalb County properties...\n');

  const service = new AtlantaUrlDiscoveryService();

  try {
    const stats = await service.discoverUrls();

    console.log('\n' + '='.repeat(60));
    console.log('RESULTS:');
    console.log('='.repeat(60));
    console.log(`  Total Atlanta properties: ${stats.totalAtlantaProperties}`);
    console.log(`  Properties needing URLs: ${stats.propertiesNeedingUrls}`);
    console.log(`  Fulton County processed: ${stats.fultonProcessed}`);
    console.log(`  DeKalb County processed: ${stats.dekalbProcessed}`);
    console.log(`  URLs discovered: ${stats.urlsDiscovered}`);
    console.log(`  URLs failed: ${stats.urlsFailed}`);

    if (stats.sampleUrls.length > 0) {
      console.log('\n  Sample discovered URLs:');
      stats.sampleUrls.forEach(s => {
        console.log(`    ${s.county}: ${s.address}`);
        console.log(`      -> ${s.assessorUrl}`);
      });
    }

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
      console.log('\nDone!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nError:', error);
      process.exit(1);
    });
}
