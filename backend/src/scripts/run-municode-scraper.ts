import { scrapeMunicipalities } from '../services/municode.scraper';
import { getPool } from '../database/connection';

const pool = getPool();

interface CliArgs {
  city?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  all?: boolean;
  test?: boolean;
}

async function main() {
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

  console.log('Municode Scraper CLI\n');

  if (args.test) {
    const result = await pool.query(`
      SELECT id, name, state, priority, last_scraped_at
      FROM municipalities
      WHERE has_api = FALSE
      ORDER BY
        CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
        name
    `);

    console.log(`Found ${result.rows.length} municipalities without APIs:\n`);
    result.rows.forEach((row: any) => {
      const status = row.last_scraped_at
        ? `Scraped ${new Date(row.last_scraped_at).toLocaleDateString()}`
        : 'Not scraped';
      console.log(`  ${row.id}: ${row.name}, ${row.state} [${row.priority}] - ${status}`);
    });
    return;
  }

  let query = `
    SELECT id, name, state, county, municode_url, zoning_chapter_path
    FROM municipalities
    WHERE has_api = FALSE
  `;
  const params: any[] = [];

  if (args.city) {
    query += ` AND id = $1`;
    params.push(args.city);
    console.log(`Scraping single city: ${args.city}\n`);
  } else if (args.priority) {
    query += ` AND priority = $1`;
    params.push(args.priority);
    console.log(`Scraping ${args.priority} priority cities\n`);
  } else if (args.all) {
    console.log(`Scraping ALL cities (this will take a while)\n`);
  } else {
    console.error('Error: Must specify --city, --priority, or --all');
    console.log('\nUsage:');
    console.log('  npx ts-node backend/src/scripts/run-municode-scraper.ts --city=birmingham-al');
    console.log('  npx ts-node backend/src/scripts/run-municode-scraper.ts --priority=HIGH');
    console.log('  npx ts-node backend/src/scripts/run-municode-scraper.ts --all');
    console.log('  npx ts-node backend/src/scripts/run-municode-scraper.ts --test');
    process.exit(1);
  }

  const result = await pool.query(query, params);

  if (result.rows.length === 0) {
    console.log('No municipalities found to scrape.');
    return;
  }

  console.log(`Found ${result.rows.length} municipalities to scrape\n`);

  await scrapeMunicipalities(result.rows);

  const summary = await pool.query(`
    SELECT
      m.id,
      m.name,
      m.state,
      m.total_zoning_districts,
      m.last_scraped_at
    FROM municipalities m
    WHERE m.id = ANY($1)
    ORDER BY m.name
  `, [result.rows.map((r: any) => r.id)]);

  console.log('\nScraping Complete!\n');
  console.log('Summary:');
  summary.rows.forEach((row: any) => {
    console.log(`  ${row.name}, ${row.state}: ${row.total_zoning_districts || 0} districts`);
  });
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
