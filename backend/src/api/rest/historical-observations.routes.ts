/**
 * Historical Observations — REST Routes
 *
 * Exposes the CorpusQueryService over HTTP for the Data Coverage Panel
 * and agent-facing API.
 *
 * Endpoints:
 *   GET  /api/v1/historical-observations          — query rows
 *   GET  /api/v1/historical-observations/summary   — aggregate stats
 *   GET  /api/v1/historical-observations/coverage   — per-geography coverage report
 *
 * @see HISTORICAL_OBSERVATIONS_SPEC.md Section 8
 */

import { Router, type Request, type Response } from 'express';
import { logger } from '../../utils/logger';
import { corpusQueryService } from '../../services/historical-observations';

const router = Router();

/**
 * GET /api/v1/historical-observations
 *
 * Query historical_observations rows. All query parameters are optional.
 *
 * Query params:
 *   msa_id        — filter by MSA
 *   submarket_id  — filter by submarket
 *   parcel_id     — filter by parcel
 *   start_date    — ISO date, inclusive
 *   end_date      — ISO date, inclusive
 *   window        — monthly | quarterly | annual
 *   subject_only  — true | false
 *   limit         — max rows (default 100)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { msa_id, submarket_id, parcel_id, start_date, end_date, window, subject_only, limit } = req.query;

    const rows = await corpusQueryService.query({
      geography: {
        msaId: msa_id as string | undefined,
        submarketId: submarket_id as string | undefined,
        parcelId: parcel_id as string | undefined,
      },
      timeRange: {
        start: start_date ? new Date(start_date as string) : new Date('2018-01-01'),
        end: end_date ? new Date(end_date as string) : new Date(),
      },
      observationWindow: (window as 'monthly' | 'quarterly' | 'annual') || undefined,
      isSubjectOnly: subject_only === 'true' ? true : undefined,
    });

    const limited = rows.slice(0, Math.min(Number(limit) || 100, 1000));

    res.json({ total: rows.length, returned: limited.length, rows: limited });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[HistoricalObs] GET / failed', { error: msg });
    res.status(500).json({ error: 'Failed to query historical observations' });
  }
});

/**
 * GET /api/v1/historical-observations/summary
 *
 * Aggregate statistics for a given geography.
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { msa_id, submarket_id, parcel_id } = req.query;

    const summary = await corpusQueryService.summary({
      geography: {
        msaId: msa_id as string | undefined,
        submarketId: submarket_id as string | undefined,
        parcelId: parcel_id as string | undefined,
      },
      timeRange: {
        start: new Date('2018-01-01'),
        end: new Date(),
      },
    });

    res.json(summary);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[HistoricalObs] GET /summary failed', { error: msg });
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

/**
 * GET /api/v1/historical-observations/coverage
 *
 * Per-geography data density / freshness report.
 *
 * Query params:
 *   msa_id        — required
 *   submarket_id  — optional but recommended for parcel-level reports
 *   parcel_id     — optional
 */
router.get('/coverage', async (req: Request, res: Response) => {
  try {
    const { msa_id, submarket_id, parcel_id } = req.query;

    if (!msa_id) {
      res.status(400).json({ error: 'msa_id is required' });
      return;
    }

    const coverage = await corpusQueryService.coverage({
      msaId: msa_id as string,
      submarketId: submarket_id as string | undefined,
      parcelId: parcel_id as string | undefined,
    });

    res.json(coverage);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[HistoricalObs] GET /coverage failed', { error: msg });
    res.status(500).json({ error: 'Failed to get coverage report' });
  }
});

export default router;
