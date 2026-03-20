/**
 * Unified Documents & Files API Routes
 * RESTful endpoints for file management with intelligent categorization
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { documentsFilesService } from '../../services/documentsFiles.service';
import { logger } from '../../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const tempDir = path.join('./uploads', 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 10, // Max 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/heic',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/v1/deals/:dealId/files
 * Upload one or more files
 */
router.post(
  '/deals/:dealId/files',
  authMiddleware.requireAuth,
  upload.array('files', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dealId } = req.params;
      const userId = req.user?.id;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files provided',
        });
      }

      const {
        category,
        folderPath,
        tags,
        description,
        isRequired,
        expirationDate,
        status,
      } = req.body;

      // Parse tags if it's a string
      const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags || [];

      // Upload each file
      const uploadedFiles = await Promise.all(
        files.map((file) =>
          documentsFilesService.uploadFile({
            dealId,
            file,
            userId,
            category,
            folderPath: folderPath || '/',
            tags: parsedTags,
            description,
            isRequired: isRequired === 'true' || isRequired === true,
            expirationDate: expirationDate ? new Date(expirationDate) : undefined,
            status: status || 'draft',
          })
        )
      );

      res.json({
        success: true,
        message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
        files: uploadedFiles,
      });
    } catch (error) {
      logger.error('Error uploading files:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/deals/:dealId/files
 * List files with optional filters
 */
router.get(
  '/deals/:dealId/files',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dealId } = req.params;
      const {
        category,
        status,
        folderPath,
        tags,
        search,
        dateFrom,
        dateTo,
        onlyLatestVersions,
      } = req.query;

      const filters: any = {};

      if (category) filters.category = category as string;
      if (status) filters.status = status as string;
      if (folderPath) filters.folderPath = folderPath as string;
      if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];
      if (search) filters.search = search as string;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);
      if (onlyLatestVersions !== undefined) {
        filters.onlyLatestVersions = onlyLatestVersions === 'true';
      }

      const files = await documentsFilesService.getFiles(dealId, filters);

      res.json({
        success: true,
        files,
        count: files.length,
      });
    } catch (error) {
      logger.error('Error getting files:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/deals/:dealId/files/:fileId
 * Get file details
 */
router.get(
  '/deals/:dealId/files/:fileId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.params;

      const file = await documentsFilesService.getFileById(fileId);

      if (!file) {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }

      res.json({
        success: true,
        file,
      });
    } catch (error) {
      logger.error('Error getting file:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/deals/:dealId/files/:fileId/download
 * Download a file
 */
router.get(
  '/deals/:dealId/files/:fileId/download',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dealId, fileId } = req.params;

      const file = await documentsFilesService.getFileById(fileId);

      if (!file || file.deal_id !== dealId) {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }

      const filePath = documentsFilesService.getFilePath(dealId, file.filename);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({
          success: false,
          message: 'File not found on disk',
        });
      }

      // Set headers for download
      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(file.original_filename)}"`
      );
      res.setHeader('Content-Length', file.file_size.toString());

      // Stream file
      const fileStream = require('fs').createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      logger.error('Error downloading file:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/v1/deals/:dealId/files/:fileId
 * Update file metadata
 */
router.put(
  '/deals/:dealId/files/:fileId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.params;
      const updates = req.body;

      // Only allow certain fields to be updated
      const allowedUpdates = [
        'category',
        'folder_path',
        'tags',
        'description',
        'status',
        'is_required',
        'expiration_date',
        'version_notes',
      ];

      const filteredUpdates: any = {};
      for (const key of allowedUpdates) {
        if (updates[key] !== undefined) {
          filteredUpdates[key] = updates[key];
        }
      }

      const updatedFile = await documentsFilesService.updateFile(fileId, filteredUpdates);

      res.json({
        success: true,
        message: 'File updated successfully',
        file: updatedFile,
      });
    } catch (error) {
      logger.error('Error updating file:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/deals/:dealId/files/:fileId
 * Delete a file (soft delete)
 */
router.delete(
  '/deals/:dealId/files/:fileId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.params;
      const userId = req.user?.id;

      const deleted = await documentsFilesService.deleteFile(fileId, userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }

      res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting file:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/deals/:dealId/files/:fileId/versions
 * Upload a new version of an existing file
 */
router.post(
  '/deals/:dealId/files/:fileId/versions',
  authMiddleware.requireAuth,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.params;
      const userId = req.user?.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No file provided',
        });
      }

      const { versionNotes } = req.body;

      const newVersion = await documentsFilesService.uploadNewVersion(
        fileId,
        file,
        userId,
        versionNotes
      );

      res.json({
        success: true,
        message: 'New version uploaded successfully',
        file: newVersion,
      });
    } catch (error) {
      logger.error('Error uploading new version:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/deals/:dealId/files/:fileId/versions
 * Get version history for a file
 */
router.get(
  '/deals/:dealId/files/:fileId/versions',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileId } = req.params;

      const versions = await documentsFilesService.getVersionHistory(fileId);

      res.json({
        success: true,
        versions,
        count: versions.length,
      });
    } catch (error) {
      logger.error('Error getting version history:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/deals/:dealId/files/search
 * Search files with full-text search
 */
router.get(
  '/deals/:dealId/files/search',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dealId } = req.params;
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Search query required',
        });
      }

      const files = await documentsFilesService.searchFiles(dealId, q);

      res.json({
        success: true,
        files,
        count: files.length,
        query: q,
      });
    } catch (error) {
      logger.error('Error searching files:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/deals/:dealId/files/stats
 * Get storage analytics and statistics
 */
router.get(
  '/deals/:dealId/files/stats',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dealId } = req.params;

      const analytics = await documentsFilesService.getStorageAnalytics(dealId);
      const suggestions = await documentsFilesService.getMissingFileSuggestions(dealId);
      const categories = await documentsFilesService.getAvailableCategories(dealId);

      res.json({
        success: true,
        analytics,
        missing_file_suggestions: suggestions,
        available_categories: categories,
      });
    } catch (error) {
      logger.error('Error getting storage stats:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/deals/:dealId/files/categories
 * Get available categories for a deal (context-aware)
 */
router.get(
  '/deals/:dealId/files/categories',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dealId } = req.params;

      const categories = await documentsFilesService.getAvailableCategories(dealId);

      res.json({
        success: true,
        categories,
      });
    } catch (error) {
      logger.error('Error getting categories:', error);
      next(error);
    }
  }
);

// ============================================================================
// EXPORT
// ============================================================================

export default router;
