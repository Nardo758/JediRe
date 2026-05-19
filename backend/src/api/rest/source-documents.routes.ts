/**
 * GET /api/v1/deals/:dealId/source-documents
 *
 * Returns the list of documents that have been extracted for a deal,
 * from deals.deal_data.source_documents, enriched with fresh status
 * from deal_files where the file_id matches.
 *
 * Backward compat: deals with no source_documents return [].
 */
import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';

const router = Router({ mergeParams: true });

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

export default router;
