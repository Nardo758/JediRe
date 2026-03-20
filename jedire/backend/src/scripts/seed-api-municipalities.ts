/**
 * Seed API-Enabled Municipalities
 * 
 * Populates the municipalities table with the 17 cities
 * that have open data APIs available
 */

import { getPool } from '../database/connection';

const db = getPool();
import { CITY_APIS } from '../services/municipal-api-connectors';

async function seedAPIMunicipalities() {
  console.log(`Seeding ${Object.keys(CITY_APIS).length} API-enabled municipalities...\n`);

  for (const [cityId, config] of Object.entries(CITY_APIS)) {
    try {
      // Extract county from city name if available
      const county = cityId.includes('county') 
        ? config.name.replace(' County', '')
        : config.name;

      await db.query(
        `
        INSERT INTO municipalities (
          id, name, state, county, 
          has_api, api_type, api_url,
          data_quality
        ) VALUES ($1, $2, $3, $4, TRUE, $5, $6, 'excellent')
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          has_api = TRUE,
          api_type = EXCLUDED.api_type,
          api_url = EXCLUDED.api_url,
          data_quality = 'excellent'
        `,
        [
          cityId,
          config.name,
          config.state,
          county,
          config.type,
          (config as any).baseUrl || (config as any).serviceUrl,
        ]
      );

      const emoji = config.type === 'socrata' ? '📊' : '🗺️';
      console.log(`${emoji} ${config.name}, ${config.state} (${config.type.toUpperCase()})`);
    } catch (error) {
      console.error(`❌ Failed to seed ${config.name}:`, error);
    }
  }

  console.log('\n✅ API municipality seeding complete!');

  // Show summary
  const stats = await db.query(`
    SELECT 
      api_type,
      COUNT(*) as count
    FROM municipalities
    WHERE has_api = TRUE
    GROUP BY api_type
    ORDER BY count DESC
  `);

  console.log('\n📊 Summary by API Type:');
  stats.rows.forEach((row) => {
    const emoji = row.api_type === 'socrata' ? '📊' : '🗺️';
    console.log(`  ${emoji} ${row.api_type}: ${row.count} cities`);
  });

  // Total stats
  const total = await db.query(`
    SELECT 
      COUNT(*) FILTER (WHERE has_api = TRUE) as api_count,
      COUNT(*) FILTER (WHERE has_api = FALSE) as no_api_count,
      COUNT(*) as total_count
    FROM municipalities
  `);

  console.log('\n📦 Total Coverage:');
  console.log(`  ✅ API Available: ${total.rows[0].api_count} cities`);
  console.log(`  🔧 Scraping Required: ${total.rows[0].no_api_count} cities`);
  console.log(`  📍 Total: ${total.rows[0].total_count} cities`);
}

// Run seeder
if (require.main === module) {
  seedAPIMunicipalities()
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedAPIMunicipalities };
