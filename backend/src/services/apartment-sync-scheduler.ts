import { ApartmentDataSyncService } from './apartmentDataSync';
import { logger } from '../utils/logger';

class ApartmentSyncScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private syncIntervalHours: number = 6;
  private syncService: ApartmentDataSyncService | null = null;
  private lastSyncAt: Date | null = null;
  private lastSyncResult: any = null;
  private syncInProgress: boolean = false;

  initialize(syncService: ApartmentDataSyncService): void {
    this.syncService = syncService;
  }

  start(intervalHours: number = 6): void {
    if (!this.syncService) {
      logger.error('Apartment sync scheduler not initialized — call initialize() first');
      return;
    }

    if (this.isRunning) {
      logger.warn('Apartment sync scheduler is already running');
      return;
    }

    this.syncIntervalHours = intervalHours;
    this.isRunning = true;

    this.runSync();

    this.intervalId = setInterval(() => {
      this.runSync();
    }, this.syncIntervalHours * 60 * 60 * 1000);

    logger.info(`Apartment data sync scheduler started (interval: ${intervalHours} hours)`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logger.info('Apartment sync scheduler stopped');
    }
  }

  getStatus(): {
    isRunning: boolean;
    intervalHours: number;
    lastSyncAt: string | null;
    lastSyncResult: any;
    syncInProgress: boolean;
  } {
    return {
      isRunning: this.isRunning,
      intervalHours: this.syncIntervalHours,
      lastSyncAt: this.lastSyncAt?.toISOString() || null,
      lastSyncResult: this.lastSyncResult,
      syncInProgress: this.syncInProgress,
    };
  }

  private async runSync(): Promise<void> {
    if (this.syncInProgress) {
      logger.warn('Apartment sync already in progress, skipping');
      return;
    }

    if (!this.syncService) return;

    this.syncInProgress = true;

    try {
      logger.info('Starting scheduled apartment data sync for Atlanta, GA...');
      const result = await this.syncService.syncAll('Atlanta', 'GA');
      this.lastSyncAt = new Date();
      this.lastSyncResult = {
        marketSnapshot: result.marketSnapshot,
        trends: result.trends,
        submarkets: result.submarkets,
        rentComps: result.rentComps,
        supplyPipeline: result.supplyPipeline,
        absorptionRate: result.absorptionRate,
        userStats: result.userStats,
        demandSignals: result.demandSignals,
        searchTrends: result.searchTrends,
        errorCount: result.errors.length,
        duration: result.duration,
      };
      logger.info(`Scheduled apartment sync completed in ${result.duration}ms (${result.errors.length} errors)`);
    } catch (error: any) {
      logger.error(`Scheduled apartment sync failed: ${error.message}`);
      this.lastSyncResult = { error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncNow(): Promise<any> {
    if (!this.syncService) {
      throw new Error('Sync service not initialized');
    }
    await this.runSync();
    return this.lastSyncResult;
  }
}

export const apartmentSyncScheduler = new ApartmentSyncScheduler();
