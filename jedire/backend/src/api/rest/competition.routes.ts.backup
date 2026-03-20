/**
 * Competition Analysis API Routes
 * 
 * Endpoints for competitive property analysis in development deals
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { getClient } from '../../database/connection';

const router = Router();

/**
 * GET /api/v1/deals/:dealId/competitors
 * 
 * Get competing properties for a development deal
 * 
 * Query params:
 *   - sameVintage: boolean (±5 years)
 *   - similarSize: boolean (±20% units)
 *   - sameClass: boolean (same property class)
 *   - distanceRadius: number (miles, default 1.0)
 * 
 * Response:
 *   - competitors: CompetitorProperty[]
 *   - totalFound: number
 */
router.get(
  '/:dealId/competitors',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId } = req.params;
      const {
        sameVintage = false,
        similarSize = true,
        sameClass = true,
        distanceRadius = 1.0,
      } = req.query;

      logger.info('Finding competitors for deal', {
        dealId,
        userId: req.user?.userId,
        filters: { sameVintage, similarSize, sameClass, distanceRadius },
      });

      const client = await getClient();
      try {
        // Get deal location and details
        const dealResult = await client.query(
          `SELECT latitude, longitude, units, year_built, property_class 
           FROM deals WHERE id = $1`,
          [dealId]
        );

        if (dealResult.rows.length === 0) {
          throw new AppError(404, 'Deal not found');
        }

        const deal = dealResult.rows[0];
        if (!deal.latitude || !deal.longitude) {
          throw new AppError(400, 'Deal location not set');
        }

        // Build dynamic query based on filters
        let whereConditions = ['pr.units > 0'];
        const queryParams: any[] = [deal.latitude, deal.longitude, distanceRadius];
        let paramIndex = 4;

        // Distance filter (using PostGIS)
        whereConditions.push(`
          ST_DWithin(
            ST_SetSRID(ST_MakePoint(pr.longitude, pr.latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
            $3 * 1609.34
          )
        `);

        // Same vintage filter
        if (sameVintage === 'true' && deal.year_built) {
          const yearBuilt = parseInt(deal.year_built);
          whereConditions.push(`
            pr.year_built::integer BETWEEN ${yearBuilt - 5} AND ${yearBuilt + 5}
          `);
        }

        // Similar size filter
        if (similarSize === 'true' && deal.units) {
          const minUnits = Math.floor(deal.units * 0.8);
          const maxUnits = Math.ceil(deal.units * 1.2);
          whereConditions.push(`pr.units BETWEEN ${minUnits} AND ${maxUnits}`);
        }

        // Same class filter
        if (sameClass === 'true' && deal.property_class) {
          whereConditions.push(`pr.property_class = '${deal.property_class}'`);
        }

        const query = `
          SELECT 
            pr.id,
            pr.address as name,
            pr.address,
            pr.units,
            pr.year_built,
            pr.owner_name,
            pr.appraised_value,
            pr.latitude,
            pr.longitude,
            ST_Distance(
              ST_SetSRID(ST_MakePoint(pr.longitude, pr.latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
            ) / 1609.34 as distance
          FROM property_records pr
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY distance
          LIMIT 20
        `;

        const competitorsResult = await client.query(query, queryParams);

        // Transform results to match frontend interface
        const competitors = competitorsResult.rows.map((row) => ({
          id: row.id,
          name: row.name || row.address,
          address: row.address,
          distance: parseFloat(row.distance).toFixed(1),
          units: row.units,
          yearBuilt: row.year_built,
          category: determineCategory(row.year_built),
          avgRent: estimateRent(row),
          occupancy: estimateOccupancy(row.year_built),
          class: row.property_class || 'B',
          latitude: row.latitude,
          longitude: row.longitude,
        }));

        res.json({
          success: true,
          competitors,
          totalFound: competitors.length,
        });
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error finding competitors', { error, dealId: req.params.dealId });
      next(error);
    }
  }
);

/**
 * GET /api/v1/deals/:dealId/advantage-matrix
 * 
 * Get competitive advantage matrix
 */
