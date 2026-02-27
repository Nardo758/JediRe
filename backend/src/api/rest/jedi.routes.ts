/**
 * JEDI Score & Alerts API Routes
 * 
 * Endpoints for JEDI Score calculation, history, and alert management
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { jediScoreService } from '../../services/jedi-score.service';
import { dealAlertService } from '../../services/deal-alert.service';

const router = Router();
const logger = { 
  error: (...args: any[]) => console.error(...args),
  info: (...args: any[]) => console.log(...args)
};

// ============================================================================
// JEDI Score Routes
// ============================================================================

/**
 * GET /api/v1/jedi/score/:dealId
 * Get current JEDI Score for a deal with breakdown
 */
router.get('/score/:dealId', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;

    // Get latest score from history
    const latestScore = await jediScoreService.getLatestScore(dealId);

    if (!latestScore) {
      // Calculate initial score if none exists
      const newScore = await jediScoreService.calculateAndSave({
        dealId,
        triggerType: 'manual_recalc',
      });

      return res.json({
        success: true,
        data: {
          score: newScore,
          isInitial: true,
        },
      });
    }

    // Get 30-day trend
    const historyLast30Days = await jediScoreService.getScoreHistory(dealId, { days: 30 });
    
    const trend = historyLast30Days.length > 1 ? {
      direction: latestScore.scoreDelta && latestScore.scoreDelta > 0 ? 'up' : 
                 latestScore.scoreDelta && latestScore.scoreDelta < 0 ? 'down' : 'flat',
      change: latestScore.scoreDelta || 0,
      dataPoints: historyLast30Days.length,
    } : null;

    res.json({
      success: true,
      data: {
        score: latestScore,
        trend,
        breakdown: {
          demand: {
            score: latestScore.demandScore,
            contribution: latestScore.demandContribution,
            weight: 0.30,
          },
          supply: {
            score: latestScore.supplyScore,
            contribution: latestScore.supplyContribution,
            weight: 0.25,
          },
          momentum: {
            score: latestScore.momentumScore,
            contribution: latestScore.momentumContribution,
            weight: 0.20,
          },
          position: {
            score: latestScore.positionScore,
            contribution: latestScore.positionContribution,
            weight: 0.15,
          },
          risk: {
            score: latestScore.riskScore,
            contribution: latestScore.riskContribution,
            weight: 0.10,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching JEDI Score:', error);
    next(error);
  }
});

/**
 * POST /api/v1/jedi/score/:dealId/recalculate
 * Manually trigger JEDI Score recalculation
 */
router.post('/score/:dealId/recalculate', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const userId = (req as any).user?.userId;

    const newScore = await jediScoreService.calculateAndSave({
      dealId,
      triggerType: 'manual_recalc',
    });

    // Check if score change warrants an alert
    if (newScore.scoreDelta && Math.abs(newScore.scoreDelta) >= 2.0) {
      await dealAlertService.generateScoreChangeAlert(
        dealId,
        userId,
        newScore.previousScore!,
        newScore.totalScore
      );
    }

    res.json({
      success: true,
      data: newScore,
    });
  } catch (error) {
    logger.error('Error recalculating JEDI Score:', error);
    next(error);
  }
});

/**
 * GET /api/v1/jedi/history/:dealId
 * Get JEDI Score history for a deal
 */
router.get('/history/:dealId', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const { limit = 50, offset = 0, days } = req.query;

    const history = await jediScoreService.getScoreHistory(dealId, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      days: days ? parseInt(days as string) : undefined,
    });

    // Calculate statistics
    const scores = history.map(h => h.totalScore);
    const stats = scores.length > 0 ? {
      current: scores[0],
      min: Math.min(...scores),
      max: Math.max(...scores),
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      volatility: calculateVolatility(scores),
    } : null;

    res.json({
      success: true,
      data: {
        history,
        stats,
        count: history.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching JEDI Score history:', error);
    next(error);
  }
});

/**
 * GET /api/v1/jedi/impact/:dealId
 * Get events impacting this deal's JEDI Score
 */
router.get('/impact/:dealId', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const { limit = 20 } = req.query;

    const events = await jediScoreService.getImpactingEvents(
      dealId,
      parseInt(limit as string)
    );

    // Group events by category
    const grouped = events.reduce((acc: any, event: any) => {
      const category = event.event_category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(event);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        events,
        grouped,
        total: events.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching impacting events:', error);
    next(error);
  }
});

// ============================================================================
// Alert Routes
// ============================================================================

/**
 * GET /api/v1/alerts
 * Get user's active alerts
 */
router.get('/alerts', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { unread_only = 'false', limit = 50, offset = 0 } = req.query;

    const alerts = await dealAlertService.getUserAlerts(userId, {
      unreadOnly: unread_only === 'true',
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    // Group by severity
    const grouped = alerts.reduce((acc: any, alert) => {
      if (!acc[alert.severity]) {
        acc[alert.severity] = [];
      }
      acc[alert.severity].push(alert);
      return acc;
    }, { green: [], yellow: [], red: [] });

    res.json({
      success: true,
      data: {
        alerts,
        grouped,
        counts: {
          total: alerts.length,
          unread: alerts.filter(a => !a.isRead).length,
          green: grouped.green.length,
          yellow: grouped.yellow.length,
          red: grouped.red.length,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    next(error);
  }
});

/**
 * GET /api/v1/alerts/deal/:dealId
 * Get alerts for a specific deal
 */
router.get('/alerts/deal/:dealId', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const { limit = 20 } = req.query;

    const alerts = await dealAlertService.getDealAlerts(
      dealId,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    logger.error('Error fetching deal alerts:', error);
    next(error);
  }
});

/**
 * POST /api/v1/alerts/:id/read
 * Mark an alert as read
 */
router.post('/alerts/:id/read', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    await dealAlertService.markAsRead(id, userId);

    res.json({
      success: true,
      message: 'Alert marked as read',
    });
  } catch (error) {
    logger.error('Error marking alert as read:', error);
    next(error);
  }
});

/**
 * POST /api/v1/alerts/:id/dismiss
 * Dismiss an alert
 */
router.post('/alerts/:id/dismiss', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    await dealAlertService.dismissAlert(id, userId);

    res.json({
      success: true,
      message: 'Alert dismissed',
    });
  } catch (error) {
    logger.error('Error dismissing alert:', error);
    next(error);
  }
});

