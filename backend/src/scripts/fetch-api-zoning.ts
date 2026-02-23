/**
 * Fetch Zoning Data from Municipal APIs
 * 
 * Usage:
 *   npm run fetch:zoning -- --city=atlanta-ga
 *   npm run fetch:zoning -- --all
 */

import { fetchZoningData, saveAPIDistricts, CITY_APIS } from '../services/municipal-api-connectors';
import { db } from '../db';

interface CliArgs {
  city?: string;
  all?: boolean;
  list?: boolean;
}

async function main() {
  // Parse CLI arguments
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

  // List available cities
  if (args.list) {
    console.log('Available cities with APIs:\n');
    
    const socrataCount = Object.values(CITY_APIS).filter(c => c.type === 'socrata').length;
    const arcgisCount = Object.values(CITY_APIS).filter(c => c.type === 'arcgis').length;
    
    console.log(`📊 Socrata Cities (${socrataCount}):`);
    Object.entries(CITY_APIS)
      .filter(([_, config]) => config.type === 'socrata')
      .forEach(([id, config]) => {
        console.log(`  ${id}: ${config.name}, ${config.state}`);
      });
    
    console.log(`\n🗺️  ArcGIS Cities (${arcgisCount}):`);
    Object.entries(CITY_APIS)
      .filter(([_, config]) => config.type === 'arcgis')
      .forEach(([id, config]) => {
        console.log(`  ${id}: ${config.name}, ${config.state}`);
      });
    
    console.log(`\n📦 Total: ${socrataCount + arcgisCount} cities`);
    return;
  }

  // Fetch single city
  if (args.city) {
    if (!CITY_APIS[args.city]) {
      console.error(`❌ City '${args.city}' not found. Run --list to see available cities.`);
      process.exit(1);
    }

    console.log(`Fetching ${CITY_APIS[args.city].name}, ${CITY_APIS[args.city].state}...\n`);
    
    try {
      const districts = await fetchZoningData(args.city);
      await saveAPIDistricts(districts);
      
      // Update municipality record
      await db.query(
        `UPDATE municipalities SET 
          total_zoning_districts = $1,
          last_scraped_at = NOW()
         WHERE id = $2`,
        [districts.length, args.city]
      );
      
      console.log(`\n✅ Successfully fetched and saved ${districts.length} zoning districts!`);
      
      // Show sample
      console.log('\n📋 Sample districts:');
      districts.slice(0, 5).forEach((d) => {
        console.log(`  - ${d.zoning_code}: ${d.district_name}`);
      });
      
    } catch (error) {
      console.error(`\n❌ Error fetching ${args.city}:`, error);
      process.exit(1);
    }
    
    return;
  }

  // Fetch all cities
  if (args.all) {
    console.log(`Fetching zoning data for all ${Object.keys(CITY_APIS).length} cities...\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const [cityId, config] of Object.entries(CITY_APIS)) {
      console.log(`\n[${successCount + failCount + 1}/${Object.keys(CITY_APIS).length}] Processing ${config.name}, ${config.state}...`);
      
      try {
        const districts = await fetchZoningData(cityId);
        await saveAPIDistricts(districts);
        
        // Update municipality record
        await db.query(
          `UPDATE municipalities SET 
            total_zoning_districts = $1,
            last_scraped_at = NOW()
           WHERE id = $2`,
          [districts.length, cityId]
        );
        
        console.log(`  ✅ ${districts.length} districts saved`);
        successCount++;
        
        // Rate limit: 2 seconds between cities
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`  ❌ Failed:`, error.message);
        failCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Success: ${successCount} cities`);
    console.log(`  ❌ Failed: ${failCount} cities`);
    
    return;
  }

  // No arguments - show usage
  console.error('❌ Error: Must specify --city, --all, or --list');
  console.log('\nUsage:');
  console.log('  npm run fetch:zoning -- --list              # List available cities');
  console.log('  npm run fetch:zoning -- --city=atlanta-ga   # Fetch single city');
  console.log('  npm run fetch:zoning -- --all               # Fetch all cities');
  process.exit(1);
}

// Run CLI
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
