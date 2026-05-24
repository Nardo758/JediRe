import path from 'path';
import fs from 'fs';
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../../utils/logger';

const LIBRARY_UPLOAD_DIR = path.join(__dirname, '../../../../uploads/library');

export function createDataLibraryFilesRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const {
      search,
      document_type,
      parser_status,
      parcel_id,
      page = '1',
      limit = '50',
    } = req.query as Record<string, string>;

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset   = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (search) {
      conditions.push(`dlf.original_filename ILIKE $${i++}`);
      params.push(`%${search}%`);
    }
    if (document_type) {
      conditions.push(`dlf.document_type = $${i++}`);
      params.push(document_type);
    }
    if (parser_status) {
      conditions.push(`dlf.parser_status = $${i++}`);
      params.push(parser_status);
    }
    if (parcel_id) {
      conditions.push(`dlf.parcel_id = $${i++}`);
      params.push(parcel_id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const [countResult, dataResult] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS cnt FROM data_library_files dlf ${where}`, params),
        pool.query(
          `SELECT
             dlf.id,
             dlf.parcel_id,
             dlf.deal_id,
             dlf.original_filename,
             dlf.mime_type,
             dlf.size_bytes,
             dlf.storage_provider,
             dlf.storage_key,
             dlf.cdn_url,
             dlf.document_type,
             dlf.parser_used,
             dlf.parser_status,
             dlf.parser_error,
             dlf.uploaded_at,
             dlf.uploaded_by,
             dlf.source_signal,
             COALESCE(dlf.license_restricted, false) AS license_restricted,
             COALESCE(p.address_line1, '')      AS property_display_name
           FROM data_library_files dlf
           LEFT JOIN properties p ON p.parcel_id = dlf.parcel_id
           ${where}
           ORDER BY dlf.uploaded_at DESC
           LIMIT $${i} OFFSET $${i + 1}`,
          [...params, limitNum, offset],
        ),
      ]);

      const total = countResult.rows[0]?.cnt ?? 0;

      return res.json({
        files: dataResult.rows,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (err: any) {
      logger.error('[data-library-files] list error', { error: err.message });
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id/download', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        `SELECT id, original_filename, mime_type, storage_provider, storage_key, cdn_url
         FROM data_library_files
         WHERE id = $1`,
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }

      const file = result.rows[0] as {
        id: string;
        original_filename: string;
        mime_type: string | null;
        storage_provider: string | null;
        storage_key: string | null;
        cdn_url: string | null;
      };

      if (file.cdn_url) {
        return res.redirect(file.cdn_url);
      }

      if (file.storage_provider === 'local' && file.storage_key) {
        const localPath = path.join(LIBRARY_UPLOAD_DIR, path.basename(file.storage_key));
        if (!fs.existsSync(localPath)) {
          return res.status(404).json({ error: 'File not found on disk' });
        }
        res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
        if (file.mime_type) res.setHeader('Content-Type', file.mime_type);
        return res.sendFile(localPath);
      }

      return res.status(422).json({ error: 'No download source configured for this file' });
    } catch (err: any) {
      logger.error('[data-library-files] download error', { fileId: id, error: err.message });
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
