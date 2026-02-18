import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { CalibrationCalculator } from '../../services/calibration/calibration-calculator';
import {
  PropertyActuals,
  ForecastValidation,
  CalibrationFactors,
  RecordActualsRequest,
  CalculateCalibrationRequest,
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
        period_start,
        period_end,
        actuals_data
      } = req.body as RecordActualsRequest;

      if (!user_id || !property_id || !period_start || !period_end || !actuals_data) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await pool.query(
        `INSERT INTO property_actuals 
         (user_id, property_id, period_start, period_end, actuals_data)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, property_id, period_start, period_end)
         DO UPDATE SET actuals_data = $5, updated_at = NOW()
         RETURNING *`,
        [user_id, property_id, period_start, period_end, actuals_data]
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
             (user_id, property_id, period_start, period_end, actuals_data)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, property_id, period_start, period_end)
             DO UPDATE SET actuals_data = $5, updated_at = NOW()
             RETURNING *`,
            [
              user_id,
              actual.property_id,
              actual.period_start,
              actual.period_end,
              actual.actuals_data
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
        module_type,
        forecast_data,
        actuals_id
      } = req.body;

      if (!user_id || !property_id || !module_type || !forecast_data || !actuals_id) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Fetch actuals
      const actualsResult = await pool.query(
        `SELECT * FROM property_actuals WHERE id = $1`,
        [actuals_id]
      );

      if (actualsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Actuals not found' });
      }

      const actuals = actualsResult.rows[0] as PropertyActuals;

      // Create validation (errors calculated by database triggers)
      const result = await pool.query(
        `INSERT INTO forecast_validations 
         (user_id, property_id, module_type, forecast_data, actuals_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [user_id, property_id, module_type, forecast_data, actuals_id]
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
        module_type,
        min_validations = 3
      } = req.body as CalculateCalibrationRequest;

      if (!user_id || !module_type) {
        return res.status(400).json({ error: 'Missing required fields: user_id, module_type' });
      }

      // Fetch validations
      const validationsResult = await pool.query(
        `SELECT * FROM forecast_validations 
         WHERE user_id = $1 AND module_type = $2
         ORDER BY created_at DESC`,
        [user_id, module_type]
      );

      if (validationsResult.rows.length < min_validations) {
        return res.status(400).json({
          error: `Insufficient validation data. Need at least ${min_validations} validations, have ${validationsResult.rows.length}`
        });
      }

      const validations = validationsResult.rows as ForecastValidation[];

      // Calculate factors
      const factors = calibrationCalculator.calculateFactors(validations, module_type);
      const confidence = calibrationCalculator.calculateConfidence(validations);

      // Save factors
      const result = await pool.query(
        `INSERT INTO calibration_factors 
         (user_id, module_type, calibration_data, validation_count, confidence)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [user_id, module_type, factors, validations.length, confidence]
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
   * GET /api/calibration/:userId/:moduleType
   * Get calibration factors for a module
   */
  router.get('/:userId/:moduleType', async (req: Request, res: Response) => {
    try {
      const { userId, moduleType } = req.params;

      const result = await pool.query(
        `SELECT * FROM calibration_factors 
         WHERE user_id = $1 AND module_type = $2
         ORDER BY calculated_at DESC
         LIMIT 1`,
        [userId, moduleType]
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
   * GET /api/calibration/:userId/:moduleType/validations
   * Get validation history for a module
   */
  router.get('/:userId/:moduleType/validations', async (req: Request, res: Response) => {
    try {
      const { userId, moduleType } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await pool.query(
        `SELECT 
           fv.*,
           pa.actuals_data,
           pa.period_start,
           pa.period_end
         FROM forecast_validations fv
         LEFT JOIN property_actuals pa ON fv.actuals_id = pa.id
         WHERE fv.user_id = $1 AND fv.module_type = $2
         ORDER BY fv.created_at DESC
         LIMIT $3 OFFSET $4`,
        [userId, moduleType, limit, offset]
      );

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM forecast_validations 
         WHERE user_id = $1 AND module_type = $2`,
        [userId, moduleType]
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
   * POST /api/calibration/:userId/:moduleType/recalculate
   * Force recalculation of calibration factors
   */
  router.post('/:userId/:moduleType/recalculate', async (req: Request, res: Response) => {
    try {
      const { userId, moduleType } = req.params;

      // Fetch all validations
      const validationsResult = await pool.query(
        `SELECT * FROM forecast_validations 
         WHERE user_id = $1 AND module_type = $2
         ORDER BY created_at DESC`,
        [userId, moduleType]
      );

      if (validationsResult.rows.length < 3) {
        return res.status(400).json({
          error: `Insufficient validation data. Need at least 3 validations, have ${validationsResult.rows.length}`
        });
      }

      const validations = validationsResult.rows as ForecastValidation[];

      // Recalculate
      const factors = calibrationCalculator.calculateFactors(validations, moduleType);
      const confidence = calibrationCalculator.calculateConfidence(validations);

      // Update factors
      const result = await pool.query(
        `INSERT INTO calibration_factors 
         (user_id, module_type, calibration_data, validation_count, confidence)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, moduleType, factors, validations.length, confidence]
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
         ORDER BY period_start DESC`,
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
   * DELETE /api/calibration/:userId/:moduleType
   * Reset calibration for a module
   */
  router.delete('/:userId/:moduleType', async (req: Request, res: Response) => {
    try {
      const { userId, moduleType } = req.params;

      await pool.query(
        `DELETE FROM calibration_factors 
         WHERE user_id = $1 AND module_type = $2`,
        [userId, moduleType]
      );

      res.json({
        success: true,
        message: `Calibration data for ${moduleType} has been reset`
      });
    } catch (error) {
      console.error('Error resetting calibration:', error);
      res.status(500).json({ error: 'Failed to reset calibration' });
    }
  });

  return router;
}
