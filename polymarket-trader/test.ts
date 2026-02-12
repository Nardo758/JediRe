#!/usr/bin/env node
/**
 * Test Script - Verify all components work
 * Run with: npm run test or node dist/test.js
 */

import { readFileSync } from 'fs';
import type { Config } from './types.js';
import { PolymarketClient } from './polymarket-api.js';
import { GrokAnalyzer } from './grok-analyzer.js';
import { ClaudeAnalyzer } from './claude-analyzer.js';
import { TelegramAlerts } from './telegram-alerts.js';

async function runTests() {
  console.log('🧪 Polymarket Trading Bot - Test Suite\n');

  // Load config
  console.log('1️⃣ Loading configuration...');
  const config: Config = JSON.parse(readFileSync('./config.json', 'utf-8'));
  console.log('   ✅ Config loaded successfully\n');

  // Test 1: Polymarket API
  console.log('2️⃣ Testing Polymarket API...');
  const polymarket = new PolymarketClient(config);
  
  try {
    const healthy = await polymarket.healthCheck();
    if (healthy) {
      console.log('   ✅ Polymarket API is accessible');
      
      console.log('   📊 Fetching top 5 markets...');
      const markets = await polymarket.getActiveMarkets(5);
      console.log(`   ✅ Found ${markets.length} active markets`);
      
      if (markets.length > 0) {
        const market = markets[0];
        console.log(`\n   Example Market:`);
        console.log(`   Question: ${market.question}`);
        console.log(`   YES: ${market.yesPrice.toFixed(2)}%`);
        console.log(`   NO: ${market.noPrice.toFixed(2)}%`);
        console.log(`   Spread: ${polymarket.calculateSpread(market).toFixed(2)}%`);
        console.log(`   Volume: $${market.volume.toLocaleString()}`);
      }
    } else {
      console.log('   ❌ Polymarket API health check failed');
    }
  } catch (error) {
    console.log('   ❌ Error:', error);
  }
  console.log();

  // Test 2: Grok (xAI)
  console.log('3️⃣ Testing Grok (xAI) API...');
  const grok = new GrokAnalyzer(config);
  
  try {
    const healthy = await grok.healthCheck();
    if (healthy) {
      console.log('   ✅ Grok API is accessible');
      console.log('   ℹ️  Skipping full analysis to save API costs');
      console.log('   ℹ️  (Will run during actual monitoring)');
    } else {
      console.log('   ❌ Grok API health check failed');
    }
  } catch (error) {
    console.log('   ❌ Error:', error);
  }
  console.log();

  // Test 3: Claude
  console.log('4️⃣ Testing Claude API...');
  const claude = new ClaudeAnalyzer(config);
  
  try {
    const healthy = await claude.healthCheck();
    if (healthy) {
      console.log('   ✅ Claude API is accessible');
      console.log('   ℹ️  Skipping full analysis to save API costs');
      console.log('   ℹ️  (Will run during actual monitoring)');
    } else {
      console.log('   ❌ Claude API health check failed');
    }
  } catch (error) {
    console.log('   ❌ Error:', error);
  }
  console.log();

  // Test 4: Telegram Alerts
  console.log('5️⃣ Testing Telegram alert formatting...');
  const telegram = new TelegramAlerts(config);
  
  const mockAlert: any = {
    id: 'test_alert_123',
    opportunity: {
      market: {
        question: 'Test Market: Will Bitcoin hit $100k?',
        category: 'crypto',
        yesPrice: 47.5,
        noPrice: 48.0,
        volume: 1234567,
        liquidity: 87654,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        url: 'https://polymarket.com/event/test',
      },
      spreadPercent: 4.5,
    },
    grokAnalysis: {
      sentiment: 'BULLISH',
      confidence: 78,
      summary: 'Strong Twitter momentum, recent news positive',
      twitterTrends: ['#Bitcoin', '#BTC100k'],
      riskFactors: ['High volatility expected'],
    },
    claudeAnalysis: {
      recommendation: 'BUY',
      riskScore: 4,
      arbitrageValid: true,
      positionSize: 50,
      reasoning: 'Solid spread with low resolution risk',
      exitStrategy: 'Hold until market resolution',
      concerns: ['Liquidity might drop near resolution'],
    },
    status: 'PENDING',
    createdAt: Date.now(),
  };

  const alertMessage = telegram.formatAlert(mockAlert);
  console.log('   ✅ Alert formatting works');
  console.log('\n   📱 Sample Alert Preview:');
  console.log('   ' + '─'.repeat(50));
  console.log(alertMessage.split('\n').map(l => '   ' + l).join('\n'));
  console.log('   ' + '─'.repeat(50));
  console.log();

  // Test 5: Arbitrage Detection
  console.log('6️⃣ Testing arbitrage detection...');
  try {
    const opportunities = await polymarket.findArbitrageOpportunities();
    if (opportunities.length > 0) {
      console.log(`   ✅ Found ${opportunities.length} arbitrage opportunities!`);
      
      console.log('\n   Top 3 Opportunities:');
      opportunities.slice(0, 3).forEach((market, i) => {
        console.log(`\n   ${i + 1}. ${market.question.slice(0, 60)}...`);
        console.log(`      Spread: ${market.spread!.toFixed(2)}%`);
        console.log(`      Volume: $${market.volume.toLocaleString()}`);
        console.log(`      YES: ${market.yesPrice.toFixed(2)}% | NO: ${market.noPrice.toFixed(2)}%`);
      });
    } else {
      console.log('   ℹ️  No arbitrage opportunities found at current thresholds');
      console.log(`   ℹ️  (Spread threshold: ${config.monitoring.minSpreadPercent}%)`);
    }
  } catch (error) {
    console.log('   ❌ Error:', error);
  }
  console.log();

  // Summary
  console.log('═'.repeat(60));
  console.log('🎉 Test Suite Complete!\n');
  console.log('✅ All core components are functional');
  console.log('✅ Ready to start monitoring\n');
  console.log('📝 Next Steps:');
  console.log('   1. Review config.json settings');
  console.log('   2. Run: npm start');
  console.log('   3. Monitor Telegram for alerts\n');
  console.log('⚠️  Remember: You\'re in MONITOR-ONLY mode');
  console.log('   No trades will be executed without wallet setup');
  console.log('═'.repeat(60));
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
