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
        // Get deal location and details (extract centroid from boundary polygon)
        const dealResult = await client.query(
          `SELECT 
             ST_Y(ST_Centroid(boundary::geometry)) as latitude,
             ST_X(ST_Centroid(boundary::geometry)) as longitude,
             target_units as units,
             EXTRACT(YEAR FROM created_at)::text as year_built,
             project_type as property_class
           FROM deals WHERE id = $1`,
          [dealId]
        );

        if (dealResult.rows.length === 0) {
          throw new AppError(404, 'Deal not found');
        }

        const deal = dealResult.rows[0];
        if (!deal.latitude || !deal.longitude) {
          throw new AppError(400, 'Deal location not set - boundary polygon missing');
        }

        // Build dynamic query based on filters
        let whereConditions = ['pr.units > 0'];
        const queryParams: any[] = [deal.latitude, deal.longitude, distanceRadius];
        let paramIndex = 4;

        // Distance filter (using PostGIS)
        whereConditions.push(`
          ST_DWithin(
            ST_SetSRID(ST_MakePoint(pr.lng, pr.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
            $3 * 1609.34
          )
        `);

        // Same vintage filter
        if (sameVintage === 'true' && deal.year_built) {
          const yearBuilt = parseInt(deal.year_built);
          const minYear = yearBuilt - 5;
          const maxYear = yearBuilt + 5;
          whereConditions.push(`pr.year_built::integer BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
          queryParams.push(minYear, maxYear);
          paramIndex += 2;
        }

        // Similar size filter
        if (similarSize === 'true' && deal.units) {
          const minUnits = Math.floor(deal.units * 0.8);
          const maxUnits = Math.ceil(deal.units * 1.2);
          whereConditions.push(`pr.units BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
          queryParams.push(minUnits, maxUnits);
          paramIndex += 2;
        }

        // Same class filter
        if (sameClass === 'true' && deal.property_class) {
          whereConditions.push(`pr.property_class = $${paramIndex}`);
          queryParams.push(deal.property_class);
          paramIndex += 1;
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
            pr.lat,
            pr.lng,
            ST_Distance(
              ST_SetSRID(ST_MakePoint(pr.lng, pr.lat), 4326)::geography,
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

      const client = await getClient();
      try {
        // Get deal details (extract centroid from boundary polygon)
        const dealResult = await client.query(
          `SELECT 
             ST_Y(ST_Centroid(boundary::geometry)) as latitude,
             ST_X(ST_Centroid(boundary::geometry)) as longitude,
             target_units as units,
             EXTRACT(YEAR FROM created_at)::text as year_built
           FROM deals WHERE id = $1`,
          [dealId]
        );

        if (dealResult.rows.length === 0) {
          throw new AppError(404, 'Deal not found');
        }

        const deal = dealResult.rows[0];
        const currentYear = new Date().getFullYear();
        const dealAge = deal.year_built ? currentYear - parseInt(deal.year_built) : 0;

        // Find top 3 nearest competitors
        const competitorsQuery = `
          SELECT 
            pr.id,
            pr.address as name,
            pr.units,
            pr.year_built,
            ST_Distance(
              ST_SetSRID(ST_MakePoint(pr.lng, pr.lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
            ) / 1609.34 as distance
          FROM property_records pr
          WHERE 
            pr.units > 0
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(pr.lng, pr.lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
              1.5 * 1609.34
            )
          ORDER BY distance
          LIMIT 3
        `;

        const competitorsResult = await client.query(competitorsQuery, [
          deal.latitude,
          deal.longitude,
        ]);

        const competitors = competitorsResult.rows.map((row) => ({
          id: `comp-${row.id}`,
          name: row.name || `Property ${row.id}`,
          yearBuilt: parseInt(row.year_built || '2000'),
          units: row.units,
        }));

        // Analyze competitive features based on property age and characteristics
        const features = [];
        const keyDifferentiators = [];

        // Modern amenities advantage (properties < 5 years old)
        if (dealAge < 5) {
          const hasCoworking = Math.random() > 0.7;
          const competitorCoworking: any = {};
          competitors.forEach((comp) => {
            const compAge = currentYear - comp.yearBuilt;
            competitorCoworking[comp.id] = compAge < 3 && Math.random() > 0.5;
          });

          features.push({
            name: 'Coworking Space',
            you: hasCoworking,
            competitors: competitorCoworking,
            advantagePoints: hasCoworking && !Object.values(competitorCoworking).some(v => v) ? 2 : 0,
          });

          if (hasCoworking && !Object.values(competitorCoworking).some(v => v)) {
            keyDifferentiators.push('Coworking Space');
          }
        }

        // EV Charging (newer properties have advantage)
        const hasEVCharging = dealAge < 3;
        const competitorEV: any = {};
        competitors.forEach((comp) => {
          const compAge = currentYear - comp.yearBuilt;
          competitorEV[comp.id] = compAge < 2;
        });

        features.push({
          name: 'EV Charging',
          you: hasEVCharging,
          competitors: competitorEV,
          advantagePoints: hasEVCharging && !Object.values(competitorEV).some(v => v) ? 3 : 0,
        });

        if (hasEVCharging && !Object.values(competitorEV).some(v => v)) {
          keyDifferentiators.push('EV Charging');
        }

        // Smart Home Tech (very new properties)
        const hasSmartHome = dealAge < 2;
        const competitorSmart: any = {};
        competitors.forEach((comp) => {
          const compAge = currentYear - comp.yearBuilt;
          competitorSmart[comp.id] = compAge < 1;
        });

        features.push({
          name: 'Smart Home Tech',
          you: hasSmartHome,
          competitors: competitorSmart,
          advantagePoints: hasSmartHome && !Object.values(competitorSmart).some(v => v) ? 3 : 0,
        });

        if (hasSmartHome && !Object.values(competitorSmart).some(v => v)) {
          keyDifferentiators.push('Smart Home Tech');
        }

        // Calculate overall score
        const totalAdvantagePoints = features.reduce((sum, f) => sum + f.advantagePoints, 0);
        const overallScore = Math.min(10, Math.max(1, 5 + totalAdvantagePoints));

        const matrix = {
          overallScore: Math.round(overallScore),
          competitors: competitors.map(c => ({ id: c.id, name: c.name })),
          features,
          keyDifferentiators,
        };

        res.json({
          success: true,
          matrix,
        });
      } finally {
        client.release();
      }
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

      const client = await getClient();
      try {
        // Get deal location (extract centroid from boundary polygon)
        const dealResult = await client.query(
          `SELECT 
             ST_Y(ST_Centroid(boundary::geometry)) as latitude,
             ST_X(ST_Centroid(boundary::geometry)) as longitude
           FROM deals WHERE id = $1`,
          [dealId]
        );

        if (dealResult.rows.length === 0) {
          throw new AppError(404, 'Deal not found');
        }

        const deal = dealResult.rows[0];
        const currentYear = new Date().getFullYear();

        // Find high-quality, newer properties (likely high occupancy)
        // Properties built within last 10 years, larger buildings
        const query = `
          SELECT 
            pr.id,
            pr.address as name,
            pr.units,
            pr.year_built,
            pr.appraised_value,
            ST_Distance(
              ST_SetSRID(ST_MakePoint(pr.lng, pr.lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
            ) / 1609.34 as distance
          FROM property_records pr
          WHERE 
            pr.year_built::integer >= $3
            AND pr.units >= 100
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(pr.lng, pr.lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
              $4 * 1609.34
            )
          ORDER BY distance, pr.year_built::integer DESC
          LIMIT 10
        `;

        const result = await client.query(query, [
          deal.latitude,
          deal.longitude,
          currentYear - 10,
          radius,
        ]);

        const properties = result.rows.map((row) => {
          const age = currentYear - parseInt(row.year_built);
          const occupancy = estimateOccupancy(row.year_built);
          const avgRent = estimateRent(row);
          
          // Estimate waitlist metrics based on property characteristics
          const isHighDemand = occupancy >= 95 && age <= 5;
          const waitlistCount = isHighDemand ? Math.floor(row.units * 0.12) : 0;
          const avgWaitTime = waitlistCount > 30 ? '3-4 months' : 
                             waitlistCount > 15 ? '2-3 months' : 
                             waitlistCount > 0 ? '1-2 months' : 'No waitlist';
          
          // Generate demand note based on property characteristics
          let demandNote = '';
          if (age <= 3) {
            demandNote = 'New construction with high demand. Strong amenity package.';
          } else if (row.units > 250) {
            demandNote = 'Large property with consistent demand. Diverse unit mix.';
          } else {
            demandNote = 'Stable occupancy. Located in desirable area.';
          }

          return {
            id: `wait-${row.id}`,
            name: row.name || row.address,
            units: row.units,
            distance: parseFloat(row.distance).toFixed(1),
            occupancy: Math.round(occupancy),
            waitlistCount,
            avgRent,
            avgWaitTime,
            demandNote,
          };
        }).filter(p => p.waitlistCount > 0); // Only return properties with estimated waitlists

        res.json({
          success: true,
          properties,
          totalFound: properties.length,
        });
      } finally {
        client.release();
      }
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
        // Get deal location (extract centroid from boundary polygon)
        const dealResult = await client.query(
          `SELECT 
             ST_Y(ST_Centroid(boundary::geometry)) as latitude,
             ST_X(ST_Centroid(boundary::geometry)) as longitude
           FROM deals WHERE id = $1`,
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
            pr.lat,
            pr.lng,
            ST_Distance(
              ST_SetSRID(ST_MakePoint(pr.lng, pr.lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
            ) / 1609.34 as distance
          FROM property_records pr
          WHERE 
            pr.year_built::integer <= $3
            AND pr.units > 50
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(pr.lng, pr.lat), 4326)::geography,
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

      const client = await getClient();
      try {
        // Get deal details (extract centroid from boundary polygon)
        const dealResult = await client.query(
          `SELECT 
             ST_Y(ST_Centroid(boundary::geometry)) as latitude,
             ST_X(ST_Centroid(boundary::geometry)) as longitude,
             target_units as units,
             EXTRACT(YEAR FROM created_at)::text as year_built
           FROM deals WHERE id = $1`,
          [dealId]
        );

        if (dealResult.rows.length === 0) {
          throw new AppError(404, 'Deal not found');
        }

        const deal = dealResult.rows[0];
        const currentYear = new Date().getFullYear();
        const dealAge = deal.year_built ? currentYear - parseInt(deal.year_built) : 0;

        // Analyze nearby competitors
        const competitorQuery = `
          SELECT 
            pr.year_built,
            pr.units,
            pr.appraised_value,
            ST_Distance(
              ST_SetSRID(ST_MakePoint(pr.lng, pr.lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
            ) / 1609.34 as distance
          FROM property_records pr
          WHERE 
            pr.units > 0
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(pr.lng, pr.lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
              1.0 * 1609.34
            )
          ORDER BY distance
          LIMIT 20
        `;

        const competitorsResult = await client.query(competitorQuery, [
          deal.latitude,
          deal.longitude,
        ]);

        // Calculate competitive metrics
        const competitors = competitorsResult.rows;
        const avgCompetitorAge = competitors.reduce(
          (sum, c) => sum + (currentYear - parseInt(c.year_built || '2000')), 
          0
        ) / Math.max(competitors.length, 1);

        const avgCompetitorUnits = competitors.reduce(
          (sum, c) => sum + (c.units || 0), 
          0
        ) / Math.max(competitors.length, 1);

        const avgCompetitorRent = competitors.reduce(
          (sum, c) => sum + estimateRent(c), 
          0
        ) / Math.max(competitors.length, 1);

        const newerPropertyCount = competitors.filter(
          c => (currentYear - parseInt(c.year_built || '2000')) < 5
        ).length;

        const olderPropertyCount = competitors.filter(
          c => (currentYear - parseInt(c.year_built || '2000')) > 15
        ).length;

        // Generate data-driven insights
        let insights = '💡 Based on competition analysis:\n\n';

        // Age-based insights
        if (dealAge < 5 && newerPropertyCount < 3) {
          insights += '• Limited new construction in area - strong differentiation opportunity\n';
          insights += '• Position as premium modern option with latest amenities\n';
        } else if (dealAge < avgCompetitorAge) {
          insights += `• Your property is ${Math.round(avgCompetitorAge - dealAge)} years newer than average - highlight modern features\n`;
        }

        // Size-based insights
        if (deal.units < avgCompetitorUnits * 0.8) {
          insights += `• Smaller building (${deal.units} vs ${Math.round(avgCompetitorUnits)} avg) - emphasize boutique, personalized experience\n`;
        } else if (deal.units > avgCompetitorUnits * 1.2) {
          insights += `• Larger building provides economies of scale - more amenity options\n`;
        }

        // Rent positioning
        insights += `• Target rent range: $${Math.round(avgCompetitorRent * 0.95)}-$${Math.round(avgCompetitorRent * 1.15)}/mo based on ${competitors.length} nearby properties\n`;

        // Aging competitor opportunities
        if (olderPropertyCount > 5) {
          insights += `• ${olderPropertyCount} aging properties (15+ years) in area - capture tenants seeking modern units\n`;
        }

        // Strategic recommendations
        if (dealAge < 3) {
          insights += '• Emphasize smart home technology and sustainable features as key differentiators\n';
          insights += '• Consider EV charging infrastructure for future-proof appeal\n';
        }

        insights += `\nCompetitive landscape: ${competitors.length} properties analyzed within 1 mile radius.`;

        res.json({
          success: true,
          insights,
          generatedAt: new Date().toISOString(),
        });
      } finally {
        client.release();
      }
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
      const { radius = 1.0 } = req.query;

      logger.info('Exporting competition analysis', {
        dealId,
        radius,
        userId: req.user?.userId,
      });

      const client = await getClient();
      try {
        // Get deal location (extract centroid from boundary polygon)
        const dealResult = await client.query(
          `SELECT 
             ST_Y(ST_Centroid(boundary::geometry)) as latitude,
             ST_X(ST_Centroid(boundary::geometry)) as longitude
           FROM deals WHERE id = $1`,
          [dealId]
        );

        if (dealResult.rows.length === 0) {
          throw new AppError(404, 'Deal not found');
        }

        const deal = dealResult.rows[0];

        // Get all competitors within radius
        const query = `
          SELECT 
            pr.id,
            pr.address,
            pr.units,
            pr.year_built,
            pr.owner_name,
            pr.appraised_value,
            pr.property_class,
            ST_Distance(
              ST_SetSRID(ST_MakePoint(pr.lng, pr.lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
            ) / 1609.34 as distance
          FROM property_records pr
          WHERE 
            pr.units > 0
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(pr.lng, pr.lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
              $3 * 1609.34
            )
          ORDER BY distance
          LIMIT 50
        `;

        const result = await client.query(query, [
          deal.latitude,
          deal.longitude,
          radius,
        ]);

        // Generate CSV
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="competition-analysis-${dealId}.csv"`
        );

        // CSV Header
        let csvData = 'Property,Address,Units,Distance (mi),Avg Rent,Occupancy %,Year Built,Age,Class,Owner,Appraised Value\n';

        // CSV Rows
        result.rows.forEach((row) => {
          const currentYear = new Date().getFullYear();
          const age = currentYear - parseInt(row.year_built || '2000');
          const avgRent = estimateRent(row);
          const occupancy = Math.round(estimateOccupancy(row.year_built));
          const propertyClass = row.property_class || 'B';
          
          // Escape CSV fields with commas or quotes
          const escapeCsvField = (field: any) => {
            if (field === null || field === undefined) return '';
            const str = String(field);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          };

          csvData += [
            escapeCsvField(row.address || `Property ${row.id}`),
            escapeCsvField(row.address),
            row.units,
            parseFloat(row.distance).toFixed(2),
            avgRent,
            occupancy,
            row.year_built,
            age,
            propertyClass,
            escapeCsvField(row.owner_name || 'N/A'),
            row.appraised_value ? `$${row.appraised_value.toLocaleString()}` : 'N/A',
          ].join(',') + '\n';
        });

        res.send(csvData);
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error exporting competition analysis', { error });
      next(error);
    }
  }
);

/**
 * GET /api/v1/deals/:dealId/competitive-ranking
 * 
 * Rank the subject property's Program against nearby competitors.
 * Pulls the saved unit mix program from deal_unit_programs and
 * merges it into the competitor list with a rank position.
 */
router.get(
  '/:dealId/competitive-ranking',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { dealId } = req.params;
      logger.info('Generating competitive ranking', {
        dealId,
        userId: req.user?.userId,
      });

      const client = await getClient();
      try {
        const dealResult = await client.query(
          `SELECT 
             d.id,
             d.address,
             d.target_units,
             ST_Y(ST_Centroid(d.boundary::geometry)) as latitude,
             ST_X(ST_Centroid(d.boundary::geometry)) as longitude,
             dup.total_units as program_units,
             dup.unit_config,
             dup.total_net_sf,
             dup.gross_rev_pa,
             dup.updated_at as program_updated_at
           FROM deals d
           LEFT JOIN deal_unit_programs dup ON dup.deal_id = d.id
           WHERE d.id = $1`,
          [dealId]
        );

        if (dealResult.rows.length === 0) {
          throw new AppError(404, 'Deal not found');
        }

        const deal = dealResult.rows[0];

        if (!deal.latitude || !deal.longitude) {
          throw new AppError(400, 'Deal location not set - boundary polygon missing');
        }

        const hasProgram = !!deal.unit_config;
        let subjectEntry: any = null;

        if (hasProgram) {
          const unitConfig = typeof deal.unit_config === 'string'
            ? JSON.parse(deal.unit_config)
            : deal.unit_config;
          const totalUnits = deal.program_units || deal.target_units || 0;

          let weightedRent = 0;
          let weightedSf = 0;
          let totalMix = 0;

          for (const [, cfg] of Object.entries(unitConfig) as [string, any][]) {
            const mix = cfg.mix || 0;
            weightedRent += cfg.rent * mix;
            weightedSf += cfg.sf * mix;
            totalMix += mix;
          }

          const avgRent = totalMix > 0 ? Math.round(weightedRent / totalMix) : 0;
          const avgSf = totalMix > 0 ? Math.round(weightedSf / totalMix) : 0;

          subjectEntry = {
            id: deal.id,
            name: deal.address || 'Your Program',
            address: deal.address || '',
            distance: 0,
            units: totalUnits,
            yearBuilt: new Date().getFullYear(),
            class: 'A',
            avgRent,
            avgSf,
            rentPerSf: avgSf > 0 ? parseFloat((avgRent / avgSf).toFixed(2)) : 0,
            occupancy: null,
            isSubject: true,
            unitConfig,
            totalNetSf: parseInt(deal.total_net_sf) || 0,
            grossRevPA: parseFloat(deal.gross_rev_pa) || 0,
            programUpdatedAt: deal.program_updated_at,
          };
        }

        let compEntries: any[] = [];

        const unitMixComps = await client.query(
          `SELECT cp.id, cp.name, cp.class, cp.built_year, cp.total_units,
                  cut.unit_type, cut.mix_pct, cut.avg_sf, cut.avg_rent, cut.vacancy_pct
           FROM comp_properties cp
           LEFT JOIN comp_unit_types cut ON cut.comp_id = cp.id
           WHERE cp.deal_id = $1 AND cp.is_subject = false
           ORDER BY cp.name`,
          [dealId]
        );

        if (unitMixComps.rows.length > 0) {
          const compMap = new Map<string, any>();
          for (const row of unitMixComps.rows) {
            if (!compMap.has(row.id)) {
              compMap.set(row.id, {
                id: row.id,
                name: row.name || 'Unknown',
                address: '',
                distance: null,
                units: row.total_units || 0,
                yearBuilt: row.built_year || 2000,
                class: row.class || 'B',
                isSubject: false,
                unitTypes: [],
              });
            }
            if (row.unit_type) {
              compMap.get(row.id).unitTypes.push({
                mix: parseFloat(row.mix_pct) || 0,
                sf: parseFloat(row.avg_sf) || 0,
                rent: parseFloat(row.avg_rent) || 0,
                vac: parseFloat(row.vacancy_pct) || 0,
              });
            }
          }

          for (const [, comp] of compMap) {
            let wRent = 0, wSf = 0, totalMix = 0;
            for (const ut of comp.unitTypes) {
              wRent += ut.rent * ut.mix;
              wSf += ut.sf * ut.mix;
              totalMix += ut.mix;
            }
            const avgRent = totalMix > 0 ? Math.round(wRent / totalMix) : estimateRent({ year_built: comp.yearBuilt });
            const avgSf = totalMix > 0 ? Math.round(wSf / totalMix) : estimateAvgSf(String(comp.yearBuilt), comp.units);
            const avgVac = comp.unitTypes.length > 0
              ? comp.unitTypes.reduce((s: number, u: any) => s + u.vac, 0) / comp.unitTypes.length
              : null;

            compEntries.push({
              id: comp.id,
              name: comp.name,
              address: comp.address,
              distance: comp.distance,
              units: comp.units,
              yearBuilt: comp.yearBuilt,
              class: comp.class,
              avgRent,
              avgSf,
              rentPerSf: avgSf > 0 ? parseFloat((avgRent / avgSf).toFixed(2)) : 0,
              occupancy: avgVac !== null ? Math.round(100 - avgVac) : Math.round(estimateOccupancy(String(comp.yearBuilt))),
              isSubject: false,
            });
          }
        }

        if (compEntries.length === 0) {
          try {
            const prResult = await client.query(
              `SELECT pr.id, pr.address, pr.units, pr.year_built, pr.appraised_value
               FROM property_records pr
               WHERE pr.units > 0
                 AND pr.city = (SELECT city FROM property_records WHERE address ILIKE '%' || $1 || '%' LIMIT 1)
               ORDER BY pr.units DESC
               LIMIT 20`,
              [deal.address ? deal.address.split(',')[0].trim() : '']
            );

            compEntries = prResult.rows.map((row) => {
              const avgRent = estimateRent(row);
              const avgSf = estimateAvgSf(row.year_built, row.units);
              return {
                id: row.id,
                name: row.address || 'Unknown',
                address: row.address,
                distance: null,
                units: row.units,
                yearBuilt: parseInt(row.year_built) || 2000,
                class: determineClass(row.year_built, row.appraised_value, row.units),
                avgRent,
                avgSf,
                rentPerSf: avgSf > 0 ? parseFloat((avgRent / avgSf).toFixed(2)) : 0,
                occupancy: Math.round(estimateOccupancy(row.year_built)),
                isSubject: false,
              };
            });
          } catch (fallbackErr) {
            logger.warn('Fallback property query failed', { fallbackErr });
          }
        }

        const allEntries = subjectEntry
          ? [subjectEntry, ...compEntries]
          : compEntries;

        allEntries.sort((a, b) => b.avgRent - a.avgRent);

        const ranked = allEntries.map((entry, idx) => ({
          ...entry,
          rank: idx + 1,
        }));

        const subjectRanked = ranked.find(e => e.isSubject);
        const compOnlyRents = compEntries.map(c => c.avgRent);
        const marketAvgRent = compOnlyRents.length > 0
          ? Math.round(compOnlyRents.reduce((s, r) => s + r, 0) / compOnlyRents.length)
          : 0;

        let summary: any = {
          totalProperties: ranked.length,
          marketAvgRent,
          hasProgram,
        };

        if (subjectRanked && hasProgram) {
          const rentDelta = subjectRanked.avgRent - marketAvgRent;
          const rentPremiumPct = marketAvgRent > 0
            ? parseFloat(((rentDelta / marketAvgRent) * 100).toFixed(1))
            : 0;
          const percentile = Math.round(
            ((ranked.length - subjectRanked.rank) / Math.max(ranked.length - 1, 1)) * 100
          );

          summary = {
            ...summary,
            subjectRank: subjectRanked.rank,
            rentDelta,
            rentPremiumPct,
            percentile,
            subjectAvgRent: subjectRanked.avgRent,
            subjectAvgSf: subjectRanked.avgSf,
            subjectRentPerSf: subjectRanked.rentPerSf,
          };
        }

        res.json({
          success: true,
          rankings: ranked,
          summary,
        });
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error generating competitive ranking', { error, dealId: req.params.dealId });
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
 * Estimate average SF per unit based on vintage and size
 */
function estimateAvgSf(yearBuilt: string, units: number): number {
  const year = parseInt(yearBuilt || '2000');
  const age = new Date().getFullYear() - year;

  let baseSf = 900;
  if (age < 5) baseSf = 950;
  else if (age < 15) baseSf = 880;
  else baseSf = 820;

  if (units > 200) baseSf -= 50;
  else if (units < 50) baseSf += 80;

  return Math.round(baseSf);
}

/**
 * Determine property class from age and value
 */
function determineClass(yearBuilt: string, appraisedValue: number, units: number): string {
  const year = parseInt(yearBuilt || '2000');
  const age = new Date().getFullYear() - year;
  const ppu = (appraisedValue && units) ? appraisedValue / units : 0;

  if (age < 5 || ppu > 200000) return 'A';
  if (age < 15 || ppu > 100000) return 'B';
  return 'C';
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
