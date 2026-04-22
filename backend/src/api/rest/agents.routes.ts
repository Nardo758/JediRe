/**
 * Agent API Routes
 * 
 * Endpoints for interacting with autonomous agents:
 * - Chat with specific agents or let orchestrator route
 * - Get agent list and configurations
 * - View agent activity and notifications
 * - Trigger agent workflows
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { agentOrchestrator } from '../../services/agents/agent-orchestrator';
import { eventDispatcher } from '../../services/agents/event-dispatcher';
import { AGENT_PERSONAS, getAgentById, getAgentsWithSkill } from '../../services/agents/agent-personas';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// ============================================================================
// AGENT LIST & INFO
// ============================================================================

/**
 * GET /api/v1/agents
 * List all agent personas
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const agents = AGENT_PERSONAS.map(agent => ({
      id: agent.id,
      name: agent.name,
      shortName: agent.shortName,
      role: agent.role,
      description: agent.description,
      icon: agent.icon,
      color: agent.color,
      allowedSkills: agent.allowedSkills,
      canWorkAutonomously: agent.canWorkAutonomously,
      triggers: agent.triggers.map(t => ({
        event: t.event,
        action: t.action,
        description: t.description,
      })),
    }));

    return res.json({
      success: true,
      agents,
      total: agents.length,
    });
  } catch (error: any) {
    logger.error('Error listing agents:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/agents/:agentId
 * Get specific agent details
 */
router.get('/:agentId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { agentId } = req.params;
    const agent = getAgentById(agentId);

    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    return res.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        shortName: agent.shortName,
        role: agent.role,
        description: agent.description,
        icon: agent.icon,
        color: agent.color,
        allowedSkills: agent.allowedSkills,
        canWorkAutonomously: agent.canWorkAutonomously,
        triggers: agent.triggers,
        notificationChannels: agent.notificationChannels,
        priority: agent.priority,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// AGENT CHAT
// ============================================================================

/**
 * POST /api/v1/agents/chat
 * Chat with an agent (orchestrator routes if no agentId specified)
 */
router.post('/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, agentId, dealId, conversationId } = req.body;
    const userId = req.user!.userId;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const response = await agentOrchestrator.processRequest({
      message,
      agentId,
      context: {
        userId,
        dealId,
        conversationId,
      },
    });

    return res.json({
      success: true,
      ...response,
    });
  } catch (error: any) {
    logger.error('Agent chat error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/agents/:agentId/chat
 * Chat with a specific agent
 */
router.post('/:agentId/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { agentId } = req.params;
    const { message, dealId, conversationId } = req.body;
    const userId = req.user!.userId;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const agent = getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const response = await agentOrchestrator.processRequest({
      message,
      agentId,
      context: {
        userId,
        dealId,
        conversationId,
      },
    });

    return res.json({
      success: true,
      ...response,
    });
  } catch (error: any) {
    logger.error('Agent chat error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// AGENT ACTIVITY & NOTIFICATIONS
// ============================================================================

/**
 * GET /api/v1/agents/activity
 * Get recent agent activity for the user
 */
router.get('/activity', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { dealId, limit = 50 } = req.query;

    let activityQuery = `
      SELECT ac.*, d.name as deal_name
      FROM agent_conversations ac
      LEFT JOIN deals d ON ac.deal_id = d.id
      WHERE ac.user_id = $1
    `;
    const params: any[] = [userId];

    if (dealId) {
      activityQuery += ` AND ac.deal_id = $2`;
      params.push(dealId);
    }

    activityQuery += ` ORDER BY ac.created_at DESC LIMIT $${params.length + 1}`;
    params.push(Number(limit));

    const result = await query(activityQuery, params);

    return res.json({
      success: true,
      activity: result.rows,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/agents/notifications
 * Get agent notifications for the user
 */
router.get('/notifications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { unreadOnly, limit = 50 } = req.query;

    let notifQuery = `
      SELECT an.*, d.name as deal_name
      FROM agent_notifications an
      LEFT JOIN deals d ON an.deal_id = d.id
      WHERE an.user_id = $1
    `;
    const params: any[] = [userId];

    if (unreadOnly === 'true') {
      notifQuery += ` AND an.read_at IS NULL`;
    }

    notifQuery += ` ORDER BY an.created_at DESC LIMIT $2`;
    params.push(Number(limit));

    const result = await query(notifQuery, params);

    return res.json({
      success: true,
      notifications: result.rows,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/v1/agents/notifications/:id/read
 * Mark notification as read
 */
router.put('/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    await query(
      `UPDATE agent_notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// MANUAL EVENT TRIGGERS (for testing/admin)
// ============================================================================

/**
 * POST /api/v1/agents/events/document-uploaded
 * Manually trigger document upload event
 */
router.post('/events/document-uploaded', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, fileId, filename, category, mimeType } = req.body;
    const userId = req.user!.userId;

    await eventDispatcher.onDocumentUploaded(dealId, userId, {
      fileId,
      filename,
      category,
      mimeType,
    });

    return res.json({ success: true, message: 'Event dispatched' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/agents/events/deal-status-changed
 * Manually trigger deal status change event
 */
router.post('/events/deal-status-changed', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, previousStatus, newStatus, reason } = req.body;
    const userId = req.user!.userId;

    await eventDispatcher.onDealStatusChanged(dealId, userId, {
      previousStatus,
      newStatus,
      reason,
    });

    return res.json({ success: true, message: 'Event dispatched' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/agents/events/financials-updated
 * Manually trigger financials update event
 */
router.post('/events/financials-updated', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, updateType, period, source } = req.body;
    const userId = req.user!.userId;

    await eventDispatcher.onFinancialsUpdated(dealId, userId, {
      updateType,
      period,
      source,
    });

    return res.json({ success: true, message: 'Event dispatched' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// CONVERSATIONS
// ============================================================================

/**
 * GET /api/v1/agents/conversations
 * List user's conversations with agents
 */
router.get('/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { dealId } = req.query;

    let convQuery = `
      SELECT DISTINCT ON (conversation_id)
        conversation_id,
        deal_id,
        agent_id,
        content as last_message,
        created_at as last_activity
      FROM agent_conversations
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (dealId) {
      convQuery += ` AND deal_id = $2`;
      params.push(dealId);
    }

    convQuery += ` ORDER BY conversation_id, created_at DESC`;

    const result = await query(convQuery, params);

    return res.json({
      success: true,
      conversations: result.rows,
    });
  } catch (error: any) {
    return res.json({ success: true, conversations: [] });
  }
});

/**
 * GET /api/v1/agents/conversations/:conversationId
 * Get conversation history
 */
router.get('/conversations/:conversationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user!.userId;

    const result = await query(
      `SELECT agent_id, role, content, skills_used, created_at
       FROM agent_conversations
       WHERE conversation_id = $1 AND user_id = $2
       ORDER BY created_at ASC`,
      [conversationId, userId]
    );

    return res.json({
      success: true,
      messages: result.rows,
    });
  } catch (error: any) {
    return res.json({ success: true, messages: [] });
  }
});

export default router;
