import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { CalibrationCalculator } from '../../services/calibration/calibration-calculator';
import {
  PropertyActuals,
  ForecastValidation,
  CalibrationFactors,
} from '../../models/calibration';

export function createCalibrationRoutes(pool: Pool): Router {
  const router = Router();
  const calibrationCalculator = new CalibrationCalculator();

  /**
   * POST /api/calibration/actuals
   * Record actual performance data for a property
   */
  router.post('/actuals', async (req: Request, res: Response) => {
    try {
      const {
        user_id,
        property_id,
        measurement_date,
        measurement_type,
        actual_noi,
        actual_rent_avg,
        actual_occupancy,
        actual_expenses,
        actual_revenue,
        actual_traffic_weekly,
        actual_traffic_data_source,
        actual_construction_cost,
        actual_months_to_complete,
        actual_cost_overrun_percentage,
        data_source,
        quality_score,
        notes
      } = req.body as {
        user_id: string;
        property_id: string;
        measurement_date: string;
        measurement_type: string;
        actual_noi?: number;
        actual_rent_avg?: number;
        actual_occupancy?: number;
        actual_expenses?: number;
        actual_revenue?: number;
        actual_traffic_weekly?: number;
        actual_traffic_data_source?: string;
        actual_construction_cost?: number;
        actual_months_to_complete?: number;
        actual_cost_overrun_percentage?: number;
        data_source?: string;
        quality_score?: number;
        notes?: string;
      };

      if (!user_id || !property_id || !measurement_date || !measurement_type) {
        return res.status(400).json({ error: 'Missing required fields: user_id, property_id, measurement_date, measurement_type' });
      }

      const result = await pool.query(
        `INSERT INTO property_actuals 
         (user_id, property_id, measurement_date, measurement_type, actual_noi, actual_rent_avg, actual_occupancy, actual_expenses, actual_revenue, actual_traffic_weekly, actual_traffic_data_source, actual_construction_cost, actual_months_to_complete, actual_cost_overrun_percentage, data_source, quality_score, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING *`,
        [user_id, property_id, measurement_date, measurement_type, actual_noi || null, actual_rent_avg || null, actual_occupancy || null, actual_expenses || null, actual_revenue || null, actual_traffic_weekly || null, actual_traffic_data_source || null, actual_construction_cost || null, actual_months_to_complete || null, actual_cost_overrun_percentage || null, data_source || null, quality_score || null, notes || null]
      );

      res.json({
        success: true,
        actuals: result.rows[0],
        message: 'Actuals recorded successfully'
      });
    } catch (error) {
      console.error('Error recording actuals:', error);
      res.status(500).json({ error: 'Failed to record actuals' });
    }
  });

  /**
   * POST /api/calibration/actuals/bulk
   * Bulk import actuals (e.g., from property management system)
   */
  router.post('/actuals/bulk', async (req: Request, res: Response) => {
    try {
      const { user_id, actuals } = req.body;

      if (!user_id || !Array.isArray(actuals) || actuals.length === 0) {
        return res.status(400).json({ error: 'Invalid bulk actuals data' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const insertedActuals = [];
        for (const actual of actuals) {
          const result = await client.query(
            `INSERT INTO property_actuals 
             (user_id, property_id, measurement_date, measurement_type, actual_noi, actual_rent_avg, actual_occupancy, actual_expenses, actual_revenue, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
              user_id,
              actual.property_id,
              actual.measurement_date,
              actual.measurement_type,
              actual.actual_noi || null,
              actual.actual_rent_avg || null,
              actual.actual_occupancy || null,
              actual.actual_expenses || null,
              actual.actual_revenue || null,
              actual.notes || null
            ]
          );
          insertedActuals.push(result.rows[0]);
        }

        await client.query('COMMIT');

        res.json({
          success: true,
          count: insertedActuals.length,
          actuals: insertedActuals,
          message: `Successfully recorded ${insertedActuals.length} actuals`
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error bulk recording actuals:', error);
      res.status(500).json({ error: 'Failed to bulk record actuals' });
    }
  });

  /**
   * POST /api/calibration/validate
   * Create forecast validation (compare forecast vs actuals)
   */
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      const {
        user_id,
        property_id,
        module_id,
        capsule_id,
        forecast_metric,
        forecast_value,
        forecast_made_at,
        forecast_timeframe,
        actual_value,
        actual_measured_at,
        actual_data_source,
        deal_context
      } = req.body;

      if (!user_id || !property_id || !module_id || !forecast_metric || forecast_value === undefined) {
        return res.status(400).json({ error: 'Missing required fields: user_id, property_id, module_id, forecast_metric, forecast_value' });
      }

      const errorAbsolute = actual_value !== undefined && actual_value !== null
        ? Math.abs(forecast_value - actual_value)
        : null;
      const errorPercentage = actual_value !== undefined && actual_value !== null && actual_value !== 0
        ? Math.abs((forecast_value - actual_value) / actual_value) * 100
        : null;

      const result = await pool.query(
        `INSERT INTO forecast_validations 
         (user_id, module_id, property_id, capsule_id, forecast_metric, forecast_value, forecast_made_at, forecast_timeframe, actual_value, actual_measured_at, actual_data_source, error_absolute, error_percentage, deal_context)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [user_id, module_id, property_id, capsule_id || null, forecast_metric, forecast_value, forecast_made_at || null, forecast_timeframe || null, actual_value || null, actual_measured_at || null, actual_data_source || null, errorAbsolute, errorPercentage, deal_context || null]
      );

      res.json({
        success: true,
        validation: result.rows[0],
        message: 'Forecast validated successfully'
      });
    } catch (error) {
      console.error('Error validating forecast:', error);
      res.status(500).json({ error: 'Failed to validate forecast' });
    }
  });

  /**
   * POST /api/calibration/calculate
   * Calculate calibration factors from validation data
   */
  router.post('/calculate', async (req: Request, res: Response) => {
    try {
      const {
        user_id,
        module_id,
        min_validations = 3
      } = req.body as {
        user_id: string;
        module_id: string;
        min_validations?: number;
      };

      if (!user_id || !module_id) {
        return res.status(400).json({ error: 'Missing required fields: user_id, module_id' });
      }

      const validationsResult = await pool.query(
        `SELECT * FROM forecast_validations 
         WHERE user_id = $1 AND module_id = $2
         ORDER BY created_at DESC`,
        [user_id, module_id]
      );

      if (validationsResult.rows.length < min_validations) {
        return res.status(400).json({
          error: `Insufficient validation data. Need at least ${min_validations} validations, have ${validationsResult.rows.length}`
        });
      }

      const validations = validationsResult.rows as ForecastValidation[];

      const factors = calibrationCalculator.calculateFactors(module_id, validations);
      const confidence = calibrationCalculator.calculateConfidence(validations);

      const result = await pool.query(
        `INSERT INTO calibration_factors 
         (user_id, module_id, calibration_data, sample_size, confidence)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [user_id, module_id, factors, validations.length, confidence]
      );

      res.json({
        success: true,
        calibration: result.rows[0],
        factors,
        confidence,
        validation_count: validations.length
      });
    } catch (error) {
      console.error('Error calculating calibration:', error);
      res.status(500).json({ error: 'Failed to calculate calibration' });
    }
  });

  /**
   * GET /api/calibration/:userId/:moduleId
   * Get calibration factors for a module
   */
  router.get('/:userId/:moduleId', async (req: Request, res: Response) => {
    try {
      const { userId, moduleId } = req.params;

      const result = await pool.query(
        `SELECT * FROM calibration_factors 
         WHERE user_id = $1 AND module_id = $2
         ORDER BY last_updated DESC
         LIMIT 1`,
        [userId, moduleId]
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          calibrated: false,
          message: 'No calibration data found for this module'
        });
      }

      res.json({
        success: true,
        calibrated: true,
        calibration: result.rows[0]
      });
    } catch (error) {
      console.error('Error fetching calibration:', error);
      res.status(500).json({ error: 'Failed to fetch calibration' });
    }
  });

  /**
   * GET /api/calibration/:userId/summary
   * Get calibration summary for all modules (uses view)
   */
  router.get('/:userId/summary', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const result = await pool.query(
        `SELECT * FROM user_validation_summary 
         WHERE user_id = $1`,
        [userId]
      );

      res.json({
        success: true,
        summary: result.rows
      });
    } catch (error) {
      console.error('Error fetching calibration summary:', error);
      res.status(500).json({ error: 'Failed to fetch calibration summary' });
    }
  });

  /**
   * GET /api/calibration/:userId/:moduleId/validations
   * Get validation history for a module
   */
  router.get('/:userId/:moduleId/validations', async (req: Request, res: Response) => {
    try {
      const { userId, moduleId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await pool.query(
        `SELECT fv.*
         FROM forecast_validations fv
         WHERE fv.user_id = $1 AND fv.module_id = $2
         ORDER BY fv.created_at DESC
         LIMIT $3 OFFSET $4`,
        [userId, moduleId, limit, offset]
      );

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM forecast_validations 
         WHERE user_id = $1 AND module_id = $2`,
        [userId, moduleId]
      );

      res.json({
        success: true,
        validations: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset
      });
    } catch (error) {
      console.error('Error fetching validations:', error);
      res.status(500).json({ error: 'Failed to fetch validations' });
    }
  });

  /**
   * POST /api/calibration/:userId/:moduleId/recalculate
   * Force recalculation of calibration factors
   */
  router.post('/:userId/:moduleId/recalculate', async (req: Request, res: Response) => {
    try {
      const { userId, moduleId } = req.params;

      const validationsResult = await pool.query(
        `SELECT * FROM forecast_validations 
         WHERE user_id = $1 AND module_id = $2
         ORDER BY created_at DESC`,
        [userId, moduleId]
      );

      if (validationsResult.rows.length < 3) {
        return res.status(400).json({
          error: `Insufficient validation data. Need at least 3 validations, have ${validationsResult.rows.length}`
        });
      }

      const validations = validationsResult.rows as ForecastValidation[];

      const factors = calibrationCalculator.calculateFactors(moduleId, validations);
      const confidence = calibrationCalculator.calculateConfidence(validations);

      const result = await pool.query(
        `INSERT INTO calibration_factors 
         (user_id, module_id, calibration_data, sample_size, confidence)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, moduleId, factors, validations.length, confidence]
      );

      res.json({
        success: true,
        calibration: result.rows[0],
        factors,
        confidence,
        validation_count: validations.length,
        message: 'Calibration recalculated successfully'
      });
    } catch (error) {
      console.error('Error recalculating calibration:', error);
      res.status(500).json({ error: 'Failed to recalculate calibration' });
    }
  });

  /**
   * GET /api/calibration/:userId/:propertyId/actuals
   * Get actuals history for a property
   */
  router.get('/:userId/:propertyId/actuals', async (req: Request, res: Response) => {
    try {
      const { userId, propertyId } = req.params;

      const result = await pool.query(
        `SELECT * FROM property_actuals 
         WHERE user_id = $1 AND property_id = $2
         ORDER BY measurement_date DESC`,
        [userId, propertyId]
      );

      res.json({
        success: true,
        actuals: result.rows
      });
    } catch (error) {
      console.error('Error fetching actuals:', error);
      res.status(500).json({ error: 'Failed to fetch actuals' });
    }
  });

  /**
   * DELETE /api/calibration/:userId/:moduleId
   * Reset calibration for a module
   */
  router.delete('/:userId/:moduleId', async (req: Request, res: Response) => {
    try {
      const { userId, moduleId } = req.params;

      await pool.query(
        `DELETE FROM calibration_factors 
         WHERE user_id = $1 AND module_id = $2`,
        [userId, moduleId]
      );

      res.json({
        success: true,
        message: `Calibration data for ${moduleId} has been reset`
      });
    } catch (error) {
      console.error('Error resetting calibration:', error);
      res.status(500).json({ error: 'Failed to reset calibration' });
    }
  });

  return router;
}
