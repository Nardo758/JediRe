/**
 * Complete Strategy Engine Setup
 * Initializes all tables, migrations, and seed data required for the strategy engine
 *
 * Run with: npm run setup-strategy-engine
 */

import { query, getPool } from '../database/connection';
import { logger } from '../utils/logger';

const pool = getPool();

async function checkTable(tableName: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_name = $1
      )`,
      [tableName]
    );
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

async function seedPresetStrategies() {
  console.log('📝 Seeding preset strategies...');

  const presets = [
    {
      name: 'Build-to-Sell',
      description: 'Pipeline-constrained markets with strong employment. Good risk/reward for development.',
      scope: 'property',
      conditions: [
        { metricId: 'S_PIPELINE_TO_STOCK', operator: 'lt', value: 5, weight: 25, required: true },
        { metricId: 'E_EMPLOYMENT_GROWTH', operator: 'gt', value: 2.0, weight: 20, required: false },
        { metricId: 'M_ABSORPTION', operator: 'gt', value: 200, weight: 20, required: false },
      ],
      combinator: 'AND',
      signal_weights: { demand: 30, supply: 25, momentum: 20, position: 15, risk: 10 },
      asset_classes: ['multifamily', 'single_family'],
      deal_types: ['development'],
      tags: ['preset', 'deal-level'],
    },
    {
      name: 'Fix & Flip / Value-Add',
      description: 'High cap rates with growing rents. Perfect for opportunistic value-add.',
      scope: 'property',
      conditions: [
        { metricId: 'F_CAP_RATE', operator: 'gt', value: 6.0, weight: 20, required: false },
        { metricId: 'F_RENT_GROWTH', operator: 'gt', value: 2.0, weight: 15, required: false },
      ],
      combinator: 'AND',
      signal_weights: { demand: 15, supply: 20, momentum: 30, position: 20, risk: 15 },
      asset_classes: ['multifamily', 'single_family', 'retail', 'office'],
      deal_types: ['existing', 'redevelopment'],
      tags: ['preset', 'deal-level'],
    },
    {
      name: 'Stabilized Rental / Hold',
      description: 'Stable markets with predictable cash flow. Long-term core portfolio.',
      scope: 'property',
      conditions: [],
      combinator: 'AND',
      signal_weights: { demand: 30, supply: 25, momentum: 20, position: 15, risk: 10 },
      asset_classes: ['multifamily', 'single_family', 'industrial'],
      deal_types: ['existing'],
      tags: ['preset', 'deal-level'],
    },
    {
      name: 'Short-Term Rental / Airbnb',
      description: 'High traffic, strong demand markets suited for short-term rental repositioning.',
      scope: 'property',
      conditions: [],
      combinator: 'AND',
      signal_weights: { demand: 25, supply: 20, momentum: 25, position: 20, risk: 10 },
      asset_classes: ['single_family', 'hospitality'],
      deal_types: ['existing'],
      tags: ['preset', 'deal-level'],
    },
    {
      name: 'Demand Surge Detector',
      description:
        'Markets where digital demand is surging but physical traffic and rents haven\'t caught up yet.',
      scope: 'submarket',
      conditions: [
        {
          metricId: 'C_SURGE_INDEX',
          operator: 'gt',
          value: 0.2,
          weight: 35,
          required: true,
          label: 'Traffic surge above 20% baseline',
        },
        {
          metricId: 'F_RENT_GROWTH',
          operator: 'lt',
          value: 2.5,
          weight: 25,
          required: false,
          label: "Rent growth still low",
        },
        {
          metricId: 'D_SEARCH_MOMENTUM',
          operator: 'gt',
          value: 15,
          weight: 20,
          required: false,
          label: 'Search demand accelerating',
        },
        {
          metricId: 'S_PIPELINE_TO_STOCK',
          operator: 'lt',
          value: 6,
          weight: 20,
          required: false,
          label: 'Supply not flooding in yet',
        },
      ],
      combinator: 'AND',
      sort_by: 'C_SURGE_INDEX',
      sort_direction: 'desc',
      asset_classes: ['multifamily', 'single_family', 'industrial'],
      deal_types: ['existing', 'development'],
      tags: ['preset', 'scanner', 'leading-indicator', 'buy-signal'],
    },
  ];

  for (const preset of presets) {
    try {
      await query(
        `INSERT INTO strategy_definitions
        (user_id, name, description, type, scope, conditions, combinator, signal_weights,
         sort_by, sort_direction, max_results, asset_classes, deal_types, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT DO NOTHING`,
        [
          null,
          preset.name,
          preset.description,
          'preset',
          preset.scope,
          JSON.stringify(preset.conditions),
          preset.combinator,
          JSON.stringify(preset.signal_weights),
          preset.sort_by || null,
          preset.sort_direction || 'desc',
          50,
          preset.asset_classes,
          preset.deal_types,
          preset.tags,
        ]
      );
      console.log(`  ✓ ${preset.name}`);
    } catch (error: any) {
      console.error(`  ✗ Failed to seed ${preset.name}:`, error.message);
    }
  }
}

async function seedFloridaGeographies() {
  console.log('🗺️  Seeding Florida geographies...');

  const counties = [
    { fipsId: '12001', name: 'Alachua', lat: 29.681, lng: -82.314 },
    { fipsId: '12003', name: 'Baker', lat: 30.347, lng: -82.366 },
    { fipsId: '12005', name: 'Bradford', lat: 29.952, lng: -82.301 },
    { fipsId: '12007', name: 'Brevard', lat: 28.341, lng: -80.656 },
    { fipsId: '12009', name: 'Broward', lat: 26.203, lng: -80.305 },
    { fipsId: '12011', name: 'Calhoun', lat: 29.935, lng: -85.365 },
    { fipsId: '12013', name: 'Charlotte', lat: 26.921, lng: -81.867 },
    { fipsId: '12015', name: 'Citrus', lat: 28.805, lng: -82.602 },
    { fipsId: '12017', name: 'Clay', lat: 30.307, lng: -81.668 },
    { fipsId: '12019', name: 'Collier', lat: 26.318, lng: -81.792 },
    { fipsId: '12021', name: 'Columbia', lat: 30.265, lng: -82.614 },
    { fipsId: '12023', name: 'DeSoto', lat: 27.023, lng: -81.768 },
    { fipsId: '12025', name: 'Dixie', lat: 29.524, lng: -83.054 },
    { fipsId: '12027', name: 'Duval', lat: 30.302, lng: -81.655 },
    { fipsId: '12029', name: 'Escambia', lat: 30.508, lng: -87.236 },
    { fipsId: '12031', name: 'Flagler', lat: 29.512, lng: -81.228 },
    { fipsId: '12033', name: 'Franklin', lat: 29.826, lng: -84.932 },
    { fipsId: '12035', name: 'Gadsden', lat: 30.604, lng: -84.256 },
    { fipsId: '12037', name: 'Gilchrist', lat: 29.547, lng: -83.009 },
    { fipsId: '12039', name: 'Glades', lat: 26.784, lng: -80.934 },
    { fipsId: '12041', name: 'Gulf', lat: 29.752, lng: -85.303 },
    { fipsId: '12043', name: 'Hamilton', lat: 30.125, lng: -82.863 },
    { fipsId: '12045', name: 'Hardee', lat: 27.37, lng: -81.723 },
    { fipsId: '12047', name: 'Hendry', lat: 26.659, lng: -80.99 },
    { fipsId: '12049', name: 'Hernando', lat: 28.469, lng: -82.598 },
    { fipsId: '12051', name: 'Highlands', lat: 27.296, lng: -81.352 },
    { fipsId: '12053', name: 'Hillsborough', lat: 27.989, lng: -82.16 },
    { fipsId: '12055', name: 'Holmes', lat: 30.829, lng: -85.682 },
    { fipsId: '12057', name: 'Indian River', lat: 27.657, lng: -80.547 },
    { fipsId: '12059', name: 'Jackson', lat: 30.811, lng: -85.279 },
    { fipsId: '12061', name: 'Jefferson', lat: 30.422, lng: -83.359 },
    { fipsId: '12063', name: 'Lafayette', lat: 29.927, lng: -83.285 },
    { fipsId: '12065', name: 'Lake', lat: 28.735, lng: -81.686 },
    { fipsId: '12067', name: 'Lee', lat: 26.558, lng: -81.866 },
    { fipsId: '12069', name: 'Leon', lat: 30.436, lng: -84.283 },
    { fipsId: '12071', name: 'Levy', lat: 29.544, lng: -83.36 },
    { fipsId: '12073', name: 'Liberty', lat: 30.286, lng: -84.903 },
    { fipsId: '12075', name: 'Madison', lat: 30.305, lng: -83.41 },
    { fipsId: '12077', name: 'Manatee', lat: 27.499, lng: -82.532 },
    { fipsId: '12079', name: 'Marion', lat: 29.176, lng: -82.307 },
    { fipsId: '12081', name: 'Martin', lat: 27.133, lng: -80.614 },
    { fipsId: '12083', name: 'Miami-Dade', lat: 25.761, lng: -80.197 },
    { fipsId: '12085', name: 'Monroe', lat: 24.755, lng: -81.41 },
    { fipsId: '12086', name: 'Nassau', lat: 30.619, lng: -81.633 },
    { fipsId: '12087', name: 'Okaloosa', lat: 30.714, lng: -86.575 },
    { fipsId: '12089', name: 'Okeechobee', lat: 27.253, lng: -80.863 },
    { fipsId: '12091', name: 'Orange', lat: 28.545, lng: -81.375 },
    { fipsId: '12093', name: 'Osceola', lat: 28.299, lng: -81.368 },
    { fipsId: '12095', name: 'Palm Beach', lat: 26.686, lng: -80.236 },
    { fipsId: '12097', name: 'Pasco', lat: 28.315, lng: -82.308 },
    { fipsId: '12099', name: 'Pinellas', lat: 27.822, lng: -82.64 },
    { fipsId: '12101', name: 'Polk', lat: 27.939, lng: -81.629 },
    { fipsId: '12103', name: 'Putnam', lat: 29.295, lng: -81.896 },
    { fipsId: '12105', name: 'St. Johns', lat: 29.916, lng: -81.319 },
    { fipsId: '12107', name: 'St. Lucie', lat: 27.306, lng: -80.369 },
    { fipsId: '12109', name: 'Santa Rosa', lat: 30.745, lng: -87.107 },
    { fipsId: '12111', name: 'Sarasota', lat: 27.342, lng: -82.473 },
    { fipsId: '12113', name: 'Seminole', lat: 28.685, lng: -81.279 },
    { fipsId: '12115', name: 'Sumter', lat: 28.789, lng: -82.174 },
    { fipsId: '12117', name: 'Suwannee', lat: 30.285, lng: -83.166 },
    { fipsId: '12119', name: 'Taylor', lat: 29.913, lng: -83.476 },
    { fipsId: '12121', name: 'Union', lat: 30.232, lng: -82.679 },
    { fipsId: '12123', name: 'Volusia', lat: 28.805, lng: -81.041 },
    { fipsId: '12125', name: 'Wakulla', lat: 30.201, lng: -84.39 },
    { fipsId: '12127', name: 'Walton', lat: 30.546, lng: -86.103 },
    { fipsId: '12129', name: 'Washington', lat: 30.793, lng: -85.618 },
  ];

  let seeded = 0;
  for (const county of counties) {
    try {
      const res = await query(
        `INSERT INTO geographies (id, type, name, state, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
        [`fl-county-${county.fipsId}`, 'county', county.name, 'FL', county.lat, county.lng]
      );
      if (res.rowCount && res.rowCount > 0) seeded++;
    } catch (error: any) {
      console.error(`  ✗ Failed to seed ${county.name}:`, error.message);
    }
  }
  console.log(`  ✓ Seeded ${seeded} Florida counties`);
}

