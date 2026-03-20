/**
 * Collaboration Service
 * Handles map collaboration, proposals, and team coordination
 */

import { logger } from '../utils/logger';
import { query } from '../database/connection';

export interface ChangeProposal {
  type: 'add_pin' | 'update_pin' | 'delete_pin' | 'add_deal_intel';
  pin_id?: string;
  data?: any;
  changes?: any;
}

/**
 * Create a collaboration proposal
 */
export async function createProposal(
  mapId: string,
  userId: string,
  title: string,
  description: string,
  changes: ChangeProposal[]
): Promise<string | null> {
  try {
    const result = await query(
      `INSERT INTO map_change_proposals (
        map_id,
        proposed_by,
        proposal_title,
        proposal_description,
        changes,
        status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING id`,
      [mapId, userId, title, description, JSON.stringify(changes)]
    );

    const proposalId = result.rows[0].id;

    logger.info('Proposal created', {
      mapId,
      userId,
      proposalId,
      changesCount: changes.length
    });

    return proposalId;

  } catch (error) {
    logger.error('Error creating proposal:', error);
    return null;
  }
}

/**
 * Get proposals for a map owner to review
 */
export async function getPendingProposalsForOwner(
  userId: string
): Promise<any[]> {
  try {
    const result = await query(
      `SELECT * FROM pending_proposals_for_owner
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;

  } catch (error) {
    logger.error('Error fetching pending proposals:', error);
    return [];
  }
}

/**
 * Get proposals created by a user
 */
export async function getMyProposals(
  userId: string
): Promise<any[]> {
  try {
    const result = await query(
      `SELECT * FROM my_proposals
       WHERE proposed_by = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;

  } catch (error) {
    logger.error('Error fetching user proposals:', error);
    return [];
  }
}

/**
 * Accept a proposal and apply changes
 */
export async function acceptProposal(
  proposalId: string,
  userId: string,
  reviewNotes?: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    // Verify user is the map owner
    const ownerCheck = await query(
      `SELECT p.id, m.owner_id
       FROM map_change_proposals p
       JOIN maps m ON p.map_id = m.id
       WHERE p.id = $1 AND m.owner_id = $2`,
      [proposalId, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return { success: false, error: 'Not authorized or proposal not found' };
    }

    // Update status
    await query(
      `UPDATE map_change_proposals
       SET status = 'accepted',
           reviewed_by = $1,
           reviewed_at = now(),
           review_notes = $2
       WHERE id = $3`,
      [userId, reviewNotes, proposalId]
    );

    // Apply changes
    const applyResult = await query(
      'SELECT apply_proposal_changes($1) as result',
      [proposalId]
    );

    logger.info('Proposal accepted', { proposalId, userId });

    return {
      success: true,
      result: applyResult.rows[0].result
    };

  } catch (error) {
    logger.error('Error accepting proposal:', error);
    return { success: false, error: 'Failed to accept proposal' };
  }
}

/**
 * Reject a proposal
 */
export async function rejectProposal(
  proposalId: string,
  userId: string,
  reviewNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await query(
      `UPDATE map_change_proposals
       SET status = 'rejected',
           reviewed_by = $1,
           reviewed_at = now(),
           review_notes = $2
       WHERE id = $3
       AND EXISTS (
         SELECT 1 FROM maps 
         WHERE id = map_change_proposals.map_id 
         AND owner_id = $1
       )
       RETURNING id`,
      [userId, reviewNotes, proposalId]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'Not authorized or proposal not found' };
    }

    logger.info('Proposal rejected', { proposalId, userId });

    return { success: true };

  } catch (error) {
    logger.error('Error rejecting proposal:', error);
    return { success: false, error: 'Failed to reject proposal' };
  }
}

/**
 * Add a collaborator to a map
 */
export async function addCollaborator(
  mapId: string,
  userId: string,
  collaboratorId: string,
  role: 'editor' | 'viewer' = 'editor'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify user is map owner
    const ownerCheck = await query(
      'SELECT id FROM maps WHERE id = $1 AND owner_id = $2',
      [mapId, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return { success: false, error: 'Not authorized or map not found' };
    }

    // Add collaborator
    await query(
      `INSERT INTO map_collaborators (map_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (map_id, user_id) DO UPDATE 
       SET role = EXCLUDED.role`,
      [mapId, collaboratorId, role]
    );

    logger.info('Collaborator added', { mapId, collaboratorId, role });

    return { success: true };

  } catch (error) {
    logger.error('Error adding collaborator:', error);
    return { success: false, error: 'Failed to add collaborator' };
  }
}

/**
 * Remove a collaborator from a map
 */
export async function removeCollaborator(
  mapId: string,
  userId: string,
  collaboratorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await query(
      `DELETE FROM map_collaborators
       WHERE map_id = $1 AND user_id = $2
       AND EXISTS (
         SELECT 1 FROM maps WHERE id = $1 AND owner_id = $3
       )
       RETURNING user_id`,
      [mapId, collaboratorId, userId]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'Not authorized or collaborator not found' };
    }

    logger.info('Collaborator removed', { mapId, collaboratorId });

    return { success: true };

  } catch (error) {
    logger.error('Error removing collaborator:', error);
    return { success: false, error: 'Failed to remove collaborator' };
  }
}

/**
 * Get collaborators for a map
 */
export async function getMapCollaborators(
  mapId: string,
  userId: string
): Promise<any[]> {
  try {
    // Verify user has access to map
    const accessCheck = await query(
      `SELECT 1 FROM maps 
       WHERE id = $1 
       AND (owner_id = $2 OR EXISTS (
         SELECT 1 FROM map_collaborators 
         WHERE map_id = $1 AND user_id = $2
       ))`,
      [mapId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return [];
    }

    const result = await query(
      `SELECT 
        mc.user_id,
        mc.role,
        mc.created_at,
        u.full_name,
        u.email
       FROM map_collaborators mc
       JOIN users u ON mc.user_id = u.id
       WHERE mc.map_id = $1
       ORDER BY mc.created_at ASC`,
      [mapId]
    );

    return result.rows;

  } catch (error) {
    logger.error('Error fetching collaborators:', error);
    return [];
  }
}

/**
 * Check if user has access to a map
 */
export async function checkMapAccess(
  mapId: string,
  userId: string
): Promise<{ hasAccess: boolean; role?: 'owner' | 'editor' | 'viewer' }> {
  try {
    // Check if owner
    const ownerCheck = await query(
      'SELECT id FROM maps WHERE id = $1 AND owner_id = $2',
      [mapId, userId]
    );

    if (ownerCheck.rows.length > 0) {
      return { hasAccess: true, role: 'owner' };
    }

    // Check if collaborator
    const collabCheck = await query(
      'SELECT role FROM map_collaborators WHERE map_id = $1 AND user_id = $2',
      [mapId, userId]
    );

    if (collabCheck.rows.length > 0) {
      return { hasAccess: true, role: collabCheck.rows[0].role };
    }

    return { hasAccess: false };

  } catch (error) {
    logger.error('Error checking map access:', error);
    return { hasAccess: false };
  }
}
