/**
 * Note Replies Service
 * Handles threaded comments/replies on asset notes
 */

import { PoolClient } from 'pg';
import { logger } from '../utils/logger';
import {
  NoteReply,
  NoteReplyWithAuthor,
  CreateNoteReplyInput,
  UpdateNoteReplyInput,
  NoteRepliesResponse,
} from '../types/assetMapIntelligence.types';
import { canUserViewNote, canUserEditReply } from '../utils/notePermissions';

class NoteRepliesService {
  /**
   * Get all replies for a note
   */
  async getReplies(
    client: PoolClient,
    noteId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<NoteRepliesResponse> {
    try {
      // Check if user can view the parent note
      const canView = await canUserViewNote(client, userId, noteId);
      if (!canView) {
        throw new Error('Not authorized to view replies for this note');
      }

      const query = `
        SELECT 
          nr.id,
          nr.note_id,
          nr.content,
          nr.author_id,
          nr.created_at,
          nr.updated_at,
          nr.is_edited,
          u.id as author_id,
          u.name as author_name,
          u.email as author_email,
          u.avatar as author_avatar
        FROM note_replies nr
        JOIN users u ON u.id = nr.author_id
        WHERE nr.note_id = $1
        ORDER BY nr.created_at ASC
        LIMIT $2 OFFSET $3
      `;

      const result = await client.query(query, [noteId, limit, offset]);

      const replies: NoteReplyWithAuthor[] = result.rows.map(row => ({
        id: row.id,
        noteId: row.note_id,
        content: row.content,
        authorId: row.author_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        isEdited: row.is_edited,
        author: {
          id: row.author_id,
          name: row.author_name,
          email: row.author_email,
          avatar: row.author_avatar,
        },
      }));

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM note_replies WHERE note_id = $1`;
      const countResult = await client.query(countQuery, [noteId]);
      const total = parseInt(countResult.rows[0].total);

      return { replies, total };
    } catch (error: any) {
      logger.error('Error fetching replies:', error);
      throw error;
    }
  }

  /**
   * Get a single reply by ID
   */
  async getReplyById(
    client: PoolClient,
    replyId: string,
    userId: string
  ): Promise<NoteReplyWithAuthor | null> {
    try {
      const query = `
        SELECT 
          nr.id,
          nr.note_id,
          nr.content,
          nr.author_id,
          nr.created_at,
          nr.updated_at,
          nr.is_edited,
          u.id as author_id,
          u.name as author_name,
          u.email as author_email,
          u.avatar as author_avatar
        FROM note_replies nr
        JOIN users u ON u.id = nr.author_id
        WHERE nr.id = $1
      `;

      const result = await client.query(query, [replyId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Check if user can view the parent note
      const canView = await canUserViewNote(client, userId, row.note_id);
      if (!canView) {
        return null;
      }

      return {
        id: row.id,
        noteId: row.note_id,
        content: row.content,
        authorId: row.author_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        isEdited: row.is_edited,
        author: {
          id: row.author_id,
          name: row.author_name,
          email: row.author_email,
          avatar: row.author_avatar,
        },
      };
    } catch (error) {
      logger.error('Error fetching reply by ID:', error);
      throw new Error('Failed to fetch reply');
    }
  }

  /**
   * Create a reply
   */
  async createReply(client: PoolClient, input: CreateNoteReplyInput): Promise<NoteReply> {
    try {
      // Validate content
      if (!input.content || input.content.trim().length === 0) {
        throw new Error('Reply content is required');
      }

      if (input.content.length > 5000) {
        throw new Error('Reply content must be 5,000 characters or less');
      }

      // Check if user can view the parent note (must have access to reply)
      const canView = await canUserViewNote(client, input.authorId, input.noteId);
      if (!canView) {
        throw new Error('Not authorized to reply to this note');
      }

      // Insert reply
      const query = `
        INSERT INTO note_replies (
          note_id,
          content,
          author_id
        ) VALUES ($1, $2, $3)
        RETURNING *
      `;

      const result = await client.query(query, [
        input.noteId,
        input.content.trim(),
        input.authorId,
      ]);

      const row = result.rows[0];

      logger.info(`Reply created: ${row.id} on note ${input.noteId}`);

      return {
        id: row.id,
        noteId: row.note_id,
        content: row.content,
        authorId: row.author_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        isEdited: row.is_edited,
      };
    } catch (error: any) {
      logger.error('Error creating reply:', error);
      throw error;
    }
  }

  /**
   * Update a reply
   */
  async updateReply(
    client: PoolClient,
    replyId: string,
    userId: string,
    input: UpdateNoteReplyInput
  ): Promise<NoteReply> {
    try {
      // Validate content
      if (!input.content || input.content.trim().length === 0) {
        throw new Error('Reply content cannot be empty');
      }

      if (input.content.length > 5000) {
        throw new Error('Reply content must be 5,000 characters or less');
      }

      // Check if user can edit this reply
      const canEdit = await canUserEditReply(client, userId, replyId);
      if (!canEdit) {
        throw new Error('Not authorized to edit this reply');
      }

      // Update reply
      const query = `
        UPDATE note_replies
        SET 
          content = $1,
          updated_at = NOW(),
          is_edited = true
        WHERE id = $2
        RETURNING *
      `;

      const result = await client.query(query, [input.content.trim(), replyId]);

      if (result.rows.length === 0) {
        throw new Error('Reply not found');
      }

      const row = result.rows[0];

      logger.info(`Reply updated: ${replyId}`);

      return {
        id: row.id,
        noteId: row.note_id,
        content: row.content,
        authorId: row.author_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        isEdited: row.is_edited,
      };
    } catch (error: any) {
      logger.error('Error updating reply:', error);
      throw error;
    }
  }

  /**
   * Delete a reply
   */
  async deleteReply(client: PoolClient, replyId: string, userId: string): Promise<void> {
    try {
      // Check if user can edit this reply
      const canEdit = await canUserEditReply(client, userId, replyId);
      if (!canEdit) {
        throw new Error('Not authorized to delete this reply');
      }

      // Delete reply (trigger will update parent note reply_count)
      const result = await client.query(`DELETE FROM note_replies WHERE id = $1`, [replyId]);

      if (result.rowCount === 0) {
        throw new Error('Reply not found');
      }

      logger.info(`Reply deleted: ${replyId}`);
    } catch (error: any) {
      logger.error('Error deleting reply:', error);
      throw error;
    }
  }

  /**
   * Get reply count for a note
   */
  async getReplyCount(client: PoolClient, noteId: string): Promise<number> {
    try {
      const query = `SELECT reply_count FROM asset_notes WHERE id = $1`;
      const result = await client.query(query, [noteId]);

      if (result.rows.length === 0) {
        return 0;
      }

      return result.rows[0].reply_count || 0;
    } catch (error) {
      logger.error('Error getting reply count:', error);
      return 0;
    }
  }

  /**
   * Get latest replies across all notes for an asset
   */
  async getLatestRepliesForAsset(
    client: PoolClient,
    assetId: string,
    userId: string,
    limit: number = 10
  ): Promise<NoteReplyWithAuthor[]> {
    try {
      const query = `
        SELECT 
          nr.id,
          nr.note_id,
          nr.content,
          nr.author_id,
          nr.created_at,
          nr.updated_at,
          nr.is_edited,
          u.id as author_id,
          u.name as author_name,
          u.email as author_email,
          u.avatar as author_avatar
        FROM note_replies nr
        JOIN asset_notes an ON an.id = nr.note_id
        JOIN users u ON u.id = nr.author_id
        WHERE an.asset_id = $1
          AND (an.is_private = false OR an.author_id = $2)
        ORDER BY nr.created_at DESC
        LIMIT $3
      `;

      const result = await client.query(query, [assetId, userId, limit]);

      return result.rows.map(row => ({
        id: row.id,
        noteId: row.note_id,
        content: row.content,
        authorId: row.author_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        isEdited: row.is_edited,
        author: {
          id: row.author_id,
          name: row.author_name,
          email: row.author_email,
          avatar: row.author_avatar,
        },
      }));
    } catch (error) {
      logger.error('Error getting latest replies for asset:', error);
      return [];
    }
  }
}

export const noteRepliesService = new NoteRepliesService();
