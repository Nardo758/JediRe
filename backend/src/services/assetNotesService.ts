/**
 * Asset Notes Service
 * CRUD operations for location-based and general notes with spatial queries
 */

import { PoolClient } from 'pg';
import { logger } from '../utils/logger';
import {
  AssetNote,
  AssetNoteWithAuthor,
  CreateAssetNoteInput,
  UpdateAssetNoteInput,
  GetNotesFilters,
  AssetNotesResponse,
  Attachment,
} from '../types/assetMapIntelligence.types';
import {
  locationToPostGIS,
  geometryToPostGIS,
  isValidLocation,
  isValidGeometry,
} from '../utils/spatialHelpers';
import { checkUserNotePermission, buildNoteVisibilityFilter } from '../utils/notePermissions';
import { fileUploadService } from './fileUploadService';

class AssetNotesService {
  /**
   * Get all notes for an asset with filters
   */
  async getNotes(
    client: PoolClient,
    filters: GetNotesFilters,
    userId: string
  ): Promise<AssetNotesResponse> {
    try {
      // Check user has permission to view notes for this asset
      const hasPermission = await checkUserNotePermission(client, userId, filters.assetId, 'view');
      if (!hasPermission) {
        throw new Error('Not authorized to view notes for this asset');
      }

      const whereClauses: string[] = ['an.asset_id = $1'];
      const params: any[] = [filters.assetId];
      let paramIndex = 2;

      // Add visibility filter (private notes only visible to author)
      whereClauses.push(`(${buildNoteVisibilityFilter(userId)})`);

      // Filter by type
      if (filters.type) {
        whereClauses.push(`an.note_type = $${paramIndex}`);
        params.push(filters.type);
        paramIndex++;
      }

      // Filter by category
      if (filters.categoryId) {
        whereClauses.push(`an.category_id = $${paramIndex}`);
        params.push(filters.categoryId);
        paramIndex++;
      }

      // Filter by author
      if (filters.authorId) {
        whereClauses.push(`an.author_id = $${paramIndex}`);
        params.push(filters.authorId);
        paramIndex++;
      }

      // Pagination
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const query = `
        SELECT 
          an.id,
          an.asset_id,
          an.note_type,
          an.title,
          an.content,
          an.category_id,
          ST_Y(an.location::geometry) as location_lat,
          ST_X(an.location::geometry) as location_lng,
          an.geometry,
          an.attachments,
          an.total_attachment_size_bytes,
          an.reply_count,
          an.last_reply_at,
          an.author_id,
          an.created_at,
          an.updated_at,
          an.is_private,
          u.id as author_id,
          u.name as author_name,
          u.email as author_email,
          u.avatar as author_avatar,
          nc.id as category_id,
          nc.name as category_name,
          nc.color as category_color,
          nc.icon as category_icon,
          nc.is_system_default as category_is_system_default,
          nc.display_order as category_display_order
        FROM asset_notes an
        JOIN users u ON u.id = an.author_id
        LEFT JOIN note_categories nc ON nc.id = an.category_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY an.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const result = await client.query(query, params);

      const notes: AssetNoteWithAuthor[] = result.rows.map(row => ({
        id: row.id,
        assetId: row.asset_id,
        noteType: row.note_type,
        title: row.title,
        content: row.content,
        categoryId: row.category_id,
        location:
          row.location_lat && row.location_lng
            ? { lat: parseFloat(row.location_lat), lng: parseFloat(row.location_lng) }
            : null,
        geometry: row.geometry ? JSON.parse(row.geometry) : null,
        attachments: row.attachments || [],
        totalAttachmentSizeBytes: row.total_attachment_size_bytes,
        replyCount: row.reply_count,
        lastReplyAt: row.last_reply_at ? new Date(row.last_reply_at) : null,
        authorId: row.author_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        isPrivate: row.is_private,
        author: {
          id: row.author_id,
          name: row.author_name,
          email: row.author_email,
          avatar: row.author_avatar,
        },
        category: row.category_id
          ? {
              id: row.category_id,
              userId: null,
              organizationId: null,
              name: row.category_name,
              color: row.category_color,
              icon: row.category_icon,
              isSystemDefault: row.category_is_system_default,
              displayOrder: row.category_display_order,
              createdAt: new Date(),
            }
          : undefined,
      }));

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM asset_notes an
        WHERE ${whereClauses.join(' AND ')}
      `;

      const countResult = await client.query(countQuery, params.slice(0, -2));
      const total = parseInt(countResult.rows[0].total);

      return { notes, total };
    } catch (error: any) {
      logger.error('Error fetching notes:', error);
      throw error;
    }
  }

