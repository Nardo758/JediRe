/**
 * Design Assistant API Routes
 * LLM-powered conversational design modifications
 */

import { Router } from 'express';
import { designAssistantService } from '../../services/design-assistant.service';

const router = Router();

/**
 * POST /api/v1/design-assistant/chat
 * Process a design modification request
 */
router.post('/chat', async (req, res) => {
  try {
    const { userPrompt, currentDesign, conversationHistory } = req.body;

    // Validate required fields
    if (!userPrompt || !currentDesign) {
      return res.status(400).json({
        error: 'userPrompt and currentDesign are required',
      });
    }

    console.log(`[Design Assistant] Processing request: "${userPrompt}"`);

    // Process request with Claude
    const response = await designAssistantService.processDesignRequest(
      userPrompt,
      currentDesign,
      conversationHistory || []
    );

    res.json({
      success: true,
      ...response,
    });
  } catch (error) {
    console.error('[Design Assistant API] Error:', error);
    res.status(500).json({
      error: 'Failed to process design request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/design-assistant/status
 * Check if design assistant service is configured
 */
router.get('/status', (req, res) => {
  const isConfigured = !!process.env.ANTHROPIC_API_KEY;

  res.json({
    configured: isConfigured,
    service: 'Claude 3.5 Sonnet (Design Assistant)',
    message: isConfigured
      ? 'Design assistant is ready'
      : 'ANTHROPIC_API_KEY environment variable not set',
  });
});

export default router;
