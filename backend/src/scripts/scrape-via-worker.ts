/**
 * Scrape Municode via Cloudflare Worker
 * 
 * Usage:
 *   npm run scrape:worker -- --city=birmingham-al
 *   npm run scrape:worker -- --priority=HIGH
 *   npm run scrape:worker -- --all
 */

import { getWorkerClient } from '../services/municode-worker-client';
import { db } from '../db';

// HIGH priority cities (6)
const HIGH_PRIORITY = [
  'birmingham-al',
  'montgomery-al',
  'louisville-ky',
  'lexington-ky',
  'fort-worth-tx',
  'el-paso-tx',
];

interface CliArgs {
  city?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  all?: boolean;
  test?: boolean;
}

async function main() {
  // Parse CLI arguments
  const args: CliArgs = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--city=')) {
      args.city = arg.split('=')[1];
    } else if (arg.startsWith('--priority=')) {
      args.priority = arg.split('=')[1] as 'HIGH' | 'MEDIUM' | 'LOW';
    } else if (arg === '--all') {
      args.all = true;
    } else if (arg === '--test') {
      args.test = true;
    }
  });

  console.log('🌐 Municode Scraper via Cloudflare Worker\n');

  // Check environment variable
  if (!process.env.MUNICODE_WORKER_URL) {
    console.error('❌ Error: MUNICODE_WORKER_URL environment variable not set');
    console.log('\nSet it in .env:');
    console.log('  MUNICODE_WORKER_URL=https://municode-scraper.your-subdomain.workers.dev');
    process.exit(1);
  }

  const client = getWorkerClient();

  // Test mode - list available cities from worker
  if (args.test) {
    try {
      console.log('Testing worker connection...\n');
      const municipalities = await client.listMunicipalities();
      console.log(`✅ Worker is online! Found ${municipalities.length} municipalities:\n`);
      municipalities.slice(0, 10).forEach((id) => {
        console.log(`  - ${id}`);
      });
      if (municipalities.length > 10) {
        console.log(`  ... and ${municipalities.length - 10} more`);
      }
      return;
    } catch (error) {
      console.error('❌ Worker connection failed:', error.message);
      process.exit(1);
    }
  }

  // Scrape single city
  if (args.city) {
    console.log(`Scraping ${args.city} via worker...\n`);
    
    try {
      await client.scrapeAndSave(args.city);
      
      // Show results
      const result = await db.query(
        `SELECT 
          m.name, 
          m.state, 
          m.total_zoning_districts, 
          m.zoning_data_quality
         FROM municipalities m
         WHERE m.id = $1`,
        [args.city]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        console.log(`\n✅ Success!`);
        console.log(`  ${row.name}, ${row.state}`);
        console.log(`  Districts: ${row.total_zoning_districts}`);
        console.log(`  Quality: ${row.zoning_data_quality}`);
      }
    } catch (error) {
      console.error(`\n❌ Failed:`, error.message);
      process.exit(1);
    }
    
    return;
  }

  // Scrape HIGH priority cities
  if (args.priority === 'HIGH') {
    console.log(`Scraping ${HIGH_PRIORITY.length} HIGH priority cities...\n`);
    
    const result = await client.scrapeMultiple(HIGH_PRIORITY, 3000); // 3 sec delay
    
    console.log(`\n📊 Results:`);
    console.log(`  ✅ Success: ${result.success}`);
    console.log(`  ❌ Failed: ${result.failed}`);
    
    console.log(`\n📋 Details:`);
    result.results.forEach((r) => {
      const emoji = r.success ? '✅' : '❌';
      console.log(`  ${emoji} ${r.id}${r.error ? ` - ${r.error}` : ''}`);
    });
    
    return;
  }

  // Scrape all cities from database
  if (args.all) {
    const citiesResult = await db.query(`
      SELECT id FROM municipalities
      WHERE has_api = FALSE AND scraping_enabled = TRUE
      ORDER BY name
    `);

    const cityIds = citiesResult.rows.map(r => r.id);
    console.log(`Scraping ${cityIds.length} cities...\n`);
    
    const result = await client.scrapeMultiple(cityIds, 3000);
    
    console.log(`\n📊 Final Results:`);
    console.log(`  ✅ Success: ${result.success}`);
    console.log(`  ❌ Failed: ${result.failed}`);
    
    return;
  }

  // No arguments - show usage
  console.error('❌ Error: Must specify --city, --priority, --all, or --test');
  console.log('\nUsage:');
  console.log('  npm run scrape:worker -- --test                  # Test worker connection');
  console.log('  npm run scrape:worker -- --city=birmingham-al    # Scrape single city');
  console.log('  npm run scrape:worker -- --priority=HIGH         # Scrape 6 HIGH priority cities');
  console.log('  npm run scrape:worker -- --all                   # Scrape all cities');
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
