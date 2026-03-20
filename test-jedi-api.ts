/**
 * Test JediRE-specific Apartment Locator AI endpoints
 */

const BASE_URL = 'https://apartment-locator-ai-real.replit.app';
const API_KEY = 'aiq_2248e8fc535c5a9c4a09f9ed1c0d719bf0ad45f56b2c47841de6bc1421388f6b';

async function testEndpoint(path: string, name: string) {
  const url = `${BASE_URL}${path}`;
  console.log(`\n🔍 Testing: ${name}`);
  console.log(`   URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ SUCCESS (HTTP ${response.status})`);
      console.log(`   Sample:`, JSON.stringify(data, null, 2).substring(0, 400));
      return { success: true, data };
    } else {
      console.log(`   ⚠️  HTTP ${response.status}`);
      console.log(`   Error:`, data);
      return { success: false, error: data };
    }
  } catch (error: any) {
    console.log(`   ❌ FAILED: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('==========================================');
  console.log('JediRE Apartment Locator AI Test');
  console.log('==========================================\n');
  
  const endpoints = [
    { path: '/api/jedi/market-data?city=Atlanta&state=GA', name: 'Atlanta Market Data' },
    { path: '/api/jedi/rent-comps?city=Atlanta&state=GA', name: 'Atlanta Rent Comps' },
    { path: '/api/jedi/supply-pipeline?city=Atlanta&state=GA', name: 'Atlanta Supply Pipeline' },
    { path: '/api/jedi/demand-signals?city=Atlanta&state=GA', name: 'Atlanta Demand Signals' },
    { path: '/api/jedi/user-stats', name: 'User Stats' },
    { path: '/api/jedi/search-trends?city=Atlanta&state=GA', name: 'Search Trends' },
    { path: '/api/jedi/debug-db', name: 'Database Debug' },
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.path, endpoint.name);
    results.push({ ...endpoint, ...result });
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n==========================================');
  console.log('Summary');
  console.log('==========================================');
  
  const successful = results.filter(r => r.success).length;
  console.log(`✅ ${successful}/${results.length} endpoints working`);
  
  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}`);
  });
  
  if (successful === results.length) {
    console.log('\n🎉 All JediRE endpoints working!');
    console.log('Ready to sync data.');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
