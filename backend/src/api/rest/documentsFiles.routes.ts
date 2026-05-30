/**
 * Unified Documents & Files API Routes
 * RESTful endpoints for file management with intelligent categorization
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';
import { verifyAccessToken, extractTokenFromHeader } from '../../auth/jwt';
import { documentsFilesService } from '../../services/documentsFiles.service';
import { triggerExtractionInBackground } from '../../services/document-extraction/auto-extract-on-upload';
import { query as dbQuery } from '../../database/connection';
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
        submarketId,
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
            submarketId: submarketId || undefined,
          })
        )
      );

      // Fire-and-forget auto-extraction for each freshly uploaded file (Task #320).
      for (const f of uploadedFiles) {
        if (f && f.id) {
          triggerExtractionInBackground({
            fileId: f.id,
            dealId,
            userId: userId as string,
            category: f.category,
            mimeType: f.mime_type,
          });
        }
      }

      // Trigger agent hooks for each uploaded file
      const { onFileUploaded, onFinancialsUploaded } = await import('../../services/agents/platform-hooks');
      for (const file of uploadedFiles) {
        await onFileUploaded({
          dealId,
          userId,
          fileId: file.id,
          filename: file.original_filename || file.originalFilename,
          category: file.category || category,
          mimeType: file.mime_type || file.mimeType || 'application/octet-stream',
        });

        // If it's a financial document, also trigger financials event
        const finCategories = ['t12', 'rent_roll', 'financials', 'operating_statement'];
        if (finCategories.includes((file.category || category || '').toLowerCase())) {
          await onFinancialsUploaded({
            dealId,
            userId,
            type: (file.category || category || '').toLowerCase().includes('rent') ? 'rent_roll' : 't12',
            source: 'file_upload',
          });
        }
      }

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
 * GET /api/v1/deals/:dealId/files/:fileId/extraction
 * Lightweight endpoint for polling auto-extraction status.
 */
router.get(
  '/deals/:dealId/files/:fileId/extraction',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dealId, fileId } = req.params;
      const authUser = req.user as
        | { userId?: string; id?: string }
        | undefined;
      const userId = authUser?.userId ?? authUser?.id ?? null;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // Authz: caller must own (or have access to) the deal
      const dealCheck = await dbQuery(
        'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
        [dealId, userId]
      );
      if (dealCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Deal not found' });
      }

      const result = await dbQuery(
        `SELECT id, deal_id, extraction_status, extraction_skill,
                extraction_result, extraction_error,
                extraction_started_at, extraction_completed_at
           FROM deal_files
          WHERE id = $1 AND deal_id = $2 AND deleted_at IS NULL`,
        [fileId, dealId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }
      res.json({ success: true, extraction: result.rows[0] });
    } catch (error) {
      logger.error('Error getting extraction status:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/deals/:dealId/files/:fileId/reextract
 * Re-trigger auto-extraction for a file. Useful when the original
 * extraction was skipped (e.g. file pre-dated the extraction columns) or
 * failed for a transient reason. Resets extraction_status to 'queued'
 * and fires the same fire-and-forget pipeline used on initial upload.
 */
router.post(
  '/deals/:dealId/files/:fileId/reextract',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dealId, fileId } = req.params;
      const authUser = req.user as
        | { userId?: string; id?: string }
        | undefined;
      const userId = authUser?.userId ?? authUser?.id ?? null;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // Authz: caller must own the deal
      const dealCheck = await dbQuery(
        'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
        [dealId, userId]
      );
      if (dealCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Deal not found' });
      }

      // Look up the file's category + mime so we can pick the right skill
      const fileRes = await dbQuery(
        `SELECT id, category, mime_type
           FROM deal_files
          WHERE id = $1 AND deal_id = $2 AND deleted_at IS NULL`,
        [fileId, dealId]
      );
      if (fileRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }
      const file = fileRes.rows[0] as {
        id: string;
        category: string | null;
        mime_type: string | null;
      };

      // Atomic single-flight guard: reset state ONLY if not already in flight.
      // Concurrent reextract calls would otherwise spawn duplicate parser
      // runs (LLM cost, repeated data-router side effects, racing terminal
      // status writes). Both 'queued' and 'running' count as in-flight, so
      // a second click while the worker hasn't picked up the job yet still
      // 409s instead of clobbering state. rowCount=0 means in-flight.
      const reset = await dbQuery(
        `UPDATE deal_files
            SET extraction_status = 'queued',
                extraction_skill = NULL,
                extraction_result = NULL,
                extraction_error = NULL,
                extraction_started_at = NULL,
                extraction_completed_at = NULL
          WHERE id = $1
            AND extraction_status IS DISTINCT FROM 'running'
            AND extraction_status IS DISTINCT FROM 'queued'`,
        [fileId]
      );

      if (reset.rowCount === 0) {
        return res.status(409).json({
          success: false,
          message: 'Extraction is already in progress for this file',
          fileId: file.id,
        });
      }

      triggerExtractionInBackground({
        fileId: file.id,
        dealId,
        userId,
        category: file.category,
        mimeType: file.mime_type,
      });

      res.json({
        success: true,
        message: 'Extraction re-triggered',
        fileId: file.id,
      });
    } catch (error) {
      logger.error('Error re-triggering extraction:', error);
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
 * Auth middleware that accepts Bearer header OR ?token= query param.
 * Used exclusively on download routes so browsers can navigate directly
 * to the URL without needing Axios to set a header.
 */
function downloadAuth(req: Request, res: Response, next: NextFunction): void {
  const headerToken = extractTokenFromHeader(req.headers.authorization);
  const queryToken = req.query.token as string | undefined;
  const raw = headerToken || queryToken;
  if (!raw) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }
  const payload = verifyAccessToken(raw);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    return;
  }
  (req as AuthenticatedRequest).user = payload;
  next();
}

