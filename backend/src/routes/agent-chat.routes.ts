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
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

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

export default router;
