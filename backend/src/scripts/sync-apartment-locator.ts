/**
 * Sync Apartment Locator AI Data
 * 
 * Manual script to sync rent data from Apartment Locator AI
 * 
 * Usage:
 *   npx tsx backend/src/scripts/sync-apartment-locator.ts
 *   npx tsx backend/src/scripts/sync-apartment-locator.ts --city=Atlanta
 *   npx tsx backend/src/scripts/sync-apartment-locator.ts --all
 */

import { apartmentLocatorSyncService } from '../services/apartment-locator-sync.service';
import { getPool } from '../database/connection';

const pool = getPool();

async function main() {
  const args = process.argv.slice(2);
  
  const syncAll = args.includes('--all');
  const cityArg = args.find(a => a.startsWith('--city='));
  const city = cityArg ? cityArg.split('=')[1] : null;
  
  console.log('==========================================');
  console.log('Apartment Locator AI Sync');
  console.log('==========================================\n');
  
  try {
    if (syncAll) {
      console.log('📊 Syncing all supported metros...\n');
      
      const result = await apartmentLocatorSyncService.syncAllMetros();
      
      console.log('\n✅ Sync Complete!\n');
      console.log('Results:');
      result.results.forEach(r => {
        const icon = r.success ? '✅' : '❌';
        console.log(`  ${icon} ${r.metro}: ${r.properties} properties, avg rent $${r.avg_rent}`);
      });
      
    } else {
      console.log('📊 Syncing Atlanta...\n');
      
      const result = await apartmentLocatorSyncService.syncAtlanta();
      
      if (result.success) {
        console.log('\n✅ Atlanta Sync Complete!\n');
        console.log('Stats:');
        console.log(`  Properties Inserted: ${result.stats.properties_inserted}`);
        console.log(`  Properties Updated: ${result.stats.properties_updated}`);
        console.log(`  Total Properties: ${result.stats.total_properties}`);
        console.log(`  Rent Comps: ${result.stats.rent_comps_count}`);
        console.log(`  Avg Rent: $${result.stats.market_data.pricing.avg_rent}`);
        console.log(`  Occupancy: ${result.stats.market_data.occupancy.avg_occupancy}%`);
      } else {
        console.log('\n❌ Sync Failed');
        console.log('Error:', result.stats.error);
      }
    }
    
    // Show sample properties
    console.log('\n📋 Sample Properties:');
    const sample = await pool.query(`
      SELECT name, address_line1, city, rent, units, beds, baths, sqft, current_occupancy
      FROM properties
      WHERE enrichment_source = 'apartment_locator_ai'
        AND city = 'Atlanta'
      ORDER BY updated_at DESC
      LIMIT 5
    `);
    
    if (sample.rows.length > 0) {
      sample.rows.forEach((p, idx) => {
        console.log(`\n  ${idx + 1}. ${p.name || 'Unnamed'}`);
        console.log(`     Address: ${p.address_line1}, ${p.city}`);
        console.log(`     Rent: $${p.rent || 'N/A'} | Units: ${p.units || 'N/A'} | Beds: ${p.beds || 'N/A'}/${p.baths || 'N/A'}ba`);
        console.log(`     Sqft: ${p.sqft || 'N/A'} | Occupancy: ${p.current_occupancy ? p.current_occupancy.toFixed(1) + '%' : 'N/A'}`);
      });
    } else {
      console.log('  No properties found. Check enrichment_source filter.');
    }
    
  } catch (error: any) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
