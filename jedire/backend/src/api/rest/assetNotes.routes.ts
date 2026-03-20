/**
 * Asset Notes API Routes
 * Endpoints for location-based and general notes with spatial queries
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth';
import { assetNotesService } from '../../services/assetNotesService';
import { fileUploadService } from '../../services/fileUploadService';
import { logger } from '../../utils/logger';
import { GetNotesFilters } from '../../types/assetMapIntelligence.types';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB per file
    files: 10, // Max 10 files per request
  },
});

/**
 * GET /api/assets/:assetId/notes
 * Get all notes for an asset with filters
 */
router.get(
  '/:assetId/notes',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { assetId } = req.params;
    const { type, category, author, limit, offset } = req.query;

    try {
      const filters: GetNotesFilters = {
        assetId,
        type: type as any,
        categoryId: category as string,
        authorId: author as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      };

      const result = await assetNotesService.getNotes(client, filters, userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error in GET /assets/:assetId/notes:', error);
      res.status(error.message.includes('authorized') ? 403 : 500).json({
        success: false,
        error: error.message || 'Failed to fetch notes',
      });
    }
  }
);

/**
 * GET /api/assets/:assetId/notes/:noteId
 * Get a single note by ID
 */
router.get(
  '/:assetId/notes/:noteId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { noteId } = req.params;

    try {
      const note = await assetNotesService.getNoteById(client, noteId, userId);

      if (!note) {
        return res.status(404).json({
          success: false,
          error: 'Note not found',
        });
      }

      res.json({
        success: true,
        note,
      });
    } catch (error: any) {
      logger.error('Error in GET /assets/:assetId/notes/:noteId:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch note',
      });
    }
  }
);

/**
 * POST /api/assets/:assetId/notes
 * Create a new note
 */
router.post(
  '/:assetId/notes',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { assetId } = req.params;
    const { type, title, content, categoryId, location, geometry, isPrivate } = req.body;

    try {
      const note = await assetNotesService.createNote(client, {
        assetId,
        noteType: type,
        title,
        content,
        categoryId,
        location,
        geometry,
        isPrivate,
        authorId: userId,
      });

      res.status(201).json({
        success: true,
        note: {
          id: note.id,
          type: note.noteType,
          title: note.title,
          createdAt: note.createdAt,
        },
      });
    } catch (error: any) {
      logger.error('Error in POST /assets/:assetId/notes:', error);
      res.status(error.message.includes('authorized') ? 403 : 400).json({
        success: false,
        error: error.message || 'Failed to create note',
      });
    }
  }
);

/**
 * PATCH /api/assets/:assetId/notes/:noteId
 * Update an existing note
 */
router.patch(
  '/:assetId/notes/:noteId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { noteId } = req.params;
    const { title, content, categoryId, location, geometry, isPrivate } = req.body;

    try {
      const updated = await assetNotesService.updateNote(client, noteId, userId, {
        title,
        content,
        categoryId,
        location,
        geometry,
        isPrivate,
      });

      res.json({
        success: true,
        note: updated,
      });
    } catch (error: any) {
      logger.error('Error in PATCH /assets/:assetId/notes/:noteId:', error);
      res.status(error.message.includes('authorized') ? 403 : 400).json({
        success: false,
        error: error.message || 'Failed to update note',
      });
    }
  }
);

/**
 * DELETE /api/assets/:assetId/notes/:noteId
 * Delete a note
 */
router.delete(
  '/:assetId/notes/:noteId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { noteId } = req.params;

    try {
      await assetNotesService.deleteNote(client, noteId, userId);

      res.json({
        success: true,
        message: 'Note deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error in DELETE /assets/:assetId/notes/:noteId:', error);
      res.status(error.message.includes('authorized') ? 403 : 400).json({
        success: false,
        error: error.message || 'Failed to delete note',
      });
    }
  }
);

/**
 * POST /api/assets/:assetId/notes/:noteId/attachments
 * Upload attachments to a note
 */
router.post(
  '/:assetId/notes/:noteId/attachments',
  authMiddleware.requireAuth,
  upload.array('files', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { noteId } = req.params;
    const files = req.files as Express.Multer.File[];

    try {
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files provided',
        });
      }

      // Get current note to check attachment size
      const note = await assetNotesService.getNoteById(client, noteId, userId);
      if (!note) {
        return res.status(404).json({
          success: false,
          error: 'Note not found',
        });
      }

      // Upload files
      const fileInputs = files.map(f => ({
        file: f.buffer,
        filename: f.originalname,
        mimeType: f.mimetype,
        size: f.size,
      }));

      const attachments = await fileUploadService.uploadMultipleFiles(
        fileInputs,
        userId,
        note.totalAttachmentSizeBytes
      );

      // Add attachments to note
      const updated = await assetNotesService.addAttachments(client, noteId, userId, attachments);

      res.json({
        success: true,
        attachments,
        totalSize: updated.totalAttachmentSizeBytes,
      });
    } catch (error: any) {
      logger.error('Error in POST /assets/:assetId/notes/:noteId/attachments:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to upload attachments',
      });
    }
  }
);

/**
 * DELETE /api/assets/:assetId/notes/:noteId/attachments
 * Remove an attachment from a note
 */
router.delete(
  '/:assetId/notes/:noteId/attachments',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const client = (req as any).dbClient;
    const userId = (req as any).user?.userId;
    const { noteId } = req.params;
    const { url } = req.body;

    try {
      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'Attachment URL is required',
        });
      }

      const updated = await assetNotesService.removeAttachment(client, noteId, userId, url);

      res.json({
        success: true,
        remainingAttachments: updated.attachments,
        totalSize: updated.totalAttachmentSizeBytes,
      });
    } catch (error: any) {
      logger.error('Error in DELETE /assets/:assetId/notes/:noteId/attachments:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to remove attachment',
      });
    }
  }
);

export default router;
