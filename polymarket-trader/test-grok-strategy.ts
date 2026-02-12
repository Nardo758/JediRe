/**
 * Test the Grok Strategy on Real Markets
 */

import axios from 'axios';
import { GrokStrategy } from './grok-strategy.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load config
const configPath = join(process.cwd(), 'config.json');
const config = JSON.parse(readFileSync(configPath, 'utf-8'));

const XAI_API_KEY = process.env.XAI_API_KEY || config.apis?.xai?.apiKey;

if (!XAI_API_KEY) {
  console.error('❌ XAI_API_KEY not found!');
  process.exit(1);
}

const strategy = new GrokStrategy(XAI_API_KEY, {
  minMispricing: 10, // Lower for testing
  minConfidence: 60,
});

async function fetchMarkets() {
  console.log('📊 Fetching markets from Polymarket...\n');
  
  try {
    // Use Gamma API (public endpoint)
    const response = await axios.get('https://gamma-api.polymarket.com/markets', {
      params: {
        limit: 10,
        active: true,
        closed: false,
      },
    });

    return response.data.slice(0, 5); // Test first 5
  } catch (error) {
    console.error('Failed to fetch markets:', error);
    return [];
  }
}

async function testMarket(market: any, index: number) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TESTING MARKET ${index + 1}`);
  console.log(`${'='.repeat(80)}\n`);
  
  const question = market.question || market.title;
  const yesPrice = Math.round((market.outcomePrices?.[0] || 0.5) * 100);
  const noPrice = Math.round((market.outcomePrices?.[1] || 0.5) * 100);

  console.log(`📌 Question: ${question}`);
  console.log(`💰 Market Prices: YES ${yesPrice}% | NO ${noPrice}%`);
  console.log(`\n🤖 Asking Grok to analyze...\n`);

  try {
    const analysis = await strategy.analyzeMarket(question, yesPrice, noPrice);

    if (!analysis) {
      console.log('❌ Grok analysis failed or returned null\n');
      return;
    }

    // Display results
    const formatted = strategy.formatAnalysis(analysis, question);
    console.log(formatted);
    console.log();

    // Trading decision
    const isWorthy = strategy.isTradeWorthy(analysis);
    
    if (isWorthy) {
      console.log('🎯 ✅ TRADE OPPORTUNITY DETECTED!');
      console.log(`   This meets our criteria:`);
      console.log(`   - Mispricing: ${Math.abs(analysis.mispricing).toFixed(1)}% (min: 10%)`);
      console.log(`   - Confidence: ${analysis.confidence}% (min: 60%)`);
      console.log(`   - Expected Value: $${analysis.expectedValue.toFixed(2)} (min: $2)`);
      console.log();
      console.log(`   → Would send Telegram alert for approval!`);
    } else {
      console.log('⏸️  PASS - Does not meet trading criteria');
      if (Math.abs(analysis.mispricing) < 10) {
        console.log(`   (Mispricing too small: ${Math.abs(analysis.mispricing).toFixed(1)}%)`);
      }
      if (analysis.confidence < 60) {
        console.log(`   (Confidence too low: ${analysis.confidence}%)`);
      }
      if (analysis.expectedValue <= 2) {
        console.log(`   (Expected value too low: $${analysis.expectedValue.toFixed(2)})`);
      }
    }

  } catch (error) {
    console.error('❌ Error analyzing market:', error);
  }

  console.log(); // Extra spacing
}

async function main() {
  console.log('🚀 GROK STRATEGY TEST RUN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('This will:');
  console.log('1. Fetch 5 real markets from Polymarket');
  console.log('2. Have Grok analyze each one');
  console.log('3. Compare Grok\'s assessment to market price');
  console.log('4. Show you trading opportunities\n');
  console.log('Press Ctrl+C to cancel...\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  const markets = await fetchMarkets();

  if (markets.length === 0) {
    console.log('❌ No markets found!\n');
    return;
  }

  console.log(`✅ Found ${markets.length} markets to analyze\n`);

  for (let i = 0; i < markets.length; i++) {
    await testMarket(markets[i], i);
    
    // Wait between requests to avoid rate limits
    if (i < markets.length - 1) {
      console.log('⏳ Waiting 5 seconds before next analysis...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('🏁 TEST COMPLETE!');
  console.log('='.repeat(80));
  console.log();
  console.log('Summary:');
  console.log('- You just saw how Grok analyzes real markets');
  console.log('- When mispricing is found, bot would alert you');
  console.log('- You approve → Bot executes trade');
  console.log();
  console.log('Ready to integrate this into the main bot? 🚀\n');
}

main().catch(console.error);
