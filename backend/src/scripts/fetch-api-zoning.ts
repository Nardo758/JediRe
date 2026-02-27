/**
 * Fetch Zoning Data from Municipal APIs
 * 
 * Usage:
 *   npx tsx backend/src/scripts/fetch-api-zoning.ts --city=atlanta-ga
 *   npx tsx backend/src/scripts/fetch-api-zoning.ts --all
 *   npx tsx backend/src/scripts/fetch-api-zoning.ts --fl-cities
 *   npx tsx backend/src/scripts/fetch-api-zoning.ts --list
 */

import { fetchZoningData, saveAPIDistricts, CITY_APIS } from '../services/municipal-api-connectors';
import { getPool } from '../database/connection';

const db = getPool();

const FL_CITY_IDS = [
  'miami-fl',
  'tampa-city-fl',
  'hollywood-fl',
  'st-petersburg-fl',
  'west-palm-beach-fl',
  'hialeah-fl',
  'coral-gables-fl',
  'cape-coral-fl',
];

async function updateMunicipality(cityId: string, districtCount: number) {
  const config = CITY_APIS[cityId];
  if (!config) return;

  const result = await db.query(
    `UPDATE municipalities SET 
      total_zoning_districts = $1,
      last_scraped_at = NOW(),
      data_quality = 'good'
     WHERE id = $2`,
    [districtCount, cityId]
  );

  if (result.rowCount === 0) {
    await db.query(
      `UPDATE municipalities SET 
        total_zoning_districts = $1,
        last_scraped_at = NOW(),
        data_quality = 'good'
       WHERE name = $2 AND state = $3`,
      [districtCount, config.name, config.state]
    );
  }
}

async function fetchCity(cityId: string): Promise<number> {
  const config = CITY_APIS[cityId];
  console.log(`Fetching ${config.name}, ${config.state} (${cityId})...`);

  const districts = await fetchZoningData(cityId);
  const saved = await saveAPIDistricts(districts);
  await updateMunicipality(cityId, districts.length);

  console.log(`  ${districts.length} unique districts found, ${saved} saved to DB`);

  if (districts.length > 0) {
    console.log('  Sample:');
    districts.slice(0, 5).forEach((d) => {
      console.log(`    ${d.zoning_code}: ${d.district_name}`);
    });
  }

  return districts.length;
}

async function fetchBatch(entries: [string, any][]) {
  let successCount = 0;
  let failCount = 0;
  let totalDistricts = 0;

  for (const [cityId, config] of entries) {
    const idx = successCount + failCount + 1;
    console.log(`\n[${idx}/${entries.length}] Processing ${config.name}, ${config.state} (${cityId})...`);

    try {
      const count = await fetchCity(cityId);
      totalDistricts += count;
      successCount++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`  Failed: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Success: ${successCount} cities`);
  console.log(`  Failed: ${failCount} cities`);
  console.log(`  Total districts: ${totalDistricts}`);
}

async function main() {
  const args: Record<string, string | boolean> = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--city=')) {
      args.city = arg.split('=')[1];
    } else if (arg === '--all') {
      args.all = true;
    } else if (arg === '--fl-cities') {
      args.flCities = true;
    } else if (arg === '--list') {
      args.list = true;
    }
  });

  console.log('Municipal API Zoning Fetcher\n');

  if (args.list) {
    console.log('Available cities with APIs:\n');

    const verified = Object.entries(CITY_APIS).filter(([_, c]) => c.verified);
    const unverified = Object.entries(CITY_APIS).filter(([_, c]) => !c.verified);

    console.log(`Verified (${verified.length}):`);
    verified.forEach(([id, config]) => {
      const tags = [];
      if (config.apiType === 'assessment') tags.push('[assessment]');
      if (config.countyFallback) tags.push(`[fallback: ${config.countyFallback}]`);
      console.log(`  ${id}: ${config.name}, ${config.state} ${tags.join(' ')}`);
    });

    console.log(`\nUnverified (${unverified.length}):`);
    unverified.forEach(([id, config]) => {
      console.log(`  ${id}: ${config.name}, ${config.state}`);
    });

    console.log(`\nFL city connectors: ${FL_CITY_IDS.join(', ')}`);
    console.log(`\nTotal: ${verified.length + unverified.length} connectors`);
    return;
  }

  if (args.city) {
    const cityId = args.city as string;
    if (!CITY_APIS[cityId]) {
      console.error(`City '${cityId}' not found. Run --list to see available cities.`);
      process.exit(1);
    }

    try {
      await fetchCity(cityId);
    } catch (error) {
      console.error(`\nError fetching ${cityId}:`, error);
      process.exit(1);
    }
    return;
  }

  if (args.flCities) {
    const entries = FL_CITY_IDS
      .filter(id => CITY_APIS[id]?.verified)
      .map(id => [id, CITY_APIS[id]] as [string, any]);

    console.log(`Fetching zoning data for ${entries.length} verified FL city connectors...\n`);
    await fetchBatch(entries);
    return;
  }

  if (args.all) {
    const entries = Object.entries(CITY_APIS).filter(([_, c]) => c.verified && c.apiType !== 'assessment');
    console.log(`Fetching zoning data for ${entries.length} verified zoning connectors...\n`);
    await fetchBatch(entries);
    return;
  }

  console.error('Error: Must specify --city, --all, --fl-cities, or --list');
  console.log('\nUsage:');
  console.log('  npx tsx backend/src/scripts/fetch-api-zoning.ts --list');
  console.log('  npx tsx backend/src/scripts/fetch-api-zoning.ts --city=atlanta-ga');
  console.log('  npx tsx backend/src/scripts/fetch-api-zoning.ts --fl-cities');
  console.log('  npx tsx backend/src/scripts/fetch-api-zoning.ts --all');
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
