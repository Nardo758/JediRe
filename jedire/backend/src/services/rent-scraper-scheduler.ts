import { rentScraperService, ScrapeJobResult } from './rent-scraper.service';
import { logger } from '../utils/logger';

interface MarketScrapeResult extends ScrapeJobResult {
  market: string;
  error?: string;
}

interface SchedulerRunResult {
  markets: MarketScrapeResult[];
  duration: number;
  totalTargets: number;
  totalSuccess: number;
  totalFailed: number;
  error?: string;
}

interface SchedulerStatus {
  isRunning: boolean;
  schedule: string;
  lastRunAt: string | null;
  lastRunResult: SchedulerRunResult | null;
  runInProgress: boolean;
}

class RentScraperScheduler {
  private checkIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastRunAt: Date | null = null;
  private lastRunResult: SchedulerRunResult | null = null;
  private runInProgress: boolean = false;
  private scheduledDay: number = 0; // Sunday
  private scheduledHourLocal: number = 2; // 2 AM Eastern
  private timezone: string = 'America/New_York';
  private lastCheckedDate: string = '';

  start(): void {
    if (this.isRunning) {
      logger.warn('Rent scraper scheduler is already running');
      return;
    }

    this.isRunning = true;

    this.checkAndRun();

    this.checkIntervalId = setInterval(() => {
      this.checkAndRun();
    }, 60 * 60 * 1000);

    logger.info('Rent scraper scheduler started (weekly: Sunday 2:00 AM Eastern)');
  }

  stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
      this.isRunning = false;
      logger.info('Rent scraper scheduler stopped');
    }
  }

  getStatus(): SchedulerStatus {
    return {
      isRunning: this.isRunning,
      schedule: 'Weekly, Sunday 2:00 AM Eastern',
      lastRunAt: this.lastRunAt?.toISOString() || null,
      lastRunResult: this.lastRunResult,
      runInProgress: this.runInProgress,
    };
  }

  private checkAndRun(): void {
    const now = new Date();
    const localTimeStr = now.toLocaleString('en-US', { timeZone: this.timezone });
    const localDate = new Date(localTimeStr);
    const dayOfWeek = localDate.getDay();
    const hour = localDate.getHours();
    const dateKey = localDate.toISOString().slice(0, 10);

    if (dayOfWeek === this.scheduledDay && hour >= this.scheduledHourLocal && this.lastCheckedDate !== dateKey) {
      this.lastCheckedDate = dateKey;
      this.runAllMarkets();
    }
  }

  async runAllMarkets(): Promise<SchedulerRunResult> {
    if (this.runInProgress) {
      logger.warn('Rent scraper job already in progress, skipping');
      return this.lastRunResult || { markets: [], duration: 0, totalTargets: 0, totalSuccess: 0, totalFailed: 0 };
    }

    this.runInProgress = true;
    const overallStart = Date.now();

    try {
      const markets = await rentScraperService.getMarketsWithActiveTargets();
      logger.info(`[RentScraperScheduler] Starting scrape for ${markets.length} markets: ${markets.join(', ')}`);

      const marketResults: MarketScrapeResult[] = [];

      for (const market of markets) {
        try {
          logger.info(`[RentScraperScheduler] Scraping market: ${market}`);
          const result = await rentScraperService.runScrapeJob(market);
          marketResults.push({ market, ...result });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(`[RentScraperScheduler] Failed to scrape market ${market}: ${message}`);
          marketResults.push({ market, error: message, total: 0, success: 0, failed: 0, results: [] });
        }
      }

      const overallDuration = Date.now() - overallStart;
      this.lastRunAt = new Date();
      this.lastRunResult = {
        markets: marketResults,
        duration: overallDuration,
        totalTargets: marketResults.reduce((s, r) => s + (r.total || 0), 0),
        totalSuccess: marketResults.reduce((s, r) => s + (r.success || 0), 0),
        totalFailed: marketResults.reduce((s, r) => s + (r.failed || 0), 0),
      };

      logger.info(`[RentScraperScheduler] Completed in ${overallDuration}ms — ${this.lastRunResult.totalSuccess} succeeded, ${this.lastRunResult.totalFailed} failed`);
      return this.lastRunResult;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[RentScraperScheduler] Fatal error: ${message}`);
      this.lastRunResult = { error: message, markets: [], duration: 0, totalTargets: 0, totalSuccess: 0, totalFailed: 0 };
      return this.lastRunResult;
    } finally {
      this.runInProgress = false;
    }
  }
}

export const rentScraperScheduler = new RentScraperScheduler();
