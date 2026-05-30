/**
 * Submarket Documents API Routes
 * Submarket-scoped document list, download, and delete.
 * Upload happens via POST /api/v1/deals/:dealId/files with submarketId in body.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';
import { verifyAccessToken, extractTokenFromHeader } from '../../auth/jwt';
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
 * Auth middleware that accepts Bearer header OR ?token= query param.
 * Used on download routes so browsers can navigate directly without Axios.
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
 * GET /api/v1/submarkets/:submarketId/documents/:fileId/download
 * Download a submarket-scoped document. Accepts Bearer header OR ?token= query param.
 */
router.get(
  '/submarkets/:submarketId/documents/:fileId/download',
  downloadAuth,
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

      res.download(file.file_path, file.original_filename, (err) => {
        if (err) {
          logger.error('Error streaming submarket file download:', { message: err.message, headersSent: res.headersSent });
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Download failed' });
          }
        }
      });
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
