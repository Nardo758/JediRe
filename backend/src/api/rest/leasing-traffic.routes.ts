/**
 * Leasing Traffic Prediction API Routes
 * 
 * REST endpoints for multifamily leasing traffic predictions
 * 
 * @version 1.0.0
 * @date 2025-02-18
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { pool } from '../../database';
import { MultifamilyTrafficService, PropertyLeasingInput } from '../../services/multifamilyTrafficService';
import { weeklyReportParser } from '../../services/weekly-report-parser.service';
import { demandSignalService } from '../../services/demand-signal.service';
import { supplySignalService } from '../../services/supply-signal.service';
import { DigitalTrafficService } from '../../services/digitalTrafficService';
import { trafficCalibrationService } from '../../services/traffic-calibration.service';
import trafficPredictionEngine from '../../services/trafficPredictionEngine';
import { getDotTemporalProfilesService } from '../../services/dot-temporal-profiles.service';
import { TrafficDataSourcesService } from '../../services/traffic-data-sources.service';
import { trendPatternDetector } from '../../services/trend-pattern-detector';
import { visibilityScoringService } from '../../services/visibility-scoring.service';
import { logger } from '../../utils/logger';

const router = Router();
const trafficService = new MultifamilyTrafficService(pool);
const digitalTrafficService = new DigitalTrafficService(pool);

const weeklyUpload = multer({
  dest: path.join(process.cwd(), 'uploads', 'weekly-reports'),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

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

  router.post('/weekly-report/upload', weeklyUpload.single('file'), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      const dealId = req.body.dealId;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      if (!dealId) {
        return res.status(400).json({ error: 'dealId is required' });
      }

      const result = await weeklyReportParser.parseAndStore(file.path, dealId);

      res.json({
        success: true,
        count: result.count,
        message: `Parsed ${result.count} weekly snapshots`,
        latestWeek: result.snapshots.length > 0
          ? result.snapshots[result.snapshots.length - 1].week_ending
          : null,
      });
    } catch (error: any) {
      logger.error('[LeasingTraffic] Weekly report upload failed', { error: error.message });
      res.status(500).json({
        error: 'Failed to parse weekly report',
        message: error.message,
      });
    }
  });

  router.get('/weekly-report/:dealId/history', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const snapshots = await weeklyReportParser.getHistory(dealId);
      res.json({ dealId, count: snapshots.length, snapshots });
    } catch (error: any) {
      logger.error('[LeasingTraffic] History fetch failed', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch history', message: error.message });
    }
  });

  router.get('/weekly-report/:dealId/projection', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const view = (req.query.view as string) || 'yearly';
      if (!['weekly', 'monthly', 'yearly'].includes(view)) {
        return res.status(400).json({ error: 'view must be weekly, monthly, or yearly' });
      }

      let marketFactors: { demand?: number; supply?: number; digital?: number } = {};
      let propertyData: any = {};
      let calibrationData: any = undefined;

      try {
        const dealResult = await pool.query(
          `SELECT d.target_units, d.project_type, d.address, d.budget,
                  d.trade_area_id, d.deal_data
           FROM deals d WHERE d.id = $1`,
          [dealId]
        );
        if (dealResult.rows.length > 0) {
          const deal = dealResult.rows[0];
          const dealData = deal.deal_data || {};
          propertyData.units = deal.target_units || dealData.units;
          propertyData.propertyType = deal.project_type;
          propertyData.occupancy = dealData.occupancy || dealData.current_occupancy;
          propertyData.avgRent = dealData.avg_rent || dealData.avgRent;
          propertyData.marketRent = dealData.market_rent || dealData.marketRent;

          const tradeAreaId = deal.trade_area_id;
          if (tradeAreaId) {
            try {
              const taResult = await pool.query(
                `SELECT submarket_id, msa_id FROM trade_areas WHERE id = $1`,
                [tradeAreaId]
              );
              if (taResult.rows.length > 0) {
                propertyData.submarketId = taResult.rows[0].submarket_id;
              }
            } catch (e) {
              logger.debug('[LeasingTraffic] Trade area lookup skipped');
            }
          }

          const subId = propertyData.submarketId;
          if (subId) {
            try {
              const now = new Date();
              const quarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
              const forecast = await demandSignalService.getTradeAreaForecast(subId, quarter, quarter);
              if (forecast && forecast.length > 0) {
                const score = forecast[0].supplyPressureScore || 0;
                marketFactors.demand = 1 + Math.min(0.15, score * 0.01);
              }
            } catch (e) {
              logger.debug('[LeasingTraffic] Demand signal fetch skipped');
            }

            try {
              const risk = await supplySignalService.calculateSupplyRisk(Number(subId), '');
              if (risk) {
                marketFactors.supply = Math.max(0.85, 1 - (risk.supplyRiskScore || 0) * 0.005);
              }
            } catch (e) {
              logger.debug('[LeasingTraffic] Supply signal fetch skipped');
            }

            try {
              const calResult = await pool.query(
                `SELECT avg_traffic_per_unit, avg_closing_ratio, avg_tour_conversion,
                        seasonal_factors, website_pct, sample_count
                 FROM traffic_submarket_calibration
                 WHERE submarket_id = $1
                 ORDER BY sample_count DESC LIMIT 1`,
                [subId]
              );
              if (calResult.rows.length > 0) {
                const cal = calResult.rows[0];
                let parsedSeasonal: number[] | undefined;
                if (cal.seasonal_factors) {
                  const raw = typeof cal.seasonal_factors === 'string'
                    ? JSON.parse(cal.seasonal_factors) : cal.seasonal_factors;
                  if (Array.isArray(raw) && raw.length === 12) {
                    parsedSeasonal = raw.map(Number);
                  }
                }
                calibrationData = {
                  avgTrafficPerUnit: cal.avg_traffic_per_unit ? Number(cal.avg_traffic_per_unit) : undefined,
                  avgClosingRatio: cal.avg_closing_ratio ? Number(cal.avg_closing_ratio) : undefined,
                  avgTourConversion: cal.avg_tour_conversion ? Number(cal.avg_tour_conversion) : undefined,
                  seasonalFactors: parsedSeasonal,
                  websitePct: cal.website_pct ? Number(cal.website_pct) : undefined,
                  sampleCount: cal.sample_count,
                };
              }
            } catch (e) {
              logger.debug('[LeasingTraffic] Calibration data fetch skipped');
            }
          }

          try {
            const propResult = await pool.query(
              `SELECT id FROM properties WHERE deal_id = $1 LIMIT 1`,
              [dealId]
            );
            const propId = propResult.rows[0]?.id;
            if (propId) {
              try {
                const digitalScore = await digitalTrafficService.calculateDigitalScore(propId);
                if (digitalScore) {
                  marketFactors.digital = 1 + Math.min(0.2, (digitalScore.trending_velocity || 0) * 0.01);
                }
              } catch (e) {
                logger.debug('[LeasingTraffic] Digital traffic fetch skipped');
              }
            }
          } catch (e) {
            logger.debug('[LeasingTraffic] Property lookup for digital score skipped');
          }
        }
      } catch (e) {
        logger.debug('[LeasingTraffic] Market factors fetch skipped, using defaults');
      }

      let dataSourceSignals: any = null;
      let tradeAreaWarning: string | undefined;

      try {
        const dealCheck = await pool.query(
          `SELECT d.trade_area_id FROM deals d WHERE d.id = $1`,
          [dealId]
        );
        if (dealCheck.rows.length > 0) {
          const deal = dealCheck.rows[0];
          if (!deal.trade_area_id) {
            tradeAreaWarning = 'Define a trade area to unlock full traffic intelligence (comp proxy, market context, visibility scoring)';
          }
          let propId: string | undefined;
          const dpLookup = await pool.query(
            `SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1`,
            [dealId]
          );
          propId = dpLookup.rows[0]?.property_id;
          if (!propId) {
            const propLookup = await pool.query(
              `SELECT id FROM properties WHERE deal_id = $1 LIMIT 1`,
              [dealId]
            );
            propId = propLookup.rows[0]?.id;
          }
          if (propId) {
            try {
              dataSourceSignals = await trafficPredictionEngine.loadDataSourceSignals(propId);
            } catch (e) {
              logger.debug('[LeasingTraffic] Data source signals fetch skipped');
            }
          }
        }
      } catch (e) {
        logger.debug('[LeasingTraffic] Trade area / data source check skipped');
      }

      const projection = await weeklyReportParser.generateProjection(
        dealId,
        view as 'weekly' | 'monthly' | 'yearly',
        marketFactors,
        propertyData,
        calibrationData
      );

      const response: any = { ...projection };
      if (dataSourceSignals) {
        response.data_sources = dataSourceSignals;
      }
      if (tradeAreaWarning) {
        response.warnings = response.warnings || [];
        response.warnings.push({ type: 'trade_area_missing', message: tradeAreaWarning });
      }

      res.json(response);
    } catch (error: any) {
      logger.error('[LeasingTraffic] Projection failed', { error: error.message });
      res.status(500).json({ error: 'Failed to generate projection', message: error.message });
    }
  });

  router.get('/data-sources/:dealId', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;

      const dealResult = await pool.query(
        `SELECT d.trade_area_id, d.city, d.state_code, d.lot_size_sqft, d.development_type, d.address, d.property_address FROM deals d WHERE d.id = $1`,
        [dealId]
      );

      if (dealResult.rows.length === 0) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      const deal = dealResult.rows[0];
      const warnings: any[] = [];

      if (!deal.trade_area_id) {
        warnings.push({
          type: 'trade_area_missing',
          message: 'Define a trade area to unlock full traffic intelligence',
        });
      }

      let propertyId: string | undefined;
      const dpLookup = await pool.query(
        `SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1`,
        [dealId]
      );
      propertyId = dpLookup.rows[0]?.property_id;
      if (!propertyId) {
        const propLookup = await pool.query(
          `SELECT id FROM properties WHERE deal_id = $1 LIMIT 1`,
          [dealId]
        );
        propertyId = propLookup.rows[0]?.id;
      }

      if (!propertyId) {
        return res.json({
          data_sources: {
            data_quality: { sources_connected: 0, total_sources: 4, confidence_level: 'Low', missing_sources: ['visibility', 'street_traffic', 'website_traffic', 'market_intel'] },
          },
          trade_area_id: deal.trade_area_id,
          warnings,
        });
      }

      const signals = await trafficPredictionEngine.loadDataSourceSignals(propertyId);

      if (!signals.visibility) {
        try {
          const lotSqft = deal.lot_size_sqft ? Number(deal.lot_size_sqft) : 20000;
          const frontageEst = Math.round(Math.sqrt(lotSqft) * 0.7);
          const devType = (deal.development_type || '').toLowerCase();
          const storiesEst = devType.includes('high') ? 10 : devType.includes('mid') ? 5 : 3;
          const autoInput = {
            property_id: propertyId,
            assessment_method: 'auto_estimated',
            assessed_by: 'system',
            frontage_feet: frontageEst,
            setback_feet: 15,
            building_stories: storiesEst,
            sightline_north_feet: 200,
            sightline_south_feet: 200,
            sightline_east_feet: 200,
            sightline_west_feet: 200,
            obstruction_trees_pct: 10,
            obstruction_buildings_pct: 5,
            has_signage: true,
            signage_is_lit: false,
            signage_size_sq_ft: 40,
            signage_visible_from_feet: 200,
            entrance_type: 'main',
            entrance_count: 1,
            glass_to_wall_ratio: 0.2,
            facade_condition: 'good',
          };
          const estimated = await visibilityScoringService.assessProperty(autoInput);
          signals.visibility = {
            overall_score: estimated.overall_visibility_score,
            capture_rate: estimated.capture_rate,
            tier: estimated.visibility_tier,
            is_estimated: true,
            component_scores: {
              positional: estimated.positional_score,
              sightline: estimated.sightline_score,
              setback: estimated.setback_score,
              signage: estimated.signage_score,
              transparency: estimated.transparency_score,
              entrance: estimated.entrance_score,
              obstruction_penalty: estimated.obstruction_penalty,
            },
          } as any;
        } catch (visErr: any) {
          logger.debug('[LeasingTraffic] Auto-visibility estimate skipped', { error: visErr.message });
        }
      }

      let tradeAreaName: string | undefined;
      if (deal.trade_area_id) {
        try {
          const taResult = await pool.query(
            `SELECT name, method FROM trade_areas WHERE id = $1`,
            [deal.trade_area_id]
          );
          if (taResult.rows.length > 0) {
            tradeAreaName = taResult.rows[0].name;
          }
        } catch (_) {}
      }

      res.json({
        data_sources: signals,
        trade_area_id: deal.trade_area_id,
        trade_area_name: tradeAreaName,
        property_id: propertyId,
        warnings,
      });
    } catch (error: any) {
      logger.error('[LeasingTraffic] Data sources fetch failed', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch data sources' });
    }
  });

  router.put('/weekly-report/:dealId/snapshot', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const { weekEnding, periodLabel, isProjected, ...updates } = req.body;

      if (isProjected && periodLabel) {
        await weeklyReportParser.saveProjectionOverrides(dealId, periodLabel, updates);
        res.json({ success: true, message: 'Projection override saved' });
      } else if (weekEnding) {
        await weeklyReportParser.updateSnapshot(dealId, weekEnding, updates);
        res.json({ success: true, message: 'Snapshot updated' });
      } else {
        return res.status(400).json({ error: 'weekEnding or periodLabel is required' });
      }
    } catch (error: any) {
      logger.error('[LeasingTraffic] Snapshot update failed', { error: error.message });
      res.status(500).json({ error: 'Failed to update snapshot', message: error.message });
    }
  });

  router.get('/weekly-report/:dealId/calibration', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const dealResult = await pool.query(
        `SELECT d.trade_area_id, d.address FROM deals d WHERE d.id = $1`,
        [dealId]
      );

      if (dealResult.rows.length === 0) {
        return res.json({ calibrated: false, sampleCount: 0, comparisons: {} });
      }

      const deal = dealResult.rows[0];
      let submarketId: string | null = null;
      if (deal.trade_area_id) {
        try {
          const taResult = await pool.query(
            `SELECT submarket_id FROM trade_areas WHERE id = $1`,
            [deal.trade_area_id]
          );
          if (taResult.rows.length > 0) submarketId = taResult.rows[0].submarket_id;
        } catch (_) {}
      }
      const stats = await trafficCalibrationService.getCalibrationStats(submarketId || undefined);

      if (!stats) {
        return res.json({ calibrated: false, sampleCount: 0, comparisons: {} });
      }

      res.json({
        calibrated: true,
        sampleCount: stats.sampleCount,
        lastUpdated: stats.lastUpdated,
        comparisons: stats.comparisons,
      });
    } catch (error: any) {
      logger.error('[LeasingTraffic] Calibration stats failed', { error: error.message });
      res.status(500).json({ error: 'Failed to get calibration stats' });
    }
  });

  const dotProfileUpload = multer({
    dest: path.join(process.cwd(), 'uploads', 'dot-profiles'),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['.csv', '.json'];
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, allowed.includes(ext));
    },
  });

  router.post('/dot-profiles/ingest', dotProfileUpload.single('file'), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      const state = (req.body.state as string) || 'FL';
      const region = (req.body.region as string) || 'statewide';

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded. Provide a CSV or JSON file with DOT temporal profile data.' });
      }

      const service = getDotTemporalProfilesService(pool);
      const result = await service.ingestProfiles(file.path, state, region);

      res.json({
        success: true,
        state,
        region,
        inserted: result.inserted,
        updated: result.updated,
        errors: result.errors,
        message: `Ingested ${result.inserted + result.updated} profiles (${result.inserted} new, ${result.updated} updated)`,
      });
    } catch (error: any) {
      logger.error('[LeasingTraffic] DOT profile ingestion failed', { error: error.message });
      res.status(500).json({ error: 'Failed to ingest DOT profiles', message: error.message });
    }
  });

  router.post('/dot-profiles/seed', async (_req: Request, res: Response) => {
    try {
      const state = (_req.body.state as string) || 'FL';
      const region = (_req.body.region as string) || 'statewide';

      const service = getDotTemporalProfilesService(pool);
      const result = await service.seedDefaultProfiles(state, region);

      res.json({
        success: true,
        state,
        region,
        seeded: result.seeded,
        skipped: result.skipped,
        message: `Seeded ${result.seeded} default FDOT profiles for ${state}/${region}`,
      });
    } catch (error: any) {
      logger.error('[LeasingTraffic] DOT profile seeding failed', { error: error.message });
      res.status(500).json({ error: 'Failed to seed DOT profiles', message: error.message });
    }
  });

  router.get('/dot-profiles/summary', async (req: Request, res: Response) => {
    try {
      const state = req.query.state as string | undefined;
      const service = getDotTemporalProfilesService(pool);
      const summary = await service.getProfileSummary(state);

      res.json({ success: true, ...summary });
    } catch (error: any) {
      logger.error('[LeasingTraffic] DOT profile summary failed', { error: error.message });
      res.status(500).json({ error: 'Failed to get profile summary', message: error.message });
    }
  });

  router.get('/dot-profiles/temporal-multiplier', async (req: Request, res: Response) => {
    try {
      const roadClass = (req.query.roadClass as string) || 'Arterial';
      const state = (req.query.state as string) || 'FL';
      const hour = parseInt(req.query.hour as string) || new Date().getHours();
      const dayOfWeek = parseInt(req.query.dayOfWeek as string) ?? new Date().getDay();
      const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
      const region = req.query.region as string | undefined;

      const service = getDotTemporalProfilesService(pool);
      const result = await service.getTemporalMultiplier(roadClass, state, hour, dayOfWeek, month, region);

      res.json({
        success: true,
        road_class: roadClass,
        state,
        hour,
        day_of_week: dayOfWeek,
        month,
        ...result,
      });
    } catch (error: any) {
      logger.error('[LeasingTraffic] Temporal multiplier lookup failed', { error: error.message });
      res.status(500).json({ error: 'Failed to get temporal multiplier', message: error.message });
    }
  });

  router.get('/dot-profiles/hourly-distribution', async (req: Request, res: Response) => {
    try {
      const roadClass = (req.query.roadClass as string) || 'Arterial';
      const state = (req.query.state as string) || 'FL';
      const region = req.query.region as string | undefined;

      const service = getDotTemporalProfilesService(pool);
      const distribution = await service.getFullHourlyDistribution(roadClass, state, region);

      res.json({
        success: true,
        road_class: roadClass,
        state,
        distribution,
      });
    } catch (error: any) {
      logger.error('[LeasingTraffic] Hourly distribution lookup failed', { error: error.message });
      res.status(500).json({ error: 'Failed to get hourly distribution', message: error.message });
    }
  });

  router.post('/dot-profiles/google-calibrate/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;

      const propResult = await pool.query(
        `SELECT id, latitude, longitude FROM properties WHERE id = $1`,
        [propertyId]
      );

      if (propResult.rows.length === 0) {
        return res.status(404).json({ error: 'Property not found' });
      }

      const property = propResult.rows[0];
      const lat = parseFloat(property.latitude);
      const lng = parseFloat(property.longitude);

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: 'Property missing coordinates' });
      }

      const trafficDataService = new TrafficDataSourcesService(pool);
      const rtResult = await trafficDataService.getRealTimeTrafficFactor(lat, lng);

      if (rtResult.factor !== 1.0 || rtResult.congestion_level !== 'unknown') {
        await pool.query(
          `UPDATE property_traffic_context
           SET google_realtime_factor = $1, last_updated = CURRENT_DATE
           WHERE property_id = $2`,
          [rtResult.factor, propertyId]
        );
      }

      res.json({
        success: true,
        property_id: propertyId,
        calibration: {
          google_realtime_factor: rtResult.factor,
          congestion_level: rtResult.congestion_level,
          duration_in_traffic: rtResult.duration_in_traffic,
          duration_normal: rtResult.duration_normal,
          fetched_at: rtResult.fetched_at,
        },
        message: rtResult.congestion_level === 'unknown'
          ? 'Google API key not configured or unavailable. Factor set to 1.0.'
          : `Google calibration complete. Real-time factor: ${rtResult.factor} (${rtResult.congestion_level} congestion)`,
      });
    } catch (error: any) {
      logger.error('[LeasingTraffic] Google calibration failed', { error: error.message });
      res.status(500).json({ error: 'Failed to calibrate with Google', message: error.message });
    }
  });

  router.get('/trend-patterns/:dealId', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;

      const result = await trendPatternDetector.detectPatternsForDeal(dealId);

      res.json({
        deal_id: dealId,
        property_id: result.property_id,
        patterns: result.patterns,
        pattern_count: result.patterns.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('[LeasingTraffic] Trend pattern detection failed', { error: error.message });
      res.status(500).json({
        error: 'Failed to detect trend patterns',
        message: error.message,
      });
    }
  });

export default router;
