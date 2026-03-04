/**
 * Example usage of JediRe API Client
 */

import { JediReClient } from './src';

async function main() {
  // Initialize client
  const client = new JediReClient({
    baseUrl: 'http://localhost:5000',
    logRequests: true,
  });

  try {
    // Example 1: Authenticate
    console.log('\n=== Authentication ===');
    // Uncomment to test authentication:
    // const auth = await client.authenticate('user@example.com', 'password');
    // console.log('Token:', auth.access_token);

    // Or set token manually
    // client.setToken('your-jwt-token-here');

    // Example 2: Health Check
    console.log('\n=== Health Check ===');
    try {
      const health = await client.healthCheck();
      console.log('API Health:', health);
    } catch (error: any) {
      console.log('Health check failed (expected if API not running):', error.message);
    }

    // Example 3: Get Deals
    console.log('\n=== Get Deals ===');
    try {
      const deals = await client.getDeals({ limit: 10 });
      console.log('Deals found:', deals.data.length);
    } catch (error: any) {
      console.log('Get deals failed:', error.message);
    }

    // Example 4: Get a specific deal
    console.log('\n=== Get Deal ===');
    try {
      const deal = await client.getDeal('deal-123');
      console.log('Deal:', deal);
    } catch (error: any) {
      console.log('Get deal failed:', error.message);
    }

    // Example 5: Market Intelligence
    console.log('\n=== Market Intelligence ===');
    try {
      const intel = await client.getMarketIntelligence('market-789');
      console.log('Market Intelligence:', intel);
    } catch (error: any) {
      console.log('Get market intelligence failed:', error.message);
    }

    // Example 6: Get Rankings
    console.log('\n=== PCS Rankings ===');
    try {
      const rankings = await client.getRankings('market-789', { limit: 10 });
      console.log('Rankings found:', rankings.data.length);
    } catch (error: any) {
      console.log('Get rankings failed:', error.message);
    }

    // Example 7: Run Analysis
    console.log('\n=== Run Analysis ===');
    try {
      const analysis = await client.runAnalysis('deal-123', 'cash_flow', {
        holdingPeriod: 5,
        appreciationRate: 3,
      });
      console.log('Analysis:', analysis);
    } catch (error: any) {
      console.log('Run analysis failed:', error.message);
    }

    // Example 8: Get Errors
    console.log('\n=== Recent Errors ===');
    try {
      const errors = await client.getErrors(10);
      console.log('Recent errors found:', errors.length);
    } catch (error: any) {
      console.log('Get errors failed:', error.message);
    }

    console.log('\n=== Example Complete ===\n');
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main();
