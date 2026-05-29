/**
 * Georgia Metro Ingestion Orchestrator
 * Coordinates data ingestion across all Atlanta metro counties.
 *
 * Core 5 (ArcGIS ingestion implemented):
 *   cobb, gwinnett, dekalb, fulton, clayton
 *
 * Inner ring (ingest pending — promote/enrich steps still run on any existing rows):
 *   cherokee, forsyth, henry, douglas, fayette, paulding, rockdale
 */

import { getCobbIngestionService } from './cobb-ingestion.service';
import { getGwinnettIngestionService } from './gwinnett-ingestion.service';
import { getDeKalbIngestionService } from './dekalb-ingestion.service';
import { getFultonIngestionService } from './fulton-ingestion.service';
import { getClaytonIngestionService } from './clayton-ingestion.service';
import { IngestionJob, IngestionConfig, DEFAULT_INGESTION_CONFIG } from './types';

export interface OrchestratorResult {
  startedAt: Date;
  completedAt: Date;
  counties: Record<string, IngestionJob | undefined>;
  summary: {
    totalRecords: number;
    totalInserted: number;
    totalErrors: number;
    successfulCounties: string[];
    failedCounties: string[];
    skippedCounties: string[];
  };
}

export class GeorgiaIngestionOrchestrator {
  private cobbService = getCobbIngestionService();
  private gwinnettService = getGwinnettIngestionService();
  private dekalbService = getDeKalbIngestionService();
  private fultonService = getFultonIngestionService();
  private claytonService = getClaytonIngestionService();

  /**
   * Run full ingestion for all (or a subset of) counties.
   *
   * Counties with no implemented ArcGIS service are skipped with a log message.
   * The promote/enrich pipeline downstream operates on whatever rows exist in
   * georgia_property_sales, so skipped counties don't block later steps.
   */
  async ingestAll(
    config: Partial<IngestionConfig> = {},
    options: {
      counties?: string[];
      parallel?: boolean;
    } = {}
  ): Promise<OrchestratorResult> {
    const startedAt = new Date();
    const counties = options.counties || ['cobb', 'gwinnett', 'dekalb', 'fulton', 'clayton'];
    const parallel = options.parallel ?? false;
    
    const result: OrchestratorResult = {
      startedAt,
      completedAt: new Date(),
      counties: {},
      summary: {
        totalRecords: 0,
        totalInserted: 0,
        totalErrors: 0,
        successfulCounties: [],
        failedCounties: [],
        skippedCounties: [],
      }
    };

    // Partition requested counties into supported vs not-yet-implemented
    const SUPPORTED = new Set(['cobb', 'gwinnett', 'dekalb', 'fulton', 'clayton']);
    const activeCounties = counties.filter(c => SUPPORTED.has(c));
    const pendingCounties = counties.filter(c => !SUPPORTED.has(c));

    if (pendingCounties.length > 0) {
      console.log(`[Georgia] Skipping (no ingestion service): ${pendingCounties.join(', ')}`);
      result.summary.skippedCounties.push(...pendingCounties);
    }

    console.log(`[Georgia] Starting ingestion for counties: ${activeCounties.join(', ')}`);
    console.log(`[Georgia] Mode: ${parallel ? 'parallel' : 'sequential'}`);

    if (parallel) {
      // Run all counties in parallel
      const promises: Promise<void>[] = [];
      
      if (activeCounties.includes('cobb')) {
        promises.push(this.runCobb(config, result));
      }
      if (activeCounties.includes('gwinnett')) {
        promises.push(this.runGwinnett(config, result));
      }
      if (activeCounties.includes('dekalb')) {
        promises.push(this.runDeKalb(config, result));
      }
      if (activeCounties.includes('fulton')) {
        promises.push(this.runFulton(config, result));
      }
      if (activeCounties.includes('clayton')) {
        promises.push(this.runClayton(config, result));
      }
      
      await Promise.all(promises);
    } else {
      // Run sequentially (recommended to avoid rate limits)
      if (activeCounties.includes('cobb')) {
        await this.runCobb(config, result);
      }
      if (activeCounties.includes('gwinnett')) {
        await this.runGwinnett(config, result);
      }
      if (activeCounties.includes('dekalb')) {
        await this.runDeKalb(config, result);
      }
      if (activeCounties.includes('fulton')) {
        await this.runFulton(config, result);
      }
      if (activeCounties.includes('clayton')) {
        await this.runClayton(config, result);
      }
    }
    
    result.completedAt = new Date();
    
    // Calculate summary
    for (const [county, job] of Object.entries(result.counties)) {
      if (job) {
        result.summary.totalRecords += job.totalRecords;
        result.summary.totalInserted += job.insertedRecords;
        result.summary.totalErrors += job.errorCount;
        
        if (job.status === 'complete') {
          result.summary.successfulCounties.push(county);
        } else {
          result.summary.failedCounties.push(county);
        }
      }
    }
    
    const duration = (result.completedAt.getTime() - startedAt.getTime()) / 1000;
    console.log(`[Georgia] Ingestion complete in ${duration.toFixed(1)}s`);
    console.log(`[Georgia] Summary: ${result.summary.totalInserted} records inserted, ${result.summary.totalErrors} errors`);
    
    // Update Knowledge Graph market nodes with fresh data timestamp
    setImmediate(async () => {
      try {
        const { getKnowledgeGraph } = await import('../neural-network/knowledge-graph.service' as any) as any;
        const { getPool } = await import('../../../database/connection');
        const kg = getKnowledgeGraph(getPool());
        // Touch the Atlanta market node
        const atlantaNode = await kg.findNodeByExternalId('Market', 'atlanta');
        if (atlantaNode) {
          await kg.updateNodeProperties(atlantaNode.id, {
            lastGeorgiaIngestion: new Date(),
            georgiaRecordsIngested: result.summary.totalInserted,
            georgiaCounties: result.summary.successfulCounties,
          });
        }
        console.log(`[Graph] Atlanta market node updated after Georgia ingestion`);
      } catch (graphErr) {
        // Non-fatal
      }
    });

    return result;
  }
  
