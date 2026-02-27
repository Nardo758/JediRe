import { fetchZoningData, saveAPIDistricts, CITY_APIS } from '../services/municipal-api-connectors';
import { query as dbQuery } from '../database/connection';

interface CliArgs {
  city?: string;
  all?: boolean;
  list?: boolean;
}

async function main() {
  const args: CliArgs = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--city=')) {
      args.city = arg.split('=')[1];
    } else if (arg === '--all') {
      args.all = true;
    } else if (arg === '--list') {
      args.list = true;
    }
  });

  console.log('🌐 Municipal API Zoning Fetcher\n');

  if (args.list) {
    console.log('Available cities with APIs:\n');
    
    const verified = Object.entries(CITY_APIS).filter(([_, c]) => c.verified);
    const unverified = Object.entries(CITY_APIS).filter(([_, c]) => !c.verified);
    
    console.log(`Verified (${verified.length}):`);
    verified.forEach(([id, config]) => {
      console.log(`  ${id}: ${config.name}, ${config.state}`);
    });
    
    console.log(`\nUnverified (${unverified.length}):`);
    unverified.forEach(([id, config]) => {
      console.log(`  ${id}: ${config.name}, ${config.state}`);
    });
    
    console.log(`\nTotal: ${verified.length + unverified.length} cities`);
    return;
  }

  if (args.city) {
    if (!CITY_APIS[args.city]) {
      console.error(`❌ City '${args.city}' not found. Run --list to see available cities.`);
      process.exit(1);
    }

    console.log(`Fetching ${CITY_APIS[args.city].name}, ${CITY_APIS[args.city].state}...\n`);
    
    try {
      const districts = await fetchZoningData(args.city);
      await saveAPIDistricts(districts);
      
      const config = CITY_APIS[args.city];
      await dbQuery(
        `UPDATE municipalities SET 
          total_zoning_districts = $1,
          last_scraped_at = NOW(),
          data_quality = 'good'
         WHERE name = $2 AND state = $3`,
        [districts.length, config.name, config.state]
      );
      
      console.log(`\nSuccessfully fetched and saved ${districts.length} zoning districts!`);
      
      console.log('\nSample districts:');
      districts.slice(0, 5).forEach((d) => {
        console.log(`  - ${d.zoning_code}: ${d.district_name}`);
      });
      
    } catch (error) {
      console.error(`\n❌ Error fetching ${args.city}:`, error);
      process.exit(1);
    }
    
    return;
  }

  if (args.all) {
    const verifiedCities = Object.entries(CITY_APIS).filter(([_, c]) => c.verified && c.apiType !== 'assessment');
    console.log(`Fetching zoning data for ${verifiedCities.length} verified cities...\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const [cityId, config] of verifiedCities) {
      console.log(`\n[${successCount + failCount + 1}/${verifiedCities.length}] Processing ${config.name}, ${config.state}...`);
      
      try {
        const districts = await fetchZoningData(cityId);
        await saveAPIDistricts(districts);
        
        await dbQuery(
          `UPDATE municipalities SET 
            total_zoning_districts = $1,
            last_scraped_at = NOW(),
            data_quality = 'good'
           WHERE name = $2 AND state = $3`,
          [districts.length, config.name, config.state]
        );
        
        console.log(`  ${districts.length} districts saved`);
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
    
    return;
  }

  console.error('❌ Error: Must specify --city, --all, or --list');
  console.log('\nUsage:');
  console.log('  npm run fetch:zoning -- --list              # List available cities');
  console.log('  npm run fetch:zoning -- --city=atlanta-ga   # Fetch single city');
  console.log('  npm run fetch:zoning -- --all               # Fetch all cities');
  process.exit(1);
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
