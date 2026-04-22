/**
 * Deal Traffic Routes
 * 
 * Traffic forecast vs actuals for a deal/property
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query } from '../../database/connection';
import { pool } from '../../database';
import { logger } from '../../utils/logger';

const router = Router();

// ============================================================================
// GET /api/v1/deals/:dealId/traffic/forecast-vs-actual
// Get traffic forecast vs actual data
// ============================================================================
router.get('/:dealId/traffic/forecast-vs-actual', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { weeks = 12 } = req.query;
    
    // Get property_id for this deal
    const dealResult = await query(
      'SELECT property_id FROM deals WHERE id = $1',
      [dealId]
    );
    
    if (dealResult.rows.length === 0 || !dealResult.rows[0].property_id) {
      return res.status(404).json({ success: false, error: 'Deal or property not found' });
    }
    
    const propertyId = dealResult.rows[0].property_id;
    
    // Get traffic predictions
    const predictions = await pool.query(`
      SELECT 
        tp.prediction_week,
        tp.target_week_start,
        tp.target_week_end,
        tp.predicted_traffic,
        tp.predicted_leases,
        tp.predicted_conversion_rate,
        tp.confidence_score,
        tp.drivers,
        tp.created_at as predicted_at
      FROM traffic_predictions tp
      WHERE tp.property_id = $1
      ORDER BY tp.target_week_start DESC
      LIMIT $2
    `, [propertyId, parseInt(weeks as string)]);
    
    // Get traffic actuals from leasing_traffic table
    const actuals = await pool.query(`
      SELECT 
        lt.week_ending,
        lt.traffic as actual_traffic,
        lt.closing_ratio as actual_conversion_rate,
        lt.occ_pct as occupancy_pct,
        (lt.traffic * lt.closing_ratio / 100)::int as actual_leases
      FROM leasing_traffic lt
      WHERE lt.deal_id = $1
      ORDER BY lt.week_ending DESC
      LIMIT $2
    `, [dealId, parseInt(weeks as string)]);
    
    // Merge predictions with actuals by week
    const forecastMap: Record<string, any> = {};
    
    for (const pred of predictions.rows) {
      const weekKey = pred.target_week_start?.toISOString?.()?.slice(0, 10) || '';
      if (!forecastMap[weekKey]) {
        forecastMap[weekKey] = {
          week: weekKey,
          weekEnd: pred.target_week_end,
        };
      }
      forecastMap[weekKey].forecast_traffic = pred.predicted_traffic;
      forecastMap[weekKey].forecast_leases = pred.predicted_leases;
      forecastMap[weekKey].forecast_conversion = pred.predicted_conversion_rate;
      forecastMap[weekKey].confidence = pred.confidence_score;
      forecastMap[weekKey].drivers = pred.drivers;
    }
    
    for (const act of actuals.rows) {
      // Find matching week (week_ending is end of week, so adjust)
      const weekEnd = act.week_ending?.toISOString?.()?.slice(0, 10) || '';
      const weekStart = new Date(act.week_ending);
      weekStart.setDate(weekStart.getDate() - 6);
      const weekKey = weekStart.toISOString().slice(0, 10);
      
      if (!forecastMap[weekKey]) {
        forecastMap[weekKey] = {
          week: weekKey,
          weekEnd: weekEnd,
        };
      }
      forecastMap[weekKey].actual_traffic = act.actual_traffic;
      forecastMap[weekKey].actual_leases = act.actual_leases;
      forecastMap[weekKey].actual_conversion = act.actual_conversion_rate;
      forecastMap[weekKey].occupancy = act.occupancy_pct;
    }
    
    // Calculate variances
    const combined = Object.values(forecastMap)
      .map((row: any) => {
        const trafficVar = row.forecast_traffic && row.actual_traffic
          ? ((row.actual_traffic - row.forecast_traffic) / row.forecast_traffic * 100)
          : null;
        const leaseVar = row.forecast_leases && row.actual_leases
          ? ((row.actual_leases - row.forecast_leases) / row.forecast_leases * 100)
          : null;
        
        return {
          ...row,
          traffic_variance: trafficVar,
          traffic_variance_type: trafficVar === null ? 'no_data' : trafficVar >= 0 ? 'favorable' : 'unfavorable',
          lease_variance: leaseVar,
          lease_variance_type: leaseVar === null ? 'no_data' : leaseVar >= 0 ? 'favorable' : 'unfavorable',
        };
      })
      .sort((a, b) => new Date(b.week).getTime() - new Date(a.week).getTime());
    
    // Calculate summary metrics
    const withBoth = combined.filter(r => r.forecast_traffic && r.actual_traffic);
    const avgTrafficVariance = withBoth.length > 0
      ? withBoth.reduce((sum, r) => sum + (r.traffic_variance || 0), 0) / withBoth.length
      : null;
    const avgLeaseVariance = withBoth.length > 0
      ? withBoth.reduce((sum, r) => sum + (r.lease_variance || 0), 0) / withBoth.length
      : null;
    
    const summary = {
      totalWeeks: combined.length,
      weeksWithForecast: predictions.rows.length,
      weeksWithActuals: actuals.rows.length,
      avgTrafficVariance,
      avgLeaseVariance,
      forecastAccuracy: avgTrafficVariance !== null ? 100 - Math.abs(avgTrafficVariance) : null,
    };
    
    res.json({
      success: true,
      propertyId,
      summary,
      data: combined,
    });
  } catch (err: any) {
    logger.error('GET traffic forecast vs actual', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// GET /api/v1/deals/:dealId/traffic/latest-prediction
// Get the latest traffic prediction
// ============================================================================
router.get('/:dealId/traffic/latest-prediction', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    
    // Get property_id for this deal
    const dealResult = await query(
      'SELECT property_id FROM deals WHERE id = $1',
      [dealId]
    );
    
    if (dealResult.rows.length === 0 || !dealResult.rows[0].property_id) {
      return res.status(404).json({ success: false, error: 'Deal or property not found' });
    }
    
    const propertyId = dealResult.rows[0].property_id;
    
    // Get latest prediction
    const result = await pool.query(`
      SELECT * FROM latest_traffic_predictions
      WHERE property_id = $1
    `, [propertyId]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        prediction: null,
        message: 'No prediction available',
      });
    }
    
    res.json({
      success: true,
      prediction: result.rows[0],
    });
  } catch (err: any) {
    logger.error('GET latest prediction', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// POST /api/v1/deals/:dealId/traffic/record-actual
// Record actual traffic data for a week
// ============================================================================
router.post('/:dealId/traffic/record-actual', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const {
      week_ending,
      traffic,
      closing_ratio,
      occ_pct,
      new_leases,
      renewals,
      move_outs,
    } = req.body;
    
    if (!week_ending || traffic === undefined) {
      return res.status(400).json({ success: false, error: 'week_ending and traffic required' });
    }
    
    const result = await query(`
      INSERT INTO leasing_traffic (
        deal_id, week_ending, traffic, closing_ratio, occ_pct,
        new_leases, renewals, move_outs
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (deal_id, week_ending) DO UPDATE SET
        traffic = EXCLUDED.traffic,
        closing_ratio = EXCLUDED.closing_ratio,
        occ_pct = EXCLUDED.occ_pct,
        new_leases = EXCLUDED.new_leases,
        renewals = EXCLUDED.renewals,
        move_outs = EXCLUDED.move_outs,
        updated_at = NOW()
      RETURNING *
    `, [
      dealId,
      week_ending,
      traffic,
      closing_ratio || null,
      occ_pct || null,
      new_leases || null,
      renewals || null,
      move_outs || null,
    ]);
    
    res.status(201).json({ success: true, actual: result.rows[0] });
  } catch (err: any) {
    logger.error('POST record traffic actual', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// GET /api/v1/deals/:dealId/traffic/intelligence
// Get full traffic intelligence (prediction + actuals + drivers)
// ============================================================================
router.get('/:dealId/traffic/intelligence', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    
    // Get property_id for this deal
    const dealResult = await query(
      'SELECT property_id FROM deals WHERE id = $1',
      [dealId]
    );
    
    if (dealResult.rows.length === 0 || !dealResult.rows[0].property_id) {
      return res.status(404).json({ success: false, error: 'Deal or property not found' });
    }
    
    const propertyId = dealResult.rows[0].property_id;
    
    // Get property traffic intelligence view
    const intelligence = await pool.query(`
      SELECT * FROM property_traffic_intelligence
      WHERE property_id = $1
    `, [propertyId]);
    
    // Get recent actuals
    const actuals = await query(`
      SELECT * FROM leasing_traffic
      WHERE deal_id = $1
      ORDER BY week_ending DESC
      LIMIT 8
    `, [dealId]);
    
    // Get forecast accuracy metrics
    const accuracy = await pool.query(`
      SELECT 
        COUNT(*) as total_predictions,
        AVG(ABS(predicted_traffic - actual_traffic) / NULLIF(predicted_traffic, 0) * 100) as avg_traffic_error_pct,
        AVG(ABS(predicted_leases - actual_leases) / NULLIF(predicted_leases, 0) * 100) as avg_lease_error_pct
      FROM traffic_prediction_accuracy
      WHERE property_id = $1 AND created_at > NOW() - INTERVAL '90 days'
    `, [propertyId]).catch(() => ({ rows: [{}] }));
    
    res.json({
      success: true,
      propertyId,
      intelligence: intelligence.rows[0] || null,
      recentActuals: actuals.rows,
      accuracy: accuracy.rows[0] || null,
    });
  } catch (err: any) {
    logger.error('GET traffic intelligence', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
