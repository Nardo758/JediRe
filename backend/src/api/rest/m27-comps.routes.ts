/**
 * M27: Sale Comp Intelligence Routes
 * API endpoints for comparable sales and transaction patterns
 */

import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { compSetService } from '../../services/saleComps/compSet.service';

const router = Router();

/**
 * POST /api/v1/deals/:dealId/comps/generate
 * Auto-generate comp set for a deal
 */
router.post('/deals/:dealId/comps/generate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const {
      radius_miles = 3.0,
      date_range_months = 24,
      min_units = 50,
      max_units = 500,
      property_classes = ['A', 'B', 'C'],
      vintage_range,
      exclude_distress = true,
      arms_length_only = true
    } = req.body;

    const compSet = await compSetService.generateCompSet({
      deal_id: dealId,
      radius_miles,
      date_range_months,
      min_units,
      max_units,
      property_classes,
      vintage_range,
      exclude_distress,
      arms_length_only
    });

    res.json({
      success: true,
      data: compSet
    });
  } catch (error: any) {
    console.error('Generate comp set error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/comps
 * Get existing comp set for a deal
 */
router.get('/deals/:dealId/comps', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    
    const compSet = await compSetService.getCompSetByDeal(dealId);
    
    if (!compSet) {
      return res.status(404).json({
        success: false,
        error: 'No comp set found for this deal'
      });
    }

    res.json({
      success: true,
      data: compSet
    });
  } catch (error: any) {
    console.error('Get comp set error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/comps/exit-cap-rate
 * Get transaction-derived exit cap rate for ProForma
 */
router.get('/deals/:dealId/comps/exit-cap-rate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    
    const compSet = await compSetService.getCompSetByDeal(dealId);
    
    if (!compSet || !compSet.median_implied_cap_rate) {
      // Fallback: use market default
      return res.json({
        success: true,
        data: {
          exit_cap_rate: 0.06, // 6% default
          source: 'market_default',
          confidence: 'low',
          message: 'No transaction-derived cap rate available. Using market default.'
        }
      });
    }

    res.json({
      success: true,
      data: {
        exit_cap_rate: compSet.median_implied_cap_rate,
        source: 'transaction_derived',
        confidence: compSet.comp_count >= 5 ? 'high' : 'medium',
        comp_count: compSet.comp_count,
        cap_rate_range: {
          median: compSet.median_implied_cap_rate,
          avg: compSet.avg_implied_cap_rate
        }
      }
    });
  } catch (error: any) {
    console.error('Get exit cap rate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/comps/summary
 * Get comp summary for dashboard
 */
router.get('/deals/:dealId/comps/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    
    const compSet = await compSetService.getCompSetByDeal(dealId);
    
    if (!compSet) {
      return res.json({
        success: true,
        data: {
          hasCompSet: false,
          message: 'No comp set available'
        }
      });
    }

    res.json({
      success: true,
      data: {
        hasCompSet: true,
        comp_count: compSet.comp_count,
        median_price_per_unit: compSet.median_price_per_unit,
        median_implied_cap_rate: compSet.median_implied_cap_rate,
        price_range: {
          min: compSet.min_price_per_unit,
          max: compSet.max_price_per_unit
        }
      }
    });
  } catch (error: any) {
    console.error('Get comp summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
