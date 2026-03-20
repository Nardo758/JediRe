import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const ANTHROPIC_API_KEY = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const ANTHROPIC_BASE_URL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

router.post('/:dealId/chat', async (req: Request, res: Response) => {
  try {
    const { messages, systemPrompt } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    const response = await axios.post(
      `${ANTHROPIC_BASE_URL}/v1/messages`,
      {
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        system: systemPrompt || 'You are a real estate building design AI assistant specializing in multifamily development.',
        messages: messages.slice(-20),
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const text = response.data.content?.[0]?.text || '';
    return res.json({ success: true, response: text });
  } catch (error: any) {
    console.error('Design AI chat error:', error.message);
    if (error.response?.status === 401) {
      return res.status(500).json({ error: 'AI service authentication failed' });
    }
    return res.status(500).json({ error: error.message || 'Failed to get AI design response' });
  }
});

export default router;
