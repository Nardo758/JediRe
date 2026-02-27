/**
 * LLM REST Routes
 * Secure API endpoints for AI-powered features
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import {
  generateCompletion,
  analyzeProperty,
  analyzeMarket,
  isLLMAvailable,
  getLLMInfo,
} from '../../services/llm.service';
import { query } from '../../database/connection';

const router = Router();

/**
 * Rate limiting map for LLM requests
 * In production, use Redis or similar
 */
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_REQUESTS = 20; // requests per window
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Check rate limit for user
 */
function checkRateLimit(userId: string): void {
  const now = Date.now();
  const userLimit = rateLimits.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit
    rateLimits.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return;
  }

  if (userLimit.count >= RATE_LIMIT_REQUESTS) {
    throw new AppError(
      429,
      `Rate limit exceeded. Maximum ${RATE_LIMIT_REQUESTS} LLM requests per hour.`
    );
  }

  userLimit.count++;
}

/**
 * GET /api/v1/llm/status
 * Check if LLM service is available
 */
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const available = isLLMAvailable();
    const info = getLLMInfo();

    res.json({
      available,
      provider: info?.provider || null,
      model: info?.model || null,
      message: available
        ? 'LLM service is available'
        : 'LLM service not configured. Set CLAUDE_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/llm/complete
 * General-purpose completion endpoint
 */
router.post('/complete', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    checkRateLimit(userId);

    const { prompt, maxTokens, temperature } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      throw new AppError(400, 'Prompt is required and must be a string');
    }

    if (prompt.length > 10000) {
      throw new AppError(400, 'Prompt exceeds maximum length of 10,000 characters');
    }

    logger.info('LLM completion request', {
      userId,
      promptLength: prompt.length,
    });

    const response = await generateCompletion({
      prompt,
      maxTokens: maxTokens || 1000,
      temperature: temperature || 0.7,
    });

    res.json({
      text: response.text,
      usage: response.usage,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/llm/analyze-property
 * Analyze a specific property
 */
router.post(
  '/analyze-property',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const userId = req.user!.userId;
      checkRateLimit(userId);

      const { propertyId } = req.body;

      if (!propertyId) {
        throw new AppError(400, 'propertyId is required');
      }

      // Fetch property data
      const result = await query(
        'SELECT * FROM properties_with_zoning WHERE id = $1',
        [propertyId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'Property not found');
      }

      const property = result.rows[0];

      logger.info('LLM property analysis request', {
        userId,
        propertyId,
      });

      const analysis = await analyzeProperty(property);

      // Store analysis in database
      await query(
        `INSERT INTO property_analyses (property_id, analyzed_by, analysis_type, content)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (property_id, analysis_type) 
         DO UPDATE SET content = $4, analyzed_at = NOW(), analyzed_by = $2`,
        [propertyId, userId, 'ai_insights', analysis]
      );

      res.json({
        propertyId,
        analysis,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/llm/analyze-market
 * Analyze market data
 */
router.post(
  '/analyze-market',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const userId = req.user!.userId;
      checkRateLimit(userId);

      const { city, state } = req.body;

      if (!city || !state) {
        throw new AppError(400, 'city and state are required');
      }

      // Fetch market data
      const result = await query(
        `SELECT 
          COUNT(*) as property_count,
          AVG(lot_size_sqft) as avg_lot_size,
          AVG(building_sqft) as avg_building_size,
          property_type,
          COUNT(*) as type_count
         FROM properties
         WHERE city ILIKE $1 AND state_code = $2
         GROUP BY property_type`,
        [city, state]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'No properties found for this market');
      }

      const marketData = {
        city,
        state,
        propertyCount: result.rows.reduce((sum, row) => sum + parseInt(row.type_count), 0),
        avgLotSize: Math.round(
          result.rows.reduce((sum, row) => sum + parseFloat(row.avg_lot_size || 0), 0) /
            result.rows.length
        ),
        propertyTypes: result.rows.reduce((acc, row) => {
          acc[row.property_type] = parseInt(row.type_count);
          return acc;
        }, {} as Record<string, number>),
        averagePrice: 0, // Would need sales data
      };

      logger.info('LLM market analysis request', {
        userId,
        city,
        state,
      });

      const analysis = await analyzeMarket(marketData);

      res.json({
        market: { city, state },
        data: marketData,
        analysis,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/llm/analysis-history
 * Get user's LLM analysis history
 */
router.get(
  '/analysis-history',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const userId = req.user!.userId;
      const { limit = 10, offset = 0 } = req.query;

      const result = await query(
        `SELECT 
          pa.*,
          p.address_line1,
          p.city,
          p.state_code
         FROM property_analyses pa
         JOIN properties p ON pa.property_id = p.id
         WHERE pa.analyzed_by = $1
         ORDER BY pa.analyzed_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      res.json({
        analyses: result.rows,
        count: result.rows.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
