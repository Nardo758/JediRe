/**
 * ═══════════════════════════════════════════════════════════════════
 * DESIGN AGENT API ROUTES
 * ═══════════════════════════════════════════════════════════════════
 */

import { Router } from 'express';
import { generateDesign, generateDesignMock, type ParcelContext } from '../../services/design-agent.service';

const router = Router();

/**
 * POST /api/v1/design-agent/generate
 *
 * Body: {
 *   prompt: string,
 *   parcelContext: {
 *     lotSizeSqft: number,
 *     zoningCode?: string,
 *     maxHeightFt?: number,
 *     maxFAR?: number,
 *     setbacks?: { front, side, rear },
 *     geometry: GeoJSON.Polygon,
 *     address: string,
 *     county: string,
 *     state: string
 *   }
 * }
 */
router.post('/generate', async (req: any, res) => {
  try {
    const { prompt, parcelContext } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }
    if (!parcelContext?.geometry) {
      return res.status(400).json({ error: 'parcelContext.geometry is required' });
    }

    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const result = hasOpenAIKey
      ? await generateDesign(prompt, parcelContext as ParcelContext)
      : generateDesignMock(prompt, parcelContext as ParcelContext);

    res.json({
      success: true,
      ...result,
      mock: !hasOpenAIKey,
    });
  } catch (error: any) {
    console.error('[DesignAgent API] Error:', error);
    res.status(500).json({
      error: 'Design agent failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/design-agent/status
 */
router.get('/status', (req, res) => {
  const isConfigured = !!process.env.OPENAI_API_KEY;
  res.json({
    configured: isConfigured,
    model: 'gpt-6-astra',
    message: isConfigured
      ? 'Design Agent ready (GPT-6 Astra)'
      : 'Running in mock mode — set OPENAI_API_KEY for real AI generation',
  });
});

export default router;
