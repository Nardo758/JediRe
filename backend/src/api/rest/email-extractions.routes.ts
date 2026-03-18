/**
 * Email Extractions API Routes
 * View and manage property/news extractions from emails
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { processQueuedExtraction } from '../../services/email-property-automation.service';

const router = Router();

/**
 * GET /api/v1/email-extractions/:emailId
 * Get all extractions for a specific email
 */
router.get('/:emailId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId || (req as any).user?.id;
  const { emailId } = req.params;

  try {
    // Check email belongs to user - emails.id is integer, emailId may be UUID or integer
    let emailCheck: any = { rows: [] };
    try {
      emailCheck = await query(
        'SELECT id FROM emails WHERE id = $1 AND user_id = $2',
        [emailId, userId]
      );
    } catch (typeErr: any) {
      // Type mismatch (e.g. uuid vs integer) means email doesn't exist
    }

    if (emailCheck.rows.length === 0) {
      throw new AppError(404, 'Email not found');
    }

    // Get property extractions - email_id is integer, use safe cast
    let propertyExtractions: any = { rows: [] };
    try {
      propertyExtractions = await query(
        `SELECT pq.*
        FROM property_extraction_queue pq
        WHERE pq.email_id = $1 AND pq.user_id = $2
        ORDER BY pq.created_at DESC`,
        [emailId, userId]
      );
    } catch (typeErr: any) {
      // Type mismatch - no extractions
    }

    // Get news extractions (linked via raw_data)
    const email = await query(
      'SELECT raw_data FROM emails WHERE id = $1',
      [emailId]
    );

    const linkedNewsId = email.rows[0]?.raw_data?.linkedNewsItemId;
    let newsExtraction = null;

    if (linkedNewsId) {
      const newsResult = await query(
        `SELECT id, title, summary, category, impact_score, sentiment_score, published_date
         FROM news_items
         WHERE id = $1`,
        [linkedNewsId]
      );
      newsExtraction = newsResult.rows[0] || null;
    }

    // Get classification
    const classification = email.rows[0]?.raw_data?.classification || null;

    res.json({
      success: true,
      data: {
        emailId,
        classification,
        propertyExtractions: propertyExtractions.rows,
        newsExtraction,
      },
    });
  } catch (error) {
    logger.error('Error fetching email extractions:', error);
    const statusCode = (error as any).statusCode || 500; res.status(statusCode).json({ error: (error as any).message || "Internal server error" });
  }
});

/**
 * GET /api/v1/email-extractions/properties
 * List all property extractions for the user
 */