/**
 * GET /api/v1/deals/:dealId/files/:fileId/download
 * Download a file. Accepts Bearer header OR ?token= query param so the browser
 * can trigger a native download via <a href="...?token=..."> without Axios.
 */
router.get(
  '/deals/:dealId/files/:fileId/download',
  downloadAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dealId, fileId } = req.params;

      const file = await documentsFilesService.getFile(fileId);

      if (!file || file.deal_id !== dealId) {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }

      const filePath = file.file_path;

      // Check if file exists on disk
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({
          success: false,
          message: 'File not found on disk',
        });
      }

      // Stream file using Express res.download (handles headers, streaming, and errors)
      res.download(filePath, file.original_filename, (err) => {
        if (err) {
          logger.error('Error streaming file download:', { message: err.message, headersSent: res.headersSent });
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Download failed' });
          }
        }
      });
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
 * Delete a file (soft delete). Caller must own the parent deal.
 */
router.delete(
  '/deals/:dealId/files/:fileId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dealId, fileId } = req.params;
      const authUser = req.user as { userId?: string; id?: string } | undefined;
      const userId = authUser?.userId ?? authUser?.id ?? null;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const dealCheck = await dbQuery(
        'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
        [dealId, userId]
      );
      if (dealCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Deal not found' });
      }

      const deleted = await documentsFilesService.deleteFile(fileId, userId, dealId);

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

      type UploadedDealFile = {
        id: string;
        deal_id: string;
        category?: string | null;
        mime_type?: string | null;
      };
      const newVersion = (await documentsFilesService.uploadNewVersion(
        fileId,
        file,
        userId,
        versionNotes
      )) as UploadedDealFile | undefined;

      if (newVersion?.id) {
        triggerExtractionInBackground({
          fileId: newVersion.id,
          dealId: newVersion.deal_id,
          userId: userId as string,
          category: newVersion.category,
          mimeType: newVersion.mime_type,
        });
      }

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
