/**
 * Clawdbot Webhook Integration Test Script
 * 
 * Tests the webhook system by sending test notifications
 * and simulating incoming commands.
 * 
 * Usage:
 *   ts-node src/scripts/test-clawdbot-webhook.ts
 */

import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const WEBHOOK_SECRET = process.env.CLAWDBOT_WEBHOOK_SECRET;
const AUTH_TOKEN = process.env.CLAWDBOT_AUTH_TOKEN;

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: string): string {
  if (!WEBHOOK_SECRET) {
    throw new Error('CLAWDBOT_WEBHOOK_SECRET not set');
  }
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
}

/**
 * Test incoming webhook with signature auth
 */
async function testIncomingWebhookWithSignature() {
  console.log('\n🔐 Testing incoming webhook with signature auth...');
  
  const payload = {
    command: 'health',
    timestamp: new Date().toISOString(),
    requestId: `test-${Date.now()}`,
  };
  
  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString);
  
  try {
    const response = await axios.post(
      `${API_BASE}/api/v1/clawdbot/command`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
      }
    );
    
    console.log('✅ Success:', response.data);
  } catch (error: any) {
    console.error('❌ Failed:', error.response?.data || error.message);
  }
}

/**
 * Test incoming webhook with token auth
 */
async function testIncomingWebhookWithToken() {
  console.log('\n🔑 Testing incoming webhook with token auth...');
  
  if (!AUTH_TOKEN) {
    console.log('⚠️  Skipped: CLAWDBOT_AUTH_TOKEN not set');
    return;
  }
  
  const payload = {
    command: 'health',
    timestamp: new Date().toISOString(),
    requestId: `test-${Date.now()}`,
  };
  
  try {
    const response = await axios.post(
      `${API_BASE}/api/v1/clawdbot/command`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`,
        },
      }
    );
    
    console.log('✅ Success:', response.data);
  } catch (error: any) {
    console.error('❌ Failed:', error.response?.data || error.message);
  }
}

/**
 * Test invalid signature (should fail)
 */
async function testInvalidSignature() {
  console.log('\n🚫 Testing invalid signature (should fail)...');
  
  const payload = {
    command: 'health',
    timestamp: new Date().toISOString(),
    requestId: `test-${Date.now()}`,
  };
  
  try {
    const response = await axios.post(
      `${API_BASE}/api/v1/clawdbot/command`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'invalid-signature',
        },
      }
    );
    
    console.log('❌ Should have failed but got:', response.data);
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log('✅ Correctly rejected with 401 Unauthorized');
    } else {
      console.error('❌ Unexpected error:', error.response?.data || error.message);
    }
  }
}

/**
 * Test various commands
 */
async function testCommands() {
  console.log('\n📋 Testing various commands...');
  
  const commands = [
    { command: 'health', params: {} },
    { command: 'get_deals', params: {} },
    { command: 'get_deal', params: { dealId: 'test-deal-123' } },
    { command: 'unknown_command', params: {} },
  ];
  
  for (const cmd of commands) {
    const payload = {
      ...cmd,
      timestamp: new Date().toISOString(),
      requestId: `test-${Date.now()}`,
    };
    
    const payloadString = JSON.stringify(payload);
    const signature = generateSignature(payloadString);
    
    try {
      const response = await axios.post(
        `${API_BASE}/api/v1/clawdbot/command`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
          },
        }
      );
      
      console.log(`  ✅ ${cmd.command}:`, response.data.result?.message || response.data.result?.status);
    } catch (error: any) {
      if (error.response?.status === 400 && cmd.command === 'unknown_command') {
        console.log(`  ✅ ${cmd.command}: Correctly rejected unknown command`);
      } else {
        console.error(`  ❌ ${cmd.command}:`, error.response?.data || error.message);
      }
    }
  }
}

/**
 * Test queries
 */
async function testQueries() {
  console.log('\n🔍 Testing various queries...');
  
  const queries = [
    { query: 'status', params: {} },
    { query: 'deals_count', params: {} },
    { query: 'recent_errors', params: {} },
  ];
  
  for (const qry of queries) {
    const payload = {
      ...qry,
      timestamp: new Date().toISOString(),
      requestId: `test-${Date.now()}`,
    };
    
    const payloadString = JSON.stringify(payload);
    const signature = generateSignature(payloadString);
    
    try {
      const response = await axios.post(
        `${API_BASE}/api/v1/clawdbot/query`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
          },
        }
      );
      
      console.log(`  ✅ ${qry.query}:`, response.data.result);
    } catch (error: any) {
      console.error(`  ❌ ${qry.query}:`, error.response?.data || error.message);
    }
  }
}

/**
 * Test health endpoint (no auth required)
 */
async function testHealthEndpoint() {
  console.log('\n❤️  Testing health endpoint...');
  
  try {
    const response = await axios.get(`${API_BASE}/api/v1/clawdbot/health`);
    console.log('✅ Success:', response.data);
  } catch (error: any) {
    console.error('❌ Failed:', error.response?.data || error.message);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 Clawdbot Webhook Integration Tests');
  console.log('=====================================');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Webhook Secret: ${WEBHOOK_SECRET ? '✓ Set' : '✗ Not set'}`);
  console.log(`Auth Token: ${AUTH_TOKEN ? '✓ Set' : '✗ Not set'}`);
  
  try {
    await testHealthEndpoint();
    await testIncomingWebhookWithSignature();
    await testIncomingWebhookWithToken();
    await testInvalidSignature();
    await testCommands();
    await testQueries();
    
    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);
