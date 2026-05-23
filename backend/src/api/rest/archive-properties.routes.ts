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
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export function createArchivePropertiesRouter(pool: Pool): Router {
  const router = Router();

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/properties/:parcelId/summary
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

      // ── Stream C: historical_observations time-series ─────────────────────
      // Returns a sparse time-series of the available per-property signals
      // over the last 5 years, grouped by observation_date.
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      const tsResult = await pool.query(
        `SELECT
           observation_date,
           data_quality_tier         AS tier,
           property_asking_rent      AS asking_rent,
           property_signing_velocity AS signing_velocity,
           source_signals,
           source_file_ids,
           created_at
         FROM historical_observations
         WHERE parcel_id = $1
           AND observation_date >= $2
         ORDER BY observation_date ASC`,
        [parcelId, fiveYearsAgo.toISOString().split('T')[0]],
      );

      // Shape time_series into metric-keyed series for easy UI consumption
      const timeSeries: Record<string, Array<{
        observation_date: string;
        value: number | null;
        tier: string | null;
        source_file_ids: string[] | null;
      }>> = {
        asking_rent: [],
        signing_velocity: [],
      };

      let minDate: string | null = null;
      let maxDate: string | null = null;

      for (const row of tsResult.rows) {
        const d = row.observation_date instanceof Date
          ? row.observation_date.toISOString().split('T')[0]
          : String(row.observation_date);

        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;

        const base = { tier: row.tier ?? null, source_file_ids: row.source_file_ids ?? null };

        if (row.asking_rent != null) {
          timeSeries.asking_rent.push({ observation_date: d, value: parseFloat(row.asking_rent), ...base });
        }
        if (row.signing_velocity != null) {
          timeSeries.signing_velocity.push({ observation_date: d, value: parseFloat(row.signing_velocity), ...base });
        }
      }

      // Coverage diagnostics for each metric
      const tsCoverage: Record<string, { observations_count: number; date_range: { start: string | null; end: string | null } }> = {};
      for (const [metric, points] of Object.entries(timeSeries)) {
        tsCoverage[metric] = {
          observations_count: points.length,
          date_range: { start: minDate, end: maxDate },
        };
      }

      // ── Coverage diagnostics ──────────────────────────────────────────────
      const filesByType: Record<string, number> = {};
      for (const f of files) {
        filesByType[f.document_type] = (filesByType[f.document_type] ?? 0) + 1;
      }

      // Description completeness: count non-null JSONB fields
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

      const tsTotalObs = tsResult.rows.length;
      // Expected: ~60 monthly observations over 5 years; use observed max as proxy
      const tsCompleteness = tsTotalObs > 0
        ? Math.min(1, tsTotalObs / 60)
        : 0;

      const coverageDiagnostics = {
        has_om:                (filesByType['OM'] ?? 0) > 0,
        has_t12_count:          filesByType['T12'] ?? 0,
        has_rent_roll_count:    filesByType['RENT_ROLL'] ?? 0,
        has_tax_bill:          (filesByType['TAX_BILL'] ?? 0) > 0,
        has_leasing_stats:     (filesByType['LEASING_STATS'] ?? 0) > 0,
        description_completeness: description
          ? Math.round((filledFields / DESCRIPTION_FIELDS.length) * 100) / 100
          : 0,
        time_series_completeness: Math.round(tsCompleteness * 100) / 100,
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
        time_series: {
          parcel_id: parcelId,
          series: timeSeries,
          coverage: tsCoverage,
        },
        coverage_diagnostics: coverageDiagnostics,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[archive-properties] summary error', { parcelId, msg });
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