  /**
   * Get a single note by ID
   */
  async getNoteById(client: PoolClient, noteId: string, userId: string): Promise<AssetNoteWithAuthor | null> {
    try {
      const query = `
        SELECT 
          an.id,
          an.asset_id,
          an.note_type,
          an.title,
          an.content,
          an.category_id,
          ST_Y(an.location::geometry) as location_lat,
          ST_X(an.location::geometry) as location_lng,
          an.geometry,
          an.attachments,
          an.total_attachment_size_bytes,
          an.reply_count,
          an.last_reply_at,
          an.author_id,
          an.created_at,
          an.updated_at,
          an.is_private,
          u.id as author_id,
          u.name as author_name,
          u.email as author_email,
          u.avatar as author_avatar,
          nc.id as category_id,
          nc.name as category_name,
          nc.color as category_color,
          nc.icon as category_icon
        FROM asset_notes an
        JOIN users u ON u.id = an.author_id
        LEFT JOIN note_categories nc ON nc.id = an.category_id
        WHERE an.id = $1
      `;

      const result = await client.query(query, [noteId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Check permission
      if (row.is_private && row.author_id !== userId) {
        return null;
      }

      const hasPermission = await checkUserNotePermission(client, userId, row.asset_id, 'view');
      if (!hasPermission) {
        return null;
      }

      return {
        id: row.id,
        assetId: row.asset_id,
        noteType: row.note_type,
        title: row.title,
        content: row.content,
        categoryId: row.category_id,
        location:
          row.location_lat && row.location_lng
            ? { lat: parseFloat(row.location_lat), lng: parseFloat(row.location_lng) }
            : null,
        geometry: row.geometry ? JSON.parse(row.geometry) : null,
        attachments: row.attachments || [],
        totalAttachmentSizeBytes: row.total_attachment_size_bytes,
        replyCount: row.reply_count,
        lastReplyAt: row.last_reply_at ? new Date(row.last_reply_at) : null,
        authorId: row.author_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        isPrivate: row.is_private,
        author: {
          id: row.author_id,
          name: row.author_name,
          email: row.author_email,
          avatar: row.author_avatar,
        },
        category: row.category_id
          ? {
              id: row.category_id,
              userId: null,
              organizationId: null,
              name: row.category_name,
              color: row.category_color,
              icon: row.category_icon,
              isSystemDefault: false,
              displayOrder: 0,
              createdAt: new Date(),
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Error fetching note by ID:', error);
      throw new Error('Failed to fetch note');
    }
  }

  /**
   * Create a new note
   */
  async createNote(client: PoolClient, input: CreateAssetNoteInput): Promise<AssetNote> {
    try {
      // Validate content length
      if (!input.content || input.content.trim().length === 0) {
        throw new Error('Note content is required');
      }

      if (input.content.length > 5000) {
        throw new Error('Note content must be 5,000 characters or less');
      }

      // Check user has permission
      const hasPermission = await checkUserNotePermission(client, input.authorId, input.assetId, 'edit');
      if (!hasPermission) {
        throw new Error('Not authorized to create notes for this asset');
      }

      // Validate location if provided
      if (input.location && !isValidLocation(input.location)) {
        throw new Error('Invalid location coordinates');
      }

      // Validate geometry if provided
      if (input.geometry && !isValidGeometry(input.geometry)) {
        throw new Error('Invalid geometry');
      }

      // Build location/geometry SQL
      let locationSQL = 'NULL';
      let geometrySQL = 'NULL';

      if (input.location) {
        locationSQL = locationToPostGIS(input.location);
      }

      if (input.geometry) {
        geometrySQL = geometryToPostGIS(input.geometry);
      }

      const query = `
        INSERT INTO asset_notes (
          asset_id,
          note_type,
          title,
          content,
          category_id,
          location,
          geometry,
          attachments,
          total_attachment_size_bytes,
          author_id,
          is_private
        ) VALUES ($1, $2, $3, $4, $5, ${locationSQL}, ${geometrySQL}, $6, $7, $8, $9)
        RETURNING *
      `;

      const result = await client.query(query, [
        input.assetId,
        input.noteType,
        input.title || null,
        input.content.trim(),
        input.categoryId || null,
        JSON.stringify([]), // Empty attachments initially
        0, // Zero attachment size initially
        input.authorId,
        input.isPrivate || false,
      ]);

      const row = result.rows[0];

      logger.info(`Note created: ${row.id} by user ${input.authorId}`);

      return this.mapRowToNote(row);
    } catch (error: any) {
      logger.error('Error creating note:', error);
      throw error;
    }
  }

  /**
   * Update a note
   */
  async updateNote(
    client: PoolClient,
    noteId: string,
    userId: string,
    input: UpdateAssetNoteInput
  ): Promise<AssetNote> {
    try {
      // Check if user can edit this note
      const existing = await this.getNoteById(client, noteId, userId);
      if (!existing) {
        throw new Error('Note not found');
      }

      if (existing.authorId !== userId) {
        const hasAdminPermission = await checkUserNotePermission(
          client,
          userId,
          existing.assetId,
          'admin'
        );
        if (!hasAdminPermission) {
          throw new Error('Not authorized to edit this note');
        }
      }

      // Validate content length if provided
      if (input.content !== undefined) {
        if (input.content.trim().length === 0) {
          throw new Error('Note content cannot be empty');
        }
        if (input.content.length > 5000) {
          throw new Error('Note content must be 5,000 characters or less');
        }
      }

      // Build update query dynamically
      const updates: string[] = ['updated_at = NOW()'];
      const params: any[] = [];
      let paramIndex = 1;

      if (input.title !== undefined) {
        updates.push(`title = $${paramIndex}`);
        params.push(input.title);
        paramIndex++;
      }

      if (input.content !== undefined) {
        updates.push(`content = $${paramIndex}`);
        params.push(input.content.trim());
        paramIndex++;
      }

      if (input.categoryId !== undefined) {
        updates.push(`category_id = $${paramIndex}`);
        params.push(input.categoryId);
        paramIndex++;
      }

      if (input.location !== undefined) {
        if (input.location && !isValidLocation(input.location)) {
          throw new Error('Invalid location coordinates');
        }
        updates.push(`location = ${input.location ? locationToPostGIS(input.location) : 'NULL'}`);
      }

      if (input.geometry !== undefined) {
        if (input.geometry && !isValidGeometry(input.geometry)) {
          throw new Error('Invalid geometry');
        }
        updates.push(`geometry = ${input.geometry ? geometryToPostGIS(input.geometry) : 'NULL'}`);
      }

      if (input.isPrivate !== undefined) {
        updates.push(`is_private = $${paramIndex}`);
        params.push(input.isPrivate);
        paramIndex++;
      }

      if (updates.length === 1) {
        return existing; // No changes
      }

      params.push(noteId);

      const query = `
        UPDATE asset_notes
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, params);
      const row = result.rows[0];

      logger.info(`Note updated: ${noteId}`);

      return this.mapRowToNote(row);
    } catch (error: any) {
      logger.error('Error updating note:', error);
      throw error;
    }
  }

  /**
   * Delete a note
   */
  async deleteNote(client: PoolClient, noteId: string, userId: string): Promise<void> {
    try {
      // Check if user can delete this note
      const existing = await this.getNoteById(client, noteId, userId);
      if (!existing) {
        throw new Error('Note not found');
      }

      if (existing.authorId !== userId) {
        const hasAdminPermission = await checkUserNotePermission(
          client,
          userId,
          existing.assetId,
          'admin'
        );
        if (!hasAdminPermission) {
          throw new Error('Not authorized to delete this note');
        }
      }

      // Delete attachments from filesystem
      if (existing.attachments && existing.attachments.length > 0) {
        await fileUploadService.deleteMultipleFiles(existing.attachments);
      }

      // Delete note (cascade will delete replies)
      await client.query(`DELETE FROM asset_notes WHERE id = $1`, [noteId]);

      logger.info(`Note deleted: ${noteId}`);
    } catch (error: any) {
      logger.error('Error deleting note:', error);
      throw error;
    }
  }

  /**
   * Add attachments to a note
   */
  async addAttachments(
    client: PoolClient,
    noteId: string,
    userId: string,
    newAttachments: Attachment[]
  ): Promise<AssetNote> {
    try {
      const existing = await this.getNoteById(client, noteId, userId);
      if (!existing) {
        throw new Error('Note not found');
      }

      if (existing.authorId !== userId) {
        throw new Error('Not authorized to modify attachments');
      }

      // Calculate new total size
      const newSize = newAttachments.reduce((sum, att) => sum + att.size, 0);
      const totalSize = existing.totalAttachmentSizeBytes + newSize;

      if (totalSize > 50 * 1024 * 1024) {
        throw new Error('Total attachment size exceeds 50 MB limit');
      }

      // Merge attachments
      const allAttachments = [...existing.attachments, ...newAttachments];

      const query = `
        UPDATE asset_notes
        SET 
          attachments = $1,
          total_attachment_size_bytes = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;

      const result = await client.query(query, [JSON.stringify(allAttachments), totalSize, noteId]);

      logger.info(`Attachments added to note: ${noteId}`);

      return this.mapRowToNote(result.rows[0]);
    } catch (error: any) {
      logger.error('Error adding attachments:', error);
      throw error;
    }
  }

  /**
   * Remove an attachment from a note
   */
  async removeAttachment(
    client: PoolClient,
    noteId: string,
    userId: string,
    attachmentUrl: string
  ): Promise<AssetNote> {
    try {
      const existing = await this.getNoteById(client, noteId, userId);
      if (!existing) {
        throw new Error('Note not found');
      }

      if (existing.authorId !== userId) {
        throw new Error('Not authorized to modify attachments');
      }

      // Find and remove attachment
      const attachmentToRemove = existing.attachments.find(att => att.url === attachmentUrl);
      if (!attachmentToRemove) {
        throw new Error('Attachment not found');
      }

      const remainingAttachments = existing.attachments.filter(att => att.url !== attachmentUrl);
      const newTotalSize = existing.totalAttachmentSizeBytes - attachmentToRemove.size;

      // Delete file from filesystem
      await fileUploadService.deleteMultipleFiles([attachmentToRemove]);

      // Update database
      const query = `
        UPDATE asset_notes
        SET 
          attachments = $1,
          total_attachment_size_bytes = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;

      const result = await client.query(query, [
        JSON.stringify(remainingAttachments),
        newTotalSize,
        noteId,
      ]);

      logger.info(`Attachment removed from note: ${noteId}`);

      return this.mapRowToNote(result.rows[0]);
    } catch (error: any) {
      logger.error('Error removing attachment:', error);
      throw error;
    }
  }

  /**
   * Map database row to AssetNote
   */
  private mapRowToNote(row: any): AssetNote {
    return {
      id: row.id,
      assetId: row.asset_id,
      noteType: row.note_type,
      title: row.title,
      content: row.content,
      categoryId: row.category_id,
      location:
        row.location_lat && row.location_lng
          ? { lat: parseFloat(row.location_lat), lng: parseFloat(row.location_lng) }
          : null,
      geometry: row.geometry ? JSON.parse(row.geometry) : null,
      attachments: row.attachments || [],
      totalAttachmentSizeBytes: row.total_attachment_size_bytes,
      replyCount: row.reply_count,
      lastReplyAt: row.last_reply_at ? new Date(row.last_reply_at) : null,
      authorId: row.author_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isPrivate: row.is_private,
    };
  }
}

export const assetNotesService = new AssetNotesService();
