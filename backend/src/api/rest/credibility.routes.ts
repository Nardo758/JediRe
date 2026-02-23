/**
 * Source Credibility API Routes
 * Endpoints for accessing source credibility, corroboration tracking,
 * and network intelligence value.
 */

import { Router, Request, Response } from 'express';
import sourceCredibilityService from '../../services/source-credibility.service';
import { authenticateToken } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/v1/credibility/sources
 * List all sources with credibility scores
 */
router.get('/sources', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const sources = await sourceCredibilityService.listSources(userId);

    res.json({
      success: true,
      data: sources,
      count: sources.length
    });
  } catch (error) {
    console.error('Error fetching sources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sources'
    });
  }
});

/**
 * GET /api/v1/credibility/source/:email
 * Get detailed source profile
 */
router.get('/source/:email', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { email } = req.params;

    const source = await sourceCredibilityService.getSourceCredibility(
      userId,
      decodeURIComponent(email)
    );

    if (!source) {
      return res.status(404).json({
        success: false,
        error: 'Source not found'
      });
    }

    res.json({
      success: true,
      data: source
    });
  } catch (error) {
    console.error('Error fetching source:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch source'
    });
  }
});

/**
 * GET /api/v1/credibility/corroborations
 * Get recent corroborations
 */
router.get('/corroborations', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 20;

    const corroborations = await sourceCredibilityService.getRecentCorroborations(
      userId,
      limit
    );

    res.json({
      success: true,
      data: corroborations,
      count: corroborations.length
    });
  } catch (error) {
    console.error('Error fetching corroborations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch corroborations'
    });
  }
});

/**
 * POST /api/v1/credibility/match
 * Manual corroboration match
 */
router.post('/match', async (req: Request, res: Response) => {
  try {
    const { privateEventId, publicEventId } = req.body;

    if (!privateEventId || !publicEventId) {
      return res.status(400).json({
        success: false,
        error: 'Both privateEventId and publicEventId are required'
      });
    }

    // This would need additional logic to create the match object
    // For now, we'll return a placeholder
    res.status(501).json({
      success: false,
      error: 'Manual matching not yet implemented'
    });
  } catch (error) {
    console.error('Error creating manual match:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create manual match'
    });
  }
});

/**
 * GET /api/v1/credibility/network-value
 * Get intelligence value rankings
 */
router.get('/network-value', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const rankings = await sourceCredibilityService.getNetworkIntelligenceValue(userId);

    // Group by tier
    const topTier = rankings.filter(r => r.tier === 'top');
    const midTier = rankings.filter(r => r.tier === 'mid');
    const lowTier = rankings.filter(r => r.tier === 'low');

    res.json({
      success: true,
      data: {
        all: rankings,
        byTier: {
          top: topTier,
          mid: midTier,
          low: lowTier
        },
        summary: {
          totalSources: rankings.length,
          topTierCount: topTier.length,
          midTierCount: midTier.length,
          lowTierCount: lowTier.length,
          avgIntelligenceValue: rankings.length > 0
            ? rankings.reduce((sum, r) => sum + r.intelligenceValueScore, 0) / rankings.length
            : 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching network value:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch network intelligence value'
    });
  }
});

/**
 * GET /api/v1/credibility/predictions/:eventId
 * Get predicted accuracy for an event
 */
router.get('/predictions/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    const prediction = await sourceCredibilityService.generatePrediction(eventId);

    if (!prediction) {
      return res.status(404).json({
        success: false,
        error: 'Event not found or prediction not available'
      });
    }

    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    console.error('Error generating prediction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate prediction'
    });
  }
});

/**
 * POST /api/v1/credibility/detect-corroborations
 * Trigger automated corroboration detection
 * Admin/background job endpoint
 */
router.post('/detect-corroborations', async (req: Request, res: Response) => {
  try {
    const matches = await sourceCredibilityService.detectCorroborations();

    res.json({
      success: true,
      data: {
        matchesFound: matches.length,
        matches: matches
      }
    });
  } catch (error) {
    console.error('Error detecting corroborations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect corroborations'
    });
  }
});

/**
 * GET /api/v1/credibility/stats
 * Get overall credibility statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const sources = await sourceCredibilityService.listSources(userId);
    const networkValue = await sourceCredibilityService.getNetworkIntelligenceValue(userId);

    const totalSignals = sources.reduce((sum, s) => sum + s.totalSignals, 0);
    const corroboratedSignals = sources.reduce((sum, s) => sum + s.corroboratedSignals, 0);
    const pendingSignals = sources.reduce((sum, s) => sum + s.pendingSignals, 0);
    const failedSignals = sources.reduce((sum, s) => sum + s.failedSignals, 0);

    const avgCredibility = sources.length > 0
      ? sources.reduce((sum, s) => sum + s.credibilityScore, 0) / sources.length
      : 0;

    const avgLeadTime = sources.length > 0
      ? sources.reduce((sum, s) => sum + s.avgLeadTimeDays, 0) / sources.length
      : 0;

    res.json({
      success: true,
      data: {
        totalSources: sources.length,
        totalSignals,
        corroboratedSignals,
        pendingSignals,
        failedSignals,
        avgCredibility: Math.round(avgCredibility * 100),
        avgLeadTimeDays: Math.round(avgLeadTime),
        networkValue: {
          topTierSources: networkValue.filter(v => v.tier === 'top').length,
          midTierSources: networkValue.filter(v => v.tier === 'mid').length,
          lowTierSources: networkValue.filter(v => v.tier === 'low').length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

export default router;
