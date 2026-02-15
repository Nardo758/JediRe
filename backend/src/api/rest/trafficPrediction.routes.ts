/**
 * Traffic Prediction API Routes
 * Property-level foot traffic predictions with validation
 */

import { Router } from 'express';
import trafficPredictionEngine from '../../services/trafficPredictionEngine';
import { pool } from '../../database';

const router = Router();

/**
 * POST /api/traffic/predict/:propertyId
 * Generate traffic prediction for a property
 */
router.post('/predict/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { targetWeek } = req.query;
    
    const prediction = await trafficPredictionEngine.predictTraffic(
      propertyId,
      targetWeek ? parseInt(targetWeek as string) : undefined
    );
    
    res.json({
      success: true,
      prediction
    });
    
  } catch (error: any) {
    console.error('Traffic prediction error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to generate traffic prediction'
    });
  }
});

/**
 * GET /api/traffic/prediction/:propertyId
 * Get latest traffic prediction for a property
 */
router.get('/prediction/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM latest_traffic_predictions
      WHERE property_id = $1
    `, [propertyId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No prediction found',
        message: 'Generate a prediction first using POST /predict/:propertyId'
      });
    }
    
    res.json({
      success: true,
      prediction: result.rows[0]
    });
    
  } catch (error: any) {
    console.error('Get prediction error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/traffic/intelligence/:propertyId
 * Get comprehensive traffic intelligence (prediction + actuals if available)
 */
router.get('/intelligence/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM property_traffic_intelligence
      WHERE property_id = $1
    `, [propertyId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No traffic data found for this property'
      });
    }
    
    res.json({
      success: true,
      intelligence: result.rows[0]
    });
    
  } catch (error: any) {
    console.error('Get intelligence error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/traffic/validation/record
 * Record actual traffic measurement for validation
 */
router.post('/validation/record', async (req, res) => {
  try {
    const {
      property_id,
      measurement_date,
      total_walk_ins,
      measurement_method,
      measurement_confidence,
      weather,
      temperature_f,
      special_events,
      notes
    } = req.body;
    
    // Calculate week/year
    const date = new Date(measurement_date);
    const week = Math.ceil((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const year = date.getFullYear();
    
    // Insert actual measurement
    const result = await pool.query(`
      INSERT INTO property_traffic_actual (
        property_id,
        measurement_date,
        measurement_week,
        measurement_year,
        total_walk_ins,
        measurement_method,
        measurement_confidence,
        weather,
        temperature_f,
        special_events,
        validation_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      property_id,
      measurement_date,
      week,
      year,
      total_walk_ins,
      measurement_method,
      measurement_confidence || 0.85,
      weather,
      temperature_f,
      special_events || [],
      notes
    ]);
    
    // Check if we have a prediction for this week
    const prediction = await pool.query(`
      SELECT * FROM traffic_predictions
      WHERE property_id = $1
      AND prediction_week = $2
      AND prediction_year = $3
    `, [property_id, week, year]);
    
    // If prediction exists, create validation result
    if (prediction.rows.length > 0) {
      const pred = prediction.rows[0];
      const absoluteError = Math.abs(pred.weekly_walk_ins - total_walk_ins);
      const percentageError = (absoluteError / total_walk_ins) * 100;
      const direction = pred.weekly_walk_ins > total_walk_ins ? 'over' : 'under';
      
      await pool.query(`
        INSERT INTO validation_results (
          property_id,
          week,
          year,
          predicted_walkins,
          actual_walkins,
          absolute_error,
          percentage_error,
          direction,
          prediction_confidence,
          measurement_confidence,
          model_version,
          prediction_id,
          measurement_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        property_id,
        week,
        year,
        pred.weekly_walk_ins,
        total_walk_ins,
        absoluteError,
        percentageError,
        direction,
        pred.confidence_score,
        measurement_confidence || 0.85,
        pred.model_version,
        pred.id,
        result.rows[0].id
      ]);
      
      res.json({
        success: true,
        message: 'Measurement recorded and validated',
        validation: {
          predicted: pred.weekly_walk_ins,
          actual: total_walk_ins,
          error: percentageError,
          direction
        }
      });
    } else {
      res.json({
        success: true,
        message: 'Measurement recorded (no prediction to validate against)',
        measurement_id: result.rows[0].id
      });
    }
    
  } catch (error: any) {
    console.error('Record measurement error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/traffic/validation/summary/:propertyId
 * Get validation summary for a property
 */
router.get('/validation/summary/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM property_validation_summary
      WHERE property_id = $1
    `, [propertyId]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No validation data yet',
        summary: null
      });
    }
    
    res.json({
      success: true,
      summary: result.rows[0]
    });
    
  } catch (error: any) {
    console.error('Get validation summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/traffic/validation/errors
 * Get recent validation errors for analysis
 */
router.get('/validation/errors', async (req, res) => {
  try {
    const { limit = 50, minError = 20 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        vr.*,
        p.property_name,
        p.address
      FROM validation_results vr
      JOIN properties p ON vr.property_id = p.id
      WHERE vr.percentage_error >= $1
      AND vr.is_outlier = FALSE
      ORDER BY vr.created_at DESC
      LIMIT $2
    `, [minError, limit]);
    
    res.json({
      success: true,
      errors: result.rows,
      count: result.rows.length
    });
    
  } catch (error: any) {
    console.error('Get validation errors error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/traffic/model/performance
 * Get model performance metrics
 */
router.get('/model/performance', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM model_performance_timeline
      ORDER BY month DESC
      LIMIT 12
    `);
    
    res.json({
      success: true,
      performance: result.rows
    });
    
  } catch (error: any) {
    console.error('Get model performance error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/traffic/calibration/apply
 * Apply a new calibration factor
 */
router.post('/calibration/apply', async (req, res) => {
  try {
    const {
      factor_type,
      factor_key,
      multiplier,
      reason,
      effective_until
    } = req.body;
    
    const result = await pool.query(`
      INSERT INTO traffic_calibration_factors (
        factor_type,
        factor_key,
        multiplier,
        reason,
        effective_until,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      factor_type,
      factor_key,
      multiplier,
      reason,
      effective_until || null,
      (req as any).user?.email || 'system'
    ]);
    
    res.json({
      success: true,
      message: 'Calibration factor applied',
      factor_id: result.rows[0].id
    });
    
  } catch (error: any) {
    console.error('Apply calibration error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/traffic/calibration/active
 * Get all active calibration factors
 */
router.get('/calibration/active', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM active_calibration_factors
    `);
    
    res.json({
      success: true,
      factors: result.rows
    });
    
  } catch (error: any) {
    console.error('Get calibration factors error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/traffic/batch-predict
 * Generate predictions for multiple properties
 */
router.post('/batch-predict', async (req, res) => {
  try {
    const { propertyIds } = req.body;
    
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ error: 'propertyIds array required' });
    }
    
    const results = [];
    
    for (const propertyId of propertyIds) {
      try {
        const prediction = await trafficPredictionEngine.predictTraffic(propertyId);
        results.push({
          property_id: propertyId,
          success: true,
          weekly_walk_ins: prediction.weekly_walk_ins,
          confidence: prediction.confidence.tier
        });
      } catch (error: any) {
        results.push({
          property_id: propertyId,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      results,
      total: propertyIds.length,
      successful: results.filter(r => r.success).length
    });
    
  } catch (error: any) {
    console.error('Batch predict error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
