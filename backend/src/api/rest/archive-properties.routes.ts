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
import {
  getAssetTimeSeries,
  DEFAULT_METRICS,
  type SupportedMetric,
} from '../../services/property-visibility/asset-time-series.service';

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
      const { recalculateDQScore } = await import('../../services/research/dq-recalculator.service');

      const enrichPromise = runResearchEnrichment({
        parcelId: rawParcelId,
        propertyName: asset.property_name,
        address: asset.address,
        city: asset.city,
        state: asset.state,
      }).then(async result => {
        const newScore = await recalculateDQScore(asset.id);
        return { result, newScore };
      });

      const SYNC_TIMEOUT_MS = 5000;
      const raceOutcome = await Promise.race([
        enrichPromise.then(r => ({ done: true as const, ...r })),
        new Promise<{ done: false }>(resolve =>
          setTimeout(() => resolve({ done: false }), SYNC_TIMEOUT_MS)
        ),
      ]);

      if (raceOutcome.done) {
        const { result, newScore } = raceOutcome;
        return res.status(200).json({
          status: 'complete',
          parcel_id: rawParcelId,
          asset_id: asset.id,
          jobId,
          fieldsEnriched: result.fields_written,
          conflicts: [],
          previousScore: prevScore,
          newScore,
          places_status: result.places_status,
          web_status: result.web_status,
          reviews_count: result.reviews_count,
          photos_count: result.photos_count,
          narrative_words: result.narrative_words,
          logId: jobId,
        });
      }

      res.status(202).json({
        status: 'processing',
        jobId,
        parcel_id: rawParcelId,
        asset_id: asset.id,
        previousScore: prevScore,
        message: 'Enrichment is running in the background. Poll /enrich/status/:jobId for completion.',
      });

      enrichPromise.catch(err => {
        console.error('[archive-properties] background enrich failed', {
          parcelId: rawParcelId, error: (err as Error).message,
        });
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
  // Poll enrichment status — checks if Phase 8 fields are present in property_descriptions.
  // ─────────────────────────────────────────────────────────────────────────
  router.get('/by-parcel/:parcelId/enrich/status', async (req: Request, res: Response) => {
    const rawParcelId = decodeURIComponent(req.params.parcelId);
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
        return res.json({ status: 'pending', parcel_id: rawParcelId, has_phase8: false });
      }

      const row = pd.rows[0];
      const hasPhase8 = !!(row.reviews || row.recent_events || row.photos || row.narrative);

      const dla = await pool.query<{ data_quality_score: number | null }>(
        `SELECT data_quality_score FROM data_library_assets WHERE property_name = $1 ORDER BY created_at DESC LIMIT 1`,
        [rawParcelId],
      );
      const dqScore = dla.rows[0]?.data_quality_score ?? null;

      return res.json({
        status: hasPhase8 ? 'complete' : 'pending',
        parcel_id: rawParcelId,
        has_phase8: hasPhase8,
        dq_score: dqScore,
        updated_at: row.updated_at,
      });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
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
