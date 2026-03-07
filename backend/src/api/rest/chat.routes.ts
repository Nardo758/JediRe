import { Router, Response } from 'express';
import { optionalAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { processChat } from '../../services/chat.service';

const router = Router();

router.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const result = await processChat(message, conversationId);
    res.json(result);
  } catch (error: any) {
    logger.error('Chat request failed:', { error: error.message, stack: error.stack });
    if (error.message === 'AI service not configured') {
      res.status(500).json({ error: 'AI service not configured' });
    } else {
      res.status(500).json({ error: 'Failed to process message. Please try again.' });
    }
  }
});

export default router;
