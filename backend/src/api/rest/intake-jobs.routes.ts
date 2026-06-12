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
             ij.block_reason, ij.conflict_data, ij.user_input, ij.source_type,
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

  /**
   * PATCH /:jobId/user-input
   *
   * Conflict resolution endpoint. Accepts a `resolved_parcel_id` field when the
   * analyst has chosen between two conflicting parcel IDs (or typed their own).
   * Writes the winning value authoritatively to `parcel_id`, clears `conflict_data`,
   * and requeues the job to `pending` so the enrichment chain reruns with the
   * correct identifier.
   *
   * Body fields:
   *   resolved_parcel_id  — the canonical parcel ID chosen by the analyst (required)
   *   [any other key]     — stored in user_input for downstream reference
   */
  router.patch('/:jobId/user-input', async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const body = req.body as Record<string, string>;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Body must be a JSON object' });
    }

    const resolvedParcelId = (body.resolved_parcel_id || '').trim() || null;

    try {
      let result;
      if (resolvedParcelId) {
        // Conflict-resolution path: analyst chose a canonical parcel ID.
        // Write it authoritatively, clear the conflict, and requeue.
        result = await pool.query(
          `UPDATE intake_jobs
              SET parcel_id      = $1,
                  conflict_data  = NULL,
                  block_reason   = NULL,
                  state          = 'pending',
                  user_input     = $2::jsonb,
                  enrichment_log = '[]'::jsonb,
                  updated_at     = NOW()
            WHERE id = $3
            RETURNING id, state, parcel_id, conflict_data, user_input, updated_at`,
          [resolvedParcelId, JSON.stringify(body), jobId],
        );
        logger.info('[intake-jobs] Conflict resolved, job requeued', { jobId, resolvedParcelId });
      } else {
        // Generic user-input patch (no conflict resolution).
        // Behaves like POST /:jobId/user-input — updates user_input and requeues.
        const newParcelId = (body.parcel_id || body.address || body.property_name || '').trim() || null;
        result = await pool.query(
          `UPDATE intake_jobs
              SET user_input     = $1::jsonb,
                  state          = 'pending',
                  block_reason   = NULL,
                  parcel_id      = COALESCE($2, parcel_id),
                  enrichment_log = '[]'::jsonb,
                  updated_at     = NOW()
            WHERE id = $3
            RETURNING id, state, parcel_id, conflict_data, user_input, updated_at`,
          [JSON.stringify(body), newParcelId, jobId],
        );
        logger.info('[intake-jobs] Job patched and requeued', { jobId, newParcelId });
      }

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }

      return res.json({ job: result.rows[0] });
    } catch (err: any) {
      logger.error('[intake-jobs] PATCH user-input error', { jobId, error: err.message });
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
