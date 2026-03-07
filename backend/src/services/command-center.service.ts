/**
 * Command Center Service
 * Orchestrates all data sync operations and monitors job status
 */

import { getPool } from '../database/connection';
import { apartmentLocatorSyncService } from './apartment-locator-sync.service';
import { logger } from '../utils/logger';

const pool = getPool();

interface Job {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

const activeJobs = new Map<string, Job>();

export class CommandCenterService {
  /**
   * Get overall data status
   */
  async getDataStatus() {
    try {
      const stats = await pool.query(`
        SELECT 
          COUNT(*) as total_properties,
          COUNT(*) FILTER (WHERE enrichment_source = 'apartment_locator_ai') as apartment_locator_synced,
          COUNT(*) FILTER (WHERE enrichment_source = 'municipality') as municipal_synced,
          COUNT(*) FILTER (WHERE rent IS NOT NULL) as with_rent,
          COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) as with_coords,
          COUNT(*) FILTER (WHERE property_type IS NOT NULL) as with_type,
          COUNT(*) FILTER (WHERE assessed_value IS NOT NULL) as with_tax,
          COUNT(DISTINCT city) as cities_covered
        FROM properties
      `);
      
      const cityBreakdown = await pool.query(`
        SELECT 
          city,
          state_code,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE enrichment_source IS NOT NULL) as enriched,
          ROUND(AVG(CASE WHEN rent IS NOT NULL THEN 1 ELSE 0 END) * 100) as pct_with_rent
        FROM properties
        WHERE city IS NOT NULL
        GROUP BY city, state_code
        ORDER BY count DESC
        LIMIT 20
      `);
      
      return {
        overall: stats.rows[0],
        by_city: cityBreakdown.rows
      };
    } catch (error: any) {
      logger.error('Failed to get data status', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get integration status
   */
  async getIntegrationStatus() {
    try {
      // Test Apartment Locator AI connection
      const apartmentLocatorHealth = await apartmentLocatorSyncService.fetchMarketData('Atlanta', 'GA');
      
      // Check municipal APIs configured
      const municipalApis = await pool.query(`
        SELECT COUNT(*) as count 
        FROM municipalities 
        WHERE has_api = true
      `);
      
      return {
        apartment_locator: {
          connected: !!apartmentLocatorHealth,
          total_properties_available: apartmentLocatorHealth?.supply.total_properties || 0,
          api_url: process.env.APARTMENT_LOCATOR_API_URL
        },
        municipal_apis: {
          configured: parseInt(municipalApis.rows[0].count),
          cities: ['Atlanta', 'Charlotte', 'Dallas', 'Houston', 'Nashville', 'San Antonio', 'Austin']
        },
        photo_scraper: {
          configured: false,
          message: 'Not yet implemented'
        },
        m27_comps: {
          populated: false,
          message: 'Database empty'
        }
      };
    } catch (error: any) {
      logger.error('Failed to get integration status', { error: error.message });
      return null;
    }
  }
  
  /**
   * Start sync job for Atlanta
   */
  async syncAtlanta(): Promise<string> {
    const jobId = `atlanta_${Date.now()}`;
    
    const job: Job = {
      id: jobId,
      type: 'apartment_locator_atlanta',
      status: 'running',
      progress: 0,
      total: 100,
      startedAt: new Date()
    };
    
    activeJobs.set(jobId, job);
    
    // Run sync in background
    this.runAtlantaSync(jobId);
    
    return jobId;
  }
  
  private async runAtlantaSync(jobId: string) {
    const job = activeJobs.get(jobId);
    if (!job) return;
    
    try {
      job.progress = 10;
      
      const result = await apartmentLocatorSyncService.syncAtlanta();
      
      job.progress = 100;
      job.status = result.success ? 'completed' : 'failed';
      job.completedAt = new Date();
      job.result = result.stats;
      
      if (!result.success) {
        job.error = result.stats.error || 'Sync failed';
      }
      
    } catch (error: any) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = error.message;
      logger.error('Atlanta sync failed', { error: error.message, jobId });
    }
  }
  
  /**
   * Start sync job for all metros
   */
  async syncAllMetros(): Promise<string> {
    const jobId = `all_metros_${Date.now()}`;
    
    const job: Job = {
      id: jobId,
      type: 'apartment_locator_all',
      status: 'running',
      progress: 0,
      total: 17,
      startedAt: new Date()
    };
    
    activeJobs.set(jobId, job);
    
    // Run sync in background
    this.runAllMetrosSync(jobId);
    
    return jobId;
  }
  
  private async runAllMetrosSync(jobId: string) {
    const job = activeJobs.get(jobId);
    if (!job) return;
    
    try {
      const result = await apartmentLocatorSyncService.syncAllMetros();
      
      job.progress = job.total;
      job.status = result.success ? 'completed' : 'failed';
      job.completedAt = new Date();
      job.result = result.results;
      
    } catch (error: any) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = error.message;
      logger.error('All metros sync failed', { error: error.message, jobId });
    }
  }
  
  /**
   * Get job status
   */
  getJobStatus(jobId: string): Job | null {
    return activeJobs.get(jobId) || null;
  }
  
  /**
   * Get all active jobs
   */
  getActiveJobs(): Job[] {
    return Array.from(activeJobs.values()).filter(j => j.status === 'running');
  }
  
  /**
   * Get recent job history
   */
  getJobHistory(limit: number = 10): Job[] {
    return Array.from(activeJobs.values())
      .filter(j => j.status === 'completed' || j.status === 'failed')
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }
  
  /**
   * Get data quality metrics
   */
  async getDataQuality() {
    try {
      const quality = await pool.query(`
        SELECT 
          COUNT(*) as total,
          ROUND(AVG(CASE WHEN rent IS NOT NULL THEN 100 ELSE 0 END), 1) as pct_with_rent,
          ROUND(AVG(CASE WHEN lat IS NOT NULL THEN 100 ELSE 0 END), 1) as pct_with_coords,
          ROUND(AVG(CASE WHEN property_type IS NOT NULL THEN 100 ELSE 0 END), 1) as pct_with_type,
          ROUND(AVG(CASE WHEN assessed_value IS NOT NULL THEN 100 ELSE 0 END), 1) as pct_with_tax,
          ROUND(AVG(CASE WHEN units IS NOT NULL THEN 100 ELSE 0 END), 1) as pct_with_units,
          ROUND(AVG(CASE WHEN year_built IS NOT NULL THEN 100 ELSE 0 END), 1) as pct_with_age
        FROM properties
        WHERE city = 'Atlanta'
      `);
      
      return quality.rows[0];
    } catch (error: any) {
      logger.error('Failed to get data quality', { error: error.message });
      return null;
    }
  }
}

export const commandCenterService = new CommandCenterService();
