/**
 * Deal Actuals REST API
 * Routes for logging and retrieving actual performance data
 */

import { Router, Request, Response } from 'express';
import { dealActualsService } from '../../services/deal-actuals.service';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// Deal Actuals (Monthly Performance)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/deals/:dealId/actuals
 * Log monthly actuals for a deal
 */
router.post('/:dealId/actuals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const input = { ...req.body, deal_id: dealId };
    const createdBy = req.user?.id || 'system';

    const actual = await dealActualsService.logActuals(input, createdBy);

    res.json({
      success: true,
      data: actual,
    });
  } catch (error) {
    console.error('Error logging actuals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log actuals',
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/actuals
 * Get actuals for a deal
 */
router.get('/:dealId/actuals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const limit = parseInt(req.query.limit as string) || 12;

    const actuals = await dealActualsService.getActuals(dealId, limit);

    res.json({
      success: true,
      data: actuals,
      count: actuals.length,
    });
  } catch (error) {
    console.error('Error fetching actuals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch actuals',
    });
  }
});

/**
 * PUT /api/v1/deals/:dealId/actuals/:id/verify
 * Verify actuals (mark as reviewed)
 */
router.put('/:dealId/actuals/:id/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const verifiedBy = req.user?.id || 'system';

    const actual = await dealActualsService.verifyActuals(parseInt(id), verifiedBy);

    res.json({
      success: true,
      data: actual,
    });
  } catch (error) {
    console.error('Error verifying actuals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify actuals',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Traffic Logs
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/deals/:dealId/traffic
 * Log traffic data
 */
router.post('/:dealId/traffic', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const input = { ...req.body, deal_id: dealId };
    const createdBy = req.user?.id || 'system';

    const traffic = await dealActualsService.logTraffic(input, createdBy);

    res.json({
      success: true,
      data: traffic,
    });
  } catch (error) {
    console.error('Error logging traffic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log traffic',
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/traffic
 * Get traffic logs for a deal
 */
router.get('/:dealId/traffic', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const limit = parseInt(req.query.limit as string) || 12;

    const logs = await dealActualsService.getTrafficLogs(dealId, limit);

    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Error fetching traffic logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch traffic logs',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Flywheel Feeds
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/deals/:dealId/flywheel-feeds
 * Create or update flywheel feed
 */
router.post('/:dealId/flywheel-feeds', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const input = { ...req.body, deal_id: dealId };

    const feed = await dealActualsService.upsertFlywheelFeed(input);

    res.json({
      success: true,
      data: feed,
    });
  } catch (error) {
    console.error('Error upserting flywheel feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upsert flywheel feed',
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/flywheel-feeds
 * Get flywheel feeds for a deal
 */
router.get('/:dealId/flywheel-feeds', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    const feeds = await dealActualsService.getFlywheelFeeds(dealId);

    res.json({
      success: true,
      data: feeds,
      count: feeds.length,
    });
  } catch (error) {
    console.error('Error fetching flywheel feeds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch flywheel feeds',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Summary / Dashboard
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/deals/:dealId/actuals-summary
 * Get actuals summary for dashboard
 */
router.get('/:dealId/actuals-summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    const summary = await dealActualsService.getActualsSummary(dealId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching actuals summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch actuals summary',
    });
  }
});

export default router;
