/**
 * Submarket Documents API Routes
 * Submarket-scoped document list, download, and delete.
 * Upload happens via POST /api/v1/deals/:dealId/files with submarketId in body.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { documentsFilesService } from '../../services/documentsFiles.service';
import { query as dbQuery } from '../../database/connection';
import { logger } from '../../utils/logger';
import fs from 'fs/promises';

const router = Router();

/**
 * GET /api/v1/submarkets/:submarketId/documents
 * List all market documents visible to this submarket.
 */
router.get(
  '/submarkets/:submarketId/documents',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { submarketId } = req.params;
      const files = await documentsFilesService.getSubmarketFiles(submarketId);
      res.json({ success: true, files, count: files.length });
    } catch (error) {
      logger.error('Error listing submarket documents:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/submarkets/:submarketId/documents/:fileId/download
 * Download a submarket-scoped document. Auth required; no deal ownership needed.
 */
router.get(
  '/submarkets/:submarketId/documents/:fileId/download',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { submarketId, fileId } = req.params;

      const result = await dbQuery(
        `SELECT * FROM deal_files
         WHERE id = $1 AND submarket_id = $2 AND deleted_at IS NULL`,
        [fileId, submarketId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }
      const file = result.rows[0];

      try {
        await fs.access(file.file_path);
      } catch {
        return res.status(404).json({ success: false, message: 'File not found on disk' });
      }

      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(file.original_filename)}"`
      );
      res.setHeader('Content-Length', String(file.file_size));

      const fileStream = require('fs').createReadStream(file.file_path);
      fileStream.pipe(res);
    } catch (error) {
      logger.error('Error downloading submarket document:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/submarkets/:submarketId/documents/:fileId
 * Soft-delete a submarket document. Auth required.
 */
router.delete(
  '/submarkets/:submarketId/documents/:fileId',
  authMiddleware.requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { submarketId, fileId } = req.params;
      const authUser = req.user as { userId?: string; id?: string } | undefined;
      const userId = authUser?.userId ?? authUser?.id ?? null;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const result = await dbQuery(
        `UPDATE deal_files
            SET deleted_at = NOW()
          WHERE id = $1 AND submarket_id = $2 AND deleted_at IS NULL
          RETURNING id`,
        [fileId, submarketId]
      );

      if ((result.rowCount ?? 0) === 0) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }

      res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
      logger.error('Error deleting submarket document:', error);
      next(error);
    }
  }
);

export default router;
