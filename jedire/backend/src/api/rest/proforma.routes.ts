/**
 * Pro Forma Adjustments API Routes
 * 
 * Endpoints for managing news-driven pro forma assumption adjustments
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { proformaAdjustmentService } from '../../services/proforma-adjustment.service';

const logger = { 
  error: (...args: any[]) => console.error(...args),
  info: (...args: any[]) => console.log(...args)
};

const router = Router();

/**
 * GET /api/v1/proforma/:dealId
 * Get current pro forma assumptions (baseline + adjusted)
 */
router.get('/:dealId', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    
    const proforma = await proformaAdjustmentService.getProForma(dealId);
    
    if (!proforma) {
      return res.status(404).json({
        success: false,
        error: 'Pro forma not found for this deal'
      });
    }
    
    res.json({
      success: true,
      data: proforma
    });
  } catch (error: any) {
    logger.error('Error fetching pro forma:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/proforma/:dealId/initialize
 * Initialize pro forma for a deal with baseline values
 * 
 * Body:
 *   strategy: 'rental' | 'build_to_sell' | 'flip' | 'airbnb'
 *   baselineValues?: { rentGrowth: { baseline: 3.5 }, ... }
 */
router.post('/:dealId/initialize', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const { strategy, baselineValues } = req.body;
    
    if (!strategy) {
      return res.status(400).json({
        success: false,
        error: 'Strategy is required (rental, build_to_sell, flip, airbnb)'
      });
    }
    
    const proforma = await proformaAdjustmentService.initializeProForma(
      dealId,
      strategy,
      baselineValues
    );
    
    res.json({
      success: true,
      data: proforma,
      message: 'Pro forma initialized successfully'
    });
  } catch (error: any) {
    logger.error('Error initializing pro forma:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/proforma/:dealId/history
 * Get assumption history over time (time series)
 * 
 * Query params:
 *   limit: number (default 50)
 *   assumptionType: 'rent_growth' | 'vacancy' | 'opex_growth' | 'exit_cap' | 'absorption'
 */
router.get('/:dealId/history', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const { limit, assumptionType } = req.query;
    
    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    if (assumptionType) options.assumptionType = assumptionType;
    
    const adjustments = await proformaAdjustmentService.getAdjustments(dealId, options);
    
    res.json({
      success: true,
      data: adjustments,
      count: adjustments.length
    });
  } catch (error: any) {
    logger.error('Error fetching pro forma history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/proforma/:dealId/adjustments
 * Get news events affecting assumptions (with event details)
 * 
 * Query params:
 *   limit: number (default 20)
 */
router.get('/:dealId/adjustments', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const { limit } = req.query;
    
    const adjustments = await proformaAdjustmentService.getAdjustmentsWithEvents(
      dealId,
      limit ? parseInt(limit as string) : 20
    );
    
    res.json({
      success: true,
      data: adjustments,
      count: adjustments.length
    });
  } catch (error: any) {
    logger.error('Error fetching adjustments with events:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/proforma/:dealId/recalculate
 * Trigger recalculation of all assumptions based on latest news/demand signals
 * 
 * Body:
 *   triggerType: 'news_event' | 'demand_signal' | 'periodic_update'
 *   triggerEventId?: string (optional, if specific event triggered it)
 */
router.post('/:dealId/recalculate', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const userId = (req as any).user?.userId;
    const { triggerType, triggerEventId } = req.body;
    
    if (!triggerType) {
      return res.status(400).json({
        success: false,
        error: 'triggerType is required (news_event, demand_signal, periodic_update)'
      });
    }
    
    logger.info('Recalculating pro forma', { dealId, triggerType, triggerEventId });
    
    const proforma = await proformaAdjustmentService.recalculate({
      dealId,
      triggerType,
      triggerEventId,
      userId
    });
    
    res.json({
      success: true,
      data: proforma,
      message: 'Pro forma recalculated successfully'
    });
  } catch (error: any) {
    logger.error('Error recalculating pro forma:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/v1/proforma/:dealId/override
 * User override for a specific assumption
 * 
 * Body:
 *   assumptionType: 'rent_growth' | 'vacancy' | 'opex_growth' | 'exit_cap' | 'absorption'
 *   value: number
 *   reason: string
 */
router.patch('/:dealId/override', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const userId = (req as any).user?.userId;
    const { assumptionType, value, reason } = req.body;
    
    if (!assumptionType || value === undefined || !reason) {
      return res.status(400).json({
        success: false,
        error: 'assumptionType, value, and reason are required'
      });
    }
    
    const validTypes = ['rent_growth', 'vacancy', 'opex_growth', 'exit_cap', 'absorption'];
    if (!validTypes.includes(assumptionType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid assumptionType. Must be one of: ${validTypes.join(', ')}`
      });
    }
    
    logger.info('User overriding assumption', { dealId, assumptionType, value, reason });
    
    const proforma = await proformaAdjustmentService.overrideAssumption(
      dealId,
      assumptionType,
      parseFloat(value),
      reason,
      userId
    );
    
    res.json({
      success: true,
      data: proforma,
      message: `${assumptionType} overridden successfully`
    });
  } catch (error: any) {
    logger.error('Error overriding assumption:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/proforma/:dealId/comparison
 * Get side-by-side baseline vs. adjusted comparison
 */
router.get('/:dealId/comparison', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    
    const comparison = await proformaAdjustmentService.getComparison(dealId);
    
    res.json({
      success: true,
      data: comparison
    });
  } catch (error: any) {
    logger.error('Error fetching comparison:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/v1/proforma/:dealId/override/:assumptionType
 * Clear user override for an assumption (revert to news-adjusted or baseline)
 */
router.delete('/:dealId/override/:assumptionType', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId, assumptionType } = req.params;
    
    const validTypes = ['rent_growth', 'vacancy', 'opex_growth', 'exit_cap', 'absorption'];
    if (!validTypes.includes(assumptionType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid assumptionType. Must be one of: ${validTypes.join(', ')}`
      });
    }
    
    // Clear override by setting to NULL
    const proforma = await proformaAdjustmentService.overrideAssumption(
      dealId,
      assumptionType as any,
      null as any, // Will be handled by setting override to NULL
      'Override cleared',
      (req as any).user?.userId
    );
    
    res.json({
      success: true,
      data: proforma,
      message: `${assumptionType} override cleared`
    });
  } catch (error: any) {
    logger.error('Error clearing override:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/proforma/batch/recalculate
 * Recalculate pro forma for multiple deals (admin/background job)
 * 
 * Body:
 *   dealIds: string[] (optional, if not provided recalculates all active deals)
 */
router.post('/batch/recalculate', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealIds } = req.body;
    const userId = (req as any).user?.userId;
    
    // Check if user has admin permissions (implement based on your auth system)
    // For now, allow all authenticated users
    
    let recalculatedCount = 0;
    const errors: any[] = [];
    
    if (dealIds && Array.isArray(dealIds)) {
      // Recalculate specific deals
      for (const dealId of dealIds) {
        try {
          await proformaAdjustmentService.recalculate({
            dealId,
            triggerType: 'periodic_update',
            userId
          });
          recalculatedCount++;
        } catch (error: any) {
          errors.push({ dealId, error: error.message });
        }
      }
    } else {
      // Recalculate all active deals
      logger.info('Batch recalculating all active deals');
      
      // This would be better as a background job, but for now we'll do it synchronously
      // In production, use a job queue (Bull, BeeQueue, etc.)
      
      res.status(202).json({
        success: true,
        message: 'Batch recalculation started (not yet implemented for all deals)',
        note: 'Provide dealIds array to recalculate specific deals'
      });
      return;
    }
    
    res.json({
      success: true,
      recalculatedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Recalculated ${recalculatedCount} deal(s)`
    });
  } catch (error: any) {
    logger.error('Error in batch recalculation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/proforma/:dealId/export
 * Export pro forma comparison for investment memos (formatted data)
 */
router.get('/:dealId/export', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const { format } = req.query; // 'json', 'csv', 'markdown' (future)
    
    const comparison = await proformaAdjustmentService.getComparison(dealId);
    
    if (format === 'csv') {
      // Generate CSV format
      const csv = generateCSV(comparison);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="proforma-${dealId}.csv"`);
      res.send(csv);
    } else if (format === 'markdown') {
      // Generate markdown format
      const markdown = generateMarkdown(comparison);
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="proforma-${dealId}.md"`);
      res.send(markdown);
    } else {
      // Default: JSON
      res.json({
        success: true,
        data: comparison,
        exportedAt: new Date().toISOString()
      });
    }
  } catch (error: any) {
    logger.error('Error exporting pro forma:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function generateCSV(comparison: any): string {
  const lines = [
    'Deal Name,Strategy,Assumption,Baseline,Adjusted,Difference,% Change',
    `${comparison.dealName},${comparison.strategy},Rent Growth,${comparison.baseline.rentGrowth.baseline}%,${comparison.baseline.rentGrowth.effective}%,${comparison.differences.rentGrowth.toFixed(2)}%,${((comparison.differences.rentGrowth / comparison.baseline.rentGrowth.baseline) * 100).toFixed(1)}%`,
    `${comparison.dealName},${comparison.strategy},Vacancy,${comparison.baseline.vacancy.baseline}%,${comparison.baseline.vacancy.effective}%,${comparison.differences.vacancy.toFixed(2)}%,${((comparison.differences.vacancy / comparison.baseline.vacancy.baseline) * 100).toFixed(1)}%`,
    `${comparison.dealName},${comparison.strategy},OpEx Growth,${comparison.baseline.opexGrowth.baseline}%,${comparison.baseline.opexGrowth.effective}%,${comparison.differences.opexGrowth.toFixed(2)}%,${((comparison.differences.opexGrowth / comparison.baseline.opexGrowth.baseline) * 100).toFixed(1)}%`,
    `${comparison.dealName},${comparison.strategy},Exit Cap,${comparison.baseline.exitCap.baseline}%,${comparison.baseline.exitCap.effective}%,${comparison.differences.exitCap.toFixed(2)}%,${((comparison.differences.exitCap / comparison.baseline.exitCap.baseline) * 100).toFixed(1)}%`,
    `${comparison.dealName},${comparison.strategy},Absorption,${comparison.baseline.absorption.baseline} leases/mo,${comparison.baseline.absorption.effective} leases/mo,${comparison.differences.absorption.toFixed(2)},${((comparison.differences.absorption / comparison.baseline.absorption.baseline) * 100).toFixed(1)}%`
  ];
  
  return lines.join('\n');
}

function generateMarkdown(comparison: any): string {
  const md = `# Pro Forma Comparison: ${comparison.dealName}

**Strategy:** ${comparison.strategy}

## Assumptions Comparison

| Assumption | Baseline | News-Adjusted | Difference | % Change |
|------------|----------|---------------|------------|----------|
| Rent Growth | ${comparison.baseline.rentGrowth.baseline}% | ${comparison.baseline.rentGrowth.effective}% | ${comparison.differences.rentGrowth.toFixed(2)}% | ${((comparison.differences.rentGrowth / comparison.baseline.rentGrowth.baseline) * 100).toFixed(1)}% |
| Vacancy | ${comparison.baseline.vacancy.baseline}% | ${comparison.baseline.vacancy.effective}% | ${comparison.differences.vacancy.toFixed(2)}% | ${((comparison.differences.vacancy / comparison.baseline.vacancy.baseline) * 100).toFixed(1)}% |
| OpEx Growth | ${comparison.baseline.opexGrowth.baseline}% | ${comparison.baseline.opexGrowth.effective}% | ${comparison.differences.opexGrowth.toFixed(2)}% | ${((comparison.differences.opexGrowth / comparison.baseline.opexGrowth.baseline) * 100).toFixed(1)}% |
| Exit Cap Rate | ${comparison.baseline.exitCap.baseline}% | ${comparison.baseline.exitCap.effective}% | ${comparison.differences.exitCap.toFixed(2)}% | ${((comparison.differences.exitCap / comparison.baseline.exitCap.baseline) * 100).toFixed(1)}% |
| Absorption Rate | ${comparison.baseline.absorption.baseline} leases/mo | ${comparison.baseline.absorption.effective} leases/mo | ${comparison.differences.absorption.toFixed(2)} | ${((comparison.differences.absorption / comparison.baseline.absorption.baseline) * 100).toFixed(1)}% |

## Recent News Events

${comparison.recentAdjustments.map((adj: any, i: number) => 
  `${i + 1}. **${adj.assumptionType}** adjusted by ${adj.adjustmentDelta > 0 ? '+' : ''}${adj.adjustmentDelta.toFixed(2)} (${adj.newsHeadline || 'Manual adjustment'})`
).join('\n')}

---
*Generated on ${new Date().toISOString()}*
`;
  
  return md;
}

export default router;
