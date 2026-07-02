/**
 * Strategy Analyses API Routes
 * Handle strategy analysis data for deals
 */

import { Router, Request, Response } from 'express';
import { assertDealOrgAccess } from '../../services/deal-scoping.service';
import { requireAuth } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { bustAdvisorCache } from '../../services/debt-advisor/debt-plan-formulator.service';
import { bustM08Cache } from '../../services/m08-strategies.service';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/strategy-analyses
 * Save a strategy selection
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId, strategySlug, assumptions, roiMetrics, riskScore, recommended } = req.body;

    // Validation
    if (!dealId || !strategySlug) {
      return res.status(400).json({
        success: false,
        error: 'dealId and strategySlug are required'
      });
    }

    // Verify user has access to this deal
    if (!await assertDealOrgAccess(dealId, userId, { query } as any).catch(() => null)) {
      return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
    }

    // Create strategy analysis
    const result = await query(
      `INSERT INTO strategy_analyses 
       (deal_id, strategy_slug, assumptions, roi_metrics, risk_score, recommended)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dealId,
        strategySlug,
        JSON.stringify(assumptions || {}),
        JSON.stringify(roiMetrics || {}),
        riskScore || null,
        recommended || false
      ]
    );

    logger.info('Strategy analysis created:', {
      userId,
      dealId,
      strategySlug,
      analysisId: result.rows[0].id
    });

    // Bust M08 + Debt Advisor caches so next GET recomputes with updated strategy output.
    // strategy_analyses is read by getPrimaryStrategyForDeal(), so M08 cache must be
    // invalidated whenever the recommended strategy changes.
    try { bustM08Cache(dealId); } catch (_) {}
    try { bustAdvisorCache(dealId); } catch (_) {}

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error creating strategy analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create strategy analysis'
    });
  }
});

/**
 * GET /api/v1/strategy-analyses/:dealId
 * Get strategy analyses for a deal
 */
router.get('/:dealId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;

    // Verify user has access to this deal
    if (!await assertDealOrgAccess(dealId, userId, { query } as any).catch(() => null)) {
      return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
    }

    // Get all strategy analyses for this deal
    const result = await query(
      `SELECT * FROM strategy_analyses 
       WHERE deal_id = $1
       ORDER BY created_at DESC`,
      [dealId]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    logger.error('Error fetching strategy analyses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch strategy analyses'
    });
  }
});

/**
 * POST /api/v1/strategy-analyses/compare
 * Compare multiple strategies for a deal
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId, strategySlugs } = req.body;

    // Validation
    if (!dealId || !strategySlugs || !Array.isArray(strategySlugs)) {
      return res.status(400).json({
        success: false,
        error: 'dealId and strategySlugs array are required'
      });
    }

    // Verify user has access to this deal
    if (!await assertDealOrgAccess(dealId, userId, { query } as any).catch(() => null)) {
      return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
    }

    // Get strategy analyses for the specified strategies
    const placeholders = strategySlugs.map((_, i) => `$${i + 2}`).join(', ');
    const result = await query(
      `SELECT * FROM strategy_analyses 
       WHERE deal_id = $1 AND strategy_slug IN (${placeholders})
       ORDER BY recommended DESC, risk_score ASC`,
      [dealId, ...strategySlugs]
    );

    // Calculate comparison metrics
    const comparison = result.rows.map(strategy => ({
      ...strategy,
      irr: strategy.roi_metrics?.irr || 0,
      risk_score: strategy.risk_score || 0,
      timeline_months: strategy.roi_metrics?.timeline_months || 0,
      capex: strategy.roi_metrics?.capex || 0
    }));

    // Find best and worst performers
    const bestIRR = comparison.reduce((best, curr) => 
      curr.irr > best.irr ? curr : best, comparison[0] || {});
    const lowestRisk = comparison.reduce((best, curr) => 
      curr.risk_score < best.risk_score ? curr : best, comparison[0] || {});

    res.json({
      success: true,
      data: {
        strategies: comparison,
        insights: {
          bestIRR: bestIRR?.strategy_slug,
          lowestRisk: lowestRisk?.strategy_slug,
          totalCompared: comparison.length
        }
      }
    });

  } catch (error) {
    logger.error('Error comparing strategies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare strategies'
    });
  }
});

/**
 * PATCH /api/v1/strategy-analyses/:id
 * Update a strategy analysis
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const { assumptions, roiMetrics, riskScore, recommended } = req.body;

    // Verify the analysis exists and user has access to the deal
    const analysisCheck = await query(
      `SELECT sa.id, sa.deal_id FROM strategy_analyses sa
       JOIN deals d ON sa.deal_id = d.id
       WHERE sa.id = $1 AND d.user_id = $2`,
      [id, userId]
    );

    if (analysisCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy analysis not found or access denied'
      });
    }
    const updatedDealId: string = analysisCheck.rows[0].deal_id;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (assumptions !== undefined) {
      updates.push(`assumptions = $${paramIndex++}`);
      values.push(JSON.stringify(assumptions));
    }
    if (roiMetrics !== undefined) {
      updates.push(`roi_metrics = $${paramIndex++}`);
      values.push(JSON.stringify(roiMetrics));
    }
    if (riskScore !== undefined) {
      updates.push(`risk_score = $${paramIndex++}`);
      values.push(riskScore);
    }
    if (recommended !== undefined) {
      updates.push(`recommended = $${paramIndex++}`);
      values.push(recommended);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    values.push(id);
    const result = await query(
      `UPDATE strategy_analyses 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    logger.info('Strategy analysis updated:', {
      userId,
      analysisId: id
    });

    // Bust M08 + Debt Advisor caches — strategy content changed, next GET recomputes
    try { bustM08Cache(updatedDealId); } catch (_) {}
    try { bustAdvisorCache(updatedDealId); } catch (_) {}

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error updating strategy analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update strategy analysis'
    });
  }
});

/**
 * DELETE /api/v1/strategy-analyses/:id
 * Delete a strategy analysis
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    // Verify the analysis exists and user has access to the deal
    const analysisCheck = await query(
      `SELECT sa.id FROM strategy_analyses sa
       JOIN deals d ON sa.deal_id = d.id
       WHERE sa.id = $1 AND d.user_id = $2`,
      [id, userId]
    );

    if (analysisCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy analysis not found or access denied'
      });
    }

    await query('DELETE FROM strategy_analyses WHERE id = $1', [id]);

    logger.info('Strategy analysis deleted:', {
      userId,
      analysisId: id
    });

    res.json({
      success: true,
      message: 'Strategy analysis deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting strategy analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete strategy analysis'
    });
  }
});

export default router;
