#!/usr/bin/env node
/**
 * Polymarket Trading Bot - Main Monitor
 * 
 * This is the entry point that orchestrates:
 * 1. Market monitoring (Polymarket API)
 * 2. Sentiment analysis (Grok/xAI)
 * 3. Risk assessment (Claude)
 * 4. Alert generation (Telegram)
 * 5. Trade execution (after approval)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import cron from 'node-cron';
import type { Config, TradingAlert, ArbitrageOpportunity, BotState } from './types.js';
import { PolymarketClient } from './polymarket-api.js';
import { GrokAnalyzer } from './grok-analyzer.js';
import { ClaudeAnalyzer } from './claude-analyzer.js';
import { TelegramAlerts } from './telegram-alerts.js';
import { TradeExecutor } from './trade-executor.js';

const CONFIG_PATH = join(process.cwd(), 'config.json');
const STATE_PATH = join(process.cwd(), 'bot-state.json');

export class PolymarketTradingBot {
  private config: Config;
  private polymarket: PolymarketClient;
  private grok: GrokAnalyzer;
  private claude: ClaudeAnalyzer;
  private telegram: TelegramAlerts;
  private executor: TradeExecutor;
  private state: BotState;
  private cronJob?: cron.ScheduledTask;

  constructor(configPath: string = CONFIG_PATH) {
    // Load configuration
    this.config = JSON.parse(readFileSync(configPath, 'utf-8'));
    
    // Initialize components
    this.polymarket = new PolymarketClient(this.config);
    this.grok = new GrokAnalyzer(this.config);
    this.claude = new ClaudeAnalyzer(this.config);
    this.telegram = new TelegramAlerts(this.config);
    this.executor = new TradeExecutor(this.config);

    // Load or initialize state
    this.state = this.loadState();
  }

  /**
   * Start the monitoring bot
   */
  async start(): Promise<void> {
    console.log('🚀 Polymarket Trading Bot Starting...\n');

    // Health checks
    await this.runHealthChecks();

    // Initial scan
    console.log('🔍 Running initial market scan...\n');
    await this.scanMarkets();

    // Schedule periodic scans
    const interval = this.config.monitoring.pollIntervalMinutes;
    console.log(`⏰ Scheduling scans every ${interval} minutes\n`);
    
    this.cronJob = cron.schedule(`*/${interval} * * * *`, async () => {
      console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Running scheduled scan...`);
      await this.scanMarkets();
    });

    this.state.running = true;
    this.saveState();

    console.log('✅ Bot is now running!');
    console.log('📊 Monitoring Polymarket for arbitrage opportunities...');
    console.log('💬 Alerts will be sent via Telegram when opportunities are found.\n');
    console.log('Press Ctrl+C to stop.\n');
  }

  /**
   * Stop the monitoring bot
   */
  stop(): void {
    console.log('\n🛑 Stopping Polymarket Trading Bot...');
    
    if (this.cronJob) {
      this.cronJob.stop();
    }

    this.state.running = false;
    this.saveState();

    console.log('✅ Bot stopped.');
  }

  /**
   * Run health checks on all services
   */
  private async runHealthChecks(): Promise<void> {
    console.log('🏥 Running health checks...\n');

    const checks = [
      { name: 'Polymarket API', check: () => this.polymarket.healthCheck() },
      { name: 'Grok (xAI)', check: () => this.grok.healthCheck() },
      { name: 'Claude', check: () => this.claude.healthCheck() },
    ];

    for (const { name, check } of checks) {
      try {
        const healthy = await check();
        console.log(`  ${healthy ? '✅' : '❌'} ${name}: ${healthy ? 'OK' : 'FAILED'}`);
      } catch (error) {
        console.log(`  ❌ ${name}: ERROR - ${error}`);
      }
    }

    console.log();
  }

  /**
   * Scan markets for arbitrage opportunities
   */
  private async scanMarkets(): Promise<void> {
    try {
      this.state.lastCheckTime = Date.now();

      // 1. Find arbitrage opportunities
      console.log('📊 Fetching markets from Polymarket...');
      const opportunities = await this.polymarket.findArbitrageOpportunities();

      if (opportunities.length === 0) {
        console.log('   No arbitrage opportunities found (spread < threshold)');
        this.saveState();
        return;
      }

      console.log(`   Found ${opportunities.length} potential opportunities!\n`);

      // 2. Analyze each opportunity
      for (const market of opportunities.slice(0, 3)) { // Limit to top 3 to save API costs
        await this.analyzeOpportunity(market);
      }

      this.saveState();
    } catch (error) {
      console.error('❌ Error scanning markets:', error);
    }
  }

  /**
   * Analyze a specific opportunity
   */
  private async analyzeOpportunity(market: any): Promise<void> {
    console.log(`\n🔍 Analyzing: ${market.question}`);
    console.log(`   Spread: ${market.spread.toFixed(2)}%`);

    try {
      // Create opportunity object
      const opportunity: ArbitrageOpportunity = {
        market,
        spread: market.spread,
        spreadPercent: market.spread,
        expectedProfit: market.spread * this.config.trading.defaultPositionSize / 100,
        recommendedSide: 'BOTH',
        timestamp: Date.now(),
      };

      // 1. Grok Analysis (Sentiment)
      console.log('   🤖 Running Grok analysis...');
      const grokAnalysis = await this.grok.analyzeMarket(market);
      console.log(`      Sentiment: ${grokAnalysis.sentiment} (${grokAnalysis.confidence}% confidence)`);

      // 2. Claude Analysis (Risk & Recommendation)
      console.log('   🧠 Running Claude analysis...');
      const claudeAnalysis = await this.claude.analyzeOpportunity(opportunity, grokAnalysis);
      console.log(`      Recommendation: ${claudeAnalysis.recommendation}`);
      console.log(`      Risk Score: ${claudeAnalysis.riskScore}/10`);

      // 3. Create alert
      const alert: TradingAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        opportunity,
        grokAnalysis,
        claudeAnalysis,
        status: 'PENDING',
        createdAt: Date.now(),
      };

      // 4. Check if we should send alert
      if (!this.telegram.shouldSendAlert(claudeAnalysis)) {
        console.log('   ⏭️  Skipping alert (below minimum threshold)');
        return;
      }

      // 5. Send Telegram alert
      console.log('   📱 Sending Telegram alert...');
      await this.sendTelegramAlert(alert);

      // Track alert
      this.state.totalAlertsGenerated++;
      this.state.pendingAlerts.push(alert);

      console.log('   ✅ Alert sent! Waiting for approval...');
    } catch (error) {
      console.error('   ❌ Error analyzing opportunity:', error);
    }
  }

  /**
   * Send alert via Telegram using Clawdbot's message tool
   * NOTE: This outputs instructions for RocketMan to execute
   */
  private async sendTelegramAlert(alert: TradingAlert): Promise<void> {
    const message = this.telegram.formatAlert(alert);
    const buttons = this.telegram.getAlertButtons(alert.id);

    // Output the alert for RocketMan to send
    console.log('\n📤 TELEGRAM ALERT:');
    console.log('---');
    console.log(message);
    console.log('---');
    console.log('Buttons:', JSON.stringify(buttons, null, 2));
    console.log('\nTo send this alert via Telegram, RocketMan should use:');
    console.log(`  message tool with inline buttons`);
    console.log('\nFor manual testing, you can also:');
    console.log(`  1. Copy the alert text above`);
    console.log(`  2. Send to Telegram manually`);
    console.log(`  3. Use callback handlers to approve/reject\n`);

    // TODO: When integrated with Clawdbot's message tool:
    // await clawdbot.message.send({
    //   target: this.config.alerts.telegramChatId,
    //   message: message,
    //   buttons: buttons,
    // });
  }

  /**
   * Handle trade approval (called when user clicks Approve button)
   */
  async handleApproval(alertId: string): Promise<void> {
    console.log(`\n✅ Trade approved for alert ${alertId}`);

    const alert = this.state.pendingAlerts.find(a => a.id === alertId);
    if (!alert) {
      console.error(`   ❌ Alert not found: ${alertId}`);
      return;
    }

    alert.status = 'APPROVED';

    try {
      // Execute the trade
      const trade = await this.executor.executeTrade(alert);
      
      alert.status = 'EXECUTED';
      alert.resolvedAt = Date.now();
      
      this.state.totalTradesExecuted++;
      this.saveState();

      // Send confirmation
      const confirmation = this.telegram.formatTradeConfirmation(alertId, trade.txHash);
      console.log('\n📤 TELEGRAM CONFIRMATION:');
      console.log(confirmation);
    } catch (error) {
      alert.status = 'FAILED';
      console.error(`   ❌ Trade execution failed:`, error);
      
      const errorMsg = this.telegram.formatError(alertId, String(error));
      console.log('\n📤 TELEGRAM ERROR:');
      console.log(errorMsg);
    }
  }

  /**
   * Handle trade rejection (called when user clicks Reject button)
   */
  async handleRejection(alertId: string): Promise<void> {
    console.log(`\n❌ Trade rejected for alert ${alertId}`);

    const alert = this.state.pendingAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'REJECTED';
      alert.resolvedAt = Date.now();
      this.saveState();
    }

    const response = this.telegram.formatResponse(alertId, false);
    console.log('\n📤 TELEGRAM RESPONSE:');
    console.log(response);
  }

  /**
   * Get current bot status
   */
  getStatus(): BotState {
    return { ...this.state };
  }

  /**
   * Load bot state from disk
   */
  private loadState(): BotState {
    try {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    } catch {
      // Initialize default state
      return {
        running: false,
        lastCheckTime: 0,
        totalAlertsGenerated: 0,
        totalTradesExecuted: 0,
        activePositions: [],
        pendingAlerts: [],
      };
    }
  }

  /**
   * Save bot state to disk
   */
  private saveState(): void {
    writeFileSync(STATE_PATH, JSON.stringify(this.state, null, 2));
  }
}

// CLI Entry Point
if (import.meta.url === `file://${process.argv[1]}`) {
  const bot = new PolymarketTradingBot();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    bot.stop();
    process.exit(0);
  });

  // Start the bot
  bot.start().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default PolymarketTradingBot;
