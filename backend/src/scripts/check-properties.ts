/**
 * Quick check of properties in database
 */
import { getPool } from '../database/connection';

const db = getPool();

async function checkProperties() {
  console.log('📊 Checking properties in database...\n');

  const countResult = await db.query('SELECT COUNT(*) as total FROM properties');
  console.log(`Total properties: ${countResult.rows[0].total}\n`);

  const sampleResult = await db.query(`
    SELECT 
      id, 
      address, 
      city, 
      state, 
      lat, 
      lng, 
      current_zoning,
      municipality_id
    FROM properties
    LIMIT 10
  `);

  console.log('Sample properties:');
  console.table(sampleResult.rows);

  const cityStats = await db.query(`
    SELECT 
      city,
      state,
      COUNT(*) as count,
      COUNT(current_zoning) as with_zoning,
      COUNT(lat) as with_coords
    FROM properties
    WHERE city IS NOT NULL
    GROUP BY city, state
    ORDER BY count DESC
  `);

  console.log('\nProperties by city:');
  console.table(cityStats.rows);

  await db.end();
}

checkProperties().catch(console.error);
