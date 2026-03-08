#!/usr/bin/env node
/**
 * Simple Batch Deal Analysis (no external dependencies)
 * Uses built-in fetch (Node 18+)
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev';
const API_TOKEN = '69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6';

async function api(endpoint, body) {
  const response = await fetch(`${API_URL}/api/v1/clawdbot/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 JediRe Batch Deal Analysis');
  console.log('================================\n');

  const limit = parseInt(process.argv[2]) || 3;
  console.log(`Fetching ${limit} deals...\n`);

  // Get deals
  const dealsResult = await api('command', {
    command: 'get_deals',
    params: { limit },
  });
  
  const deals = dealsResult.result.deals;
  console.log(`✓ Found ${deals.length} deals\n`);

  const results = [];

  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];
    console.log(`[${i + 1}/${deals.length}] 📊 ${deal.name}`);
    console.log(`   ${deal.address}`);

    try {
      // Submit analysis
      const analysisResult = await api('command', {
        command: 'run_analysis',
        params: { dealId: deal.id, analysisType: 'full' },
      });

      const taskIds = analysisResult.result.tasks.map(t => t.taskId);
      console.log(`   ✓ Submitted ${taskIds.length} tasks`);

      // Wait for completion (increased from 10s to 20s for queue processing)
      await sleep(20000);

      const taskResults = {};
      for (const taskId of taskIds) {
        const taskResult = await api('command', {
          command: 'get_agent_task',
          params: { taskId },
        });
        taskResults[taskId] = taskResult.result.task;
      }

      // Summarize
      const summary = {
        dealId: deal.id,
        dealName: deal.name,
        agents: {},
      };

      for (const task of Object.values(taskResults)) {
        const agent = task.taskType.replace('_analysis', '');
        summary.agents[agent] = {
          status: task.status,
          time: task.executionTimeMs,
        };
        
        const icon = task.status === 'completed' ? '✅' : '❌';
        console.log(`   ${icon} ${agent}: ${task.status} (${task.executionTimeMs}ms)`);
      }

      results.push(summary);

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({ dealId: deal.id, dealName: deal.name, error: error.message });
    }

    console.log('');
  }

  // Save report
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `batch-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  console.log('================================');
  console.log(`📄 Report: ${reportPath}`);
  
  const successful = results.filter(r => !r.error).length;
  console.log(`\n✅ ${successful}/${deals.length} deals analyzed`);
}

main().catch(console.error);
