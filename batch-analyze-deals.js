#!/usr/bin/env node
/**
 * Batch Deal Analysis Script
 * Runs all 3 agents on multiple deals and generates reports
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev';
const API_TOKEN = process.env.API_TOKEN || '69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6';

const api = axios.create({
  baseURL: `${API_URL}/api/v1/clawdbot`,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_TOKEN}`,
  },
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAllDeals(limit = 50) {
  const response = await api.post('/command', {
    command: 'get_deals',
    params: { limit },
  });
  return response.data.result.deals;
}

async function runAnalysis(dealId, analysisType = 'full') {
  const response = await api.post('/command', {
    command: 'run_analysis',
    params: { dealId, analysisType },
  });
  return response.data.result;
}

async function getTaskStatus(taskId) {
  const response = await api.post('/command', {
    command: 'get_agent_task',
    params: { taskId },
  });
  return response.data.result.task;
}

async function waitForTasks(taskIds, maxWaitMs = 60000) {
  const startTime = Date.now();
  const results = {};

  while (Object.keys(results).length < taskIds.length) {
    if (Date.now() - startTime > maxWaitMs) {
      console.error('⏱️  Timeout waiting for tasks');
      break;
    }

    for (const taskId of taskIds) {
      if (results[taskId]) continue; // Already completed

      const task = await getTaskStatus(taskId);
      if (task.status === 'completed' || task.status === 'failed') {
        results[taskId] = task;
      }
    }

    if (Object.keys(results).length < taskIds.length) {
      await sleep(2000); // Wait 2s before polling again
    }
  }

  return results;
}

async function analyzeDeal(deal) {
  console.log(`\n📊 Analyzing: ${deal.name}`);
  console.log(`   Address: ${deal.address}`);
  console.log(`   Status: ${deal.status} | Type: ${deal.projectType}`);

  try {
    const analysisResult = await runAnalysis(deal.id, 'full');
    console.log(`   ✓ Submitted ${analysisResult.tasks.length} tasks`);

    const taskIds = analysisResult.tasks.map(t => t.taskId);
    const taskResults = await waitForTasks(taskIds, 30000);

    const summary = {
      dealId: deal.id,
      dealName: deal.name,
      address: deal.address,
      projectType: deal.projectType,
      status: deal.status,
      budget: deal.budget,
      targetUnits: deal.targetUnits,
      analysisTimestamp: new Date().toISOString(),
      agents: {},
    };

    for (const [taskId, task] of Object.entries(taskResults)) {
      const agentType = task.taskType.replace('_analysis', '');
      summary.agents[agentType] = {
        status: task.status,
        executionTimeMs: task.executionTimeMs,
        error: task.errorMessage,
        output: task.status === 'completed' ? task.outputData : null,
      };

      const statusIcon = task.status === 'completed' ? '✅' : '❌';
      console.log(`   ${statusIcon} ${agentType}: ${task.status} (${task.executionTimeMs}ms)`);
      if (task.errorMessage) {
        console.log(`      Error: ${task.errorMessage}`);
      }
    }

    return summary;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return {
      dealId: deal.id,
      dealName: deal.name,
      error: error.message,
    };
  }
}

async function generateReport(results) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.join(__dirname, 'reports');
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, `batch-analysis-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  console.log(`\n📄 Full report saved: ${reportPath}`);

  // Generate summary
  const summary = {
    timestamp: new Date().toISOString(),
    totalDeals: results.length,
    successful: results.filter(r => !r.error && r.agents).length,
    failed: results.filter(r => r.error).length,
    agentStats: {
      zoning: { completed: 0, failed: 0 },
      supply: { completed: 0, failed: 0 },
      cashflow: { completed: 0, failed: 0 },
    },
  };

  results.forEach(result => {
    if (result.agents) {
      Object.entries(result.agents).forEach(([agent, data]) => {
        if (data.status === 'completed') {
          summary.agentStats[agent].completed++;
        } else {
          summary.agentStats[agent].failed++;
        }
      });
    }
  });

  const summaryPath = path.join(reportDir, `summary-${timestamp}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`\n📊 Summary:`);
  console.log(`   Total Deals: ${summary.totalDeals}`);
  console.log(`   ✅ Successful: ${summary.successful}`);
  console.log(`   ❌ Failed: ${summary.failed}`);
  console.log(`\n   Agent Performance:`);
  Object.entries(summary.agentStats).forEach(([agent, stats]) => {
    const total = stats.completed + stats.failed;
    const pct = total > 0 ? ((stats.completed / total) * 100).toFixed(1) : 0;
    console.log(`   ${agent}: ${stats.completed}/${total} (${pct}%)`);
  });

  return summary;
}

async function main() {
  console.log('🚀 JediRe Batch Deal Analysis');
  console.log('================================\n');

  const limit = parseInt(process.argv[2]) || 25;
  console.log(`Fetching up to ${limit} deals...\n`);

  const deals = await getAllDeals(limit);
  console.log(`✓ Found ${deals.length} deals\n`);

  const results = [];

  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];
    console.log(`[${i + 1}/${deals.length}]`);
    
    const result = await analyzeDeal(deal);
    results.push(result);

    // Brief pause between deals to avoid overwhelming the system
    if (i < deals.length - 1) {
      await sleep(1000);
    }
  }

  console.log('\n\n================================');
  console.log('✨ Batch Analysis Complete\n');

  const summary = await generateReport(results);

  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { analyzeDeal, generateReport };