  private async runCobb(config: Partial<IngestionConfig>, result: OrchestratorResult): Promise<void> {
    try {
      console.log('[Georgia] Starting Cobb County...');
      result.counties.cobb = await this.cobbService.ingestAll(config);
    } catch (error) {
      console.error('[Georgia] Cobb County failed:', error);
      result.counties.cobb = {
        id: 'cobb-failed',
        county: 'Cobb',
        state: 'GA',
        jobType: 'full',
        status: 'failed',
        totalRecords: 0,
        processedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        errorCount: 1,
        errors: [String(error)]
      };
    }
  }
  
  private async runGwinnett(config: Partial<IngestionConfig>, result: OrchestratorResult): Promise<void> {
    try {
      console.log('[Georgia] Starting Gwinnett County...');
      result.counties.gwinnett = await this.gwinnettService.ingestAll(config);
    } catch (error) {
      console.error('[Georgia] Gwinnett County failed:', error);
      result.counties.gwinnett = {
        id: 'gwinnett-failed',
        county: 'Gwinnett',
        state: 'GA',
        jobType: 'full',
        status: 'failed',
        totalRecords: 0,
        processedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        errorCount: 1,
        errors: [String(error)]
      };
    }
  }
  
  private async runDeKalb(config: Partial<IngestionConfig>, result: OrchestratorResult): Promise<void> {
    try {
      console.log('[Georgia] Starting DeKalb County...');
      result.counties.dekalb = await this.dekalbService.ingestAll(config);
    } catch (error) {
      console.error('[Georgia] DeKalb County failed:', error);
      result.counties.dekalb = {
        id: 'dekalb-failed',
        county: 'DeKalb',
        state: 'GA',
        jobType: 'full',
        status: 'failed',
        totalRecords: 0,
        processedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        errorCount: 1,
        errors: [String(error)]
      };
    }
  }
  
  private async runFulton(config: Partial<IngestionConfig>, result: OrchestratorResult): Promise<void> {
    try {
      console.log('[Georgia] Starting Fulton County...');
      result.counties.fulton = await this.fultonService.ingestAll(config);
    } catch (error) {
      console.error('[Georgia] Fulton County failed:', error);
      result.counties.fulton = {
        id: 'fulton-failed',
        county: 'Fulton',
        state: 'GA',
        jobType: 'full',
        status: 'failed',
        totalRecords: 0,
        processedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        errorCount: 1,
        errors: [String(error)]
      };
    }
  }

  private async runClayton(config: Partial<IngestionConfig>, result: OrchestratorResult): Promise<void> {
    try {
      console.log('[Georgia] Starting Clayton County...');
      result.counties.clayton = await this.claytonService.ingestAll(config);
    } catch (error) {
      console.error('[Georgia] Clayton County failed:', error);
      result.counties.clayton = {
        id: 'clayton-failed',
        county: 'Clayton',
        state: 'GA',
        jobType: 'full',
        status: 'failed',
        totalRecords: 0,
        processedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        errorCount: 1,
        errors: [String(error)]
      };
    }
  }
  
  /**
   * Ingest sales only for all counties
   */
  async ingestSalesOnly(config: Partial<IngestionConfig> = {}): Promise<{
    cobb?: IngestionJob;
    fulton?: IngestionJob;
  }> {
    const result: { cobb?: IngestionJob; fulton?: IngestionJob } = {};
    
    console.log('[Georgia] Starting sales-only ingestion...');
    
    // Cobb has the richest sales data (927K records)
    try {
      result.cobb = await this.cobbService.ingestSales(config);
    } catch (error) {
      console.error('[Georgia] Cobb sales failed:', error);
    }
    
    // Fulton has Tyler yearly sales (2018-2022)
    try {
      result.fulton = await this.fultonService.ingestSales(config);
    } catch (error) {
      console.error('[Georgia] Fulton sales failed:', error);
    }
    
    // Gwinnett/DeKalb sales are part of their main tables, not separate
    
    return result;
  }
  
  /**
   * Get multifamily properties only from each county
   */
  async getMultifamilyProperties(): Promise<{
    cobb: number;
    gwinnett: number;
  }> {
    const [cobbMF, gwinnettMF] = await Promise.all([
      this.cobbService.getMultifamilyParcels(),
      this.gwinnettService.getApartments()
    ]);
    
    return {
      cobb: cobbMF.length,
      gwinnett: gwinnettMF.length
    };
  }
}

// Singleton
let orchestratorInstance: GeorgiaIngestionOrchestrator | null = null;

export function getGeorgiaIngestionOrchestrator(): GeorgiaIngestionOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new GeorgiaIngestionOrchestrator();
  }
  return orchestratorInstance;
}
