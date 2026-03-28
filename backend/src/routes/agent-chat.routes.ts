/**
 * Agent Chat API Routes
 * 
 * Endpoints for real-time chat with JEDI agents
 * 
 * @version 1.0.0
 * @date 2026-03-28
 */

import { Router, Request, Response } from 'express';
import { 
  agentChat, 
  sendMobileNotification,
  getUserNotifications,
  markNotificationRead,
  AgentCode 
} from '../services/agent-chat.service';
import {
  sendPushNotification,
  registerPushToken,
  unregisterPushToken,
  isPushServiceAvailable,
} from '../services/push-notification.service';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authMiddleware.requireAuth);

/**
 * POST /api/v1/agents/chat
 * Send a message to a specific agent
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { agentCode, message, dealId, msaId, sessionId } = req.body;
    const userId = (req as any).user?.id;

    if (!agentCode || !message) {
      return res.status(400).json({
        success: false,
        error: 'agentCode and message are required',
      });
    }

    // Validate agent code
    const validAgents: AgentCode[] = [
      'ORCHESTRATOR', 'SUPPLY', 'DEMAND', 'NEWS', 'DEBT',
      'STRATEGY', 'CASH', 'ZONING', 'COMPS', 'RISK'
    ];

    if (!validAgents.includes(agentCode)) {
      return res.status(400).json({
        success: false,
        error: `Invalid agent code. Valid options: ${validAgents.join(', ')}`,
      });
    }

    const response = await agentChat({
      agentCode,
      message,
      dealId,
      msaId,
      userId,
      sessionId,
    });

    return res.json({
      success: true,
      data: response,
    });

  } catch (error: any) {
    logger.error('Agent chat error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process chat request',
    });
  }
});

/**
 * GET /api/v1/agents/status
 * Get status of all agents
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Return agent status (in production, this would query actual agent health)
    const agents = [
      { code: 'ORCHESTRATOR', name: 'JEDI Orchestrator', emoji: '🤖', status: 'online', color: '#00D4FF' },
      { code: 'SUPPLY', name: 'Supply Agent', emoji: '📦', status: 'online', color: '#F5A623' },
      { code: 'DEMAND', name: 'Demand Agent', emoji: '📈', status: 'online', color: '#7ED321' },
      { code: 'NEWS', name: 'News Agent', emoji: '📰', status: 'online', color: '#4A90E2' },
      { code: 'DEBT', name: 'Debt Agent', emoji: '🏦', status: 'online', color: '#9B59B6' },
      { code: 'STRATEGY', name: 'Strategy Agent', emoji: '🎯', status: 'online', color: '#E74C3C' },
      { code: 'CASH', name: 'Cash Agent', emoji: '💰', status: 'online', color: '#27AE60' },
      { code: 'ZONING', name: 'Zoning Agent', emoji: '📋', status: 'online', color: '#8E44AD' },
      { code: 'COMPS', name: 'Comps Agent', emoji: '🏢', status: 'online', color: '#3498DB' },
      { code: 'RISK', name: 'Risk Agent', emoji: '⚠️', status: 'online', color: '#E67E22' },
    ];

    return res.json({
      success: true,
      data: { agents },
    });

  } catch (error: any) {
    logger.error('Agent status error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get agent status',
    });
  }
});

/**
 * POST /api/v1/agents/notify
 * Send a notification to user's mobile (used by agents)
 */
router.post('/notify', async (req: Request, res: Response) => {
  try {
    const { title, body, priority, dealId, agentSource, actionUrl } = req.body;
    const userId = (req as any).user?.id;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: 'title and body are required',
      });
    }

    const success = await sendMobileNotification({
      userId,
      title,
      body,
      priority: priority || 'normal',
      dealId,
      agentSource: agentSource || 'ORCHESTRATOR',
      actionUrl,
    });

    return res.json({
      success,
      message: success ? 'Notification sent' : 'Failed to send notification',
    });

  } catch (error: any) {
    logger.error('Notification error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send notification',
    });
  }
});

/**
 * GET /api/v1/agents/notifications
 * Get user's notifications
 */
router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unread_only === 'true';

    const notifications = await getUserNotifications(userId, limit, unreadOnly);

    return res.json({
      success: true,
      data: { notifications },
    });

  } catch (error: any) {
    logger.error('Get notifications error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get notifications',
    });
  }
});

/**
 * POST /api/v1/agents/notifications/:id/read
 * Mark a notification as read
 */
router.post('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const notificationId = req.params.id;

    const success = await markNotificationRead(notificationId, userId);

    return res.json({
      success,
      message: success ? 'Notification marked as read' : 'Notification not found or already read',
    });

  } catch (error: any) {
    logger.error('Mark notification read error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark notification as read',
    });
  }
});

// ============================================================================
// Push Token Management
// ============================================================================

/**
 * POST /api/v1/agents/push/register
 * Register a push notification token for the current user's device
 */
router.post('/push/register', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { token, platform, deviceName } = req.body;

    if (!token || !platform) {
      return res.status(400).json({
        success: false,
        error: 'token and platform are required',
      });
    }

    if (!['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'platform must be ios, android, or web',
      });
    }

    const success = await registerPushToken(userId, token, platform, deviceName);

    return res.json({
      success,
      message: success ? 'Push token registered' : 'Failed to register token',
    });

  } catch (error: any) {
    logger.error('Push register error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to register push token',
    });
  }
});

/**
 * POST /api/v1/agents/push/unregister
 * Unregister a push notification token
 */
router.post('/push/unregister', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'token is required',
      });
    }

    const success = await unregisterPushToken(token);

    return res.json({
      success,
      message: success ? 'Push token unregistered' : 'Token not found',
    });

  } catch (error: any) {
    logger.error('Push unregister error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to unregister push token',
    });
  }
});

/**
 * GET /api/v1/agents/push/status
 * Check if push notifications are available
 */
router.get('/push/status', async (req: Request, res: Response) => {
  try {
    const available = await isPushServiceAvailable();

    return res.json({
      success: true,
      data: {
        pushEnabled: available,
        provider: available ? 'firebase' : null,
      },
    });

  } catch (error: any) {
    logger.error('Push status error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to check push status',
    });
  }
});

/**
 * POST /api/v1/agents/push/test
 * Send a test push notification to the current user
 */
router.post('/push/test', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const result = await sendPushNotification({
      userId,
      title: '🤖 JEDI Test Notification',
      body: 'Push notifications are working! You\'ll receive alerts here.',
      priority: 'high',
      data: {
        type: 'test',
        agentSource: 'ORCHESTRATOR',
      },
    });

    return res.json({
      success: result.sent > 0,
      data: result,
      message: result.sent > 0 
        ? `Test notification sent to ${result.sent} device(s)` 
        : 'No registered devices or push not configured',
    });

  } catch (error: any) {
    logger.error('Push test error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send test notification',
    });
  }
});

export default router;
