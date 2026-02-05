/**
 * Collaboration Proposals API Routes
 * Handle change proposals for map collaboration
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
// @ts-nocheck
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/proposals
 * Create a new change proposal
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const {
      map_id,
      proposal_title,
      proposal_description,
      changes
    } = req.body;

    // Validation
    if (!map_id) {
      return res.status(400).json({
        success: false,
        error: 'map_id is required'
      });
    }

    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'changes must be a non-empty array'
      });
    }

    // Verify user is a collaborator on this map
    const accessCheck = await query(
      `SELECT 1 FROM map_collaborators 
       WHERE map_id = $1 AND user_id = $2`,
      [map_id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You must be a collaborator to create proposals'
      });
    }

    // Create proposal
    const result = await query(
      `INSERT INTO map_change_proposals (
        map_id,
        proposed_by,
        proposal_title,
        proposal_description,
        changes,
        status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING id, map_id, proposed_by, proposal_title, proposal_description, 
                changes, status, created_at, changes_count`,
      [map_id, userId, proposal_title, proposal_description, JSON.stringify(changes)]
    );

    logger.info('Proposal created', {
      userId,
      mapId: map_id,
      proposalId: result.rows[0].id,
      changesCount: changes.length
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Proposal created successfully'
    });

  } catch (error) {
    logger.error('Error creating proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create proposal'
    });
  }
});

/**
 * GET /api/v1/proposals/pending
 * Get proposals pending review (for map owner)
 */
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const result = await query(
      `SELECT * FROM pending_proposals_for_owner
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    logger.error('Error fetching pending proposals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending proposals'
    });
  }
});

/**
 * GET /api/v1/proposals/my
 * Get proposals I created (for collaborator)
 */
router.get('/my', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const result = await query(
      `SELECT 
        p.id,
        p.map_id,
        m.name as map_name,
        p.proposal_title,
        p.proposal_description,
        p.changes_count,
        p.status,
        p.review_notes,
        p.created_at,
        p.reviewed_at,
        r.full_name as reviewed_by_name
       FROM map_change_proposals p
       JOIN maps m ON p.map_id = m.id
       LEFT JOIN users r ON p.reviewed_by = r.id
       WHERE p.proposed_by = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Error fetching my proposals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch proposals'
    });
  }
});

/**
 * POST /api/v1/proposals/:id/accept
 * Accept a proposal and apply changes
 */
router.post('/:id/accept', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const proposalId = req.params.id;
    const { review_notes } = req.body;

    // Verify user is the map owner
    const ownerCheck = await query(
      `SELECT p.id, m.owner_id
       FROM map_change_proposals p
       JOIN maps m ON p.map_id = m.id
       WHERE p.id = $1 AND m.owner_id = $2`,
      [proposalId, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Only map owner can accept proposals'
      });
    }

    // Update proposal status
    const updateResult = await query(
      `UPDATE map_change_proposals
       SET status = 'accepted',
           reviewed_by = $1,
           reviewed_at = now(),
           review_notes = $2
       WHERE id = $3
       RETURNING *`,
      [userId, review_notes, proposalId]
    );

    // Apply the changes using the stored procedure
    const applyResult = await query(
      'SELECT apply_proposal_changes($1) as result',
      [proposalId]
    );

    logger.info('Proposal accepted and changes applied', {
      userId,
      proposalId,
      result: applyResult.rows[0].result
    });

    res.json({
      success: true,
      data: updateResult.rows[0],
      applied: applyResult.rows[0].result,
      message: 'Proposal accepted and changes applied'
    });

  } catch (error) {
    logger.error('Error accepting proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept proposal'
    });
  }
});

/**
 * POST /api/v1/proposals/:id/reject
 * Reject a proposal
 */
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const proposalId = req.params.id;
    const { review_notes } = req.body;

    // Verify user is the map owner
    const ownerCheck = await query(
      `SELECT p.id, m.owner_id
       FROM map_change_proposals p
       JOIN maps m ON p.map_id = m.id
       WHERE p.id = $1 AND m.owner_id = $2`,
      [proposalId, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Only map owner can reject proposals'
      });
    }

    // Update proposal status
    const result = await query(
      `UPDATE map_change_proposals
       SET status = 'rejected',
           reviewed_by = $1,
           reviewed_at = now(),
           review_notes = $2
       WHERE id = $3
       RETURNING *`,
      [userId, review_notes, proposalId]
    );

    logger.info('Proposal rejected', { userId, proposalId });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Proposal rejected'
    });

  } catch (error) {
    logger.error('Error rejecting proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject proposal'
    });
  }
});

/**
 * POST /api/v1/proposals/:id/comment
 * Add a comment to a proposal
 */
router.post('/:id/comment', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const proposalId = req.params.id;
    const { comment_text } = req.body;

    if (!comment_text) {
      return res.status(400).json({
        success: false,
        error: 'comment_text is required'
      });
    }

    // Verify user has access to this proposal
    const accessCheck = await query(
      `SELECT p.id
       FROM map_change_proposals p
       JOIN maps m ON p.map_id = m.id
       WHERE p.id = $1 
       AND (p.proposed_by = $2 OR m.owner_id = $2 OR EXISTS (
         SELECT 1 FROM map_collaborators 
         WHERE map_id = m.id AND user_id = $2
       ))`,
      [proposalId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'No access to this proposal'
      });
    }

    // Create comment
    const result = await query(
      `INSERT INTO proposal_comments (proposal_id, user_id, comment_text)
       VALUES ($1, $2, $3)
       RETURNING id, proposal_id, user_id, comment_text, created_at`,
      [proposalId, userId, comment_text]
    );

    logger.info('Comment added to proposal', { userId, proposalId });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Comment added successfully'
    });

  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add comment'
    });
  }
});

/**
 * GET /api/v1/proposals/:id/comments
 * Get comments for a proposal
 */
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const proposalId = req.params.id;

    // Verify user has access
    const accessCheck = await query(
      `SELECT p.id
       FROM map_change_proposals p
       JOIN maps m ON p.map_id = m.id
       WHERE p.id = $1 
       AND (p.proposed_by = $2 OR m.owner_id = $2 OR EXISTS (
         SELECT 1 FROM map_collaborators 
         WHERE map_id = m.id AND user_id = $2
       ))`,
      [proposalId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'No access to this proposal'
      });
    }

    // Get comments
    const result = await query(
      `SELECT 
        c.id,
        c.proposal_id,
        c.user_id,
        u.full_name as user_name,
        c.comment_text,
        c.created_at,
        c.updated_at
       FROM proposal_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.proposal_id = $1
       ORDER BY c.created_at ASC`,
      [proposalId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comments'
    });
  }
});

export default router;
