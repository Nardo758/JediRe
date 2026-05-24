import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../../utils/logger';

export function createIntakeJobsRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/summary', async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT state, COUNT(*)::int AS cnt FROM intake_jobs GROUP BY state ORDER BY state`,
      );
      const summary: Record<string, number> = {};
      for (const row of result.rows) {
        summary[row.state as string] = row.cnt as number;
      }
      res.json(summary);
    } catch (err: any) {
      logger.error('[intake-jobs/summary] error', { error: err.message });
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/', async (req: Request, res: Response) => {
    const { state, page = '1', limit = '25' } = req.query as Record<string, string>;

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const offset   = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (state && state !== 'ALL') {
      conditions.push(`ij.state = $${i++}`);
      params.push(state);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const [countResult, dataResult] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS cnt FROM intake_jobs ij ${where}`, params),
        pool.query(
          `SELECT
             ij.id, ij.file_id, ij.parcel_id, ij.state,
             ij.block_reason, ij.user_input, ij.source_type,
             ij.source_data, ij.enrichment_log,
             ij.created_at, ij.updated_at,
             dlf.original_filename, dlf.document_type,
             dlf.size_bytes, dlf.mime_type
           FROM intake_jobs ij
           LEFT JOIN data_library_files dlf ON dlf.id = ij.file_id
           ${where}
           ORDER BY ij.updated_at DESC
           LIMIT $${i} OFFSET $${i + 1}`,
          [...params, limitNum, offset],
        ),
      ]);

      const total = countResult.rows[0]?.cnt ?? 0;

      return res.json({
        jobs: dataResult.rows,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (err: any) {
      logger.error('[intake-jobs] GET error', { error: err.message });
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/:jobId/user-input', async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const input = req.body as Record<string, string>;

    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return res.status(400).json({ error: 'Body must be an object with parcel_id, address, or property_name' });
    }

    const newParcelId =
      (input.parcel_id || input.address || input.property_name || '').trim() || null;

    try {
      const result = await pool.query(
        `UPDATE intake_jobs
         SET user_input     = $1::jsonb,
             state          = 'pending',
             block_reason   = NULL,
             parcel_id      = COALESCE($2, parcel_id),
             enrichment_log = '[]'::jsonb,
             updated_at     = NOW()
         WHERE id = $3
         RETURNING id, state, parcel_id, user_input, updated_at`,
        [JSON.stringify(input), newParcelId, jobId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }

      logger.info('[intake-jobs] Job requeued', { jobId, newParcelId });
      return res.json({ job: result.rows[0] });
    } catch (err: any) {
      logger.error('[intake-jobs] POST user-input error', { jobId, error: err.message });
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
