#!/usr/bin/env node

/**
 * Test Clawdbot Webhook Integration
 * Validates that routes are registered and handlers work
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const API_PREFIX = '/api/v1/clawdbot';

// Test configuration
const tests = [
  {
    name: 'Health Check',
    method: 'GET',
    path: `${API_PREFIX}/health`,
    expectedStatus: 200,
    validate: (data) => data.status === 'healthy' && data.integration === 'clawdbot'
  },
  {
    name: 'System Stats Command',
    method: 'POST',
    path: `${API_PREFIX}/command`,
    body: {
      command: 'system_stats',
      requestId: 'test-001',
      timestamp: new Date().toISOString()
    },
    expectedStatus: 200,
    validate: (data) => data.success && data.result && data.result.deals
  },
  {
    name: 'Get Deals Command',
    method: 'POST',
    path: `${API_PREFIX}/command`,
    body: {
      command: 'get_deals',
      params: { limit: 10 },
      requestId: 'test-002',
      timestamp: new Date().toISOString()
    },
    expectedStatus: 200,
    validate: (data) => data.success && Array.isArray(data.result.deals)
  },
  {
    name: 'Deals Count Query',
    method: 'POST',
    path: `${API_PREFIX}/query`,
    body: {
      query: 'deals_count',
      requestId: 'test-003',
      timestamp: new Date().toISOString()
    },
    expectedStatus: 200,
    validate: (data) => data.success && typeof data.result.count === 'number'
  },
  {
    name: 'Status Query',
    method: 'POST',
    path: `${API_PREFIX}/query`,
    body: {
      query: 'status',
      requestId: 'test-004',
      timestamp: new Date().toISOString()
    },
    expectedStatus: 200,
    validate: (data) => data.success && data.result.status === 'operational'
  }
];

// Helper function to make HTTP requests
function makeRequest(test) {
  return new Promise((resolve, reject) => {
    const url = new URL(test.path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: parsed
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: data,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (test.body) {
      req.write(JSON.stringify(test.body));
    }

    req.end();
  });
}

// Run tests
async function runTests() {
  console.log('🧪 Testing Clawdbot Webhook Integration\n');
  console.log('=' .repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      process.stdout.write(`Testing: ${test.name}... `);
      
      const result = await makeRequest(test);
      
      // Check status code
      if (result.statusCode !== test.expectedStatus) {
        console.log(`❌ FAILED`);
        console.log(`  Expected status ${test.expectedStatus}, got ${result.statusCode}`);
        console.log(`  Response:`, JSON.stringify(result.data, null, 2));
        failed++;
        continue;
      }
      
      // Check validation
      if (test.validate && !test.validate(result.data)) {
        console.log(`❌ FAILED`);
        console.log(`  Validation failed`);
        console.log(`  Response:`, JSON.stringify(result.data, null, 2));
        failed++;
        continue;
      }
      
      console.log(`✅ PASSED`);
      passed++;
      
    } catch (error) {
      console.log(`❌ FAILED`);
      console.log(`  Error: ${error.message}`);
      failed++;
    }
  }
  
  console.log('=' .repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed (${tests.length} total)`);
  
  if (failed === 0) {
    console.log('\n✨ All tests passed! Webhook integration is working correctly.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the output above.\n');
    process.exit(1);
  }
}

// Check if server is running
http.get(`${BASE_URL}/health`, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Server is running\n');
    runTests();
  } else {
    console.error('❌ Server health check failed');
    process.exit(1);
  }
}).on('error', (error) => {
  console.error('❌ Server is not running or not accessible');
  console.error(`   Error: ${error.message}`);
  console.error('\n   Please start the server first:');
  console.error('   cd /home/leon/clawd/jedire/backend && npm run dev\n');
  process.exit(1);
});
