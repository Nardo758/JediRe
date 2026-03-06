/**
 * M28 Endpoint Testing Script
 * Tests all cycle intelligence endpoints and validates data structures
 */

import { cycleIntelligenceService } from '../services/cycle-intelligence.service';

const TEST_MARKET_ID = 'tampa-msa';
const TEST_MARKETS = ['tampa-msa', 'atlanta-msa', 'orlando-msa', 'miami-msa'];

async function testEndpoints() {
  console.log('═══════════════════════════════════════════════════');
  console.log('M28 Cycle Intelligence Endpoint Testing');
  console.log('═══════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Get Cycle Phase
  try {
    console.log('📊 Test 1: getCyclePhase()');
    const snapshot = await cycleIntelligenceService.getCyclePhase(TEST_MARKET_ID);
    if (snapshot && snapshot.market_id === TEST_MARKET_ID) {
      console.log(`   ✅ PASS: Got cycle phase for ${TEST_MARKET_ID}`);
      console.log(`      Phase: ${snapshot.lag_phase} (${Math.round(snapshot.lag_position * 100)}%)`);
      console.log(`      Divergence: ${snapshot.divergence.toFixed(1)}%`);
      passed++;
    } else {
      console.log(`   ❌ FAIL: No cycle data found for ${TEST_MARKET_ID}`);
      failed++;
    }
  } catch (err) {
    console.log(`   ❌ FAIL: ${err.message}`);
    failed++;
  }

  // Test 2: Get Divergence
  try {
    console.log('\n🎯 Test 2: getDivergence()');
    const divergence = await cycleIntelligenceService.getDivergence(TEST_MARKET_ID);
    if (divergence && divergence.signal) {
      console.log(`   ✅ PASS: Got divergence signal`);
      console.log(`      Signal: ${divergence.signal} (${divergence.divergence > 0 ? '+' : ''}${divergence.divergence.toFixed(1)}%)`);
      passed++;
    } else {
      console.log(`   ❌ FAIL: No divergence data`);
      failed++;
    }
  } catch (err) {
    console.log(`   ❌ FAIL: ${err.message}`);
    failed++;
  }

  // Test 3: Get Rate Environment
  try {
    console.log('\n💹 Test 3: getRateEnvironment()');
    const rates = await cycleIntelligenceService.getRateEnvironment();
    if (rates && rates.ffr) {
      console.log(`   ✅ PASS: Got rate environment`);
      console.log(`      FFR: ${rates.ffr}% | 10Y: ${rates.t10y}% | Mortgage: ${rates.t30y_mtg}%`);
      console.log(`      M2 YoY: ${rates.m2_yoy}% | Policy: ${rates.policy_stance}`);
      passed++;
    } else {
      console.log(`   ❌ FAIL: No rate data`);
      failed++;
    }
  } catch (err) {
    console.log(`   ❌ FAIL: ${err.message}`);
    failed++;
  }

  // Test 4: Get Leading Indicators
  try {
    console.log('\n📈 Test 4: getLeadingIndicators()');
    const indicators = await cycleIntelligenceService.getLeadingIndicators();
    if (indicators && indicators.length > 0) {
      console.log(`   ✅ PASS: Got ${indicators.length} leading indicators`);
      indicators.slice(0, 3).forEach(ind => {
        console.log(`      - ${ind.indicator_name}: ${ind.value} (${ind.signal})`);
      });
      passed++;
    } else {
      console.log(`   ❌ FAIL: No leading indicators`);
      failed++;
    }
  } catch (err) {
    console.log(`   ❌ FAIL: ${err.message}`);
    failed++;
  }

  // Test 5: Get Pattern Matches
  try {
    console.log('\n🔍 Test 5: getPatternMatches()');
    const patterns = await cycleIntelligenceService.getPatternMatches(3);
    if (patterns && patterns.length > 0) {
      console.log(`   ✅ PASS: Got ${patterns.length} pattern matches`);
      patterns.forEach(p => {
        console.log(`      - ${p.event.name}: ${Math.round(p.similarity_pct * 100)}% similarity`);
      });
      passed++;
    } else {
      console.log(`   ⚠️  WARN: No pattern matches (table may be empty)`);
      console.log(`      This is expected if pattern matching hasn't run yet`);
      passed++; // Don't fail - this is optional
    }
  } catch (err) {
    console.log(`   ❌ FAIL: ${err.message}`);
    failed++;
  }

  // Test 6: Get Value Forecast
  try {
    console.log('\n📊 Test 6: getValueForecast()');
    const forecast = await cycleIntelligenceService.getValueForecast(TEST_MARKET_ID);
    if (forecast) {
      console.log(`   ✅ PASS: Got value forecast`);
      console.log(`      Bear: ${forecast.bear_12mo > 0 ? '+' : ''}${forecast.bear_12mo.toFixed(1)}%`);
      console.log(`      Base: ${forecast.base_12mo > 0 ? '+' : ''}${forecast.base_12mo.toFixed(1)}%`);
      console.log(`      Bull: ${forecast.bull_12mo > 0 ? '+' : ''}${forecast.bull_12mo.toFixed(1)}%`);
      passed++;
    } else {
      console.log(`   ❌ FAIL: No forecast data`);
      failed++;
    }
  } catch (err) {
    console.log(`   ❌ FAIL: ${err.message}`);
    failed++;
  }

  // Test 7: Get Phase Optimal Strategy
  try {
    console.log('\n🎯 Test 7: getPhaseOptimalStrategy()');
    const strategy = await cycleIntelligenceService.getPhaseOptimalStrategy(TEST_MARKET_ID);
    if (strategy) {
      console.log(`   ✅ PASS: Got phase-optimal strategy`);
      console.log(`      Strategy: ${strategy.best_strategy}`);
      console.log(`      Expected IRR: ${strategy.expected_irr.toFixed(1)}%`);
      console.log(`      Expected EM: ${strategy.expected_em.toFixed(2)}x`);
      passed++;
    } else {
      console.log(`   ⚠️  WARN: No strategy data (needs deal performance history)`);
      console.log(`      This is expected if m28_deal_performance_by_phase is empty`);
      passed++; // Don't fail - needs historical data
    }
  } catch (err) {
    console.log(`   ❌ FAIL: ${err.message}`);
    failed++;
  }

  // Test 8: Get Macro Risk Score
  try {
    console.log('\n⚠️  Test 8: getMacroRiskScore()');
    const risk = await cycleIntelligenceService.getMacroRiskScore();
    if (risk) {
      console.log(`   ✅ PASS: Got macro risk score`);
      console.log(`      Score: ${risk.score}/100 (${risk.level})`);
      console.log(`      Components: Geo ${risk.components.geopolitical_risk}, Trade ${risk.components.trade_policy_uncertainty}`);
      passed++;
    } else {
      console.log(`   ❌ FAIL: No risk data`);
      failed++;
    }
  } catch (err) {
    console.log(`   ❌ FAIL: ${err.message}`);
    failed++;
  }

  // Test 9: Multiple Markets (for CycleCompass)
  try {
    console.log('\n🧭 Test 9: getCyclePhases() - Multiple Markets');
    const snapshots = await cycleIntelligenceService.getCyclePhases(TEST_MARKETS);
    if (snapshots && snapshots.length > 0) {
      console.log(`   ✅ PASS: Got ${snapshots.length} market snapshots`);
      snapshots.forEach(s => {
        const signal = s.divergence > 10 ? 'ACQUIRE' : s.divergence < -10 ? 'EXIT' : 'HOLD';
        console.log(`      - ${s.market_id}: ${s.lag_phase} → ${signal}`);
      });
      passed++;
    } else {
      console.log(`   ⚠️  WARN: No multi-market data (only ${TEST_MARKET_ID} seeded?)`);
      passed++; // Don't fail
    }
  } catch (err) {
    console.log(`   ❌ FAIL: ${err.message}`);
    failed++;
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('Test Summary');
  console.log('═══════════════════════════════════════════════════');
  console.log(`✅ Passed: ${passed}/${passed + failed}`);
  console.log(`❌ Failed: ${failed}/${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Widgets should work correctly.');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Check the errors above.`);
  }

  console.log('\n📝 Next Steps:');
  console.log('1. If pattern matches failed, that\'s OK - they\'re optional');
  console.log('2. If strategy data failed, run: psql $DATABASE_URL < backend/src/database/seeds/m28-test-data.sql');
  console.log('3. Access test endpoints at:');
  console.log('   - GET /api/v1/cycle-intelligence/test/rate-environment');
  console.log('   - GET /api/v1/cycle-intelligence/test/leading-indicators');
  console.log('4. View widget demo at: http://localhost:3000/demo/m28-widgets');

  process.exit(failed === 0 ? 0 : 1);
}

// Run tests
testEndpoints().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