/**
 * GET /api/v1/alerts/settings
 * Get user's alert configuration
 */
router.get('/alerts/settings', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;

    const config = await dealAlertService.getUserConfiguration(userId);

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error('Error fetching alert settings:', error);
    next(error);
  }
});

/**
 * PATCH /api/v1/alerts/settings
 * Update user's alert configuration
 */
router.patch('/alerts/settings', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const updates = req.body;

    const config = await dealAlertService.updateUserConfiguration(userId, updates);

    res.json({
      success: true,
      data: config,
      message: 'Alert settings updated',
    });
  } catch (error) {
    logger.error('Error updating alert settings:', error);
    next(error);
  }
});

/**
 * POST /api/v1/alerts/check
 * Manually trigger alert check for user's deals
 */
router.post('/alerts/check', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;

    const alertsGenerated = await dealAlertService.checkDealsForAlerts(userId);

    res.json({
      success: true,
      data: {
        alertsGenerated,
      },
      message: `Generated ${alertsGenerated} new alert(s)`,
    });
  } catch (error) {
    logger.error('Error checking for alerts:', error);
    next(error);
  }
});

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * POST /api/v1/jedi/recalculate-all
 * Recalculate JEDI Scores for all active deals (admin only)
 */
router.post('/recalculate-all', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Add admin check
    const count = await jediScoreService.recalculateAllScores();

    res.json({
      success: true,
      data: {
        dealsProcessed: count,
      },
      message: `Recalculated scores for ${count} deal(s)`,
    });
  } catch (error) {
    logger.error('Error recalculating all scores:', error);
    next(error);
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function calculateVolatility(scores: number[]): number {
  if (scores.length < 2) return 0;
  
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  return Math.sqrt(variance);
}

export default router;