router.get(
  '/:dealId/advantage-matrix',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId } = req.params;

      logger.info('Generating advantage matrix', {
        dealId,
        userId: req.user?.userId,
      });

      // TODO: Replace with real data analysis
      // For now, return structured mock data
      const matrix = {
        overallScore: 9,
        competitors: [
          { id: 'comp-1', name: 'Metro Towers' },
          { id: 'comp-2', name: 'The Modern' },
          { id: 'comp-3', name: 'Skyline' },
        ],
        features: [
          {
            name: 'Coworking Space',
            you: true,
            competitors: { 'comp-1': false, 'comp-2': false, 'comp-3': true },
            advantagePoints: 2,
          },
          {
            name: 'EV Charging',
            you: true,
            competitors: { 'comp-1': false, 'comp-2': false, 'comp-3': false },
            advantagePoints: 3,
          },
          {
            name: 'Smart Home Tech',
            you: true,
            competitors: { 'comp-1': false, 'comp-2': false, 'comp-3': false },
            advantagePoints: 3,
          },
        ],
        keyDifferentiators: ['EV Charging', 'Smart Home Tech', 'Coworking Space'],
      };

      res.json({
        success: true,
        matrix,
      });
    } catch (error) {
      logger.error('Error generating advantage matrix', { error });
      next(error);
    }
  }
);

/**
 * GET /api/v1/deals/:dealId/waitlist-properties
 * 
 * Get properties with waitlists (high demand)
 */
router.get(
  '/:dealId/waitlist-properties',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId } = req.params;
      const { radius = 1.0 } = req.query;

      logger.info('Finding waitlist properties', {
        dealId,
        radius,
        userId: req.user?.userId,
      });

      // TODO: Integrate with market intelligence data
      // For now, return mock data representing high-demand properties
      const properties = [
        {
          id: 'wait-1',
          name: 'Metro Towers',
          units: 287,
          distance: 0.4,
          occupancy: 98,
          waitlistCount: 45,
          avgRent: 1850,
          avgWaitTime: '3-4 months',
          demandNote: 'Highest demand for 1BR units. Strong young professional demographic.',
        },
        {
          id: 'wait-2',
          name: 'The Modern',
          units: 312,
          distance: 0.6,
          occupancy: 97,
          waitlistCount: 32,
          avgRent: 1725,
          avgWaitTime: '2-3 months',
          demandNote: 'Pet-friendly units in highest demand. Near tech campus.',
        },
      ];

      res.json({
        success: true,
        properties,
        totalFound: properties.length,
      });
    } catch (error) {
      logger.error('Error finding waitlist properties', { error });
      next(error);
    }
  }
);

/**
 * GET /api/v1/deals/:dealId/aging-competitors
 * 
 * Get aging competitors (opportunities for premium positioning)
 */
router.get(
  '/:dealId/aging-competitors',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId } = req.params;
      const { radius = 1.0 } = req.query;

      logger.info('Finding aging competitors', {
        dealId,
        radius,
        userId: req.user?.userId,
      });

      const client = await getClient();
      try {
        // Get deal location
        const dealResult = await client.query(
          `SELECT latitude, longitude FROM deals WHERE id = $1`,
          [dealId]
        );

        if (dealResult.rows.length === 0) {
          throw new AppError(404, 'Deal not found');
        }

        const deal = dealResult.rows[0];
        const currentYear = new Date().getFullYear();
        const cutoffYear = currentYear - 15; // Properties 15+ years old

        // Find aging properties
        const query = `
          SELECT 
            pr.id,
            pr.address as name,
            pr.address,
            pr.units,
            pr.year_built,
            pr.appraised_value,
            pr.latitude,
            pr.longitude,
            ST_Distance(
              ST_SetSRID(ST_MakePoint(pr.longitude, pr.latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
            ) / 1609.34 as distance
          FROM property_records pr
          WHERE 
            pr.year_built::integer <= $3
            AND pr.units > 50
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(pr.longitude, pr.latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
              $4 * 1609.34
            )
          ORDER BY distance
          LIMIT 10
        `;

        const result = await client.query(query, [
          deal.latitude,
          deal.longitude,
          cutoffYear,
          radius,
        ]);

        const agingCompetitors = result.rows.map((row) => {
          const age = currentYear - parseInt(row.year_built);
          const estimatedRent = Math.max(1000, 1800 - age * 25);
          const potentialPremium = Math.min(500, age * 15);

          return {
            id: row.id,
            name: row.name || row.address,
            address: row.address,
            distance: parseFloat(row.distance).toFixed(1),
            units: row.units,
            yearBuilt: row.year_built,
            category: 'direct',
            avgRent: estimatedRent,
            occupancy: Math.max(70, 95 - age),
            class: age > 20 ? 'C' : 'B',
            needsRenovation: age > 20,
            datedAmenities: age > 15,
            lowOccupancy: age > 18,
            potentialPremium,
            opportunityNote: `${age}-year-old property ${
              age > 20 ? 'needs major renovation' : 'showing signs of aging'
            }. Capture market share with modern amenities.`,
          };
        });

        res.json({
          success: true,
          competitors: agingCompetitors,
          totalFound: agingCompetitors.length,
        });
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error finding aging competitors', { error });
      next(error);
    }
  }
);

