/**
 * Trade Executor
 * Handles trade execution after approval
 */

import type { Config, Trade, TradingAlert } from './types.js';
import { PolymarketClient } from './polymarket-api.js';

export class TradeExecutor {
  private config: Config;
  private polymarket: PolymarketClient;
  private pendingTrades: Map<string, Trade>;

  constructor(config: Config) {
    this.config = config;
    this.polymarket = new PolymarketClient(config);
    this.pendingTrades = new Map();
  }

  /**
   * Execute a trade after approval
   */
  async executeTrade(alert: TradingAlert): Promise<Trade> {
    const { market } = alert.opportunity;
    const { positionSize, recommendation } = alert.claudeAnalysis;

    try {
      console.log(`\n🔄 Executing trade for alert ${alert.id}...`);
      console.log(`   Market: ${market.question}`);
      console.log(`   Position: $${positionSize}`);
      console.log(`   Recommendation: ${recommendation}`);

      // Determine which side to buy
      const side = this.determineSide(alert);
      
      // Check if auto-approve is enabled (safety check)
      if (!this.config.trading.autoApprove && alert.status !== 'APPROVED') {
        throw new Error('Trade not approved and auto-approve is disabled');
      }

      // Execute the trade via Polymarket API
      const trade = await this.polymarket.executeTrade(
        market.id,
        side,
        positionSize,
        side === 'YES' ? market.yesPrice : market.noPrice
      );

      // Store pending trade
      this.pendingTrades.set(alert.id, trade);

      console.log(`✅ Trade submitted: ${trade.id}`);
      console.log(`   Status: ${trade.status}`);

      return trade;
    } catch (error) {
      console.error(`❌ Trade execution failed:`, error);
      throw error;
    }
  }

  /**
   * Execute arbitrage trade (buy both sides)
   */
  async executeArbitrageTrade(alert: TradingAlert): Promise<Trade[]> {
    const { market } = alert.opportunity;
    const { positionSize } = alert.claudeAnalysis;

    try {
      console.log(`\n🔄 Executing ARBITRAGE trade for alert ${alert.id}...`);
      console.log(`   Market: ${market.question}`);
      console.log(`   Total Position: $${positionSize}`);
      console.log(`   Strategy: Buy both YES and NO`);

      // Split position between YES and NO
      const yesAmount = positionSize / 2;
      const noAmount = positionSize / 2;

      // Execute both sides
      const yesTrade = await this.polymarket.executeTrade(
        market.id,
        'YES',
        yesAmount,
        market.yesPrice
      );

      const noTrade = await this.polymarket.executeTrade(
        market.id,
        'NO',
        noAmount,
        market.noPrice
      );

      console.log(`✅ Arbitrage trades submitted`);
      console.log(`   YES Trade: ${yesTrade.id}`);
      console.log(`   NO Trade: ${noTrade.id}`);

      return [yesTrade, noTrade];
    } catch (error) {
      console.error(`❌ Arbitrage trade execution failed:`, error);
      throw error;
    }
  }

  /**
   * Determine which side to buy based on analysis
   */
  private determineSide(alert: TradingAlert): 'YES' | 'NO' {
    const { grokAnalysis, claudeAnalysis } = alert;
    const { market } = alert.opportunity;

    // If spread is wide enough and arbitrage is valid, buy both sides
    if (alert.opportunity.spreadPercent >= 5 && claudeAnalysis.arbitrageValid) {
      // For pure arbitrage, we should buy both
      // But since this method returns single side, default to cheaper side
      return market.yesPrice < market.noPrice ? 'YES' : 'NO';
    }

    // If Grok sentiment is strong, follow it
    if (grokAnalysis.confidence > 70) {
      if (grokAnalysis.sentiment === 'BULLISH') return 'YES';
      if (grokAnalysis.sentiment === 'BEARISH') return 'NO';
    }

    // Default to cheaper side
    return market.yesPrice < market.noPrice ? 'YES' : 'NO';
  }

  /**
   * Get pending trade status
   */
  getPendingTrade(alertId: string): Trade | undefined {
    return this.pendingTrades.get(alertId);
  }

  /**
   * Check trade status (poll blockchain/API)
   */
  async checkTradeStatus(tradeId: string): Promise<Trade | null> {
    // TODO: Implement actual status checking
    // Would query Polymarket API or blockchain for trade status
    return null;
  }

  /**
   * Cancel a pending trade if possible
   */
  async cancelTrade(tradeId: string): Promise<boolean> {
    // TODO: Implement trade cancellation
    // Would need to call Polymarket API to cancel order
    console.log(`[CANCEL TRADE] Would cancel trade ${tradeId}`);
    return false;
  }

  /**
   * Get all active positions
   */
  async getActivePositions(): Promise<any[]> {
    return await this.polymarket.getPositions();
  }
}
