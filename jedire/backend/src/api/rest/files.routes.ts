/**
 * File Management API Routes
 * Handles file uploads, downloads, and deletions for Asset Map Intelligence
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { fileUploadService, uploadMiddleware } from '../../services/fileUpload.service';
import { logger } from '../../utils/logger';
import path from 'path';

const router = Router();

/**
 * POST /api/v1/upload/note-attachment
 * Upload file(s) to a note
 * 
 * Body: multipart/form-data
 * - files: File(s) to upload
 * - assetId: UUID of the asset
 * - noteId: UUID of the note
 */
router.post(
  '/upload/note-attachment',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { assetId, noteId } = req.body;

      if (!assetId || !noteId) {
        return res.status(400).json({
          success: false,
          message: 'assetId and noteId are required',
        });
      }

      // Check current size and validate size limit before upload
      const upload = uploadMiddleware.array('files', 10);
      
      upload(req, res, async (err: any) => {
        try {
          if (err) {
            logger.error('Upload error:', err);
            
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({
                success: false,
                message: `File too large. Maximum size per file: 20 MB`,
              });
            }
            
            if (err.code === 'LIMIT_FILE_COUNT') {
              return res.status(400).json({
                success: false,
                message: 'Too many files. Maximum 10 files per upload.',
              });
            }
            
            return res.status(400).json({
              success: false,
              message: err.message || 'File upload failed',
            });
          }

          const files = req.files as Express.Multer.File[];
          
          if (!files || files.length === 0) {
            return res.status(400).json({
              success: false,
              message: 'No files provided',
            });
          }

          // Check total size limit
          const totalSize = await fileUploadService.getTotalNoteAttachmentSize(assetId, noteId);
          const maxSize = 50 * 1024 * 1024; // 50 MB
          
          if (totalSize > maxSize) {
            // Delete uploaded files if limit exceeded
            for (const file of files) {
              await fileUploadService.deleteFile(assetId, noteId, file.filename);
            }
            
            return res.status(400).json({
              success: false,
              message: `Total attachment size limit exceeded. Maximum 50 MB per note. Current size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`,
            });
          }

          // TODO: Virus scan files here in production

          // Build response with file metadata
          const uploadedFiles = files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            url: fileUploadService.generateDownloadUrl(assetId, noteId, file.filename),
          }));

          logger.info(`Uploaded ${files.length} file(s) for note ${noteId}`, {
            assetId,
            noteId,
            files: uploadedFiles.map(f => f.originalName),
          });

          res.json({
            success: true,
            message: `Successfully uploaded ${files.length} file(s)`,
            files: uploadedFiles,
            totalSize,
            remainingSpace: maxSize - totalSize,
          });
        } catch (innerError) {
          logger.error('Error processing upload:', innerError);
          next(innerError);
        }
      });
    } catch (error) {
      logger.error('Error in upload handler:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/files/notes/:assetId/:noteId/:filename
 * Download a file
 */
router.get(
  '/files/notes/:assetId/:noteId/:filename',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { assetId, noteId, filename } = req.params;

      // TODO: Check user permissions for the asset/note here
      // For now, any authenticated user can download

      const filePath = fileUploadService.getFilePath(assetId, noteId, filename);

      if (!filePath) {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }

      // Send file with proper content type
      const sanitizedFilename = path.basename(filename);
      res.download(filePath, sanitizedFilename, (err) => {
        if (err) {
          logger.error('Error sending file:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: 'Error downloading file',
            });
          }
        }
      });
    } catch (error) {
      logger.error('Error in download handler:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/files/notes/:assetId/:noteId/:filename
 * Delete a file
 */
router.delete(
  '/files/notes/:assetId/:noteId/:filename',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { assetId, noteId, filename } = req.params;

      // TODO: Check user permissions (only note author or admin can delete)
      // For now, any authenticated user can delete

      const deleted = await fileUploadService.deleteFile(assetId, noteId, filename);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }

      logger.info(`Deleted file: ${filename}`, { assetId, noteId });

      res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      logger.error('Error in delete handler:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/files/notes/:assetId/:noteId
 * List all attachments for a note
 */
router.get(
  '/files/notes/:assetId/:noteId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { assetId, noteId } = req.params;

      const attachments = await fileUploadService.listNoteAttachments(assetId, noteId);
      const totalSize = await fileUploadService.getTotalNoteAttachmentSize(assetId, noteId);
      const maxSize = 50 * 1024 * 1024; // 50 MB

      const files = attachments.map(attachment => ({
        filename: attachment.sanitizedName,
        originalName: attachment.originalName,
        size: attachment.size,
        mimeType: attachment.mimeType,
        uploadedAt: attachment.uploadedAt,
        url: fileUploadService.generateDownloadUrl(assetId, noteId, attachment.sanitizedName),
      }));

      res.json({
        success: true,
        files,
        count: files.length,
        totalSize,
        remainingSpace: Math.max(0, maxSize - totalSize),
        maxSize,
      });
    } catch (error) {
      logger.error('Error listing attachments:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/files/notes/:assetId/:noteId
 * Delete all attachments for a note
 */
router.delete(
  '/files/notes/:assetId/:noteId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { assetId, noteId } = req.params;

      // TODO: Check user permissions (only note author or admin can delete)

      const deleted = await fileUploadService.deleteNoteAttachments(assetId, noteId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'No attachments found',
        });
      }

      logger.info(`Deleted all attachments for note: ${noteId}`, { assetId });

      res.json({
        success: true,
        message: 'All attachments deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting all attachments:', error);
      next(error);
    }
  }
);

export default router;
