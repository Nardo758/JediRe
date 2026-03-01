import { ApartmentDataSyncService } from './apartmentDataSync';
import { logger } from '../utils/logger';

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

    logger.info('Apartment data sync scheduler started (weekly: Saturday 9:00 AM EST)');
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
  } {
    return {
      isRunning: this.isRunning,
      schedule: 'Weekly, Saturday 9:00 AM EST',
      nextSync: this.getNextSyncTime(),
      lastSyncAt: this.lastSyncAt?.toISOString() || null,
      lastSyncResult: this.lastSyncResult,
      syncInProgress: this.syncInProgress,
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
