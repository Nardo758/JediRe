/**
 * Polymarket API Client
 * Handles all interactions with Polymarket's CLOB API
 */

import axios, { AxiosInstance } from 'axios';
import type { Config, Market, Trade } from './types.js';

export class PolymarketClient {
  private api: AxiosInstance;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.api = axios.create({
      baseURL: config.apis.polymarket.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (config.apis.polymarket.apiKey) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${config.apis.polymarket.apiKey}`;
    }
  }

  /**
   * Get all active markets from Polymarket
   */
  async getActiveMarkets(limit: number = 50): Promise<Market[]> {
    try {
      // Using Polymarket's public API endpoints
      const response = await axios.get('https://gamma-api.polymarket.com/markets', {
        params: {
          closed: false,
          limit,
          order: 'volume24hr',
        },
      });

      const markets: Market[] = response.data.map((m: any) => this.parseMarket(m));
      
      // Filter by configured categories if not "all"
      if (!this.config.monitoring.categories.includes('all')) {
        return markets.filter(m => 
          this.config.monitoring.categories.some(cat => 
            m.category.toLowerCase().includes(cat.toLowerCase())
          )
        );
      }

      return markets;
    } catch (error) {
      console.error('Error fetching markets:', error);
      throw error;
    }
  }

  /**
   * Get detailed market information including current prices
   */
  async getMarketDetails(marketId: string): Promise<Market | null> {
    try {
      const response = await axios.get(`https://gamma-api.polymarket.com/markets/${marketId}`);
      return this.parseMarket(response.data);
    } catch (error) {
      console.error(`Error fetching market ${marketId}:`, error);
      return null;
    }
  }

  /**
   * Calculate arbitrage spread for a market
   * Spread = 100 - (YES price + NO price)
   * Positive spread = arbitrage opportunity
   */
  calculateSpread(market: Market): number {
    const totalPrice = market.yesPrice + market.noPrice;
    return 100 - totalPrice;
  }

  /**
   * Find arbitrage opportunities based on configured thresholds
   */
  async findArbitrageOpportunities(): Promise<Market[]> {
    const markets = await this.getActiveMarkets(this.config.monitoring.maxMarkets);
    
    return markets
      .map(market => ({
        ...market,
        spread: this.calculateSpread(market),
      }))
      .filter(market => 
        market.spread >= this.config.monitoring.minSpreadPercent &&
        market.liquidity >= this.config.monitoring.minLiquidity
      )
      .sort((a, b) => b.spread! - a.spread!);
  }

  /**
   * Execute a trade (buy YES or NO tokens)
   * NOTE: Requires wallet setup with ethers.js and private key
   */
  async executeTrade(
    marketId: string,
    side: 'YES' | 'NO',
    amount: number,
    maxPrice?: number
  ): Promise<Trade> {
    // Check if we have credentials configured
    if (!this.config.apis.polymarket.privateKey) {
      throw new Error('Private key not configured. Cannot execute trades.');
    }

    try {
      // TODO: Implement actual trade execution using ethers.js
      // This requires:
      // 1. Setting up wallet with private key
      // 2. Approving USDC spending
      // 3. Creating order via CLOB API
      // 4. Signing and submitting transaction

      const trade: Trade = {
        id: `trade_${Date.now()}`,
        alertId: '',
        marketId,
        marketQuestion: '',
        side,
        amount,
        price: maxPrice || 0,
        status: 'PENDING',
      };

      console.log(`[TRADE EXECUTION - DRY RUN] Would execute: ${side} ${amount} @ ${maxPrice}`);
      
      // For safety, we're not implementing actual execution yet
      // Requires additional wallet setup and testing
      return trade;
    } catch (error) {
      console.error('Error executing trade:', error);
      throw error;
    }
  }

  /**
   * Get current positions (if wallet is connected)
   */
  async getPositions(): Promise<any[]> {
    // TODO: Implement position tracking
    // Requires querying blockchain for token balances
    return [];
  }

  /**
   * Parse raw market data from API into our Market type
   */
  private parseMarket(data: any): Market {
    // Polymarket returns prices as probabilities (0-1), convert to 0-100
    const yesPrice = data.outcomePrices ? parseFloat(data.outcomePrices[0]) * 100 : 50;
    const noPrice = data.outcomePrices ? parseFloat(data.outcomePrices[1]) * 100 : 50;

    return {
      id: data.id || data.condition_id,
      question: data.question,
      description: data.description || '',
      category: data.category || 'general',
      endDate: data.end_date_iso || data.endDate,
      volume: parseFloat(data.volume || data.volume24hr || '0'),
      liquidity: parseFloat(data.liquidity || '0'),
      yesPrice,
      noPrice,
      yesTokenId: data.tokens?.[0]?.token_id || '',
      noTokenId: data.tokens?.[1]?.token_id || '',
      active: data.active !== false && data.closed !== true,
      url: `https://polymarket.com/event/${data.slug || data.id}`,
    };
  }

  /**
   * Health check - verify API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      await axios.get('https://gamma-api.polymarket.com/markets?limit=1');
      return true;
    } catch (error) {
      console.error('Polymarket API health check failed:', error);
      return false;
    }
  }
}
