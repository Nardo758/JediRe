/**
 * AI Rendering API Routes
 * Endpoints for converting 3D massing to photorealistic renderings
 */

import { Router } from 'express';
import { aiRenderingService } from '../../services/ai-rendering.service';

const router = Router();

/**
 * POST /api/v1/ai/render
 * Generate photorealistic rendering from massing screenshot
 */
router.post('/render', async (req, res) => {
  try {
    const {
      imageBase64,
      depthMapBase64,
      style = 'modern-glass',
      context,
      timeOfDay = 'golden-hour',
      weather = 'sunny',
    } = req.body;

    // Validate required fields
    if (!imageBase64) {
      return res.status(400).json({
        error: 'imageBase64 is required',
      });
    }

    // Validate style
    const validStyles = ['modern-glass', 'brick-traditional', 'mixed-use-urban', 'industrial-loft', 'luxury-highrise'];
    if (!validStyles.includes(style)) {
      return res.status(400).json({
        error: `Invalid style. Must be one of: ${validStyles.join(', ')}`,
      });
    }

    console.log(`[AI Rendering API] Generating rendering with style: ${style}`);

    // Generate rendering
    const result = await aiRenderingService.generateRendering({
      imageBase64,
      depthMapBase64,
      style,
      context,
      timeOfDay,
      weather,
    });

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Failed to generate rendering',
      });
    }

    res.json({
      success: true,
      imageUrl: result.imageUrl,
      localPath: result.localPath,
      processingTime: result.processingTime,
    });
  } catch (error) {
    console.error('[AI Rendering API] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/ai/render/styles
 * List available rendering styles
 */
router.get('/render/styles', (req, res) => {
  res.json({
    styles: [
      {
        id: 'modern-glass',
        name: 'Modern Glass',
        description: 'Contemporary luxury with floor-to-ceiling glass',
      },
      {
        id: 'brick-traditional',
        name: 'Brick Traditional',
        description: 'Classic masonry with timeless appeal',
      },
      {
        id: 'mixed-use-urban',
        name: 'Mixed-Use Urban',
        description: 'Ground floor retail with residential above',
      },
      {
        id: 'industrial-loft',
        name: 'Industrial Loft',
        description: 'Converted warehouse aesthetic with exposed elements',
      },
      {
        id: 'luxury-highrise',
        name: 'Luxury High-Rise',
        description: 'Premium materials and sophisticated design',
      },
    ],
  });
});

/**
 * GET /api/v1/ai/render/status
 * Check if AI rendering service is configured and ready
 */
router.get('/render/status', (req, res) => {
  const isConfigured = !!process.env.REPLICATE_API_TOKEN;

  res.json({
    configured: isConfigured,
    service: 'Replicate API (ControlNet + SDXL)',
    message: isConfigured
      ? 'AI rendering service is ready'
      : 'REPLICATE_API_TOKEN environment variable not set',
  });
});

export default router;
