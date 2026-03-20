/**
 * Neighboring Properties API Routes
 * 
 * Endpoints for finding and analyzing adjacent parcels for assemblage
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { neighboringPropertyEngine } from '../../services/neighboringPropertyEngine';
import { findNearbyParcels, calculateParcelMetrics } from '../../services/spatialAnalysis';
import { getClient } from '../../database/connection';

const router = Router();

/**
 * GET /api/v1/properties/:id/neighbors
 * 
 * Find and analyze neighboring properties for assemblage opportunities
 * 
 * Query params:
 *   - includeNearby: boolean (include properties within 500ft, not just adjacent)
 *   - limit: number (max recommendations to return, default 10)
 * 
 * Response:
 *   - recommendations: NeighborRecommendation[]
 *   - totalFound: number
 *   - primaryParcel: ParcelInfo
 */
router.get(
  '/:id/neighbors',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id: parcelId } = req.params;
      const { includeNearby, limit = 10 } = req.query;

      logger.info('Finding neighbors for parcel', {
        parcelId,
        userId: req.user?.userId,
        includeNearby
      });

      // Find neighboring properties
      const recommendations = await neighboringPropertyEngine.findNeighbors(parcelId);

      // Optionally include nearby (non-adjacent) parcels
      let nearbyParcels = [];
      if (includeNearby === 'true') {
        const client = await getClient();
        try {
          nearbyParcels = await findNearbyParcels(client, parcelId, 500);
        } finally {
          client.release();
        }
      }

      // Get primary parcel info
      const client = await getClient();
      let primaryParcel;
      try {
        primaryParcel = await calculateParcelMetrics(client, parcelId);
      } finally {
        client.release();
      }

      // Limit results
      const limitNum = parseInt(limit as string);
      const limitedRecommendations = recommendations.slice(0, limitNum);

      res.json({
        success: true,
        recommendations: limitedRecommendations,
        nearby: nearbyParcels.slice(0, 5), // Top 5 nearby only
        totalFound: recommendations.length,
        primaryParcel: {
          parcelId,
          ...primaryParcel
        }
      });
    } catch (error) {
      logger.error('Error finding neighbors', { error, parcelId: req.params.id });
      next(error);
    }
  }
);

/**
 * GET /api/v1/properties/:id/neighbors/:neighborId
 * 
 * Get detailed analysis of a specific neighboring property
 */
router.get(
  '/:id/neighbors/:neighborId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id: parcelId, neighborId } = req.params;

      logger.info('Analyzing specific neighbor', {
        parcelId,
        neighborId,
        userId: req.user?.userId
      });

      // Get all recommendations and find the specific one
      const recommendations = await neighboringPropertyEngine.findNeighbors(parcelId);
      const recommendation = recommendations.find(r => r.neighbor.parcelId === neighborId);

      if (!recommendation) {
        throw new AppError(404, 'Neighbor not found or not adjacent to primary parcel');
      }

      res.json({
        success: true,
        recommendation
      });
    } catch (error) {
      logger.error('Error analyzing neighbor', { error, parcelId: req.params.id });
      next(error);
    }
  }
);

/**
 * GET /api/v1/properties/:id/assemblage-scenarios
 * 
 * Generate multiple assemblage scenarios (combinations of neighbors)
 * 
 * Query params:
 *   - maxParcels: number (max parcels to include in scenarios, default 3)
 * 
 * Response:
 *   - scenarios: AssemblageScenario[]
 */
router.get(
  '/:id/assemblage-scenarios',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id: parcelId } = req.params;
      const { maxParcels = 3 } = req.query;

      logger.info('Generating assemblage scenarios', {
        parcelId,
        maxParcels,
        userId: req.user?.userId
      });

      // Get all neighbors
      const recommendations = await neighboringPropertyEngine.findNeighbors(parcelId);

      // Generate scenarios (combinations)
      const scenarios = generateAssemblageScenarios(
        recommendations,
        parseInt(maxParcels as string)
      );

      res.json({
        success: true,
        scenarios,
        totalScenarios: scenarios.length
      });
    } catch (error) {
      logger.error('Error generating scenarios', { error, parcelId: req.params.id });
      next(error);
    }
  }
);

