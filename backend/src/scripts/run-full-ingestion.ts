/**
 * Full Data Ingestion Pipeline
 * Runs all ingestion jobs in sequence with better error handling
 * 
 * Usage:
 *   npx tsx backend/src/scripts/run-full-ingestion.ts
 *   npx tsx backend/src/scripts/run-full-ingestion.ts --skip-zoning
 *   npx tsx backend/src/scripts/run-full-ingestion.ts --skip-benchmarks
 */

import { getPool } from '../database/connection';
import { fetchZoningData, saveAPIDistricts, CITY_APIS } from '../services/municipal-api-connectors';
import { AtlantaBenchmarkIngestionService } from '../services/atlanta-benchmark-ingestion.service';
import { floridaBenchmarkIngestionService } from '../services/florida-benchmark-ingestion.service';

const db = getPool();

interface IngestionSummary {
  zoning: {
    cities: number;
    districts: number;
    duration: number;
  };
  benchmarks: {
    atlanta: number;
    florida: number;
    duration: number;
  };
  errors: string[];
}

/**
 * Ingest zoning districts for key cities
 */
async function ingestZoningDistricts(): Promise<{ cities: number; districts: number }> {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1: ZONING DISTRICTS INGESTION');
  console.log('='.repeat(60));
  
  // Key cities with your properties
  const priorityCities = [
    'atlanta-ga',
    'miami-dade-fl',
    'miami-fl',
    'west-palm-beach-fl',
    'tampa-city-fl',
  ];
  
  let totalDistricts = 0;
  let successCities = 0;
  
  for (const cityId of priorityCities) {
    const config = CITY_APIS[cityId];
    if (!config) {
      console.log(`  ⚠️  ${cityId} not configured, skipping`);
      continue;
    }
    
    console.log(`\n📍 ${config.name}, ${config.state}...`);
    
    try {
      const districts = await fetchZoningData(cityId);
      const saved = await saveAPIDistricts(districts);
      
      console.log(`  ✅ ${districts.length} districts, ${saved} saved`);
      totalDistricts += districts.length;
      successCities++;
      
      // Rate limit
      await new Promise(r => setTimeout(r, 2000));
      
    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}`);
    }
  }
  
  return { cities: successCities, districts: totalDistricts };
}

/**
 * Ingest benchmark projects
 */
async function ingestBenchmarks(): Promise<{ atlanta: number; florida: number }> {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 2: BENCHMARK PROJECTS INGESTION');
  console.log('='.repeat(60));
  
  // Atlanta
  console.log('\n🏙️  ATLANTA');
  let atlantaCount = 0;
  try {
    const atlantaService = new AtlantaBenchmarkIngestionService();
    const stats = await atlantaService.ingest();
    atlantaCount = stats.totalUpserted;
    console.log(`  ✅ ${atlantaCount} benchmark projects`);
    console.log(`  📊 ${stats.rezoningsMatched} rezonings, ${stats.supsMatched} SUPs`);
  } catch (error: any) {
    console.error(`  ❌ Atlanta failed: ${error.message}`);
  }
  
  // Florida - just Miami-Dade for now
  console.log('\n🌴 FLORIDA (Miami-Dade)');
  let floridaCount = 0;
  try {
    const stats = await floridaBenchmarkIngestionService.ingest('miami-dade');
    floridaCount = stats.recordsUpserted;
    console.log(`  ✅ ${floridaCount} benchmark projects`);
  } catch (error: any) {
    console.error(`  ❌ Florida failed: ${error.message}`);
  }
  
  return { atlanta: atlantaCount, florida: floridaCount };
}

/**
 * Check current database state
 */
async function checkCurrentState() {
  console.log('\n' + '='.repeat(60));
  console.log('CURRENT DATABASE STATE');
  console.log('='.repeat(60));
  
  try {
    const muniResult = await db.query('SELECT COUNT(*) as count FROM municipalities');
    console.log(`  Municipalities: ${muniResult.rows[0].count}`);
    
    const zoningResult = await db.query('SELECT COUNT(*) as count FROM zoning_districts');
    console.log(`  Zoning districts: ${zoningResult.rows[0].count}`);
    
    const benchmarkResult = await db.query('SELECT COUNT(*) as count FROM benchmark_projects');
    console.log(`  Benchmark projects: ${benchmarkResult.rows[0].count}`);
    
    const propertiesResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(current_zoning) FILTER (WHERE current_zoning IS NOT NULL) as with_zoning
      FROM properties
    `);
    console.log(`  Properties: ${propertiesResult.rows[0].total} (${propertiesResult.rows[0].with_zoning} with zoning)`);
    
  } catch (error: any) {
    console.error(`  ⚠️  Could not check state: ${error.message}`);
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const skipZoning = args.includes('--skip-zoning');
  const skipBenchmarks = args.includes('--skip-benchmarks');
  
  console.log('\n🚀 JEDIRE FULL DATA INGESTION PIPELINE\n');
  console.log('Options:');
  console.log(`  Skip zoning: ${skipZoning}`);
  console.log(`  Skip benchmarks: ${skipBenchmarks}`);
  
  const startTime = Date.now();
  const summary: IngestionSummary = {
    zoning: { cities: 0, districts: 0, duration: 0 },
    benchmarks: { atlanta: 0, florida: 0, duration: 0 },
    errors: [],
  };
  
  // Check current state first
  await checkCurrentState();
  
  // Phase 1: Zoning Districts
  if (!skipZoning) {
    const zoningStart = Date.now();
    try {
      const result = await ingestZoningDistricts();
      summary.zoning = {
        ...result,
        duration: Math.round((Date.now() - zoningStart) / 1000),
      };
    } catch (error: any) {
      summary.errors.push(`Zoning ingestion failed: ${error.message}`);
    }
  } else {
    console.log('\n⏭️  Skipping zoning districts ingestion');
  }
  
  // Phase 2: Benchmark Projects
  if (!skipBenchmarks) {
    const benchmarkStart = Date.now();
    try {
      const result = await ingestBenchmarks();
      summary.benchmarks = {
        ...result,
        duration: Math.round((Date.now() - benchmarkStart) / 1000),
      };
    } catch (error: any) {
      summary.errors.push(`Benchmark ingestion failed: ${error.message}`);
    }
  } else {
    console.log('\n⏭️  Skipping benchmark projects ingestion');
  }
  
  // Final summary
  const totalDuration = Math.round((Date.now() - startTime) / 1000);
  
  console.log('\n' + '='.repeat(60));
  console.log('INGESTION COMPLETE');
  console.log('='.repeat(60));
  console.log(`\n⏱️  Total duration: ${totalDuration}s\n`);
  console.log('📊 Zoning Districts:');
  console.log(`  Cities: ${summary.zoning.cities}`);
  console.log(`  Districts: ${summary.zoning.districts}`);
  console.log(`  Duration: ${summary.zoning.duration}s`);
  console.log('\n📊 Benchmark Projects:');
  console.log(`  Atlanta: ${summary.benchmarks.atlanta}`);
  console.log(`  Florida: ${summary.benchmarks.florida}`);
  console.log(`  Duration: ${summary.benchmarks.duration}s`);
  
  if (summary.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    summary.errors.forEach(e => console.log(`  - ${e}`));
  }
  
  // Check final state
  await checkCurrentState();
  
  console.log('\n' + '='.repeat(60));
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Pipeline complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    })
    .finally(() => {
      db.end();
    });
}
