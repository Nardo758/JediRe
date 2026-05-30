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
import { query } from '../../database/connection';
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

/**
 * GET /api/v1/historical-observations/deals/:dealId/coverage
 *
 * Rich coverage report for the Data Coverage Panel on the deal page.
 * Returns property_performance, submarket_context, external_signals,
 * and a composite confidence rating.
 */
router.get('/deals/:dealId/coverage', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    // Look up the deal's property info — validate access (owner or active team member)
    const requestingUserId = req.user?.userId;
    const dealSql = `
      SELECT
        d.name AS deal_name,
        dp.property_id,
        COALESCE(p.parcel_id, dp.property_id) AS parcel_id,
        p.msa_id,
        p.submarket_id,
        p.year_built,
        p.property_class
      FROM deals d
      JOIN deal_properties dp ON dp.deal_id = d.id
      LEFT JOIN properties p ON p.id = dp.property_id
      WHERE d.id = $1
        AND (
          d.user_id = $2
          OR EXISTS (
            SELECT 1 FROM deal_team_members
            WHERE deal_id = $1 AND user_id = $2 AND status = 'active'
          )
        )
      LIMIT 5
    `;
    const dealResult = await query(dealSql, [dealId, requestingUserId]);

    if (dealResult.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found or has no linked properties' });
      return;
    }

    const properties = dealResult.rows.map((r: Record<string, unknown>) => ({
      dealName: r.deal_name as string,
      propertyId: r.property_id as string,
      parcelId: (r.parcel_id as string) ?? (r.property_id as string),
      msaId: (r.msa_id as string) ?? null,
      submarketId: (r.submarket_id as string) ?? null,
      yearBuilt: (r.year_built as number) ?? null,
      propertyClass: (r.property_class as string) ?? null,
    }));

    // Build coverage for first/primary property
    const primary = properties[0];

    // Property performance status
    const perfSql = `
      SELECT
        COUNT(*) AS total_months,
        MAX(observation_date) AS last_upload,
        MIN(observation_date) AS first_upload
      FROM historical_observations
      WHERE parcel_id = $1 AND is_subject_property = TRUE
    `;
    const perfResult = await query(perfSql, [primary.parcelId]);
    const totalMonths = Number(perfResult.rows[0]?.total_months) || 0;
    const lastUpload = perfResult.rows[0]?.last_upload
      ? new Date(perfResult.rows[0].last_upload as string)
      : null;
    const firstUpload = perfResult.rows[0]?.first_upload
      ? new Date(perfResult.rows[0].first_upload as string)
      : null;

    // Determine upload status
    const now = new Date();
    const daysSinceUpload = lastUpload
      ? Math.floor((now.getTime() - lastUpload.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    let propertyStatus: 'current' | 'stale' | 'missing';
    if (!lastUpload) propertyStatus = 'missing';
    else if (daysSinceUpload <= 35) propertyStatus = 'current';
    else propertyStatus = 'stale';

    // Check for gaps in the upload sequence
    let gaps = 0;
    if (firstUpload && lastUpload && totalMonths > 1) {
      const monthsBetween =
        (lastUpload.getUTCFullYear() - firstUpload.getUTCFullYear()) * 12 +
        (lastUpload.getUTCMonth() - firstUpload.getUTCMonth()) + 1;
      gaps = monthsBetween - totalMonths;
      if (gaps < 0) gaps = 0;
    }

    const coveragePct = totalMonths > 0
      ? Math.min(100, Math.round((totalMonths / 84) * 100))
      : 0;

    // Submarket context
    let submarketStatus: 'strong' | 'partial' | 'sparse' | 'missing' = 'missing';
    let submarketMonths = 0;
    if (primary.submarketId) {
      const subSql = `
        SELECT COUNT(*) AS cnt, MIN(observation_date) AS earliest, MAX(observation_date) AS latest
        FROM historical_observations
        WHERE submarket_id = $1 AND geography_level = 'submarket'
      `;
      const subResult = await query(subSql, [primary.submarketId]);
      submarketMonths = Number(subResult.rows[0]?.cnt) || 0;
      if (submarketMonths >= 36) submarketStatus = 'strong';
      else if (submarketMonths >= 12) submarketStatus = 'partial';
      else if (submarketMonths > 0) submarketStatus = 'sparse';
    }

    // External signal availability (stubs until Phase 4 ingestion is live)
    const externalSignals = [
      {
        name: 'LODES (commute-shed)',
        status: 'awaiting_ingestion' as const,
        note: 'Phase 4',
      },
      {
        name: 'QCEW (employment)',
        status: 'awaiting_ingestion' as const,
        note: 'Phase 4',
      },
      {
        name: 'FRED (rates)',
        status: 'awaiting_ingestion' as const,
        note: 'Phase 4',
      },
      {
        name: 'M35 events',
        status: 'awaiting_ingestion' as const,
        note: 'Phase 4',
      },
      {
        name: 'Veraset mobility',
        status: 'pending_subscription' as const,
        note: 'Vendor selection',
      },
    ];

    // Composite confidence
    let confidence: 'high' | 'medium' | 'low';
    if (propertyStatus === 'current' && submarketStatus === 'strong' && totalMonths >= 36) {
      confidence = 'high';
    } else if (propertyStatus !== 'missing' && (submarketStatus === 'partial' || submarketStatus === 'strong')) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    res.json({
      dealName: primary.dealName,
      propertyId: primary.propertyId,
      parcelId: primary.parcelId,
      propertyPerformance: {
        status: propertyStatus,
        totalMonths,
        lastUpload,
        firstUpload,
        daysSinceUpload,
        gaps,
        coveragePct,
      },
      submarketContext: {
        status: submarketStatus,
        totalMonths: submarketMonths,
        submarketId: primary.submarketId,
      },
      externalSignals,
      confidence,
      yearBuilt: primary.yearBuilt,
      propertyClass: primary.propertyClass,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[HistoricalObs] GET /deals/:dealId/coverage failed', { error: msg });
    res.status(500).json({ error: 'Failed to get deal coverage report' });
  }
});

/**
 * GET /api/v1/historical-observations/submarket/:submarketId/vendor-surveys
 *
 * Returns vendor-sourced historical_observations rows for a given submarket.
 * Used by SubmarketOverviewTab in the F4 market intelligence view.
 *
 * Matching strategy (OR):
 *   1. submarket_id column matches :submarketId (exact FK match)
 *   2. market_survey_snapshot->>'submarket' ILIKE ?name? (vendor text match)
 *
 * Query params:
 *   name    — submarket display name for JSONB text matching
 *   dealId  — optional; when provided, also matches by deal_id (tighter scope)
 *
 * Rows are ordered newest-first. Max 200 rows.
 *
 * Auth: requireAuth is already applied at the router mount; no deal-ownership
 * check here since submarket data has no inherent owner — it is aggregated
 * market context.
 */
router.get('/submarket/:submarketId/vendor-surveys', async (req: Request, res: Response) => {
  try {
    const { submarketId } = req.params;
    const { name, dealId } = req.query;

    const namePct = name ? `%${(name as string).trim()}%` : null;

    let sql: string;
    let params: unknown[];

    if (dealId) {
      // Deal-scoped: precise match via deal_id (also OR submarket_id / name)
      sql = `
        SELECT
          id, deal_id, observation_date, geography_level,
          submarket_avg_asking_rent, submarket_avg_effective_rent,
          submarket_vacancy_rate, submarket_under_construction,
          vendor_source, vendor_license_posture, vendor_data_as_of,
          market_survey_source, market_survey_snapshot
        FROM historical_observations
        WHERE vendor_source IS NOT NULL
          AND (
            deal_id = $1::uuid
            OR submarket_id = $2
            OR (
              $3::text IS NOT NULL
              AND market_survey_snapshot->>'submarket' ILIKE $3::text
            )
          )
        ORDER BY observation_date DESC
        LIMIT 200
      `;
      params = [dealId, submarketId, namePct];
    } else {
      // Submarket-only: match by submarket_id FK or JSONB name
      sql = `
        SELECT
          id, deal_id, observation_date, geography_level,
          submarket_avg_asking_rent, submarket_avg_effective_rent,
          submarket_vacancy_rate, submarket_under_construction,
          vendor_source, vendor_license_posture, vendor_data_as_of,
          market_survey_source, market_survey_snapshot
        FROM historical_observations
        WHERE vendor_source IS NOT NULL
          AND (
            submarket_id = $1
            OR (
              $2::text IS NOT NULL
              AND market_survey_snapshot->>'submarket' ILIKE $2::text
            )
          )
        ORDER BY observation_date DESC
        LIMIT 200
      `;
      params = [submarketId, namePct];
    }

    const result = await query(sql, params);

    res.json({
      submarketId,
      total: result.rows.length,
      rows: result.rows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[HistoricalObs] GET /submarket/:submarketId/vendor-surveys failed', { error: msg });
    res.status(500).json({ error: 'Failed to load submarket vendor surveys' });
  }
});

/**
 * GET /api/v1/historical-observations/deals/:dealId/vendor-surveys
 *
 * Returns all historical_observations rows for a deal that came from a
 * registered market data vendor (vendor_source IS NOT NULL). Used by the
 * VendorMarketSurveyPanel in the deal's Market Data tab.
 *
 * Rows are ordered newest-first. A max of 200 rows is returned.
 *
 * License posture note: `platform_only` and `restricted` rows ARE returned
 * here because this is an internal, authenticated, deal-scoped endpoint.
 * The platform_only constraint governs public export paths, not this view.
 */
router.get('/deals/:dealId/vendor-surveys', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const requestingUserId = req.user?.userId;

    // Verify the requesting user has access to this deal
    const accessSql = `
      SELECT d.id
      FROM deals d
      WHERE d.id = $1
        AND (
          d.user_id = $2
          OR EXISTS (
            SELECT 1 FROM deal_team_members
            WHERE deal_id = $1 AND user_id = $2 AND status = 'active'
          )
        )
      LIMIT 1
    `;
    const accessResult = await query(accessSql, [dealId, requestingUserId]);
    if (accessResult.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found or access denied' });
      return;
    }

    const surveysSql = `
      SELECT
        id,
        deal_id,
        observation_date,
        geography_level,
        submarket_avg_asking_rent,
        submarket_avg_effective_rent,
        submarket_vacancy_rate,
        submarket_under_construction,
        vendor_source,
        vendor_license_posture,
        vendor_data_as_of,
        market_survey_source,
        market_survey_snapshot
      FROM historical_observations
      WHERE deal_id = $1
        AND vendor_source IS NOT NULL
      ORDER BY observation_date DESC
      LIMIT 200
    `;
    const result = await query(surveysSql, [dealId]);

    res.json({
      dealId,
      total: result.rows.length,
      rows: result.rows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[HistoricalObs] GET /deals/:dealId/vendor-surveys failed', { error: msg });
    res.status(500).json({ error: 'Failed to load vendor survey data' });
  }
});

export default router;
