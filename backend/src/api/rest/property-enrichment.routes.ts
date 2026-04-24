/**
 * Property Enrichment API Routes
 * 
 * Endpoints for enriching properties with public records and rent data.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getEnrichmentOrchestrator } from '../../services/property-enrichment';
import { hasCountyCoverage, COUNTY_CONFIGS } from '../../services/property-enrichment/property-info/county-configs';
import { getFullEnrichmentService, DataLibraryAsset } from '../../services/property-enrichment/data-library';

const router = Router();
const orchestrator = getEnrichmentOrchestrator();

// ============================================================================
// SCHEMAS
// ============================================================================

const EnrichRequestSchema = z.object({
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().optional(),
  county: z.string().optional(),
  propertyName: z.string().optional(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional(),
  skipPropertyInfo: z.boolean().optional(),
  skipRentData: z.boolean().optional()
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/v1/property-enrichment/enrich
 * 
 * Enrich a property address with public records and rent data.
 * Returns both property info (county GIS) and rent data (Apartments.com, etc.)
 */
router.post('/enrich', async (req: Request, res: Response) => {
  try {
    const parsed = EnrichRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues
      });
    }
    
    const { address, city, state, zip, county, propertyName, coordinates, skipPropertyInfo, skipRentData } = parsed.data;
    
    console.log(`[API] Enriching: ${address}, ${city}, ${state}`);
    
    const job = await orchestrator.enrichProperty(address, city, state, {
      zip,
      county,
      propertyName,
      coordinates,
      skipPropertyInfo,
      skipRentData
    });
    
    const profile = orchestrator.buildPropertyProfile(job);
    
    res.json({
      success: true,
      job: {
        id: job.id,
        propertyInfoStatus: job.propertyInfoStatus,
        propertyInfoProvider: job.propertyInfoProvider,
        rentDataStatus: job.rentDataStatus,
        rentDataProvider: job.rentDataProvider,
        completedAt: job.completedAt
      },
      profile
    });
  } catch (error) {
    console.error('[API] Enrichment error:', error);
    res.status(500).json({
      error: 'Enrichment failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/property-enrichment/coverage
 * 
 * Check coverage for a state/county.
 */
router.get('/coverage', async (req: Request, res: Response) => {
  try {
    const { state, county } = req.query as { state?: string; county?: string };
    
    if (!state) {
      return res.status(400).json({ error: 'State is required' });
    }
    
    const coverage = orchestrator.getCoverage(state, county);
    
    res.json({
      state,
      county,
      coverage
    });
  } catch (error) {
    console.error('[API] Coverage check error:', error);
    res.status(500).json({ error: 'Coverage check failed' });
  }
});

/**
 * GET /api/v1/property-enrichment/coverage/all
 * 
 * Get all supported counties.
 */
router.get('/coverage/all', async (_req: Request, res: Response) => {
  try {
    const stats = orchestrator.getStats();
    
    res.json({
      propertyInfo: {
        totalCounties: stats.propertyInfo.totalProviders,
        byState: stats.propertyInfo.byState,
        counties: stats.propertyInfo.counties
      },
      rentData: {
        providers: stats.rentData.providers
      }
    });
  } catch (error) {
    console.error('[API] Stats error:', error);
    res.status(500).json({ error: 'Stats failed' });
  }
});

/**
 * GET /api/v1/property-enrichment/health
 * 
 * Health check all providers.
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await orchestrator.healthCheck();
    
    // Convert Maps to objects for JSON
    const propertyInfoHealth: Record<string, boolean> = {};
    health.propertyInfo.forEach((v, k) => { propertyInfoHealth[k] = v; });
    
    const rentDataHealth: Record<string, boolean> = {};
    health.rentData.forEach((v, k) => { rentDataHealth[k] = v; });
    
    const allHealthy = 
      Object.values(propertyInfoHealth).some(v => v) &&
      Object.values(rentDataHealth).some(v => v);
    
    res.json({
      healthy: allHealthy,
      propertyInfo: propertyInfoHealth,
      rentData: rentDataHealth
    });
  } catch (error) {
    console.error('[API] Health check error:', error);
    res.status(500).json({
      healthy: false,
      error: 'Health check failed'
    });
  }
});

/**
 * POST /api/v1/property-enrichment/batch
 * 
 * Enrich multiple properties at once.
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { properties } = req.body as {
      properties: Array<{
        address: string;
        city: string;
        state: string;
        zip?: string;
        county?: string;
        propertyName?: string;
      }>;
    };
    
    if (!properties || !Array.isArray(properties)) {
      return res.status(400).json({ error: 'Properties array is required' });
    }
    
    if (properties.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 properties per batch' });
    }
    
    const results = await Promise.all(
      properties.map(async (prop) => {
        try {
          const job = await orchestrator.enrichProperty(
            prop.address,
            prop.city,
            prop.state,
            {
              zip: prop.zip,
              county: prop.county,
              propertyName: prop.propertyName
            }
          );
          const profile = orchestrator.buildPropertyProfile(job);
          return { success: true, address: prop.address, profile };
        } catch (error) {
          return {
            success: false,
            address: prop.address,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );
    
    res.json({
      total: properties.length,
      successful: results.filter(r => r.success).length,
      results
    });
  } catch (error) {
    console.error('[API] Batch enrichment error:', error);
    res.status(500).json({ error: 'Batch enrichment failed' });
  }
});

/**
 * GET /api/v1/property-enrichment/county-check
 * 
 * Quick check if a county has coverage.
 */
router.get('/county-check', async (req: Request, res: Response) => {
  try {
    const { county, state } = req.query as { county?: string; state?: string };
    
    if (!county || !state) {
      return res.status(400).json({ error: 'County and state are required' });
    }
    
    const hasCoverage = hasCountyCoverage(county, state);
    
    res.json({
      county,
      state,
      hasCoverage,
      message: hasCoverage 
        ? `${county} County, ${state} is supported`
        : `${county} County, ${state} is not yet supported. Contact us to add it!`
    });
  } catch (error) {
    res.status(500).json({ error: 'County check failed' });
  }
});

/**
 * POST /api/v1/property-enrichment/full-enrich
 * 
 * Full enrichment connecting all data matrix layers:
 * - Property Info (Municipal APIs)
 * - Rent Data (Apartment Locator)
 * - Proximity Context (Transit, Grocery, Schools, Crime)
 * - Market Events (Employer moves, Supply pipeline)
 * - Historical Backtest (Similar deals performance)
 * - Sales Comps (Recent transactions)
 */
router.post('/full-enrich', async (req: Request, res: Response) => {
  try {
    const { asset, config } = req.body as {
      asset: DataLibraryAsset;
      config?: {
        enrichPropertyInfo?: boolean;
        enrichRentData?: boolean;
        enrichProximity?: boolean;
        enrichEvents?: boolean;
        enrichBacktest?: boolean;
        enrichSalesComps?: boolean;
        searchRadiusMiles?: number;
        lookAheadMonths?: number;
      };
    };
    
    if (!asset || !asset.address || !asset.city || !asset.state) {
      return res.status(400).json({ 
        error: 'Asset with address, city, and state is required' 
      });
    }
    
    // Get pool from app
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database pool not configured' });
    }
    
    const service = getFullEnrichmentService(pool);
    const result = await service.enrichAsset(asset, config);
    
    res.json({
      success: result.success,
      readinessForUnderwriting: result.readinessForUnderwriting,
      overallDataQualityScore: result.overallDataQualityScore,
      
      // Core enrichment
      fieldsEnriched: result.fieldsEnriched,
      fieldsStillMissing: result.fieldsStillMissing,
      missingCriticalData: result.missingCriticalData,
      
      // Proximity
      proximity: result.proximity ? {
        transitGrade: result.proximity.transitGrade,
        groceryGrade: result.proximity.groceryGrade,
        schoolGrade: result.proximity.schoolGrade,
        safetyGrade: result.proximity.safetyGrade,
        estimatedPremiumPct: result.proximity.estimatedPremiumPct,
        highlights: result.proximity.highlights,
        concerns: result.proximity.concerns
      } : null,
      
      // Events
      events: result.events ? {
        netSentiment: result.events.netSentiment,
        supplyPipelineUnits: result.events.supplyPipelineUnits,
        keyEvents: result.events.keyEvents,
        riskFactors: result.events.riskFactors,
        opportunities: result.events.opportunities
      } : null,
      
      // Backtest
      backtest: result.backtest ? {
        sampleSize: result.backtest.sampleSize,
        avgActualIrr: result.backtest.avgActualIrr,
        outperformanceRate: result.backtest.outperformanceRate,
        confidenceLevel: result.backtest.confidenceLevel,
        insights: result.backtest.insights
      } : null,
      
      // Sales comps
      salesComps: result.salesComps,
      
      // Conflicts
      conflicts: result.conflicts,
      
      // Raw enriched data (for updates)
      enrichedData: result.enrichedData
    });
  } catch (error) {
    console.error('[API] Full enrichment error:', error);
    res.status(500).json({ 
      error: 'Full enrichment failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/property-enrichment/counties/:state
 * 
 * Get all supported counties for a state.
 */
router.get('/counties/:state', async (req: Request, res: Response) => {
  try {
    const { state } = req.params;
    
    const counties = COUNTY_CONFIGS
      .filter(c => c.state.toUpperCase() === state.toUpperCase())
      .map(c => ({
        county: c.county,
        fipsCode: c.fipsCode,
        pattern: c.pattern
      }));
    
    res.json({
      state: state.toUpperCase(),
      count: counties.length,
      counties
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get counties' });
  }
});

export default router;
