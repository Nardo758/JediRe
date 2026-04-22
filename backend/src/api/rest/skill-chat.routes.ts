/**
 * Skill Chat API Routes
 * 
 * POST /api/v1/deals/:dealId/skills/chat - Chat with AI assistant using skills
 * GET  /api/v1/deals/:dealId/skills/list - List available skills
 * GET  /api/v1/deals/:dealId/skills/conversations - List conversations
 * GET  /api/v1/deals/:dealId/skills/conversations/:conversationId - Get conversation history
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { skillChat } from '../../services/skills/skill-chat.service';
import { skillRegistry } from '../../services/skills/skill-registry';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

// Import skills to register them
import '../../services/skills/skills';

const router = Router();

// ============================================================================
// CHAT ENDPOINT
// ============================================================================

/**
 * POST /api/v1/deals/:dealId/skills/chat
 * Send a message to the AI assistant
 */
router.post('/:dealId/skills/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { message, conversationId } = req.body;
    const userId = req.user!.userId;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }

    // Verify deal access
    const dealCheck = await query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, userId]
    );

    if (dealCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found',
      });
    }

    // Process chat
    const response = await skillChat({
      message,
      dealId,
      userId,
      conversationId,
    });

    return res.json({
      success: true,
      ...response,
    });

  } catch (error: any) {
    logger.error('Skill chat error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Chat processing failed',
    });
  }
});

// ============================================================================
// SKILLS LIST
// ============================================================================

/**
 * GET /api/v1/deals/:dealId/skills/list
 * List all available skills
 */
router.get('/:dealId/skills/list', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const skills = skillRegistry.getAll().map(skill => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category,
    }));

    const byCategory = skills.reduce((acc, skill) => {
      if (!acc[skill.category]) acc[skill.category] = [];
      acc[skill.category].push(skill);
      return acc;
    }, {} as Record<string, typeof skills>);

    return res.json({
      success: true,
      skills,
      byCategory,
      total: skills.length,
    });

  } catch (error: any) {
    logger.error('Skills list error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// CONVERSATIONS
// ============================================================================

/**
 * GET /api/v1/deals/:dealId/skills/conversations
 * List conversations for a deal
 */
router.get('/:dealId/skills/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;

    const result = await query(
      `SELECT DISTINCT ON (conversation_id) 
        conversation_id,
        content as last_message,
        created_at as last_activity
       FROM skill_chat_messages
       WHERE deal_id = $1 AND user_id = $2
       ORDER BY conversation_id, created_at DESC`,
      [dealId, userId]
    );

    return res.json({
      success: true,
      conversations: result.rows,
    });

  } catch (error: any) {
    // Table might not exist
    return res.json({
      success: true,
      conversations: [],
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/skills/conversations/:conversationId
 * Get conversation history
 */
router.get('/:dealId/skills/conversations/:conversationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, conversationId } = req.params;
    const userId = req.user!.userId;

    const result = await query(
      `SELECT role, content, skill_calls, created_at
       FROM skill_chat_messages
       WHERE conversation_id = $1 AND deal_id = $2 AND user_id = $3
       ORDER BY created_at ASC`,
      [conversationId, dealId, userId]
    );

    return res.json({
      success: true,
      messages: result.rows,
    });

  } catch (error: any) {
    return res.json({
      success: true,
      messages: [],
    });
  }
});

export default router;
