/**
 * Property Extractions API Routes
 * Handle property extraction queue and review workflow
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
// @ts-nocheck
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { processQueuedExtraction } from '../../services/email-property-automation.service';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/v1/extractions/pending
 * Get pending property reviews for user
 */
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const status = req.query.status as string || 'requires-review';
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await query(
      `SELECT 
        id,
        email_id,
        email_subject,
        email_from,
        email_received_at,
        extracted_data,
        extraction_confidence,
        preference_match_score,
        preference_match_reasons,
        status,
        decision_reason,
        created_at
       FROM property_extraction_queue
       WHERE user_id = $1 
       AND ($2 = 'all' OR status = $2)
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, status, limit]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    logger.error('Error fetching pending extractions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending extractions'
    });
  }
});

/**
 * POST /api/v1/extractions/:id/approve
 * Approve extraction and create property pin
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const extractionId = req.params.id;
    const { map_id, pipeline_stage_id, notes } = req.body;

    if (!map_id) {
      return res.status(400).json({
        success: false,
        error: 'map_id is required'
      });
    }

    // Verify extraction belongs to user
    const checkResult = await query(
      'SELECT id FROM property_extraction_queue WHERE id = $1 AND user_id = $2',
      [extractionId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Extraction not found'
      });
    }

    // Process the extraction (create pin)
    const result = await processQueuedExtraction(extractionId, userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.reason || 'Failed to process extraction'
      });
    }

    // Add notes if provided
    if (notes && result.pinId) {
      await query(
        `INSERT INTO deal_intel (pin_id, intel_type, source, data)
         VALUES ($1, 'note', 'user', $2)`,
        [result.pinId, { text: notes, created_by: userId }]
      );
    }

    logger.info('Extraction approved and pin created', {
      userId,
      extractionId,
      pinId: result.pinId
    });

    res.json({
      success: true,
      data: {
        pin_id: result.pinId,
        map_id: map_id
      },
      message: 'Property added to map successfully'
    });

  } catch (error) {
    logger.error('Error approving extraction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve extraction'
    });
  }
});

/**
 * POST /api/v1/extractions/:id/reject
 * Reject extraction
 */
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const extractionId = req.params.id;
    const { reason } = req.body;

    const result = await query(
      `UPDATE property_extraction_queue
       SET status = 'rejected',
           reviewed_by = $1,
           reviewed_at = now(),
           decision_reason = $2
       WHERE id = $3 AND user_id = $1
       RETURNING id`,
      [userId, reason || 'User rejected', extractionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Extraction not found'
      });
    }

    logger.info('Extraction rejected', { userId, extractionId, reason });

    res.json({
      success: true,
      message: 'Property rejected successfully'
    });

  } catch (error) {
    logger.error('Error rejecting extraction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject extraction'
    });
  }
});

/**
 * POST /api/v1/extractions/:id/skip
 * Skip extraction for later review
 */
router.post('/:id/skip', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const extractionId = req.params.id;

    // Just verify it exists, don't change status
    const result = await query(
      'SELECT id FROM property_extraction_queue WHERE id = $1 AND user_id = $2',
      [extractionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Extraction not found'
      });
    }

    logger.info('Extraction skipped', { userId, extractionId });

    res.json({
      success: true,
      message: 'Property skipped - will remain in queue'
    });

  } catch (error) {
    logger.error('Error skipping extraction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to skip extraction'
    });
  }
});

/**
 * POST /api/v1/extractions/bulk-approve
 * Approve multiple extractions at once
 */
router.post('/bulk-approve', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { extraction_ids, map_id } = req.body;

    if (!extraction_ids || !Array.isArray(extraction_ids) || extraction_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'extraction_ids must be a non-empty array'
      });
    }

    if (!map_id) {
      return res.status(400).json({
        success: false,
        error: 'map_id is required'
      });
    }

    const results = {
      approved: [] as string[],
      failed: [] as string[]
    };

    for (const extractionId of extraction_ids) {
      try {
        const result = await processQueuedExtraction(extractionId, userId);
        if (result.success && result.pinId) {
          results.approved.push(result.pinId);
        } else {
          results.failed.push(extractionId);
        }
      } catch (error) {
        results.failed.push(extractionId);
      }
    }

    logger.info('Bulk approve completed', {
      userId,
      total: extraction_ids.length,
      approved: results.approved.length,
      failed: results.failed.length
    });

    res.json({
      success: true,
      data: results,
      message: `Approved ${results.approved.length} of ${extraction_ids.length} properties`
    });

  } catch (error) {
    logger.error('Error in bulk approve:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk approve'
    });
  }
});

/**
 * POST /api/v1/extractions/bulk-reject
 * Reject multiple extractions at once
 */
router.post('/bulk-reject', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { extraction_ids, reason } = req.body;

    if (!extraction_ids || !Array.isArray(extraction_ids) || extraction_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'extraction_ids must be a non-empty array'
      });
    }

    const result = await query(
      `UPDATE property_extraction_queue
       SET status = 'rejected',
           reviewed_by = $1,
           reviewed_at = now(),
           decision_reason = $2
       WHERE id = ANY($3) AND user_id = $1
       RETURNING id`,
      [userId, reason || 'Bulk rejected by user', extraction_ids]
    );

    logger.info('Bulk reject completed', {
      userId,
      total: extraction_ids.length,
      rejected: result.rows.length
    });

    res.json({
      success: true,
      message: `Rejected ${result.rows.length} of ${extraction_ids.length} properties`
    });

  } catch (error) {
    logger.error('Error in bulk reject:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk reject'
    });
  }
});

export default router;
