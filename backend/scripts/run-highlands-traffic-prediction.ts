/**
 * Run Highlands at Sweetwater Creek (p2122) through the full traffic prediction pipeline:
 *   1. Generate market research report (via MarketResearchEngine.generateMarketReport)
 *   2. Run TrafficPredictionEngine.predictTraffic
 *   3. Print a summary of what was written to traffic_predictions
 *
 * Property ID : 7ea31caf-f070-43eb-9fd1-fe08f7123701
 * Deal ID     : eaabeb9f-830e-44f9-a923-56679ad0329d
 * Address     : 2789 Satellite Blvd, Duluth, GA 30096
 */

import { pool } from '../src/database';
import marketResearchEngine from '../src/services/marketResearchEngine';
import trafficPredictionEngine from '../src/services/trafficPredictionEngine';

const PROPERTY_ID = '7ea31caf-f070-43eb-9fd1-fe08f7123701';
const DEAL_ID     = 'eaabeb9f-830e-44f9-a923-56679ad0329d';

async function run() {
  console.log('=== Highlands Traffic Prediction Pipeline ===\n');

  // ── Step 1: generate market research ──────────────────────────────
  console.log('STEP 1 — Generating market research report for deal', DEAL_ID);

  const report = await marketResearchEngine.generateMarketReport({
    id: DEAL_ID,
    latitude: 33.9779,
    longitude: -84.1447,
    city: 'Duluth',
    state: 'GA',
    address: '2789 Satellite Blvd, Duluth, GA 30096',
  });

  console.log(`✅  Market research generated — confidence: ${report.data_quality.confidence_level}`);
  console.log(`    Sources available : ${report.data_quality.sources_available.join(', ') || 'none'}`);
  console.log(`    Sources missing   : ${report.data_quality.sources_missing.join(', ') || 'none'}`);
  console.log(`    Existing units    : ${report.supply_analysis.existing_total_units}`);
  console.log(`    Avg occupancy     : ${report.demand_indicators.avg_occupancy_rate}`);
  console.log('');

  // ── Step 2: run traffic prediction ────────────────────────────────
  console.log('STEP 2 — Running traffic prediction engine for property', PROPERTY_ID);

  const prediction = await trafficPredictionEngine.predictTraffic(
    PROPERTY_ID,
    undefined,
    DEAL_ID,
  );

  console.log(`✅  Traffic prediction complete`);
  console.log(`    Weekly walk-ins   : ${prediction.weekly_walk_ins}`);
  console.log(`    Confidence tier   : ${prediction.confidence.tier}`);
  console.log(`    Confidence score  : ${prediction.confidence.score}`);
  console.log('');

  // ── Step 3: verify rows written to traffic_predictions ────────────
  console.log('STEP 3 — Verifying traffic_predictions rows');

  const rows = await pool.query(`
    SELECT id, prediction_week, prediction_year, weekly_walk_ins, model_version,
           physical_factor_score, market_demand_score, confidence_score, created_at
    FROM traffic_predictions
    WHERE property_id = $1
    ORDER BY created_at DESC
    LIMIT 5
  `, [PROPERTY_ID]);

  if (rows.rows.length === 0) {
    console.warn('⚠️  No rows found in traffic_predictions — prediction may not have persisted.');
  } else {
    console.log(`✅  Found ${rows.rows.length} row(s) in traffic_predictions (newest first):`);
    for (const row of rows.rows) {
      console.log(`    week=${row.prediction_week}/${row.prediction_year}  walk_ins=${row.weekly_walk_ins}  model=${row.model_version}  confidence=${row.confidence_score}  physical=${row.physical_factor_score}  demand=${row.market_demand_score}`);
    }
  }

  console.log('\n=== Pipeline complete ===');
  await pool.end();
}

run().catch(err => {
  console.error('Pipeline failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
