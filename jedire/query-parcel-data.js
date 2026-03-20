#!/usr/bin/env node
/**
 * Query Parcel Data - Find the 300-unit building
 * This script queries the database to find deals with property boundaries
 */

const { Pool } = require('pg');

// Use environment variables (available in Replit)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('amazonaws.com') ? { rejectUnauthorized: false } : false
});

async function queryParcelData() {
  try {
    console.log('🔍 Searching for deals with property boundaries...\n');

    // Query deals with boundaries
    const dealsQuery = `
      SELECT 
        d.id,
        d.name,
        d.project_type,
        d.module_outputs,
        pb.id as boundary_id,
        pb.parcel_area,
        pb.parcel_area_sf,
        pb.boundary_geojson,
        pb.setbacks,
        pb.buildable_area_sf
      FROM deals d
      LEFT JOIN property_boundaries pb ON d.id = pb.deal_id
      WHERE pb.id IS NOT NULL
      ORDER BY d.created_at DESC
      LIMIT 20
    `;

    const result = await pool.query(dealsQuery);

    if (result.rows.length === 0) {
      console.log('❌ No deals with property boundaries found.');
      return;
    }

    console.log(`✅ Found ${result.rows.length} deal(s) with property boundaries:\n`);

    for (const row of result.rows) {
      const zoningOutput = row.module_outputs?.zoningIntelligence || {};
      const byRightUnits = zoningOutput.byRightUnits || 0;
      
      console.log('─────────────────────────────────────────────────────');
      console.log(`📍 Deal: ${row.name}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Type: ${row.project_type}`);
      console.log(`   Parcel Area: ${row.parcel_area} acres (${Math.round(row.parcel_area_sf)} SF)`);
      console.log(`   Buildable Area: ${Math.round(row.buildable_area_sf)} SF`);
      console.log(`   By-Right Units: ${byRightUnits}`);
      
      if (row.setbacks) {
        console.log(`   Setbacks: Front=${row.setbacks.front}' Side=${row.setbacks.side}' Rear=${row.setbacks.rear}'`);
      }
      
      // Show GeoJSON preview
      if (row.boundary_geojson) {
        const coords = row.boundary_geojson.coordinates || [];
        console.log(`   Boundary Coordinates: ${coords.length > 0 ? coords[0].length + ' points' : 'N/A'}`);
      }
      
      console.log('');
    }

    // Find the one with ~300 units
    const match = result.rows.find(r => {
      const units = r.module_outputs?.zoningIntelligence?.byRightUnits || 0;
      return units >= 250 && units <= 350;
    });

    if (match) {
      console.log('\n🎯 FOUND THE 300-UNIT BUILDING!\n');
      console.log('Full Data:');
      console.log(JSON.stringify(match, null, 2));
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

queryParcelData();
