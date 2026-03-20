/**
 * Note Permission Utilities
 * Handles permission checking for asset notes
 */

import { PoolClient } from 'pg';
import { NotePermissionLevel } from '../types/assetMapIntelligence.types';
import { logger } from './logger';

/**
 * Check if user has required permission level for an asset's notes
 */
export async function checkUserNotePermission(
  client: PoolClient,
  userId: string,
  assetId: string,
  requiredPermission: NotePermissionLevel = 'view'
): Promise<boolean> {
  try {
    // Use the database function to check permission
    const query = `SELECT user_has_note_permission($1, $2, $3) as has_permission`;
    const result = await client.query(query, [userId, assetId, requiredPermission]);
    return result.rows[0]?.has_permission || false;
  } catch (error) {
    logger.error('Error checking note permission:', error);
    return false;
  }
}

/**
 * Check if user is the deal creator (has full access)
 */
export async function isUserDealCreator(
  client: PoolClient,
  userId: string,
  assetId: string
): Promise<boolean> {
  try {
    const query = `SELECT EXISTS(SELECT 1 FROM deals WHERE id = $1 AND user_id = $2) as is_creator`;
    const result = await client.query(query, [assetId, userId]);
    return result.rows[0]?.is_creator || false;
  } catch (error) {
    logger.error('Error checking deal creator:', error);
    return false;
  }
}

/**
 * Get user's permission level for an asset
 */
export async function getUserPermissionLevel(
  client: PoolClient,
  userId: string,
  assetId: string
): Promise<NotePermissionLevel | null> {
  try {
    // Check if user is deal creator first
    const isCreator = await isUserDealCreator(client, assetId, userId);
    if (isCreator) {
      return 'admin';
    }

    // Check explicit permissions
    const query = `
      SELECT permission
      FROM asset_note_permissions
      WHERE asset_id = $1 AND user_id = $2
    `;
    const result = await client.query(query, [assetId, userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].permission as NotePermissionLevel;
  } catch (error) {
    logger.error('Error getting user permission level:', error);
    return null;
  }
}

/**
 * Check if user can view a specific note (considering private notes)
 */
export async function canUserViewNote(
  client: PoolClient,
  userId: string,
  noteId: string
): Promise<boolean> {
  try {
    const query = `
      SELECT 
        n.asset_id,
        n.author_id,
        n.is_private
      FROM asset_notes n
      WHERE n.id = $1
    `;
    const result = await client.query(query, [noteId]);

    if (result.rows.length === 0) {
      return false;
    }

    const note = result.rows[0];

    // If note is private, only author can view
    if (note.is_private && note.author_id !== userId) {
      return false;
    }

    // Check asset-level permissions
    return await checkUserNotePermission(client, userId, note.asset_id, 'view');
  } catch (error) {
    logger.error('Error checking note view permission:', error);
    return false;
  }
}

/**
 * Check if user can edit a specific note
 */
export async function canUserEditNote(
  client: PoolClient,
  userId: string,
  noteId: string
): Promise<boolean> {
  try {
    const query = `
      SELECT 
        n.asset_id,
        n.author_id
      FROM asset_notes n
      WHERE n.id = $1
    `;
    const result = await client.query(query, [noteId]);

    if (result.rows.length === 0) {
      return false;
    }

    const note = result.rows[0];

    // Only author or admin can edit
    if (note.author_id === userId) {
      return true;
    }

    // Check if user has admin permission
    const permissionLevel = await getUserPermissionLevel(client, userId, note.asset_id);
    return permissionLevel === 'admin';
  } catch (error) {
    logger.error('Error checking note edit permission:', error);
    return false;
  }
}

/**
 * Check if user can delete a specific note
 */
export async function canUserDeleteNote(
  client: PoolClient,
  userId: string,
  noteId: string
): Promise<boolean> {
  // Same logic as edit for now
  return await canUserEditNote(client, userId, noteId);
}

/**
 * Check if user can edit a reply
 */
export async function canUserEditReply(
  client: PoolClient,
  userId: string,
  replyId: string
): Promise<boolean> {
  try {
    const query = `
      SELECT 
        r.author_id,
        n.asset_id
      FROM note_replies r
      JOIN asset_notes n ON n.id = r.note_id
      WHERE r.id = $1
    `;
    const result = await client.query(query, [replyId]);

    if (result.rows.length === 0) {
      return false;
    }

    const reply = result.rows[0];

    // Only author or admin can edit
    if (reply.author_id === userId) {
      return true;
    }

    // Check if user has admin permission
    const permissionLevel = await getUserPermissionLevel(client, userId, reply.asset_id);
    return permissionLevel === 'admin';
  } catch (error) {
    logger.error('Error checking reply edit permission:', error);
    return false;
  }
}

/**
 * Get permission level hierarchy value (for comparison)
 */
export function getPermissionValue(level: NotePermissionLevel): number {
  const hierarchy = {
    view: 1,
    edit: 2,
    admin: 3,
  };
  return hierarchy[level] || 0;
}

/**
 * Check if one permission level is sufficient for another
 */
export function hasRequiredPermission(
  userLevel: NotePermissionLevel,
  requiredLevel: NotePermissionLevel
): boolean {
  return getPermissionValue(userLevel) >= getPermissionValue(requiredLevel);
}

/**
 * Filter notes based on user permissions (for private notes)
 */
export function buildNoteVisibilityFilter(userId: string): string {
  return `(is_private = false OR author_id = '${userId}')`;
}
