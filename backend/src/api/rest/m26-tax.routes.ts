/**
 * M26: Tax Intelligence Routes
 * API endpoints for tax projections and tax intelligence
 */

import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { taxProjectionService } from '../../services/tax/taxProjection.service';

const router = Router();

/**
 * POST /api/v1/deals/:dealId/tax/projection
 * Calculate tax projection for a deal
 */
router.post('/deals/:dealId/tax/projection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const {
      purchase_price,
      parcel_id,
      county_id,
      units,
      override_millage,
      override_non_ad_valorem,
      exemption_reduction_pct,
      projection_years,
      market_value_growth_rate,
      millage_trend_assumption
    } = req.body;

    if (!purchase_price || !units) {
      return res.status(400).json({
        success: false,
        error: 'purchase_price and units are required'
      });
    }

    const projection = await taxProjectionService.calculateProjection({
      deal_id: dealId,
      purchase_price,
      parcel_id,
      county_id,
      units,
      override_millage,
      override_non_ad_valorem,
      exemption_reduction_pct,
      projection_years,
      market_value_growth_rate,
      millage_trend_assumption
    });

    res.json({
      success: true,
      data: projection
    });
  } catch (error: any) {
    console.error('Tax projection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/tax/projection
 * Get existing tax projection for a deal
 */
router.get('/deals/:dealId/tax/projection', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    
    const projection = await taxProjectionService.getProjectionByDeal(dealId);
    
    if (!projection) {
      return res.status(404).json({
        success: false,
        error: 'No tax projection found for this deal'
      });
    }

    res.json({
      success: true,
      data: projection
    });
  } catch (error: any) {
    console.error('Get tax projection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/tax/summary
 * Get tax summary for dashboard/capsule
 */
router.get('/deals/:dealId/tax/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    
    const projection = await taxProjectionService.getProjectionByDeal(dealId);
    
    if (!projection) {
      return res.json({
        success: true,
        data: {
          hasProjection: false,
          message: 'No tax projection available'
        }
      });
    }

    res.json({
      success: true,
      data: {
        hasProjection: true,
        projected_total_tax: projection.projected_total_tax,
        projected_tax_per_unit: projection.projected_tax_per_unit,
        effective_tax_rate: projection.effective_tax_rate,
        delta_amount: projection.delta_amount,
        delta_pct: projection.delta_pct,
        current_annual_tax: projection.current_annual_tax
      }
    });
  } catch (error: any) {
    console.error('Get tax summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