router.get('/list/properties', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId || (req as any).user?.id;
  const { status, limit = 50, offset = 0 } = req.query;

  try {
    let whereClause = 'WHERE pq.user_id = $1';
    const params: any[] = [userId];

    if (status) {
      whereClause += ' AND pq.status = $2';
      params.push(status);
    }

    const result = await query(
      `SELECT 
        pq.*,
        e.subject as email_subject,
        e.from_address as email_from,
        e.received_at as email_received_at
      FROM property_extraction_queue pq
      LEFT JOIN emails e ON pq.email_id = e.id
      ${whereClause}
      ORDER BY pq.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM property_extraction_queue pq
       ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        extractions: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    logger.error('Error listing property extractions:', error);
    const statusCode = (error as any).statusCode || 500; res.status(statusCode).json({ error: (error as any).message || "Internal server error" });
  }
});

/**
 * GET /api/v1/email-extractions/news
 * List all news extractions from emails
 */
router.get('/list/news', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId || (req as any).user?.id;
  const { limit = 50, offset = 0 } = req.query;

  try {
    // Find news items that came from email source
    const result = await query(
      `SELECT 
        ni.*
      FROM news_items ni
      WHERE ni.source_name IS NOT NULL
      ORDER BY ni.published_at DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM news_items ni
       WHERE ni.source_name IS NOT NULL`,
      []
    );

    res.json({
      success: true,
      data: {
        newsItems: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    logger.error('Error listing news extractions:', error);
    const statusCode = (error as any).statusCode || 500; res.status(statusCode).json({ error: (error as any).message || "Internal server error" });
  }
});

/**
 * POST /api/v1/email-extractions/properties/:extractionId/approve
 * Approve a property extraction and create pin
 */
router.post('/properties/:extractionId/approve', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId || (req as any).user?.id;
  const { extractionId } = req.params;

  try {
    const result = await processQueuedExtraction(extractionId, userId);

    if (!result.success) {
      throw new AppError(400, result.reason || 'Failed to approve extraction');
    }

    res.json({
      success: true,
      data: {
        pinId: result.pinId,
        message: 'Property pin created successfully',
      },
    });
  } catch (error) {
    logger.error('Error approving extraction:', error);
    const statusCode = (error as any).statusCode || 500; res.status(statusCode).json({ error: (error as any).message || "Internal server error" });
  }
});

/**
 * POST /api/v1/email-extractions/properties/:extractionId/reject
 * Reject a property extraction
 */
router.post('/properties/:extractionId/reject', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId || (req as any).user?.id;
  const { extractionId } = req.params;
  const { reason } = req.body;

  try {
    // Verify ownership
    const check = await query(
      'SELECT id FROM property_extraction_queue WHERE id = $1 AND user_id = $2',
      [extractionId, userId]
    );

    if (check.rows.length === 0) {
      throw new AppError(404, 'Extraction not found');
    }

    // Update status to rejected
    await query(
      `UPDATE property_extraction_queue
       SET status = 'rejected',
           decision_reason = $2,
           reviewed_by = $3,
           reviewed_at = NOW()
       WHERE id = $1`,
      [extractionId, reason || 'User rejected', userId]
    );

    res.json({
      success: true,
      message: 'Extraction rejected',
    });
  } catch (error) {
    logger.error('Error rejecting extraction:', error);
    const statusCode = (error as any).statusCode || 500; res.status(statusCode).json({ error: (error as any).message || "Internal server error" });
  }
});

/**
 * DELETE /api/v1/email-extractions/properties/:extractionId
 * Delete a property extraction (false positive)
 */
router.delete('/properties/:extractionId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId || (req as any).user?.id;
  const { extractionId } = req.params;

  try {
    // Verify ownership
    const check = await query(
      'SELECT id FROM property_extraction_queue WHERE id = $1 AND user_id = $2',
      [extractionId, userId]
    );

    if (check.rows.length === 0) {
      throw new AppError(404, 'Extraction not found');
    }

    // Delete extraction
    await query(
      'DELETE FROM property_extraction_queue WHERE id = $1',
      [extractionId]
    );

    res.json({
      success: true,
      message: 'Extraction deleted',
    });
  } catch (error) {
    logger.error('Error deleting extraction:', error);
    const statusCode = (error as any).statusCode || 500; res.status(statusCode).json({ error: (error as any).message || "Internal server error" });
  }
});

/**
 * DELETE /api/v1/email-extractions/news/:newsItemId
 * Delete a news extraction (false positive)
 */
router.delete('/news/:newsItemId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId || (req as any).user?.id;
  const { newsItemId } = req.params;

  try {
    // Verify ownership (news item came from user's email)
    const check = await query(
      `SELECT ni.id
       FROM news_items ni
       WHERE ni.id = $1
       AND ni.source_name IS NOT NULL`,
      [newsItemId]
    );

    if (check.rows.length === 0) {
      throw new AppError(404, 'News item not found or not owned by user');
    }

    // Delete news item
    await query(
      'DELETE FROM news_items WHERE id = $1',
      [newsItemId]
    );

    res.json({
      success: true,
      message: 'News item deleted',
    });
  } catch (error) {
    logger.error('Error deleting news item:', error);
    const statusCode = (error as any).statusCode || 500; res.status(statusCode).json({ error: (error as any).message || "Internal server error" });
  }
});

/**
 * GET /api/v1/email-extractions/stats
 * Get extraction statistics for the user
 */
router.get('/stats/summary', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId || (req as any).user?.id;

  try {
    // Property extraction stats
    const propertyStats = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'auto-created') as auto_created,
        COUNT(*) FILTER (WHERE status = 'requires-review') as pending_review,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected
      FROM property_extraction_queue
      WHERE user_id = $1`,
      [userId]
    );

    // News extraction stats
    const newsStats = await query(
      `SELECT COUNT(*) as total
       FROM news_items ni
       WHERE ni.source_name IS NOT NULL`,
      []
    );

    // Recent extractions (last 7 days)
    const recentStats = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM property_extraction_queue
      WHERE user_id = $1
      AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        properties: propertyStats.rows[0],
        news: newsStats.rows[0],
        recentActivity: recentStats.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching extraction stats:', error);
    const statusCode = (error as any).statusCode || 500; res.status(statusCode).json({ error: (error as any).message || "Internal server error" });
  }
});

export default router;
