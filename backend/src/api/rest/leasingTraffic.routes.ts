/**
 * Leasing Traffic API Routes
 * Multifamily property leasing predictions and forecasts
 */

import { Router } from 'express';
import leasingTrafficService from '../../services/leasingTrafficService';

const router = Router();

/**
 * GET /api/leasing-traffic/predict/:propertyId
 * Get current week leasing traffic prediction
 */
router.get('/predict/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    const prediction = await leasingTrafficService.predictCurrentWeek(propertyId);
    
    res.json({
      success: true,
      prediction
    });
    
  } catch (error: any) {
    console.error('Leasing prediction error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to generate leasing traffic prediction'
    });
  }
});

/**
 * GET /api/leasing-traffic/forecast/:propertyId
 * Get multi-week leasing forecast
 */
router.get('/forecast/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { weeks = '12' } = req.query;
    
    const weeksNum = parseInt(weeks as string, 10);
    
    if (isNaN(weeksNum) || weeksNum < 1 || weeksNum > 52) {
      return res.status(400).json({
        error: 'Invalid weeks parameter',
        message: 'weeks must be between 1 and 52'
      });
    }
    
    const forecast = await leasingTrafficService.forecast(propertyId, weeksNum);
    
    res.json({
      success: true,
      forecast
    });
    
  } catch (error: any) {
    console.error('Leasing forecast error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to generate leasing forecast'
    });
  }
});

export default router;
