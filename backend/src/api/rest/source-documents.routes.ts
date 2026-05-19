/**
 * Source Documents Routes — Capsule Sharing Piece 1
 *
 * Lists, views, and downloads source documents per deal with audit logging.
 *
 * @version 2.0.0 (Piece 1 — download + audit)
 * @date 2026-05-19
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import * as fs from 'fs';
import * as path from 'path';

const router = Router({ mergeParams: true });

interface SourceDocRecord {
  file_id: string | null;
  filename: string;
  document_type: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  extracted_at: string;
  key_fields: string[];
  rows_inserted: number;
  source_ref: string;
}

// ─── List source documents ──────────────────────────────────────────────────

/**
 * GET /api/v1/deals/:dealId/source-documents
 *
 * Returns the list of extracted documents with live status enrichment.
 */
router.get('/:dealId/source-documents', async (req: Request, res: Response) => {
  const { dealId } = req.params;

  try {
    const pool = getPool();

    const dealRow = await pool.query(
      `SELECT deal_data->'source_documents' AS source_documents
         FROM deals
        WHERE id = $1`,
      [dealId]
    );

    if (dealRow.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const sourceDocs: SourceDocRecord[] =
      (dealRow.rows[0].source_documents as SourceDocRecord[] | null) ?? [];

    if (sourceDocs.length === 0) {
      return res.json({ deal_id: dealId, source_documents: [] });
    }

    // Enrich with live extraction_status + category from deal_files
    const fileIds = sourceDocs
      .map((d) => d.file_id)
      .filter((id): id is string => !!id);

    let fileStatusMap: Record<string, { extraction_status: string | null; category: string | null }> = {};

    if (fileIds.length > 0) {
      const fileRows = await pool.query(
        `SELECT id, extraction_status, category
           FROM deal_files
          WHERE id = ANY($1::uuid[])`,
        [fileIds]
      );
      for (const row of fileRows.rows) {
        fileStatusMap[row.id as string] = {
          extraction_status: row.extraction_status as string | null,
          category: row.category as string | null,
        };
      }
    }

    const enriched = sourceDocs.map((doc) => ({
      ...doc,
      live_extraction_status: doc.file_id
        ? (fileStatusMap[doc.file_id]?.extraction_status ?? null)
        : null,
      category: doc.file_id
        ? (fileStatusMap[doc.file_id]?.category ?? null)
        : null,
    }));

    return res.json({
      deal_id: dealId,
      source_documents: enriched,
      count: enriched.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
});

// ─── Single document download ────────────────────────────────────────────────

/**
 * GET /api/v1/deals/:dealId/documents/:documentId/download
 *
 * Downloads a single source document. Logs to document_access_log.
 */
router.get('/:dealId/documents/:documentId/download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId, documentId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;

  try {
    const pool = getPool();

    // Fetch the file record
    const fileResult = await pool.query(
      `SELECT id, deal_id, filename, original_filename, mime_type, file_size, storage_path
       FROM deal_files
       WHERE id = $1 AND deal_id = $2
       LIMIT 1`,
      [documentId, dealId]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileResult.rows[0];
    const storagePath: string = file.storage_path ?? '';
    const originalFilename: string = file.original_filename ?? file.filename ?? 'download';
    const mimeType: string = file.mime_type ?? 'application/octet-stream';

    // Resolve file path — try absolute storage_path first, then local uploads dir
    let fullPath = '';
    if (storagePath && fs.existsSync(storagePath)) {
      fullPath = storagePath;
    } else {
      // Fallback: look in local uploads directory
      const uploadsDir = path.resolve(process.cwd(), 'uploads', dealId);
      const localPath = path.join(uploadsDir, documentId);
      if (fs.existsSync(localPath)) {
        fullPath = localPath;
      } else {
        // Try finding by filename
        if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir);
          const match = files.find(f => f.startsWith(documentId) || f === (file.filename as string));
          if (match) {
            fullPath = path.join(uploadsDir, match);
          }
        }
      }
    }

    if (!fullPath) {
      logger.warn('File not found on disk for download', { dealId, documentId, storagePath });
      return res.status(404).json({ error: 'File content not found on storage. The file may have been deleted or migrated.' });
    }

    // Log the download
    const clientIp = req.ip ?? req.socket.remoteAddress ?? null;
    try {
      await pool.query(
        `INSERT INTO document_access_log (document_id, deal_id, accessed_by_user_id, access_type, ip_address, user_agent)
         VALUES ($1, $2, $3, 'download_single', $4::inet, $5)`,
        [documentId, dealId, userId, clientIp, req.headers['user-agent'] ?? null]
      );
    } catch (logErr: any) {
      // Don't fail the download if logging fails — just warn
      logger.warn('Failed to log document download', { error: logErr?.message, dealId, documentId });
    }

    // Stream the file
    const stat = fs.statSync(fullPath);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${originalFilename}"`);
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
    stream.on('error', (err) => {
      logger.error('Error streaming file', { error: err.message, dealId, documentId });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming file' });
      }
    });
  } catch (err: any) {
    logger.error('Document download error', { error: err?.message, dealId, documentId });
    return res.status(500).json({ error: err?.message ?? 'Download failed' });
  }
});

// ─── Bulk download ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/deals/:dealId/documents/bulk_download
 *
 * Downloads all documents for a deal as a ZIP archive with manifest.
 */
router.get('/:dealId/documents/bulk_download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;

  // Only load archiver when route is hit (it has heavy native dependencies)
  try {
    const archiver = require('archiver');
    const pool = getPool();

    // Get all files for the deal
    const fileResult = await pool.query(
      `SELECT id, filename, original_filename, mime_type, file_size, storage_path
       FROM deal_files
       WHERE deal_id = $1
       ORDER BY created_at`,
      [dealId]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'No files found for this deal' });
    }

    // Log the bulk download
    const clientIp = req.ip ?? req.socket.remoteAddress ?? null;
    try {
      // Log one entry per file to maintain audit granularity
      for (const file of fileResult.rows) {
        await pool.query(
          `INSERT INTO document_access_log (document_id, deal_id, accessed_by_user_id, access_type, ip_address, user_agent)
           VALUES ($1, $2, $3, 'download_bulk', $4::inet, $5)`,
          [file.id, dealId, userId, clientIp, req.headers['user-agent'] ?? null]
        );
      }
    } catch (logErr: any) {
      logger.warn('Failed to log bulk download', { error: logErr?.message, dealId });
    }

    // Build ZIP
    const archive = archiver('zip', { zlib: { level: 6 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="deal_${dealId}_documents.zip"`);

    archive.pipe(res);

    // Add manifest as first entry
    const manifestLines = [
      'filename,original_filename,mime_type,file_size',
      ...fileResult.rows.map((f: any) =>
        `"${f.filename}","${f.original_filename ?? f.filename}","${f.mime_type}",${f.file_size ?? 0}`
      ),
    ];
    archive.append(manifestLines.join('\n'), { name: 'manifest.csv' });

    // Add each file
    for (const file of fileResult.rows) {
      const storagePath: string = file.storage_path ?? '';
      const originalFilename: string = file.original_filename ?? file.filename ?? 'file';
      let fullPath = '';

      if (storagePath && fs.existsSync(storagePath)) {
        fullPath = storagePath;
      } else {
        const uploadsDir = path.resolve(process.cwd(), 'uploads', dealId);
        if (fs.existsSync(uploadsDir)) {
          const matches = fs.readdirSync(uploadsDir);
          const match = matches.find(f => f.startsWith(file.id) || f === file.filename);
          if (match) {
            fullPath = path.join(uploadsDir, match);
          }
        }
      }

      if (fullPath && fs.existsSync(fullPath)) {
        archive.file(fullPath, { name: originalFilename });
      } else {
        archive.append('File not found on disk', { name: `_missing_/${originalFilename}` });
      }
    }

    archive.finalize();

    archive.on('error', (err: Error) => {
      logger.error('Archive error', { error: err.message, dealId });
    });
  } catch (err: any) {
    if (!res.headersSent) {
      return res.status(500).json({ error: err?.message ?? 'Bulk download failed' });
    }
  }
});

// ─── Access log (deal owner) ─────────────────────────────────────────────────

/**
 * GET /api/v1/deals/:dealId/documents/access_log
 *
 * Returns the download audit log for a deal's documents (deal owner only).
 */
router.get('/:dealId/documents/access_log', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;

  try {
    const pool = getPool();

    // Verify ownership
    const dealCheck = await pool.query(
      `SELECT 1 FROM deals WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [dealId, userId]
    );
    if (dealCheck.rows.length === 0) {
      // Also check team membership
      const teamCheck = await pool.query(
        `SELECT 1 FROM deal_team_members WHERE deal_id = $1 AND user_id = $2 LIMIT 1`,
        [dealId, userId]
      );
      if (teamCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Only the deal owner or team members can view the access log' });
      }
    }

    const { rows } = await pool.query(
      `SELECT dal.log_id,
              dal.document_id,
              dal.access_type,
              dal.access_timestamp,
              dal.ip_address,
              df.original_filename AS filename,
              df.document_type,
              u.email AS user_email,
              u.name AS user_name
       FROM document_access_log dal
       LEFT JOIN deal_files df ON df.id = dal.document_id
       LEFT JOIN users u ON u.user_id = dal.accessed_by_user_id
       WHERE dal.deal_id = $1
       ORDER BY dal.access_timestamp DESC
       LIMIT 500`,
      [dealId]
    );

    return res.json({
      deal_id: dealId,
      entries: rows,
      count: rows.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Failed to fetch access log' });
  }
});

export default router;
