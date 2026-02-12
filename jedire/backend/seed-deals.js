#!/usr/bin/env node
/**
 * Seed 5 sample deals into the database
 * Usage: node seed-deals.js
 */

const { Client } = require('pg');
require('dotenv').config();

const sampleDeals = [
  {
    name: 'Midtown Mixed-Use Development',
    projectType: 'mixed_use',
    status: 'lead',
    tier: 'pro',
    budget: 5500000,
    targetUnits: 85,
    projectIntent: 'High-potential mixed-use project in prime Midtown location',
    // Polygon around -84.385, 33.785
    boundary: 'POLYGON((-84.385 33.785, -84.380 33.785, -84.380 33.780, -84.385 33.780, -84.385 33.785))',
    propertyAddress: '1234 Peachtree St NE, Atlanta, GA 30309'
  },
  {
    name: 'Buckhead Luxury Apartments',
    projectType: 'multifamily',
    status: 'lead',
    tier: 'enterprise',
    budget: 8200000,
    targetUnits: 120,
    projectIntent: 'Luxury residential development targeting high-income professionals',
    boundary: 'POLYGON((-84.388 33.850, -84.383 33.850, -84.383 33.845, -84.388 33.845, -84.388 33.850))',
    propertyAddress: '3456 Peachtree Rd NE, Atlanta, GA 30326'
  },
  {
    name: 'Downtown Office Conversion',
    projectType: 'office',
    status: 'qualified',
    tier: 'pro',
    budget: 3800000,
    targetUnits: 45,
    projectIntent: 'Converting old office building to modern workspace',
    boundary: 'POLYGON((-84.390 33.755, -84.385 33.755, -84.385 33.750, -84.390 33.750, -84.390 33.755))',
    propertyAddress: '789 Marietta St NW, Atlanta, GA 30318'
  },
  {
    name: 'Inman Park Multifamily',
    projectType: 'multifamily',
    status: 'due_diligence',
    tier: 'basic',
    budget: 2950000,
    targetUnits: 38,
    projectIntent: 'Affordable housing project in growing neighborhood',
    boundary: 'POLYGON((-84.350 33.760, -84.345 33.760, -84.345 33.755, -84.350 33.755, -84.350 33.760))',
    propertyAddress: '456 Edgewood Ave SE, Atlanta, GA 30312'
  },
  {
    name: 'Westside Retail Center',
    projectType: 'retail',
    status: 'under_contract',
    tier: 'enterprise',
    budget: 6750000,
    targetUnits: null,
    projectIntent: 'Modern retail center with anchor tenant secured',
    boundary: 'POLYGON((-84.410 33.770, -84.405 33.770, -84.405 33.765, -84.410 33.765, -84.410 33.770))',
    propertyAddress: '234 Howell Mill Rd NW, Atlanta, GA 30318'
  }
];

async function seedDeals() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Get first user
    const userResult = await client.query('SELECT id, email FROM users LIMIT 1');
    let userId;

    if (userResult.rows.length === 0) {
      console.log('No users found, creating test user...');
      const newUser = await client.query(
        "INSERT INTO users (email, tier) VALUES ('test@jedire.com', 'pro') RETURNING id"
      );
      userId = newUser.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
      console.log(`Using existing user: ${userResult.rows[0].email}`);
    }

    console.log(`\nSeeding ${sampleDeals.length} deals...`);

    for (const deal of sampleDeals) {
      const query = `
        INSERT INTO deals (
          user_id,
          name,
          boundary,
          project_type,
          status,
          tier,
          budget,
          target_units,
          project_intent
        ) VALUES ($1, $2, ST_GeomFromText($3, 4326), $4, $5, $6, $7, $8, $9)
        RETURNING id, name
      `;

      const values = [
        userId,
        deal.name,
        deal.boundary,
        deal.projectType,
        deal.status,
        deal.tier,
        deal.budget,
        deal.targetUnits,
        deal.projectIntent
      ];

      const result = await client.query(query, values);
      console.log(`✓ Created deal: ${result.rows[0].name} (${result.rows[0].id})`);
    }

    console.log(`\n✅ Successfully seeded ${sampleDeals.length} deals!`);

  } catch (error) {
    console.error('❌ Error seeding deals:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedDeals();
