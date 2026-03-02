import { ApartmentDataSyncService } from './apartmentDataSync';
import { logger } from '../utils/logger';

interface MetroCoverage {
  city: string;
  state: string;
  zipCount: number;
}

const COVERED_METROS: MetroCoverage[] = [
  { city: 'Atlanta', state: 'GA', zipCount: 91 },
  { city: 'Houston', state: 'TX', zipCount: 120 },
  { city: 'Miami', state: 'FL', zipCount: 129 },
  { city: 'Dallas', state: 'TX', zipCount: 92 },
  { city: 'Tampa', state: 'FL', zipCount: 78 },
  { city: 'San Antonio', state: 'TX', zipCount: 64 },
  { city: 'Austin', state: 'TX', zipCount: 53 },
  { city: 'Fort Myers', state: 'FL', zipCount: 53 },
  { city: 'Jacksonville', state: 'FL', zipCount: 44 },
  { city: 'Charlotte', state: 'NC', zipCount: 43 },
  { city: 'Orlando', state: 'FL', zipCount: 42 },
  { city: 'Raleigh', state: 'NC', zipCount: 38 },
  { city: 'Nashville', state: 'TN', zipCount: 33 },
  { city: 'Charleston', state: 'SC', zipCount: 17 },
  { city: 'Savannah', state: 'GA', zipCount: 11 },
  { city: 'Tallahassee', state: 'FL', zipCount: 10 },
  { city: 'Gainesville', state: 'FL', zipCount: 10 },
];

interface MetroSyncResult {
  city: string;
  state: string;
  success: boolean;
  marketSnapshot: boolean;
  trends: boolean;
  submarkets: boolean;
  rentComps: number;
  supplyPipeline: number;
  errorCount: number;
  duration: number;
}

class ApartmentSyncScheduler {
  private checkIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private syncService: ApartmentDataSyncService | null = null;
  private lastSyncAt: Date | null = null;
  private lastSyncResult: any = null;
  private syncInProgress: boolean = false;
  private scheduledDay: number = 6;
  private scheduledHourUTC: number = 14;
  private lastCheckedDate: string = '';

  initialize(syncService: ApartmentDataSyncService): void {
    this.syncService = syncService;
  }

  start(): void {
    if (!this.syncService) {
      logger.error('Apartment sync scheduler not initialized — call initialize() first');
      return;
    }

    if (this.isRunning) {
      logger.warn('Apartment sync scheduler is already running');
      return;
    }

    this.isRunning = true;

    this.checkAndSync();

    this.checkIntervalId = setInterval(() => {
      this.checkAndSync();
    }, 60 * 60 * 1000);

    logger.info(`Apartment data sync scheduler started (weekly: Saturday 9:00 AM EST, ${COVERED_METROS.length} metros)`);
  }

  stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
      this.isRunning = false;
      logger.info('Apartment sync scheduler stopped');
    }
  }

  getStatus(): {
    isRunning: boolean;
    schedule: string;
    nextSync: string | null;
    lastSyncAt: string | null;
    lastSyncResult: any;
    syncInProgress: boolean;
    coveredMetros: number;
    totalZipCodes: number;
  } {
    return {
      isRunning: this.isRunning,
      schedule: 'Weekly, Saturday 9:00 AM EST (after Friday scrape)',
      nextSync: this.getNextSyncTime(),
      lastSyncAt: this.lastSyncAt?.toISOString() || null,
      lastSyncResult: this.lastSyncResult,
      syncInProgress: this.syncInProgress,
      coveredMetros: COVERED_METROS.length,
      totalZipCodes: COVERED_METROS.reduce((sum, m) => sum + m.zipCount, 0),
    };
  }

  getCoverage(): {
    metros: MetroCoverage[];
    totalZipCodes: number;
    scrapingModel: string;
    estimatedCostPerRun: string;
    schedule: string;
  } {
    return {
      metros: COVERED_METROS,
      totalZipCodes: COVERED_METROS.reduce((sum, m) => sum + m.zipCount, 0),
      scrapingModel: 'Zip-based: 30 listings per zip, ~140 actor runs per scrape (70 batches × 2 sources)',
      estimatedCostPerRun: '$2.80',
      schedule: 'Apartment Locator AI scrapes Friday 9 AM ET → JediRE syncs Saturday 9 AM EST',
    };
  }

  private getNextSyncTime(): string | null {
    const now = new Date();
    const next = new Date(now);
    const currentDay = now.getUTCDay();
    let daysUntilSaturday = (this.scheduledDay - currentDay + 7) % 7;
    if (daysUntilSaturday === 0 && now.getUTCHours() >= this.scheduledHourUTC) {
      daysUntilSaturday = 7;
    }
    next.setUTCDate(next.getUTCDate() + daysUntilSaturday);
    next.setUTCHours(this.scheduledHourUTC, 0, 0, 0);
    return next.toISOString();
  }

  private checkAndSync(): void {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const hourUTC = now.getUTCHours();
    const dateKey = now.toISOString().slice(0, 10);

    if (dayOfWeek === this.scheduledDay && hourUTC >= this.scheduledHourUTC && this.lastCheckedDate !== dateKey) {
      this.lastCheckedDate = dateKey;
      this.runSync();
    }
  }

  private async runSync(): Promise<void> {
    if (this.syncInProgress) {
      logger.warn('Apartment sync already in progress, skipping');
      return;
    }

    if (!this.syncService) return;

    this.syncInProgress = true;
    const overallStart = Date.now();

    try {
      logger.info(`Starting scheduled apartment data sync across ${COVERED_METROS.length} metros...`);

      const metroResults: MetroSyncResult[] = [];

      for (const metro of COVERED_METROS) {
        try {
          logger.info(`Syncing ${metro.city}, ${metro.state} (${metro.zipCount} zips)...`);
          const result = await this.syncService.syncAll(metro.city, metro.state);
          metroResults.push({
            city: metro.city,
            state: metro.state,
            success: result.errors.length === 0,
            marketSnapshot: result.marketSnapshot,
            trends: result.trends,
            submarkets: result.submarkets,
            rentComps: result.rentComps,
            supplyPipeline: result.supplyPipeline,
            errorCount: result.errors.length,
            duration: result.duration,
          });
        } catch (error: any) {
          logger.error(`Sync failed for ${metro.city}, ${metro.state}: ${error.message}`);
          metroResults.push({
            city: metro.city,
            state: metro.state,
            success: false,
            marketSnapshot: false,
            trends: false,
            submarkets: false,
            rentComps: 0,
            supplyPipeline: 0,
            errorCount: 1,
            duration: 0,
          });
        }
      }

      const overallDuration = Date.now() - overallStart;
      const successCount = metroResults.filter(r => r.success).length;
      const totalErrors = metroResults.reduce((s, r) => s + r.errorCount, 0);

      this.lastSyncAt = new Date();
      this.lastSyncResult = {
        metros: metroResults,
        summary: {
          totalMetros: COVERED_METROS.length,
          successfulMetros: successCount,
          failedMetros: COVERED_METROS.length - successCount,
          totalErrors,
          totalRentComps: metroResults.reduce((s, r) => s + r.rentComps, 0),
          totalSupplyPipeline: metroResults.reduce((s, r) => s + r.supplyPipeline, 0),
          duration: overallDuration,
        },
        demandSignals: true,
        searchTrends: true,
        userPreferences: true,
      };

      logger.info(`Scheduled apartment sync completed: ${successCount}/${COVERED_METROS.length} metros in ${overallDuration}ms (${totalErrors} total errors)`);
    } catch (error: any) {
      logger.error(`Scheduled apartment sync failed: ${error.message}`);
      this.lastSyncResult = { error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncNow(city?: string, state?: string): Promise<any> {
    if (!this.syncService) {
      throw new Error('Sync service not initialized');
    }

    if (city && state) {
      this.syncInProgress = true;
      try {
        logger.info(`Manual sync triggered for ${city}, ${state}...`);
        const result = await this.syncService.syncAll(city, state);
        this.lastSyncAt = new Date();
        this.lastSyncResult = {
          metros: [{ city, state, success: result.errors.length === 0, ...result }],
          summary: { totalMetros: 1, successfulMetros: result.errors.length === 0 ? 1 : 0, failedMetros: result.errors.length === 0 ? 0 : 1, totalErrors: result.errors.length, duration: result.duration },
        };
        return this.lastSyncResult;
      } finally {
        this.syncInProgress = false;
      }
    }

    await this.runSync();
    return this.lastSyncResult;
  }
}

export { COVERED_METROS };
export type { MetroCoverage };
export const apartmentSyncScheduler = new ApartmentSyncScheduler();
