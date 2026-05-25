/**
 * GET /api/v1/properties/:parcelId/summary
 *
 * Unified per-property summary endpoint (Per-Property Visibility Substrate, §4.5).
 * Returns all three data streams in one call:
 *   Stream A — property_descriptions row (attributes with LayeredValue provenance)
 *   Stream B — data_library_files list (source documents for this parcel)
 *   Stream C — historical_observations time-series (default metrics, last 5 years)
 *
 * Also returns coverage_diagnostics so the UI knows what data is present.
 *
 * Auth: requireAuth (applied at mount time in index.replit.ts)
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../../utils/logger';
import {
  getAssetTimeSeries,
  DEFAULT_METRICS,
  type SupportedMetric,
} from '../../services/property-visibility/asset-time-series.service';

// ── In-memory enrichment job tracking ────────────────────────────────────────
// Tracks async enrichment jobs for status polling. TTL-purged after 30 min.
interface EnrichJobEntry {
  status: 'enriching' | 'complete' | 'error' | 'no_match' | 'pending_review';
  fields_written?: string[];
  dq_score?: number;
  error_msg?: string;
  updated_at: string;
  expires_at: number;
}
const enrichJobStore = new Map<string, EnrichJobEntry>();
const ENRICH_JOB_TTL_MS = 30 * 60 * 1000;

function setJobState(jobId: string, update: Omit<EnrichJobEntry, 'expires_at'>) {
  enrichJobStore.set(jobId, { ...update, expires_at: Date.now() + ENRICH_JOB_TTL_MS });
  for (const [id, entry] of enrichJobStore) {
    if (Date.now() > entry.expires_at) enrichJobStore.delete(id);
  }
}

export function createArchivePropertiesRouter(pool: Pool): Router {
  const router = Router();

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/properties/:parcelId/summary
  //
  // Spec §4.5 response shape:
  //   { parcel_id, description, files, time_series, coverage_diagnostics }
  // ─────────────────────────────────────────────────────────────────────────
  router.get('/:parcelId/summary', async (req: Request, res: Response) => {
    const { parcelId } = req.params;

    try {
      // ── Stream A: property_descriptions ──────────────────────────────────
      const descResult = await pool.query(
        `SELECT * FROM property_descriptions WHERE parcel_id = $1`,
        [parcelId],
      );
      const description = descResult.rows[0] ?? null;

      // ── Stream B: data_library_files ──────────────────────────────────────
      const filesResult = await pool.query(
        `SELECT
           id, parcel_id, deal_id,
           original_filename, sha256, mime_type, size_bytes,
           storage_provider, storage_key, cdn_url,
           document_type, parser_used, parser_version,
           parser_status, parser_run_id, parser_error,
           uploaded_at, uploaded_by, source_signal,
           license_restricted, license_source
         FROM data_library_files
         WHERE parcel_id = $1
         ORDER BY document_type, uploaded_at DESC`,
        [parcelId],
      );
      const files = filesResult.rows;

      // ── Stream C: time-series via getAssetTimeSeries service ──────────────
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      // Allow caller to override metrics via ?metrics=asking_rent,occupancy
      let metrics: SupportedMetric[] = DEFAULT_METRICS;
      if (req.query.metrics) {
        const requested = (req.query.metrics as string).split(',').map(s => s.trim());
        const valid = requested.filter((m): m is SupportedMetric =>
          DEFAULT_METRICS.includes(m as SupportedMetric),
        );
        if (valid.length > 0) metrics = valid;
      }

      const timeSeries = await getAssetTimeSeries(parcelId, metrics, fiveYearsAgo);

      // ── Coverage diagnostics ──────────────────────────────────────────────
      const filesByType: Record<string, number> = {};
      for (const f of files) {
        filesByType[f.document_type] = (filesByType[f.document_type] ?? 0) + 1;
      }

      // Description completeness: count non-null JSONB fields with a resolved value
      const DESCRIPTION_FIELDS = [
        'property_name', 'address', 'msa', 'county',
        'year_built', 'unit_count', 'stories', 'total_sqft', 'rentable_sqft',
        'lot_size_acres', 'construction_type', 'parking_type', 'asset_class',
        'property_type', 'amenities', 'zoning_code', 'narrative',
      ];
      let filledFields = 0;
      if (description) {
        for (const field of DESCRIPTION_FIELDS) {
          const val = description[field];
          if (val && val.resolved != null && val.resolved !== '') filledFields++;
        }
      }

      // Time-series completeness: average across all metrics (0–1)
      const metricCompleteness = Object.values(timeSeries.coverage).map(c =>
        c.gap_diagnostic ? c.gap_diagnostic.coverage_pct : 0,
      );
      const tsCompleteness = metricCompleteness.length > 0
        ? metricCompleteness.reduce((a, b) => a + b, 0) / metricCompleteness.length
        : 0;

      const coverageDiagnostics = {
        has_om:                   (filesByType['OM'] ?? 0) > 0,
        has_t12_count:             filesByType['T12'] ?? 0,
        has_rent_roll_count:       filesByType['RENT_ROLL'] ?? 0,
        has_tax_bill:             (filesByType['TAX_BILL'] ?? 0) > 0,
        has_leasing_stats:        (filesByType['LEASING_STATS'] ?? 0) > 0,
        description_completeness:  description
          ? Math.round((filledFields / DESCRIPTION_FIELDS.length) * 100) / 100
          : 0,
        time_series_completeness:  Math.round(tsCompleteness * 100) / 100,
      };

      if (!description && files.length === 0) {
        return res.status(404).json({
          error: 'Property not found',
          parcel_id: parcelId,
        });
      }

      return res.json({
        parcel_id: parcelId,
        description,
        files,
        time_series: timeSeries,
        coverage_diagnostics: coverageDiagnostics,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[archive-properties] summary error', { parcelId, msg });
      return res.status(500).json({ error: msg });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/properties/places-photo
  // Server-side proxy for Google Places photo media — keeps API key off clients.
  // ─────────────────────────────────────────────────────────────────────────
  router.get('/places-photo', async (req: Request, res: Response) => {
    const photoName = req.query.name as string | undefined;
    if (!photoName) return res.status(400).json({ error: 'name query param required' });

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Places API not configured' });

    const allowedPrefix = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;
    if (!allowedPrefix.test(photoName)) {
      return res.status(400).json({ error: 'Invalid photo resource name' });
    }

    try {
      const upstream = await fetch(
        `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&key=${apiKey}`,
        { redirect: 'follow' },
      );
      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: 'Upstream Places photo fetch failed' });
      }
      const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const buf = await upstream.arrayBuffer();
      return res.send(Buffer.from(buf));
    } catch (err) {
      return res.status(502).json({ error: 'Photo proxy error' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/v1/properties/by-parcel/:parcelId/enrich
  // On-demand Phase 8 research enrichment (web search + Google Places).
  // 5-second sync window: completes within 5s → 200; otherwise → 202 + jobId.
  // ─────────────────────────────────────────────────────────────────────────
  router.post('/by-parcel/:parcelId/enrich', async (req: Request, res: Response) => {
    const rawParcelId = decodeURIComponent(req.params.parcelId);

    try {
      const bodyAssetId: string | undefined = typeof req.body?.assetId === 'string' ? req.body.assetId : undefined;

      const dlaRow = bodyAssetId
        ? await pool.query<{
            property_name: string;
            address: string | null;
            city: string | null;
            state: string | null;
            id: string;
            data_quality_score: number | null;
          }>(
            `SELECT id, property_name, address, city, state, data_quality_score
             FROM data_library_assets WHERE id = $1 LIMIT 1`,
            [bodyAssetId],
          )
        : await pool.query<{
            property_name: string;
            address: string | null;
            city: string | null;
            state: string | null;
            id: string;
            data_quality_score: number | null;
          }>(
            `SELECT id, property_name, address, city, state, data_quality_score
             FROM data_library_assets
             WHERE property_name = $1
             ORDER BY created_at DESC LIMIT 1`,
            [rawParcelId],
          );

      if (dlaRow.rows.length === 0) {
        return res.status(404).json({ error: `No asset found for parcel_id: ${rawParcelId}` });
      }

      const asset = dlaRow.rows[0];

      if (!process.env.GOOGLE_PLACES_API_KEY) {
        return res.status(503).json({ error: 'places_key_missing' });
      }

      if (!asset.address || !asset.city || !asset.state) {
        return res.status(400).json({
          error: 'address, city, and state are required on the asset for research enrichment',
          missing: [
            ...(!asset.address ? ['address'] : []),
            ...(!asset.city ? ['city'] : []),
            ...(!asset.state ? ['state'] : []),
          ],
        });
      }

      const prevScore = asset.data_quality_score ?? 0;
      const jobId = `research_${rawParcelId.replace(/\s+/g, '_')}_${Date.now()}`;

      const { runResearchEnrichment } = await import('../../services/research/research-enrichment.service');

      const enrichPromise = runResearchEnrichment({
        parcelId: rawParcelId,
        propertyName: asset.property_name,
        address: asset.address,
        city: asset.city,
        state: asset.state,
      }).then(result => ({ result }));

      const SYNC_TIMEOUT_MS = 5000;
      const raceOutcome = await Promise.race([
        enrichPromise.then(r => ({ done: true as const, ...r })),
        new Promise<{ done: false }>(resolve =>
          setTimeout(() => resolve({ done: false }), SYNC_TIMEOUT_MS)
        ),
      ]);

      if (raceOutcome.done) {
        const { result } = raceOutcome;
        const enrichStatus = result.fields_written.length === 0 ? 'no_match' : 'pending_review';
        return res.status(200).json({
          status: enrichStatus,
          parcel_id: rawParcelId,
          asset_id: asset.id,
          jobId,
          fieldsEnriched: result.fields_written,
          conflicts: [],
          previousScore: prevScore,
          places_status: result.places_status,
          web_status: result.web_status,
          reviews_count: result.reviews_count,
          photos_count: result.photos_count,
          narrative_words: result.narrative_words,
          logId: jobId,
        });
      }

      setJobState(jobId, { status: 'enriching', updated_at: new Date().toISOString() });

      res.status(202).json({
        status: 'processing',
        jobId,
        parcel_id: rawParcelId,
        asset_id: asset.id,
        previousScore: prevScore,
        message: 'Enrichment is running in the background. Poll /enrich/status for completion.',
      });

      enrichPromise
        .then(({ result }) => {
          const finalStatus = result.fields_written.length === 0 ? 'no_match' : 'pending_review';
          setJobState(jobId, {
            status: finalStatus,
            fields_written: result.fields_written,
            updated_at: new Date().toISOString(),
          });
        })
        .catch(err => {
          const msg = (err as Error).message;
          setJobState(jobId, { status: 'error', error_msg: msg, updated_at: new Date().toISOString() });
          console.error('[archive-properties] background enrich failed', { parcelId: rawParcelId, error: msg });
        });

      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const statusCode = msg.includes('quota') || msg.includes('429') ? 429
        : msg.includes('unavailable') || msg.includes('503') ? 503
        : 500;
      console.error('[archive-properties] enrich error', { parcelId: rawParcelId, msg });
      return res.status(statusCode).json({ error: msg });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/properties/by-parcel/:parcelId/enrich/status
  // Poll enrichment status. Checks in-memory job store by jobId query param.
  // Falls back to property_descriptions scan if jobId not provided.
  // ─────────────────────────────────────────────────────────────────────────
  router.get('/by-parcel/:parcelId/enrich/status', async (req: Request, res: Response) => {
    const rawParcelId = decodeURIComponent(req.params.parcelId);
    const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : undefined;

    if (jobId) {
      const entry = enrichJobStore.get(jobId);
      if (entry) {
        return res.json({
          status: entry.status,
          jobId,
          parcel_id: rawParcelId,
          fieldsEnriched: entry.fields_written ?? [],
          dq_score: entry.dq_score ?? null,
          error_msg: entry.error_msg ?? null,
          updated_at: entry.updated_at,
        });
      }
    }

    try {
      const pd = await pool.query<{
        reviews: unknown;
        recent_events: unknown;
        photos: unknown;
        narrative: unknown;
        updated_at: string;
      }>(
        `SELECT reviews, recent_events, photos, narrative, updated_at
         FROM property_descriptions WHERE parcel_id = $1`,
        [rawParcelId],
      );

      if (pd.rows.length === 0) {
        return res.json({ status: 'enriching', parcel_id: rawParcelId });
      }

      const row = pd.rows[0];
      type LVObj = { layers?: { pending_web?: unknown } } | null;
      const hasPendingWeb = [row.reviews, row.recent_events, row.photos, row.narrative].some(
        v => v && typeof v === 'object' && (v as LVObj)?.layers?.pending_web != null
      );
      const hasApplied = !hasPendingWeb && !!(row.reviews || row.recent_events || row.photos || row.narrative);
      const enrichStatus = hasPendingWeb ? 'pending_review' : hasApplied ? 'complete' : 'no_match';

      const jobEntry = jobId ? enrichJobStore.get(jobId) : undefined;

      return res.json({
        status: enrichStatus,
        parcel_id: rawParcelId,
        updated_at: row.updated_at,
        fieldsEnriched: jobEntry?.fields_written ?? [],
      });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 8 columns that carry pending_web enrichment data
  // ─────────────────────────────────────────────────────────────────────────
  const PHASE8_COLS = [
    'narrative', 'photos', 'reviews', 'sentiment_summary', 'recent_events',
    'has_pool', 'has_fitness', 'has_clubhouse', 'has_concierge',
    'has_business_center', 'has_dog_park',
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/v1/properties/by-parcel/:parcelId/enrichment/apply
  // Promotes pending_web → web layer, sets resolved, recomputes DQ.
  // ─────────────────────────────────────────────────────────────────────────
  router.post('/by-parcel/:parcelId/enrichment/apply', async (req: Request, res: Response) => {
    const rawParcelId = decodeURIComponent(req.params.parcelId);
    try {
      const applySetClauses = PHASE8_COLS.map(col => `
        ${col} = CASE
          WHEN ${col}->'layers'->'pending_web' IS NOT NULL THEN
            jsonb_set(
              jsonb_set(
                ${col} #- '{layers,pending_web}',
                '{layers,web}',
                ${col}->'layers'->'pending_web'
              ),
              '{resolved}',
              ${col}->'layers'->'pending_web'->'value'
            )
          ELSE ${col}
        END`).join(',');

      await pool.query(
        `UPDATE property_descriptions SET ${applySetClauses}, updated_at = NOW() WHERE parcel_id = $1`,
        [rawParcelId],
      );

      const { recalculateDQScoreByParcelId } = await import('../../services/research/dq-recalculator.service');
      const newDqScore = await recalculateDQScoreByParcelId(rawParcelId);

      return res.json({ status: 'applied', parcel_id: rawParcelId, new_dq_score: newDqScore });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[archive-properties] enrichment/apply failed', { parcelId: rawParcelId, error: msg });
      return res.status(500).json({ error: msg });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/v1/properties/by-parcel/:parcelId/enrichment/discard
  // Removes the pending_web layer from all Phase 8 columns. Resolved stays.
  // ─────────────────────────────────────────────────────────────────────────
  router.post('/by-parcel/:parcelId/enrichment/discard', async (req: Request, res: Response) => {
    const rawParcelId = decodeURIComponent(req.params.parcelId);
    try {
      const discardSetClauses = PHASE8_COLS.map(col => `
        ${col} = CASE
          WHEN ${col}->'layers'->'pending_web' IS NOT NULL THEN
            ${col} #- '{layers,pending_web}'
          ELSE ${col}
        END`).join(',');

      await pool.query(
        `UPDATE property_descriptions SET ${discardSetClauses}, updated_at = NOW() WHERE parcel_id = $1`,
        [rawParcelId],
      );

      return res.json({ status: 'discarded', parcel_id: rawParcelId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[archive-properties] enrichment/discard failed', { parcelId: rawParcelId, error: msg });
      return res.status(500).json({ error: msg });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/properties/:parcelId/files
  // Standalone file list for this property (lightweight alternative to /summary)
  // ─────────────────────────────────────────────────────────────────────────
  router.get('/:parcelId/files', async (req: Request, res: Response) => {
    const { parcelId } = req.params;
    const { document_type, parser_status } = req.query;

    try {
      const conditions: string[] = ['parcel_id = $1'];
      const params: unknown[] = [parcelId];
      let i = 2;

      if (document_type) {
        conditions.push(`document_type = $${i++}`);
        params.push(document_type);
      }
      if (parser_status) {
        conditions.push(`parser_status = $${i++}`);
        params.push(parser_status);
      }

      const result = await pool.query(
        `SELECT id, original_filename, document_type, parser_status,
                mime_type, size_bytes, uploaded_at, cdn_url, storage_key
         FROM data_library_files
         WHERE ${conditions.join(' AND ')}
         ORDER BY document_type, uploaded_at DESC`,
        params,
      );

      return res.json({ parcel_id: parcelId, files: result.rows, count: result.rows.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: msg });
    }
  });

  return router;
}
