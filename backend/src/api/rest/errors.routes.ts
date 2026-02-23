import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../../db';
import { logger } from '../../utils/logger';

const router = Router();

interface ErrorLogPayload {
  error: string;
  stack: string;
  componentStack?: string;
  timestamp: string;
  url?: string;
  userAgent?: string;
  context?: string;
  dealId?: string;
  userId?: string;
  formName?: string;
  isNetworkError?: boolean;
  isOnline?: boolean;
  isWebGLError?: boolean;
  webglInfo?: any;
  hadFormData?: boolean;
  [key: string]: any;
}

/**
 * POST /api/v1/errors/log
 * Log frontend errors for monitoring and debugging
 */
router.post(
  '/log',
  [
    body('error').isString().notEmpty().withMessage('Error message is required'),
    body('stack').isString().optional(),
    body('timestamp').isISO8601().withMessage('Valid timestamp is required'),
    body('url').isString().optional(),
    body('context').isString().optional(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const payload: ErrorLogPayload = req.body;

      // Get user ID from session/token if available
      const userId = (req as any).user?.id || payload.userId || null;

      // Log to application logger for immediate visibility
      logger.error('Frontend Error:', {
        error: payload.error,
        context: payload.context || 'UNKNOWN',
        userId,
        url: payload.url,
        timestamp: payload.timestamp,
      });

      // Store in database for analysis
      const result = await db.query(
        `
        INSERT INTO error_logs (
          user_id,
          error_message,
          stack_trace,
          component_stack,
          error_context,
          url,
          user_agent,
          deal_id,
          form_name,
          is_network_error,
          is_webgl_error,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
        `,
        [
          userId,
          payload.error,
          payload.stack || null,
          payload.componentStack || null,
          payload.context || 'GENERAL',
          payload.url || null,
          payload.userAgent || null,
          payload.dealId || null,
          payload.formName || null,
          payload.isNetworkError || false,
          payload.isWebGLError || false,
          JSON.stringify({
            isOnline: payload.isOnline,
            webglInfo: payload.webglInfo,
            hadFormData: payload.hadFormData,
            ...Object.keys(payload).reduce((acc, key) => {
              // Store any additional metadata
              if (![
                'error',
                'stack',
                'componentStack',
                'timestamp',
                'url',
                'userAgent',
                'context',
                'dealId',
                'userId',
                'formName',
                'isNetworkError',
                'isOnline',
                'isWebGLError',
                'webglInfo',
                'hadFormData',
              ].includes(key)) {
                acc[key] = payload[key];
              }
              return acc;
            }, {} as Record<string, any>),
          }),
          payload.timestamp,
        ]
      );

      const errorLogId = result.rows[0]?.id;

      // Check for critical error patterns that need immediate attention
      const criticalPatterns = [
        'Cannot read property',
        'is not a function',
        'Maximum call stack',
        'Out of memory',
      ];

      const isCritical = criticalPatterns.some((pattern) =>
        payload.error.includes(pattern)
      );

      if (isCritical) {
        logger.error('CRITICAL FRONTEND ERROR DETECTED', {
          errorLogId,
          error: payload.error,
          userId,
        });

        // In production, you might want to send alerts here
        // e.g., Slack notification, PagerDuty, email, etc.
      }

      res.status(201).json({
        success: true,
        errorLogId,
        message: 'Error logged successfully',
      });
    } catch (error) {
      // Don't let error logging fail the application
      logger.error('Failed to log frontend error:', error);
      
      // Still return success to prevent retry loops
      res.status(200).json({
        success: false,
        message: 'Error logging failed but acknowledged',
      });
    }
  }
);

/**
 * GET /api/v1/errors/stats
 * Get error statistics (for admin dashboard)
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Check if user is admin (add your auth check here)
    // const isAdmin = (req as any).user?.isAdmin;
    // if (!isAdmin) {
    //   return res.status(403).json({ error: 'Forbidden' });
    // }

    const timeRange = req.query.timeRange || '24h';
    
    let interval = '24 hours';
    if (timeRange === '7d') interval = '7 days';
    if (timeRange === '30d') interval = '30 days';

    const stats = await db.query(
      `
      SELECT
        COUNT(*) as total_errors,
        COUNT(DISTINCT user_id) as affected_users,
        COUNT(CASE WHEN is_network_error THEN 1 END) as network_errors,
        COUNT(CASE WHEN is_webgl_error THEN 1 END) as webgl_errors,
        error_context,
        DATE_TRUNC('hour', created_at) as hour
      FROM error_logs
      WHERE created_at > NOW() - INTERVAL '${interval}'
      GROUP BY error_context, hour
      ORDER BY hour DESC, total_errors DESC
      `,
      []
    );

    const topErrors = await db.query(
      `
      SELECT
        error_message,
        COUNT(*) as occurrence_count,
        MAX(created_at) as last_occurrence
      FROM error_logs
      WHERE created_at > NOW() - INTERVAL '${interval}'
      GROUP BY error_message
      ORDER BY occurrence_count DESC
      LIMIT 10
      `,
      []
    );

    res.json({
      success: true,
      timeRange,
      stats: stats.rows,
      topErrors: topErrors.rows,
    });
  } catch (error) {
    logger.error('Failed to fetch error stats:', error);
    res.status(500).json({ error: 'Failed to fetch error statistics' });
  }
});

/**
 * GET /api/v1/errors/recent
 * Get recent errors (for admin dashboard)
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    // const isAdmin = (req as any).user?.isAdmin;
    // if (!isAdmin) {
    //   return res.status(403).json({ error: 'Forbidden' });
    // }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const context = req.query.context as string;

    let whereClause = '';
    const params: any[] = [limit, offset];

    if (context) {
      whereClause = 'WHERE error_context = $3';
      params.push(context);
    }

    const errors = await db.query(
      `
      SELECT
        id,
        user_id,
        error_message,
        error_context,
        url,
        deal_id,
        is_network_error,
        is_webgl_error,
        created_at
      FROM error_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
      `,
      params
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM error_logs ${whereClause}`,
      context ? [context] : []
    );

    res.json({
      success: true,
      errors: errors.rows,
      total: parseInt(countResult.rows[0]?.total || '0'),
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Failed to fetch recent errors:', error);
    res.status(500).json({ error: 'Failed to fetch recent errors' });
  }
});

export default router;
