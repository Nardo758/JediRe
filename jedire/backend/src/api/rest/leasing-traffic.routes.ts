/**
 * Leasing Traffic Prediction API Routes
 * 
 * REST endpoints for multifamily leasing traffic predictions
 * 
 * @version 1.0.0
 * @date 2025-02-18
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../database';
import { MultifamilyTrafficService, PropertyLeasingInput } from '../../services/multifamilyTrafficService';

const router = Router();
const trafficService = new MultifamilyTrafficService(pool);

  /**
   * GET /api/leasing-traffic/predict/:propertyId
   * 
   * Get weekly leasing traffic prediction for a single property
   * 
   * Returns: LeasingPrediction with traffic, tours, leases, and breakdown
   */
  router.get('/predict/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;

      // Fetch property data from database
      const propertyResult = await pool.query(
        `SELECT 
          id,
          units,
          current_occupancy as occupancy,
          submarket_id,
          avg_rent,
          market_rent
         FROM properties
         WHERE id = $1`,
        [propertyId]
      );

      if (propertyResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Property not found',
          property_id: propertyId
        });
      }

      const property = propertyResult.rows[0];

      // Validate required fields
      if (!property.units || !property.submarket_id) {
        return res.status(400).json({
          error: 'Property missing required fields (units, submarket_id)',
          property_id: propertyId
        });
      }

      // Set defaults for missing data
      const propertyInput: PropertyLeasingInput = {
        units: property.units,
        occupancy: property.occupancy || 0.90,
        submarket_id: property.submarket_id,
        avg_rent: property.avg_rent || property.market_rent || 1500,
        market_rent: property.market_rent || property.avg_rent || 1500
      };

      // Get prediction
      const prediction = await trafficService.predictWeeklyLeasingTraffic(propertyInput);

      // Log prediction to database for tracking
      await pool.query(
        `INSERT INTO leasing_traffic_predictions (
          property_id,
          prediction_date,
          weekly_traffic,
          weekly_tours,
          expected_leases,
          confidence,
          prediction_details
        ) VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
        [
          propertyId,
          prediction.weekly_traffic,
          prediction.weekly_tours,
          prediction.expected_leases,
          prediction.confidence,
          JSON.stringify(prediction)
        ]
      );

      res.json({
        property_id: propertyId,
        property_name: property.property_name || 'Unknown',
        prediction,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[LeasingTrafficRoutes] Error in /predict:', error);
      res.status(500).json({
        error: 'Failed to generate prediction',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/leasing-traffic/forecast/:propertyId
   * 
   * Get multi-week leasing forecast
   * 
   * Query params:
   * - weeks: Number of weeks to forecast (default: 12)
   * 
   * Returns: MonthlyAbsorptionForecast with week-by-week projections
   */
  router.get('/forecast/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const weeks = parseInt(req.query.weeks as string) || 12;

      if (weeks < 1 || weeks > 52) {
        return res.status(400).json({
          error: 'Weeks parameter must be between 1 and 52',
          provided: weeks
        });
      }

      // Fetch property data
      const propertyResult = await pool.query(
        `SELECT 
          id,
          units,
          current_occupancy as occupancy,
          submarket_id,
          avg_rent,
          market_rent
         FROM properties
         WHERE id = $1`,
        [propertyId]
      );

      if (propertyResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Property not found',
          property_id: propertyId
        });
      }

      const property = propertyResult.rows[0];

      const propertyInput: PropertyLeasingInput = {
        units: property.units,
        occupancy: property.occupancy || 0.90,
        submarket_id: property.submarket_id,
        avg_rent: property.avg_rent || property.market_rent || 1500,
        market_rent: property.market_rent || property.avg_rent || 1500
      };

      // Get forecast
      const forecast = await trafficService.predictMonthlyAbsorption(propertyInput, weeks);

      res.json({
        property_id: propertyId,
        forecast_weeks: weeks,
        forecast,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[LeasingTrafficRoutes] Error in /forecast:', error);
      res.status(500).json({
        error: 'Failed to generate forecast',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/leasing-traffic/lease-up-timeline
   * 
   * Calculate lease-up timeline for new construction or repositioning
   * 
   * Body:
   * {
   *   property_id: string,
   *   total_units: number,
   *   start_occupancy: number,
   *   target_occupancy: number,
   *   submarket_id: string,
   *   avg_rent: number,
   *   market_rent: number
   * }
   * 
   * Returns: LeaseUpTimeline with week-by-week projections and completion date
   */
  router.post('/lease-up-timeline', async (req: Request, res: Response) => {
    try {
      const {
        property_id,
        total_units,
        start_occupancy,
        target_occupancy,
        submarket_id,
        avg_rent,
        market_rent
      } = req.body;

      // Validate required fields
      if (!property_id || !total_units || start_occupancy === undefined || 
          target_occupancy === undefined || !submarket_id) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['property_id', 'total_units', 'start_occupancy', 'target_occupancy', 'submarket_id']
        });
      }

      // Validate ranges
      if (start_occupancy < 0 || start_occupancy > 1 || 
          target_occupancy < 0 || target_occupancy > 1) {
        return res.status(400).json({
          error: 'Occupancy must be between 0 and 1',
          start_occupancy,
          target_occupancy
        });
      }

      if (target_occupancy <= start_occupancy) {
        return res.status(400).json({
          error: 'Target occupancy must be greater than start occupancy',
          start_occupancy,
          target_occupancy
        });
      }

      // Calculate lease-up timeline
      const timeline = await trafficService.calculateLeaseUpTimeline(
        property_id,
        total_units,
        start_occupancy,
        target_occupancy,
        submarket_id,
        avg_rent || market_rent || 1500,
        market_rent || avg_rent || 1500
      );

      // Save timeline to database
      await pool.query(
        `INSERT INTO lease_up_timelines (
          property_id,
          total_units,
          start_occupancy,
          target_occupancy,
          estimated_weeks,
          estimated_completion_date,
          timeline_details,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          property_id,
          total_units,
          start_occupancy,
          target_occupancy,
          timeline.estimated_weeks,
          timeline.estimated_completion_date,
          JSON.stringify(timeline)
        ]
      );

      res.json({
        timeline,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[LeasingTrafficRoutes] Error in /lease-up-timeline:', error);
      res.status(500).json({
        error: 'Failed to calculate lease-up timeline',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/leasing-traffic/optimize-rent/:propertyId
   * 
   * Analyze rent vs absorption velocity tradeoff
   * 
   * Query params:
   * - target_months: Target months to stabilization (optional)
   * 
   * Returns: RentOptimizationResult with scenarios and recommendation
   */
  router.get('/optimize-rent/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const targetMonths = req.query.target_months 
        ? parseInt(req.query.target_months as string) 
        : undefined;

      // Fetch property data
      const propertyResult = await pool.query(
        `SELECT 
          id,
          units,
          current_occupancy as occupancy,
          submarket_id,
          avg_rent,
          market_rent
         FROM properties
         WHERE id = $1`,
        [propertyId]
      );

      if (propertyResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Property not found',
          property_id: propertyId
        });
      }

      const property = propertyResult.rows[0];

      const propertyInput: PropertyLeasingInput = {
        units: property.units,
        occupancy: property.occupancy || 0.90,
        submarket_id: property.submarket_id,
        avg_rent: property.avg_rent || property.market_rent || 1500,
        market_rent: property.market_rent || property.avg_rent || 1500
      };

      // Get optimization analysis
      const optimization = await trafficService.optimizeRentForVelocity(
        propertyId,
        propertyInput,
        targetMonths
      );

      res.json({
        property_id: propertyId,
        optimization,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[LeasingTrafficRoutes] Error in /optimize-rent:', error);
      res.status(500).json({
        error: 'Failed to optimize rent',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/leasing-traffic/historical/:propertyId
   * 
   * Get historical prediction accuracy for a property
   * 
   * Query params:
   * - days: Number of days to look back (default: 30)
   * 
   * Returns: Historical predictions with actual vs predicted comparison
   */
  router.get('/historical/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      const result = await pool.query(
        `SELECT 
          prediction_date,
          weekly_traffic,
          weekly_tours,
          expected_leases,
          confidence,
          prediction_details
         FROM leasing_traffic_predictions
         WHERE property_id = $1
           AND prediction_date >= NOW() - INTERVAL '${days} days'
         ORDER BY prediction_date DESC`,
        [propertyId]
      );

      res.json({
        property_id: propertyId,
        days_back: days,
        predictions: result.rows,
        count: result.rows.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[LeasingTrafficRoutes] Error in /historical:', error);
      res.status(500).json({
        error: 'Failed to fetch historical data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

export default router;
