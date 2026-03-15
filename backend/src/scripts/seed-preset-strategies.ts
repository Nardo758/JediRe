/**
 * Seed preset strategies into the database
 * Run with: npm run seed-presets (add this script to package.json)
 */

import { query } from '../database/connection';

const PRESET_STRATEGIES = [
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
      'Markets where digital demand is surging but physical traffic and rents haven\'t caught up yet. The buy window.',
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
        label: "Rent growth still low (hasn't repriced yet)",
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
    tags: ['preset', 'scanner', 'leading-indicator', 'buy-signal', 'demand'],
  },
];

async function seedPresetStrategies() {
  try {
    console.log('🌱 Checking for existing preset strategies...');

    const countResult = await query('SELECT COUNT(*) as count FROM strategy_definitions WHERE type = $1', ['preset']);
    const presetCount = parseInt(countResult.rows[0].count);

    if (presetCount > 0) {
      console.log(`✅ Found ${presetCount} existing preset strategies. Skipping seed.`);
      process.exit(0);
    }

    console.log('📝 Seeding 5 preset strategies...');

    for (const strategy of PRESET_STRATEGIES) {
      await query(
        `INSERT INTO strategy_definitions
        (user_id, name, description, type, scope, conditions, combinator, signal_weights,
         sort_by, sort_direction, max_results, asset_classes, deal_types, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          null, // user_id = NULL for presets
          strategy.name,
          strategy.description || null,
          'preset',
          strategy.scope,
          JSON.stringify(strategy.conditions),
          strategy.combinator,
          strategy.signal_weights ? JSON.stringify(strategy.signal_weights) : null,
          strategy.sort_by || null,
          strategy.sort_direction || 'desc',
          50,
          strategy.asset_classes || [],
          strategy.deal_types || [],
          strategy.tags || [],
        ]
      );
      console.log(`  ✓ Created "${strategy.name}"`);
    }

    console.log('✅ Preset strategies seeded successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to seed preset strategies:', error.message);
    process.exit(1);
  }
}

seedPresetStrategies();
