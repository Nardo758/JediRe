/**
 * Test Zoning → Financial Dashboard Flow
 * 
 * Tests the complete data flow from zoning module through to financial dashboard
 * 
 * Usage: npx tsx backend/src/scripts/test-zoning-to-financial-flow.ts <dealId>
 */

import { getPool } from '../database/connection';

const pool = getPool();
const DEAL_ID = process.argv[2] || 'e044db04-439b-4442-82df-b36a840f2fd8';

interface TestResult {
  step: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function log(result: TestResult) {
  results.push(result);
  const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
  console.log(`${icon} ${result.step}: ${result.message}`);
  if (result.data) {
    console.log(`   Data:`, JSON.stringify(result.data, null, 2));
  }
}

async function testZoningToFinancialFlow() {
  console.log('🧪 Testing Zoning → Financial Dashboard Flow\n');
  console.log(`Deal ID: ${DEAL_ID}\n`);
  console.log('='.repeat(70));
  
  try {
    // Step 1: Check if deal exists
    const dealResult = await pool.query(
      `SELECT id, name, address, module_outputs, deal_data, budget, target_units FROM deals WHERE id = $1`,
      [DEAL_ID]
    );
    
    if (dealResult.rows.length === 0) {
      log({ step: '1. Deal Lookup', status: 'fail', message: 'Deal not found' });
      return;
    }
    
    const deal = dealResult.rows[0];
    log({ 
      step: '1. Deal Lookup', 
      status: 'pass', 
      message: `Found: ${deal.name}`,
      data: { address: deal.address }
    });
    
    // Step 2: Check zoning data in module_outputs
    const zoningData = deal.module_outputs?.zoning;
    
    if (!zoningData) {
      log({ 
        step: '2. Zoning Data', 
        status: 'fail', 
        message: 'No zoning data in module_outputs.zoning'
      });
    } else {
      log({ 
        step: '2. Zoning Data', 
        status: 'pass', 
        message: `Found zoning: ${zoningData.code}`,
        data: zoningData
      });
    }
    
    // Step 3: Check if zoning_capacity table has data
    const capacityResult = await pool.query(
      `SELECT * FROM zoning_capacity WHERE deal_id = $1 LIMIT 1`,
      [DEAL_ID]
    );
    
    if (capacityResult.rows.length === 0) {
      log({ 
        step: '3. Zoning Capacity', 
        status: 'warn', 
        message: 'No zoning capacity analysis yet (expected - needs to be triggered)'
      });
    } else {
      log({ 
        step: '3. Zoning Capacity', 
        status: 'pass', 
        message: 'Zoning capacity analysis exists',
        data: capacityResult.rows[0]
      });
    }
    
    // Step 4: Check strategy analysis
    const strategyResult = await pool.query(
      `SELECT id, strategy_slug, assumptions, roi_metrics FROM strategy_analyses 
       WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [DEAL_ID]
    );
    
    if (strategyResult.rows.length === 0) {
      log({ 
        step: '4. Strategy Analysis', 
        status: 'warn', 
        message: 'No strategy analysis yet (expected - needs to be triggered)'
      });
    } else {
      log({ 
        step: '4. Strategy Analysis', 
        status: 'pass', 
        message: `Found strategy: ${strategyResult.rows[0].strategy_slug}`,
        data: strategyResult.rows[0].roi_metrics
      });
    }
    
    // Step 5: Check financial model
    const modelResult = await pool.query(
      `SELECT id, model_type, status, results FROM deal_financial_models 
       WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [DEAL_ID]
    );
    
    if (modelResult.rows.length === 0) {
      log({ 
        step: '5. Financial Model', 
        status: 'warn', 
        message: 'No financial model yet (expected - needs to be triggered)'
      });
    } else {
      const model = modelResult.rows[0];
      log({ 
        step: '5. Financial Model', 
        status: model.status === 'complete' ? 'pass' : 'warn', 
        message: `Model type: ${model.model_type}, status: ${model.status}`,
        data: model.results
      });
    }
    
    // Step 6: Check traffic projections
    const trafficResult = await pool.query(
      `SELECT id, total_units, year1_summary FROM traffic_projections 
       WHERE deal_id = $1 ORDER BY projection_date DESC LIMIT 1`,
      [DEAL_ID]
    );
    
    if (trafficResult.rows.length === 0) {
      log({ 
        step: '6. Traffic Projections', 
        status: 'warn', 
        message: 'No traffic projections yet (expected - needs to be triggered)'
      });
    } else {
      log({ 
        step: '6. Traffic Projections', 
        status: 'pass', 
        message: `Found projections for ${trafficResult.rows[0].total_units} units`,
        data: trafficResult.rows[0].year1_summary
      });
    }
    
    // Step 7: Test Financial Dashboard API endpoint
    console.log('\n' + '='.repeat(70));
    console.log('\n📊 SUMMARY\n');
    
    const passCount = results.filter(r => r.status === 'pass').length;
    const warnCount = results.filter(r => r.status === 'warn').length;
    const failCount = results.filter(r => r.status === 'fail').length;
    
    console.log(`✅ Passed: ${passCount}`);
    console.log(`⚠️  Warnings: ${warnCount}`);
    console.log(`❌ Failed: ${failCount}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('\n💡 NEXT STEPS:\n');
    
    if (zoningData && capacityResult.rows.length === 0) {
      console.log('1. ⚡ Trigger zoning capacity analysis');
      console.log('   - This converts zoning code → development capacity (units, FAR, height)');
      console.log('   - API: POST /api/v1/deals/:dealId/zoning/analyze\n');
    }
    
    if (capacityResult.rows.length > 0 && strategyResult.rows.length === 0) {
      console.log('2. 📋 Run strategy analysis');
      console.log('   - This determines best development strategy');
      console.log('   - API: POST /api/v1/deals/:dealId/strategy/analyze\n');
    }
    
    if (strategyResult.rows.length > 0 && modelResult.rows.length === 0) {
      console.log('3. 💰 Generate financial model');
      console.log('   - This creates the pro forma based on strategy');
      console.log('   - API: POST /api/v1/deals/:dealId/financial-models\n');
    }
    
    if (modelResult.rows.length > 0 && trafficResult.rows.length === 0) {
      console.log('4. 🚶 Generate traffic projections');
      console.log('   - This models lease-up velocity');
      console.log('   - API: POST /api/v1/deals/:dealId/traffic/project\n');
    }
    
    if (passCount >= 5) {
      console.log('✅ All modules complete! Financial dashboard should be fully populated.\n');
      console.log('   View at: /deals/:dealId/financial-dashboard\n');
    } else {
      console.log('Current Status: Zoning data exists, but downstream modules need to be triggered.\n');
      console.log('The system does NOT auto-flow from zoning → financial.');
      console.log('Each module needs to be explicitly triggered (manually or via automation).\n');
    }
    
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testZoningToFinancialFlow();
}
