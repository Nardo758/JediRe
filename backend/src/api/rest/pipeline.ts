/**
 * Data Pipeline API Endpoints
 * 
 * REST endpoints for triggering Python data pipeline operations
 */

import { Router, Request, Response } from 'express';
import { PythonPipelineService } from '../../services/pythonPipeline';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/pipeline/status
 * Get pipeline status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await PythonPipelineService.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Pipeline status check failed:', error);
    res.status(500).json({ error: 'Failed to check pipeline status' });
  }
});

/**
 * POST /api/pipeline/load-parcels
 * Trigger parcel data loading
 * 
 * Body: {
 *   pattern?: string,  // GIS file pattern (default: fulton_parcels_complete.geojson)
 *   limit?: number     // Limit number of parcels (for testing)
 * }
 */
router.post('/load-parcels', async (req: Request, res: Response) => {
  try {
    const { pattern, limit } = req.body;
    
    logger.info(`Loading parcels: pattern=${pattern}, limit=${limit}`);
    
    // Start loading (this will take a while for full dataset)
    const result = await PythonPipelineService.loadParcels(pattern, limit);
    
    res.json({
      success: true,
      message: `Loaded ${result.parcelsLoaded} parcels in ${result.duration}ms`,
      result,
    });
  } catch (error) {
    logger.error('Parcel loading failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/pipeline/load-mock-data
 * Load mock data for testing
 * 
 * Body: {
 *   types?: string[]  // Data types to load (default: ['all'])
 * }
 */
router.post('/load-mock-data', async (req: Request, res: Response) => {
  try {
    const { types = ['all'] } = req.body;
    
    logger.info(`Loading mock data: types=${types.join(',')}`);
    
    const result = await PythonPipelineService.loadMockData(types);
    
    res.json({
      success: true,
      message: `Loaded mock data in ${result.duration}ms`,
      result,
    });
  } catch (error) {
    logger.error('Mock data loading failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/pipeline/analyze/:parcelId
 * Analyze a specific parcel
 */
router.get('/analyze/:parcelId', async (req: Request, res: Response) => {
  try {
    const { parcelId } = req.params;
    
    logger.info(`Analyzing parcel: ${parcelId}`);
    
    const analysis = await PythonPipelineService.analyzeParcel(parcelId);
    
    res.json({
      success: true,
      parcel: analysis,
    });
  } catch (error) {
    logger.error(`Parcel analysis failed for ${req.params.parcelId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/pipeline/analyze-batch
 * Analyze multiple parcels
 * 
 * Body: {
 *   parcelIds: string[]
 * }
 */
router.post('/analyze-batch', async (req: Request, res: Response) => {
  try {
    const { parcelIds } = req.body;
    
    if (!Array.isArray(parcelIds) || parcelIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'parcelIds array required',
      });
    }
    
    logger.info(`Analyzing ${parcelIds.length} parcels`);
    
    // Analyze in parallel
    const analyses = await Promise.all(
      parcelIds.map(id => PythonPipelineService.analyzeParcel(id))
    );
    
    res.json({
      success: true,
      count: analyses.length,
      parcels: analyses,
    });
  } catch (error) {
    logger.error('Batch analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
