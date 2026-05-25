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
  // POST /api/v1/properties/by-parcel/:parcelId/enrich
  // On-demand Phase 8 research enrichment (web search + Google Places).
  // Called by the AssetDetailModal AUTO-ENRICH button.
  // ─────────────────────────────────────────────────────────────────────────
  router.post('/by-parcel/:parcelId/enrich', async (req: Request, res: Response) => {
    const rawParcelId = decodeURIComponent(req.params.parcelId);

    try {
      const dlaRow = await pool.query<{
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
      const prevScore = asset.data_quality_score ?? 0;

      const { runResearchEnrichment } = await import('../../services/research/research-enrichment.service');
      const result = await runResearchEnrichment({
        parcelId: rawParcelId,
        propertyName: asset.property_name,
        address: asset.address,
        city: asset.city,
        state: asset.state,
      });

      const { recalculateDQScore } = await import('../../services/research/dq-recalculator.service');
      const newScore = await recalculateDQScore(asset.id);

      return res.json({
        parcel_id: rawParcelId,
        asset_id: asset.id,
        fieldsEnriched: result.fields_written,
        conflicts: [],
        previousScore: prevScore,
        newScore,
        places_status: result.places_status,
        web_status: result.web_status,
        reviews_count: result.reviews_count,
        photos_count: result.photos_count,
        narrative_words: result.narrative_words,
        log_entries: result.log_entries,
        logId: `research_${rawParcelId}_${Date.now()}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[archive-properties] enrich error', { parcelId: rawParcelId, msg });
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
