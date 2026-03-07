/**
 * Test Apartment Locator AI Connection
 * 
 * Verifies API connectivity and data availability
 * Usage: npx tsx test-apartment-locator-connection.ts
 */

const APARTMENT_LOCATOR_URL = 'https://apartment-locator-ai-real.replit.app';
const API_KEY = 'aiq_2248e8fc535c5a9c4a09f9ed1c0d719bf0ad45f56b2c47841de6bc1421388f6b';

interface TestResult {
  endpoint: string;
  success: boolean;
  statusCode?: number;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];

async function testEndpoint(path: string, name: string): Promise<TestResult> {
  const url = `${APARTMENT_LOCATOR_URL}${path}`;
  
  console.log(`\n🔍 Testing: ${name}`);
  console.log(`   URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const text = await response.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch {
      data = text.substring(0, 200);
    }
    
    if (response.ok) {
      console.log(`   ✅ SUCCESS (HTTP ${response.status})`);
      if (typeof data === 'object') {
        console.log(`   Response:`, JSON.stringify(data, null, 2).substring(0, 300));
      }
      return { endpoint: path, success: true, statusCode: response.status, data };
    } else {
      console.log(`   ⚠️  HTTP ${response.status}`);
      console.log(`   Response:`, data);
      return { endpoint: path, success: false, statusCode: response.status, error: data };
    }
  } catch (error: any) {
    console.log(`   ❌ FAILED: ${error.message}`);
    return { endpoint: path, success: false, error: error.message };
  }
}

async function main() {
  console.log('==========================================');
  console.log('Apartment Locator AI Connection Test');
  console.log('==========================================');
  console.log(`API URL: ${APARTMENT_LOCATOR_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 20)}...`);
  console.log('');
  
  // Test various endpoints based on documentation
  const endpoints = [
    { path: '/api/status', name: 'Status Check' },
    { path: '/api/health', name: 'Health Check' },
    { path: '/api/v1/status', name: 'V1 Status' },
    { path: '/api/v1/properties', name: 'Properties List' },
    { path: '/api/v1/properties?city=Atlanta&state=GA&limit=5', name: 'Atlanta Properties' },
    { path: '/api/v1/market-snapshots', name: 'Market Snapshots' },
    { path: '/api/v1/market-snapshots?city=Atlanta&state=GA', name: 'Atlanta Market Snapshot' },
  ];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.path, endpoint.name);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
  }
  
  // Summary
  console.log('\n');
  console.log('==========================================');
  console.log('Test Summary');
  console.log('==========================================');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  console.log('\n📊 Results:');
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    const code = r.statusCode ? ` (HTTP ${r.statusCode})` : '';
    console.log(`  ${status} ${r.endpoint}${code}`);
  });
  
  if (successful > 0) {
    console.log('\n🎉 Connection established! Apartment Locator AI is accessible.');
    console.log('\n📋 Next Steps:');
    console.log('  1. Add environment variables to Replit Secrets:');
    console.log('     APARTMENT_LOCATOR_API_URL=https://apartment-locator-ai-real.replit.app');
    console.log('     APARTMENT_LOCATOR_API_KEY=aiq_2248e8fc535c5a9c4a09f9ed1c0d719bf0ad45f56b2c47841de6bc1421388f6b');
    console.log('  2. Run sync script: npx tsx backend/src/scripts/enrich-from-apartment-locator.ts');
    console.log('  3. Verify data in rent_comps table');
  } else {
    console.log('\n⚠️  No endpoints responding. Possible issues:');
    console.log('  • API URL incorrect');
    console.log('  • API key invalid');
    console.log('  • Service is down');
    console.log('  • Different endpoint structure');
  }
}

main()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
