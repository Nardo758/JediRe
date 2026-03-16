import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

interface StockDataResult {
  ticker: string;
  closePrice: number;
  volume: number;
  marketCap: number;
  price90dAgo: number | null;
  price180dAgo: number | null;
  stockMomentumScore: number;
}

export class YahooFinanceService {
  async fetchAndStore(ticker: string): Promise<StockDataResult | null> {
    try {
      const yahooFinance = (await import('yahoo-finance2')).default;

      const quote = await yahooFinance.quote(ticker);
      if (!quote || !quote.regularMarketPrice) {
        logger.warn(`[YahooFinance] No quote data for ${ticker}`);
        return null;
      }

      const now = new Date();
      const date90dAgo = new Date(now);
      date90dAgo.setDate(date90dAgo.getDate() - 90);
      const date180dAgo = new Date(now);
      date180dAgo.setDate(date180dAgo.getDate() - 180);

      let price90d: number | null = null;
      let price180d: number | null = null;

      try {
        const historical = await yahooFinance.historical(ticker, {
          period1: date180dAgo.toISOString().substring(0, 10),
          period2: now.toISOString().substring(0, 10),
          interval: '1d',
        });

        if (historical && historical.length > 0) {
          const target90 = date90dAgo.getTime();
          const target180 = date180dAgo.getTime();

          let closest90: any = null;
          let closest180: any = null;
          let minDiff90 = Infinity;
          let minDiff180 = Infinity;

          for (const h of historical) {
            const hTime = new Date(h.date).getTime();
            const diff90 = Math.abs(hTime - target90);
            const diff180 = Math.abs(hTime - target180);
            if (diff90 < minDiff90) { minDiff90 = diff90; closest90 = h; }
            if (diff180 < minDiff180) { minDiff180 = diff180; closest180 = h; }
          }

          price90d = closest90?.close ?? null;
          price180d = closest180?.close ?? null;
        }
      } catch (histErr: any) {
        logger.warn(`[YahooFinance] Historical data fetch failed for ${ticker}: ${histErr.message}`);
      }

      const currentPrice = quote.regularMarketPrice;
      let momentumScore = 50;
      if (price90d && price180d && price180d > 0) {
        const ratio = currentPrice / price180d;
        momentumScore = Math.max(0, Math.min(100, (ratio - 0.7) / 0.6 * 100));
      } else if (price90d && price90d > 0) {
        const ratio = currentPrice / price90d;
        momentumScore = Math.max(0, Math.min(100, (ratio - 0.85) / 0.3 * 100));
      }

      const pool = getPool();
      const today = now.toISOString().substring(0, 10);

      await pool.query(
        `INSERT INTO corporate_stock_prices
         (ticker, price_date, close_price, volume, market_cap, price_90d_ago, price_180d_ago, stock_momentum_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (ticker, price_date) DO UPDATE SET
           close_price = EXCLUDED.close_price,
           volume = EXCLUDED.volume,
           market_cap = EXCLUDED.market_cap,
           price_90d_ago = EXCLUDED.price_90d_ago,
           price_180d_ago = EXCLUDED.price_180d_ago,
           stock_momentum_score = EXCLUDED.stock_momentum_score`,
        [
          ticker, today, currentPrice,
          quote.regularMarketVolume || 0,
          quote.marketCap || 0,
          price90d, price180d,
          Math.round(momentumScore * 100) / 100,
        ],
      );

      logger.info(`[YahooFinance] Stored stock data for ${ticker}: $${currentPrice}, momentum=${momentumScore.toFixed(1)}`);

      return {
        ticker,
        closePrice: currentPrice,
        volume: quote.regularMarketVolume || 0,
        marketCap: quote.marketCap || 0,
        price90dAgo: price90d,
        price180dAgo: price180d,
        stockMomentumScore: Math.round(momentumScore * 100) / 100,
      };
    } catch (err: any) {
      logger.error(`[YahooFinance] Error fetching ${ticker}: ${err.message}`);
      return null;
    }
  }

  async getLatestStockData(ticker: string): Promise<any | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM corporate_stock_prices
       WHERE ticker = $1 ORDER BY price_date DESC LIMIT 1`,
      [ticker],
    );
    return result.rows[0] || null;
  }
}

export const yahooFinanceService = new YahooFinanceService();
