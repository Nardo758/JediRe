#!/usr/bin/env node
/**
 * Polymarket Trading Bot v2 - Grok-Powered Strategy
 * 
 * Uses Grok (xAI) to assess TRUE probability vs market price
 * Finds opportunities where Grok thinks market is mispriced
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import cron from 'node-cron';
import { PolymarketClient } from './polymarket-api.js';
import { GrokStrategy } from './grok-strategy.js';
import { TelegramAlerts } from './telegram-alerts.js';
import { TradeExecutor } from './trade-executor.js';

const CONFIG_PATH = join(process.cwd(), 'config.json');
const STATE_PATH = join(process.cwd(), 'bot-state.json');

interface BotState {
  running: boolean;
  lastCheckTime: number | null;
  totalAlertsGenerated: number;
  totalTradesExecuted: number;
  activePositions: any[];
  pendingAlerts: any[];
}

export class PolymarketTradingBotV2 {
  private config: any;
  private polymarket: PolymarketClient;
  private grokStrategy: GrokStrategy;
  private telegram: TelegramAlerts;
  private executor: TradeExecutor;
  private state: BotState;
  private cronJob?: cron.ScheduledTask;

  constructor(configPath: string = CONFIG_PATH) {
    // Load configuration
    this.config = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    // Get XAI API key
    const xaiKey = process.env.XAI_API_KEY || this.config.apis?.xai?.apiKey;
    if (!xaiKey) {
      throw new Error('XAI_API_KEY not found in config or environment');
    }

    // Initialize components
    this.polymarket = new PolymarketClient(this.config);
    this.grokStrategy = new GrokStrategy(xaiKey, {
      minMispricing: 15, // 15% difference required
      minConfidence: 70,  // 70% confidence required
    });
    this.telegram = new TelegramAlerts(this.config);
    this.executor = new TradeExecutor(this.config);

    // Load or initialize state
    this.state = this.loadState();
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    console.log('🚀 Polymarket Trading Bot v2 (Grok-Powered) Starting...\n');
    console.log('🧠 Strategy: Grok Probability Assessment');
    console.log('   - Grok analyzes each market');
    console.log('   - Compares to market price');
    console.log('   - Alerts when mispricing detected\n');

    // Initial scan
    console.log('🔍 Running initial market scan...\n');
    await this.scanMarkets();

    // Schedule periodic scans
    const interval = this.config.monitoring?.pollIntervalMinutes || 5;
    console.log(`⏰ Scheduling scans every ${interval} minutes\n`);
    
    this.cronJob = cron.schedule(`*/${interval} * * * *`, async () => {
      console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Running scheduled scan...`);
      await this.scanMarkets();
    });

    this.state.running = true;
    this.saveState();

    console.log('✅ Bot is now running!');
    console.log('📊 Monitoring with Grok AI analysis...');
    console.log('💬 Alerts will be sent via Telegram when opportunities are found.\n');
    console.log('Press Ctrl+C to stop.\n');
  }

  /**
   * Stop the bot
   */
  stop(): void {
    console.log('\n🛑 Stopping bot...');
    
    if (this.cronJob) {
      this.cronJob.stop();
    }

    this.state.running = false;
    this.saveState();

    console.log('✅ Bot stopped.');
  }

  /**
   * Scan markets for opportunities
   */
  async scanMarkets(): Promise<void> {
    try {
      console.log('📊 Fetching markets from Polymarket...');
      
      const markets = await this.polymarket.getActiveMarkets(
        this.config.monitoring?.maxMarkets || 50
      );

      if (!markets || markets.length === 0) {
        console.log('   No active markets found');
        this.state.lastCheckTime = Date.now();
        this.saveState();
        return;
      }

      console.log(`   Found ${markets.length} markets to analyze`);

      let opportunitiesFound = 0;

      // Analyze each market with Grok
      for (const market of markets.slice(0, 10)) { // Limit to 10 to avoid rate limits
        const opportunity = await this.analyzeMarket(market);
        
        if (opportunity) {
          opportunitiesFound++;
          await this.handleOpportunity(opportunity, market);
        }
      }

      if (opportunitiesFound === 0) {
        console.log('   No opportunities found (market prices aligned with Grok assessment)');
      } else {
        console.log(`   ✅ Found ${opportunitiesFound} opportunities!`);
      }

      this.state.lastCheckTime = Date.now();
      this.saveState();

    } catch (error) {
      console.error('❌ Error scanning markets:', error);
    }
  }

  /**
   * Analyze a single market with Grok
   */
  private async analyzeMarket(market: any): Promise<any | null> {
    try {
      const question = market.question || market.title;
      const yesPrice = Math.round((market.outcomePrices?.[0] || 0.5) * 100);
      const noPrice = Math.round((market.outcomePrices?.[1] || 0.5) * 100);

      // Skip if prices are invalid
      if (isNaN(yesPrice) || isNaN(noPrice)) {
        return null;
      }

      console.log(`\n🔍 Analyzing: ${question.substring(0, 60)}...`);
      console.log(`   Market: YES ${yesPrice}% | NO ${noPrice}%`);

      // Get Grok's analysis
      const analysis = await this.grokStrategy.analyzeMarket(question, yesPrice, noPrice);

      if (!analysis) {
        console.log('   ⏭️  Grok analysis failed');
        return null;
      }

      console.log(`   🤖 Grok: ${analysis.trueProbability}% (confidence: ${analysis.confidence}%)`);
      console.log(`   📊 Mispricing: ${analysis.mispricing > 0 ? '+' : ''}${analysis.mispricing.toFixed(1)}%`);

      // Check if it's trade-worthy
      if (this.grokStrategy.isTradeWorthy(analysis)) {
        console.log(`   ✅ OPPORTUNITY DETECTED!`);
        return { analysis, market };
      } else {
        console.log(`   ⏸️  Not significant enough to trade`);
        return null;
      }

    } catch (error) {
      console.error(`   ❌ Error analyzing market:`, error);
      return null;
    }
  }

  /**
   * Handle detected opportunity
   */
  private async handleOpportunity(opportunity: any, market: any): Promise<void> {
    const { analysis } = opportunity;
    
    // Generate alert message
    const alertMessage = this.grokStrategy.formatAnalysis(
      analysis,
      market.question || market.title
    );

    console.log('\n📱 Sending Telegram alert...');
    console.log(alertMessage);

    try {
      // TODO: Send to Telegram (implement later)
      // For now, just log the alert
      
      this.state.totalAlertsGenerated++;
      this.state.pendingAlerts.push({
        market: market.question,
        time: Date.now(),
        analysis,
      });
      
      this.saveState();

      console.log('   ✅ Opportunity logged!');
      console.log('   💬 In production, this would send a Telegram alert');

    } catch (error) {
      console.error('   ❌ Error logging opportunity:', error);
    }
  }

  /**
   * Load bot state
   */
  private loadState(): BotState {
    try {
      const data = readFileSync(STATE_PATH, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {
        running: false,
        lastCheckTime: null,
        totalAlertsGenerated: 0,
        totalTradesExecuted: 0,
        activePositions: [],
        pendingAlerts: [],
      };
    }
  }

  /**
   * Save bot state
   */
  private saveState(): void {
    writeFileSync(STATE_PATH, JSON.stringify(this.state, null, 2));
  }
}

// Main entry point
if (import.meta.url.endsWith(process.argv[1])) {
  const bot = new PolymarketTradingBotV2();
  
  bot.start().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    bot.stop();
    process.exit(0);
  });
}

export default PolymarketTradingBotV2;
