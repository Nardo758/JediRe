/**
 * Municode Scraper CLI
 * 
 * Usage:
 *   npm run scrape:municode -- --city=birmingham-al
 *   npm run scrape:municode -- --priority=HIGH
 *   npm run scrape:municode -- --all
 */

import { scrapeMunicipalities, MunicodeScraper } from '../services/municode.scraper';
import { db } from '../db';

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

  console.log('🔍 Municode Scraper CLI\n');

  // Test mode - just print municipality info
  if (args.test) {
    const result = await db.query(`
      SELECT id, name, state, municode_url, last_scraped_at
      FROM municipalities
      WHERE has_api = FALSE
      ORDER BY 
        CASE WHEN last_scraped_at IS NULL THEN 0 ELSE 1 END,
        name
    `);

    console.log(`Found ${result.rows.length} municipalities without APIs:\n`);
    result.rows.forEach((row) => {
      const status = row.last_scraped_at 
        ? `✅ Scraped ${new Date(row.last_scraped_at).toLocaleDateString()}`
        : '⏳ Not scraped';
      console.log(`  ${row.id}: ${row.name}, ${row.state} - ${status}`);
    });
    return;
  }

  // Fetch municipalities to scrape
  let query = `
    SELECT id, name, state, county, municode_url, zoning_chapter_path
    FROM municipalities
    WHERE has_api = FALSE AND scraping_enabled = TRUE
  `;
  const params: any[] = [];

  if (args.city) {
    query += ` AND id = $1`;
    params.push(args.city);
    console.log(`Scraping single city: ${args.city}\n`);
  } else if (args.priority) {
    // Priority stored in notes or tags - simplified for now
    query += ` LIMIT 6`; // HIGH = first 6
    console.log(`Scraping ${args.priority} priority cities\n`);
  } else if (args.all) {
    console.log(`Scraping ALL cities (this will take a while)\n`);
  } else {
    console.error('❌ Error: Must specify --city, --priority, or --all');
    console.log('\nUsage:');
    console.log('  npm run scrape:municode -- --city=birmingham-al');
    console.log('  npm run scrape:municode -- --priority=HIGH');
    console.log('  npm run scrape:municode -- --all');
    console.log('  npm run scrape:municode -- --test');
    process.exit(1);
  }

  const result = await db.query(query, params);
  
  if (result.rows.length === 0) {
    console.log('No municipalities found to scrape.');
    return;
  }

  console.log(`Found ${result.rows.length} municipalities to scrape\n`);

  // Run scraper
  await scrapeMunicipalities(result.rows);

  // Show summary
  const summary = await db.query(`
    SELECT 
      m.id,
      m.name,
      m.state,
      COUNT(zd.id) as districts_found,
      m.last_scraped_at
    FROM municipalities m
    LEFT JOIN zoning_districts zd ON zd.municipality_id = m.id
    WHERE m.id = ANY($1)
    GROUP BY m.id, m.name, m.state, m.last_scraped_at
  `, [result.rows.map(r => r.id)]);

  console.log('\n✅ Scraping Complete!\n');
  console.log('📊 Summary:');
  summary.rows.forEach((row) => {
    console.log(`  ${row.name}, ${row.state}: ${row.districts_found} districts`);
  });
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