async function checkData() {
  console.log('\n📊 Checking data status...');

  try {
    const presetCount = await query('SELECT COUNT(*) as count FROM strategy_definitions WHERE type = $1', ['preset']);
    console.log(`  Strategy presets: ${presetCount.rows[0].count}`);

    const geoCount = await query('SELECT COUNT(*) as count FROM geographies');
    console.log(`  Geographies: ${geoCount.rows[0].count}`);

    const metricsCount = await query('SELECT COUNT(*) as count FROM metric_time_series');
    console.log(`  Metric time series records: ${metricsCount.rows[0].count}`);

    if (metricsCount.rows[0].count === 0) {
      console.log('  ⚠️  No metric data yet — data ingestion needed');
    }
  } catch (error: any) {
    console.error('  ✗ Error checking data:', error.message);
  }
}

async function main() {
  console.log('\n🚀 Strategy Engine Setup\n');

  try {
    // Check tables
    console.log('✓ Database connected');

    // Check if tables exist
    const tables = ['strategy_definitions', 'geographies', 'metric_time_series', 'strategy_runs', 'metric_correlations'];
    const missingTables = [];

    for (const table of tables) {
      const exists = await checkTable(table);
      if (!exists) {
        missingTables.push(table);
      }
    }

    if (missingTables.length > 0) {
      console.log('\n⚠️  Missing tables. Run migration first:');
      console.log('   npm run migrate\n');
      process.exit(1);
    }

    console.log('✓ All required tables exist\n');

    // Seed presets
    const presetCount = await query('SELECT COUNT(*) as count FROM strategy_definitions WHERE type = $1', ['preset']);
    if (presetCount.rows[0].count === 0) {
      await seedPresetStrategies();
    } else {
      console.log('✓ Presets already seeded');
    }

    // Seed Florida geographies
    const geoCount = await query('SELECT COUNT(*) as count FROM geographies WHERE state = $1', ['FL']);
    if (geoCount.rows[0].count === 0) {
      await seedFloridaGeographies();
    } else {
      console.log('✓ Florida geographies already seeded');
    }

    // Check data
    await checkData();

    console.log('\n✅ Strategy Engine setup complete!\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