/**
 * GET /api/v1/deals/:dealId/competition-insights
 * 
 * Get AI-generated competitive insights
 */
router.get(
  '/:dealId/competition-insights',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId } = req.params;

      logger.info('Generating competition insights', {
        dealId,
        userId: req.user?.userId,
      });

      // TODO: Integrate with AI/LLM service
      const insights = `💡 Based on competition analysis, consider:

• Increase 1BR allocation to 45% (+10%) to match high-demand properties
• Add coworking space (2,000 SF) for +$125/unit premium - competitive advantage
• Target young professionals from nearby tech campus (5,000 employees within 0.8 mi)
• Position at $1,788/mo rent point to capture waitlist overflow
• Emphasize smart home technology as key differentiator
• Design for car-optional lifestyle - 45% of target demographic remote workers

Your development shows strong differentiation potential. Focus marketing on tech-forward amenities.`;

      res.json({
        success: true,
        insights,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error generating insights', { error });
      next(error);
    }
  }
);

/**
 * GET /api/v1/deals/:dealId/competition-export
 * 
 * Export competition analysis to CSV
 */
router.get(
  '/:dealId/competition-export',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId } = req.params;

      logger.info('Exporting competition analysis', {
        dealId,
        userId: req.user?.userId,
      });

      // TODO: Generate actual CSV export
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="competition-analysis-${dealId}.csv"`
      );

      const csvData = `Property,Units,Distance,Avg Rent,Occupancy,Year Built,Class\n`;
      res.send(csvData);
    } catch (error) {
      logger.error('Error exporting competition analysis', { error });
      next(error);
    }
  }
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine property category based on year built
 */
function determineCategory(yearBuilt: string): 'direct' | 'construction' | 'planned' {
  const year = parseInt(yearBuilt);
  const currentYear = new Date().getFullYear();

  if (year > currentYear) {
    return 'planned';
  } else if (year >= currentYear - 2) {
    return 'construction';
  } else {
    return 'direct';
  }
}

/**
 * Estimate rent based on property characteristics
 */
function estimateRent(property: any): number {
  const baseRent = 1500;
  const yearBuilt = parseInt(property.year_built || '2000');
  const age = new Date().getFullYear() - yearBuilt;

  // Adjust for age
  let rent = baseRent - age * 10;

  // Adjust for value
  if (property.appraised_value && property.units) {
    const valuePerUnit = property.appraised_value / property.units;
    if (valuePerUnit > 150000) {
      rent += 300;
    } else if (valuePerUnit > 100000) {
      rent += 150;
    }
  }

  return Math.max(900, Math.round(rent));
}

/**
 * Estimate occupancy based on age
 */
function estimateOccupancy(yearBuilt: string): number {
  const year = parseInt(yearBuilt || '2000');
  const age = new Date().getFullYear() - year;

  if (age < 3) return 95 + Math.random() * 3;
  if (age < 10) return 90 + Math.random() * 5;
  if (age < 20) return 85 + Math.random() * 5;
  return 75 + Math.random() * 10;
}

export default router;