/**
 * POST /api/v1/properties/:id/neighbors/ai-analysis
 * 
 * Trigger AI-powered analysis (future Qwen integration)
 * 
 * Body:
 *   - type: 'owner-disposition' | 'negotiation-strategy' | 'aerial-context'
 *   - neighborIds: string[] (optional, for specific neighbors)
 * 
 * Response:
 *   - analysis: AI-generated insights
 */
router.post(
  '/:id/neighbors/ai-analysis',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id: parcelId } = req.params;
      const { type, neighborIds } = req.body;

      logger.info('AI analysis requested', {
        parcelId,
        type,
        neighborIds,
        userId: req.user?.userId
      });

      let analysis;

      switch (type) {
        case 'owner-disposition':
          if (!neighborIds || neighborIds.length === 0) {
            throw new AppError(400, 'neighborIds required for owner disposition analysis');
          }
          // TODO: Call Qwen for owner analysis
          analysis = await neighboringPropertyEngine.analyzeOwnerDisposition(
            neighborIds[0],
            'qwen'
          );
          break;

        case 'negotiation-strategy':
          const recommendations = await neighboringPropertyEngine.findNeighbors(parcelId);
          const selectedNeighbors = neighborIds
            ? recommendations.filter(r => neighborIds.includes(r.neighbor.parcelId))
            : recommendations.slice(0, 3);
          
          // TODO: Call Qwen for negotiation strategy
          analysis = await neighboringPropertyEngine.generateNegotiationStrategy(
            selectedNeighbors.map(r => r.neighbor),
            'qwen'
          );
          break;

        case 'aerial-context':
          // Get parcel coordinates
          const client = await getClient();
          let coords;
          try {
            const metrics = await calculateParcelMetrics(client, parcelId);
            coords = metrics.centroid;
          } finally {
            client.release();
          }

          // TODO: Call Qwen with satellite imagery
          analysis = await neighboringPropertyEngine.analyzeSiteFromAerial(coords);
          break;

        default:
          throw new AppError(400, `Unknown analysis type: ${type}`);
      }

      res.json({
        success: true,
        type,
        analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error running AI analysis', { error, parcelId: req.params.id });
      next(error);
    }
  }
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate assemblage scenarios (different combinations of neighbors)
 */
function generateAssemblageScenarios(
  recommendations: any[],
  maxParcels: number
): any[] {
  const scenarios = [];

  // Single neighbor scenarios
  for (let i = 0; i < Math.min(recommendations.length, 5); i++) {
    const rec = recommendations[i];
    scenarios.push({
      id: `scenario-single-${i}`,
      parcels: [rec.neighbor.parcelId],
      totalUnits: rec.benefits.additionalUnits,
      totalCostReduction: rec.benefits.constructionCostReduction,
      totalInvestment: rec.feasibility.estimatedAskingPrice,
      benefitScore: rec.benefitScore,
      complexity: 'low'
    });
  }

  // Two-neighbor scenarios (if maxParcels >= 2)
  if (maxParcels >= 2 && recommendations.length >= 2) {
    for (let i = 0; i < Math.min(recommendations.length - 1, 3); i++) {
      for (let j = i + 1; j < Math.min(recommendations.length, 4); j++) {
        const rec1 = recommendations[i];
        const rec2 = recommendations[j];
        
        scenarios.push({
          id: `scenario-dual-${i}-${j}`,
          parcels: [rec1.neighbor.parcelId, rec2.neighbor.parcelId],
          totalUnits: rec1.benefits.additionalUnits + rec2.benefits.additionalUnits,
          totalCostReduction: rec1.benefits.constructionCostReduction + rec2.benefits.constructionCostReduction,
          totalInvestment: rec1.feasibility.estimatedAskingPrice + rec2.feasibility.estimatedAskingPrice,
          benefitScore: (rec1.benefitScore + rec2.benefitScore) / 2,
          complexity: 'medium'
        });
      }
    }
  }

  // Sort by benefit score
  scenarios.sort((a, b) => b.benefitScore - a.benefitScore);

  return scenarios.slice(0, 10); // Return top 10 scenarios
}

export default router;
