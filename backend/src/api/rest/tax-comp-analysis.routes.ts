/**
 * Tax Comp Analysis API Routes
 * Compare subject property tax burden to comps
 */

import { Router } from 'express';
import { taxCompAnalysisService } from '../../services/tax/taxCompAnalysis.service';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * POST /api/v1/deals/:dealId/tax/comp-analysis
 * Perform tax comp analysis for a deal
 */
router.post('/deals/:dealId/tax/comp-analysis', async (req, res) => {
  try {
    const { dealId } = req.params;

    const analysis = await taxCompAnalysisService.analyzeTaxComps(dealId);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    logger.error('Tax comp analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/tax/comp-analysis
 * Get existing tax comp analysis
 */
router.get('/deals/:dealId/tax/comp-analysis', async (req, res) => {
  try {
    const { dealId } = req.params;

    const analysis = await taxCompAnalysisService.getTaxCompAnalysis(dealId);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No tax comp analysis found for this deal'
      });
    }

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    logger.error('Get tax comp analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/tax/comp-analysis/summary
 * Get formatted tax comp analysis summary
 */
router.get('/deals/:dealId/tax/comp-analysis/summary', async (req, res) => {
  try {
    const { dealId } = req.params;

    const analysis = await taxCompAnalysisService.getTaxCompAnalysis(dealId);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No tax comp analysis found for this deal'
      });
    }

    const summary = taxCompAnalysisService.formatAnalysisSummary(analysis);

    res.json({
      success: true,
      data: {
        summary,
        analysis
      }
    });
  } catch (error: any) {
    logger.error('Get tax comp analysis summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
