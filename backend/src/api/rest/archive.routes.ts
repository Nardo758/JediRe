/**
 * Archive Management Routes
 * 
 * Endpoints for scanning, ingesting, and querying archive deal data.
 * Used by Settings → Intelligence & Data and the CashFlow agent.
 */

import express, { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { 
  ingestArchiveDeals, 
  scanArchiveFolder,
  getArchiveCompStats,
  getArchiveComps,
  type ArchiveCompQuery 
} from '../../services/archive-ingestion.service';
import { 
  refreshArchiveBenchmarks, 
  getArchiveBenchmarkStats,
  refreshLineItemBenchmarks,
  getLineItemBenchmarkStats
} from '../../services/archive-benchmark-aggregator';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { stampProvenance } from '../../utils/provenance-stamp';
import multer from 'multer';
import { parseOM } from '../../services/document-extraction/parsers/om-parser';
import { S3Client, PutObjectCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { registerUploadedFile } from '../../services/intake-sources/data-library-upload';

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const router = Router();

// Default archive path (can be overridden in request)
const DEFAULT_ARCHIVE_PATH = '/home/ldixon/.openclaw/Archive Deals';

/**
 * GET /api/v1/archive/scan
 * Preview what's in the archive folder without ingesting
 */
router.get('/scan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const archivePath = (req.query.path as string) || DEFAULT_ARCHIVE_PATH;
    const folders = scanArchiveFolder(archivePath);
    
    // Summarize file types
    const summary = {
      totalFolders: folders.length,
      folders: folders.slice(0, 50).map(f => ({
        name: f.name,
        fileCount: f.files.length,
        hasT12: f.files.some(file => file.type === 'T12'),
        hasRentRoll: f.files.some(file => file.type === 'RENT_ROLL'),
        hasTaxBill: f.files.some(file => file.type === 'TAX_BILL'),
        hasOM: f.files.some(file => file.type === 'OM'),
        files: f.files.map(file => ({ name: file.name, type: file.type })),
      })),
      truncated: folders.length > 50,
    };
    
    res.json({ success: true, ...summary });
  } catch (err) {
    logger.error('Archive scan error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Scan failed' 
    });
  }
});

/**
 * POST /api/v1/archive/ingest
 * Start archive ingestion (parses all folders and populates data_library_assets)
 */
router.post('/ingest', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { path: archivePath, limit, skipExisting } = req.body;
    
    const stamp = stampProvenance({
      ingestionSource: 'archive_import',
      userId: req.user?.userId ?? null,
      rawSourceRef: archivePath || DEFAULT_ARCHIVE_PATH,
    });
    const result = await ingestArchiveDeals(
      archivePath || DEFAULT_ARCHIVE_PATH,
      { 
        limit: limit ? parseInt(limit) : undefined,
        skipExisting: skipExisting !== false, // default true
        provenance: stamp,
      }
    );
    
    res.json({ success: true, result });
  } catch (err) {
    logger.error('Archive ingestion error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Ingestion failed' 
    });
  }
});

/**
 * GET /api/v1/archive/status
 * Get current archive ingestion status and statistics
 */
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_assets,
        COUNT(*) FILTER (WHERE source_type = 'archive') as archive_assets,
        COUNT(*) FILTER (WHERE source_type = 'archive' AND noi IS NOT NULL) as with_noi,
        COUNT(*) FILTER (WHERE source_type = 'archive' AND avg_rent IS NOT NULL) as with_rent_roll,
        COUNT(*) FILTER (WHERE source_type = 'archive' AND parse_status = 'complete') as parsed_complete,
        COUNT(*) FILTER (WHERE source_type = 'archive' AND parse_status = 'error') as parsed_error,
        COUNT(DISTINCT state) FILTER (WHERE source_type = 'archive') as unique_states,
        COUNT(DISTINCT property_type) FILTER (WHERE source_type = 'archive') as unique_property_types
      FROM data_library_assets
    `);
    
    const row = stats.rows[0];
    
    // Get breakdown by state
    const byState = await pool.query(`
      SELECT state, COUNT(*) as count
      FROM data_library_assets
      WHERE source_type = 'archive' AND state IS NOT NULL
      GROUP BY state
      ORDER BY count DESC
      LIMIT 10
    `);
    
    // Get breakdown by vintage
    const byVintage = await pool.query(`
      SELECT vintage_band, COUNT(*) as count
      FROM data_library_assets
      WHERE source_type = 'archive' AND vintage_band IS NOT NULL
      GROUP BY vintage_band
      ORDER BY vintage_band
    `);
    
    // Get breakdown by unit count
    const byUnitCount = await pool.query(`
      SELECT unit_count_band, COUNT(*) as count
      FROM data_library_assets
      WHERE source_type = 'archive' AND unit_count_band IS NOT NULL
      GROUP BY unit_count_band
      ORDER BY unit_count_band
    `);
    
    res.json({
      success: true,
      stats: {
        totalAssets: parseInt(row.total_assets),
        archiveAssets: parseInt(row.archive_assets),
        withNoi: parseInt(row.with_noi),
        withRentRoll: parseInt(row.with_rent_roll),
        parsedComplete: parseInt(row.parsed_complete),
        parsedError: parseInt(row.parsed_error),
        uniqueStates: parseInt(row.unique_states),
        uniquePropertyTypes: parseInt(row.unique_property_types),
      },
      breakdown: {
        byState: byState.rows,
        byVintage: byVintage.rows,
        byUnitCount: byUnitCount.rows,
      },
    });
  } catch (err) {
    logger.error('Archive status error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Status fetch failed' 
    });
  }
});

/**
 * GET /api/v1/archive/deals
 * List archive deals with filtering
 */
router.get('/deals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { state, propertyType, vintageBand, unitCountBand, limit = 50, offset = 0 } = req.query;
    
    const conditions: string[] = ["source_type = 'archive'"];
    const params: (string | number)[] = [];
    let paramIndex = 1;
    
    if (state) {
      conditions.push(`state = $${paramIndex++}`);
      params.push(state as string);
    }
    if (propertyType) {
      conditions.push(`property_type = $${paramIndex++}`);
      params.push(propertyType as string);
    }
    if (vintageBand) {
      conditions.push(`vintage_band = $${paramIndex++}`);
      params.push(vintageBand as string);
    }
    if (unitCountBand) {
      conditions.push(`unit_count_band = $${paramIndex++}`);
      params.push(unitCountBand as string);
    }
    
    params.push(parseInt(limit as string) || 50);
    params.push(parseInt(offset as string) || 0);
    
    const result = await pool.query(`
      SELECT 
        id, property_name, city, state, unit_count, year_built,
        property_type, vintage_band, unit_count_band,
        noi, trailing_revenue, trailing_opex, operating_expense_ratio,
        noi_per_unit, opex_per_unit, avg_rent, occupancy_pct,
        parse_status, parsed_at, parse_warnings
      FROM data_library_assets
      WHERE ${conditions.join(' AND ')}
      ORDER BY property_name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params);
    
    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM data_library_assets
      WHERE ${conditions.join(' AND ')}
    `, params.slice(0, -2));
    
    res.json({
      success: true,
      deals: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit as string) || 50,
      offset: parseInt(offset as string) || 0,
    });
  } catch (err) {
    logger.error('Archive deals list error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'List failed' 
    });
  }
});

/**
 * GET /api/v1/archive/deals/:id
 * Get single archive deal details
 */
router.get('/deals/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT *
      FROM data_library_assets
      WHERE id = $1 AND source_type = 'archive'
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    
    res.json({ success: true, deal: result.rows[0] });
  } catch (err) {
    logger.error('Archive deal fetch error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Fetch failed' 
    });
  }
});

/**
 * GET /api/v1/archive/comps
 * Get comparable archive deals for a given profile (used by CashFlow agent)
 */
router.get('/comps', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query: ArchiveCompQuery = {
      state: req.query.state as string,
      msa: req.query.msa as string,
      propertyType: req.query.propertyType as string,
      vintageBand: req.query.vintageBand as string,
      unitCountBand: req.query.unitCountBand as string,
      minUnits: req.query.minUnits ? parseInt(req.query.minUnits as string) : undefined,
      maxUnits: req.query.maxUnits ? parseInt(req.query.maxUnits as string) : undefined,
    };
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const comps = await getArchiveComps(query, limit);
    
    res.json({ success: true, comps });
  } catch (err) {
    logger.error('Archive comps error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Comps query failed' 
    });
  }
});

/**
 * GET /api/v1/archive/stats
 * Get statistical distribution for archive comps (P10/P25/P50/P75/P90)
 */
router.get('/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query: ArchiveCompQuery = {
      state: req.query.state as string,
      msa: req.query.msa as string,
      propertyType: req.query.propertyType as string,
      vintageBand: req.query.vintageBand as string,
      unitCountBand: req.query.unitCountBand as string,
    };
    
    const fields = (req.query.fields as string)?.split(',') || 
      ['operating_expense_ratio', 'noi_per_unit', 'opex_per_unit', 'occupancy_pct', 'avg_rent'];
    
    const stats = await getArchiveCompStats(query, fields);
    
    res.json({ success: true, stats, query });
  } catch (err) {
    logger.error('Archive stats error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Stats query failed' 
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// Archive Benchmark Endpoints (for CashFlow Agent calibration)
// ───────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/archive/benchmarks/refresh
 * Recompute P10-P90 distributions from all archive + live deal data
 * Writes to archive_assumption_benchmarks table
 */
router.post('/benchmarks/refresh', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info('[archive.routes] Starting benchmark refresh...');
    const result = await refreshArchiveBenchmarks();
    
    res.json({ 
      success: true, 
      ...result,
      message: `Refreshed ${result.rowsWritten} benchmark rows across ${result.bucketsWritten} buckets`,
    });
  } catch (err) {
    logger.error('Benchmark refresh error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Refresh failed' 
    });
  }
});

/**
 * GET /api/v1/archive/benchmarks/stats
 * Get summary stats for the benchmark table
 */
router.get('/benchmarks/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await getArchiveBenchmarkStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    logger.error('Benchmark stats error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Stats query failed' 
    });
  }
});

/**
 * GET /api/v1/archive/benchmarks/distribution
 * Query benchmark distribution for a specific assumption
 */
router.get('/benchmarks/distribution', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { asset_class, deal_type, assumption_name, vintage_band } = req.query;
    
    if (!assumption_name) {
      return res.status(400).json({ success: false, error: 'assumption_name is required' });
    }
    
    const pool = getPool();
    const result = await pool.query(
      `SELECT p10, p25, p50, p75, p90, assumed_median, achieved_median, gap_bps, n_samples, n_closed_deals, as_of
       FROM archive_assumption_benchmarks
       WHERE ($1::text IS NULL OR asset_class = $1)
         AND ($2::text IS NULL OR deal_type = $2)
         AND assumption_name = $3
         AND ($4::text IS NULL OR vintage_band = $4)
         AND n_samples >= 5
       ORDER BY n_samples DESC, as_of DESC
       LIMIT 1`,
      [asset_class || null, deal_type || null, assumption_name, vintage_band || null]
    );
    
    if (result.rows.length === 0) {
      return res.json({ 
        success: true, 
        found: false, 
        message: 'No benchmark data for this query (need >= 5 samples)' 
      });
    }
    
    res.json({ success: true, found: true, benchmark: result.rows[0] });
  } catch (err) {
    logger.error('Benchmark distribution error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Query failed' 
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// Line Item Benchmark Endpoints
// ───────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/archive/line-items/refresh
 * Recompute line-item benchmarks from all archive data
 */
router.post('/line-items/refresh', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info('[archive.routes] Starting line item benchmark refresh...');
    const result = await refreshLineItemBenchmarks();
    
    res.json({ 
      success: true, 
      ...result,
      message: `Refreshed ${result.lineItemsWritten} line items across ${result.bucketsWritten} buckets`,
    });
  } catch (err) {
    logger.error('Line item benchmark refresh error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Refresh failed' 
    });
  }
});

/**
 * GET /api/v1/archive/line-items/stats
 * Get summary stats for line item benchmarks
 */
router.get('/line-items/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await getLineItemBenchmarkStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    logger.error('Line item stats error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Stats query failed' 
    });
  }
});

/**
 * GET /api/v1/archive/line-items/query
 * Query line item benchmarks for a specific location/deal type
 */
router.get('/line-items/query', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { state, msa, asset_class, deal_type, vintage_band, line_items, category } = req.query;
    
    const pool = getPool();
    const params: unknown[] = [];
    const conditions: string[] = ['n_samples >= 3'];
    
    if (state) {
      params.push(state);
      conditions.push(`state = $${params.length}`);
    }
    if (msa) {
      params.push(msa);
      conditions.push(`msa = $${params.length}`);
    }
    if (asset_class) {
      params.push(asset_class);
      conditions.push(`asset_class = $${params.length}`);
    }
    if (deal_type) {
      params.push(deal_type);
      conditions.push(`deal_type = $${params.length}`);
    }
    if (vintage_band) {
      params.push(vintage_band);
      conditions.push(`vintage_band = $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (line_items) {
      const items = (line_items as string).split(',').map(s => s.trim());
      params.push(items);
      conditions.push(`line_item = ANY($${params.length})`);
    }
    
    const result = await pool.query(
      `SELECT 
        line_item, category,
        per_unit_p10, per_unit_p25, per_unit_p50, per_unit_p75, per_unit_p90,
        per_unit_mean, per_unit_stddev,
        pct_egi_p10, pct_egi_p50, pct_egi_p90,
        n_samples, as_of,
        state, msa, asset_class, deal_type, vintage_band
      FROM line_item_benchmarks
      WHERE ${conditions.join(' AND ')}
      ORDER BY category, line_item, n_samples DESC`,
      params
    );
    
    res.json({ 
      success: true, 
      benchmarks: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    logger.error('Line item query error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Query failed' 
    });
  }
});

/**
 * POST /api/v1/archive/refresh-all
 * Refresh both archive assumption benchmarks AND line item benchmarks
 */
router.post('/refresh-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info('[archive.routes] Starting full benchmark refresh...');
    
    const [assumptionResult, lineItemResult] = await Promise.all([
      refreshArchiveBenchmarks(),
      refreshLineItemBenchmarks(),
    ]);
    
    res.json({ 
      success: true,
      assumptions: {
        bucketsWritten: assumptionResult.bucketsWritten,
        rowsWritten: assumptionResult.rowsWritten,
        errors: assumptionResult.errors,
      },
      lineItems: {
        bucketsWritten: lineItemResult.bucketsWritten,
        lineItemsWritten: lineItemResult.lineItemsWritten,
        errors: lineItemResult.errors,
      },
      message: `Refreshed ${assumptionResult.rowsWritten} assumption benchmarks and ${lineItemResult.lineItemsWritten} line item benchmarks`,
    });
  } catch (err) {
    logger.error('Full benchmark refresh error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Refresh failed' 
    });
  }
});

/**
 * POST /api/v1/archive/ingest-rows
 *
 * Bulk-write pre-parsed corpus rows into historical_observations.
 * Designed for the Windows-side archive-bulk-ingest.ts script, which cannot
 * reach the internal Postgres host directly.
 *
 * Auth: x-ingest-secret header must match ARCHIVE_INGEST_SECRET env var.
 * Body: { rows: CorpusRow[], dryRun?: boolean }
 *
 * Each row (snake_case) must include at minimum:
 *   parcel_id, observation_date, source_signals, data_quality_tier
 *
 * Upsert logic: if a row with the same (parcel_id, observation_date, geography_level)
 * already exists, source_signals are merged and non-null fields are updated.
 * New rows are inserted. Returns { inserted, updated, skipped, errors[] }.
 */
router.post('/ingest-rows', async (req: Request, res: Response) => {
  const secret = process.env.ARCHIVE_INGEST_SECRET;
  if (!secret) {
    return res.status(503).json({ success: false, error: 'ARCHIVE_INGEST_SECRET not configured on server' });
  }
  const provided = req.headers['x-ingest-secret'];
  if (!provided || provided !== secret) {
    return res.status(401).json({ success: false, error: 'Invalid or missing x-ingest-secret header' });
  }

  const { rows, dryRun = false } = req.body as {
    rows: Record<string, unknown>[];
    dryRun?: boolean;
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, error: 'Body must contain a non-empty rows array' });
  }

  // Allowlist of every valid snake_case column in historical_observations.
  // Any field sent by the client that isn't in this set is silently dropped
  // so unknown field names never blow up the INSERT/UPDATE.
  const VALID_COLS = new Set([
    'msa_id','submarket_id','parcel_id','latitude','longitude',
    'geography_level','observation_date','observation_window',
    'commute_shed_workers','commute_shed_wage_pct',
    'mobility_visits_monthly','mobility_unique_visitors','mobility_visits_psf',
    'active_event_count','event_employer_jobs_added','event_employer_jobs_lost',
    'event_supply_units_delivered','event_supply_units_announced','event_subtypes',
    'msa_employment_total','msa_employment_growth_yoy','msa_avg_wage',
    'msa_wage_growth_yoy','msa_unemployment_rate','msa_population',
    'msa_household_growth_yoy','msa_in_migration_net','msa_treasury_10y','msa_fed_funds_rate',
    'submarket_avg_asking_rent','submarket_avg_effective_rent','submarket_vacancy_rate',
    'submarket_concession_pct','submarket_under_construction','submarket_pipeline_units_24mo',
    'submarket_class_a_share',
    'property_occupancy','property_avg_rent','property_concession_per_unit',
    'property_unit_count','property_year_built','property_class',
    'property_asking_rent','property_signing_velocity',
    'realized_rent_change_t3','realized_rent_change_t12','realized_rent_change_t24',
    'realized_occupancy_change_t3','realized_occupancy_change_t12',
    'realized_concession_change_t12',
    'realized_signing_velocity_t3','realized_signing_velocity_t12',
    'realized_cap_rate_change_t12_bps','realized_cap_rate_change_t24_bps',
    'realized_walkins_psf_t12',
    'source_signals','signal_freshness_days','is_subject_property',
    'realization_complete','realization_complete_date',
    'data_quality_flags','data_quality_tier',
    'capital_event_type','capital_event_amount','capital_event_metadata',
    'redistribution_restricted',
    'costar_submarket_rent','costar_submarket_vacancy','costar_submarket_absorption',
    'costar_submarket_concession_pct','costar_submarket_new_supply',
    'market_survey_source','market_survey_snapshot',
    'deal_id',
    'rezone_upzoning_event_count','rezone_approval_event_count',
    'rezone_moratorium_active','rezone_outcome','rezone_window_months',
  ]);

  const SKIP_ALWAYS = new Set(['id','created_at','updated_at']);

  const pool = getPool();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { index: number; parcelId: unknown; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const parcelId = row['parcel_id'] as string | undefined;
    const observationDate = row['observation_date'] as string | undefined;
    const newSignals: string[] = Array.isArray(row['source_signals'])
      ? (row['source_signals'] as string[])
      : [];
    const geographyLevel = (row['geography_level'] as string | undefined) ?? 'parcel';

    if (!parcelId || !observationDate) {
      errors.push({ index: i, parcelId, error: 'Missing parcel_id or observation_date' });
      skipped++;
      continue;
    }

    if (dryRun) {
      inserted++;
      continue;
    }

    try {
      const existing = await pool.query(
        `SELECT id, source_signals FROM historical_observations
         WHERE parcel_id = $1 AND observation_date = $2::DATE AND geography_level = $3
         LIMIT 1`,
        [parcelId, observationDate, geographyLevel],
      );

      if (existing.rows[0]) {
        const existingId = existing.rows[0].id as string;
        const existingSignals: string[] = (existing.rows[0].source_signals as string[]) ?? [];
        const mergedSignals = Array.from(new Set([...existingSignals, ...newSignals]));

        const assignments: string[] = ['source_signals = $1', 'updated_at = NOW()'];
        const params: unknown[] = [mergedSignals];
        let idx = params.length;

        for (const [col, val] of Object.entries(row)) {
          if (SKIP_ALWAYS.has(col) || col === 'source_signals') continue;
          if (!VALID_COLS.has(col) || val === null || val === undefined) continue;
          idx++;
          params.push(val);
          assignments.push(`${col} = $${idx}`);
        }

        params.push(existingId);
        idx++;

        await pool.query(
          `UPDATE historical_observations SET ${assignments.join(', ')} WHERE id = $${idx}`,
          params,
        );
        updated++;
      } else {
        const allFields: Record<string, unknown> = {
          geography_level: geographyLevel,
          observation_window: 'monthly',
          is_subject_property: false,
          scope_id: 'GLOBAL',
          redistribution_restricted: false,
        };

        for (const [col, val] of Object.entries(row)) {
          if (SKIP_ALWAYS.has(col) || val === null || val === undefined) continue;
          if (!VALID_COLS.has(col)) continue;
          allFields[col] = val;
        }
        allFields['source_signals'] = newSignals;

        const cols = Object.keys(allFields);
        const vals = Object.values(allFields);
        const placeholders = vals.map((_, pi) => `$${pi + 1}`);

        await pool.query(
          `INSERT INTO historical_observations (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
          vals,
        );
        inserted++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[archive/ingest-rows] Row error', { index: i, parcelId, error: msg });
      errors.push({ index: i, parcelId, error: msg });
      skipped++;
    }
  }

  logger.info('[archive/ingest-rows] Batch complete', { inserted, updated, skipped, errors: errors.length, dryRun });

  return res.json({
    success: true,
    dryRun,
    inserted,
    updated,
    skipped,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
  });
});

/**
 * POST /api/v1/archive/parse-om
 *
 * Upload a scanned/image-based OM PDF and extract year_built (+ full OM data).
 * Uses the existing parseOM() pipeline which automatically falls back to
 * pdftoppm + tesseract.js OCR when the PDF has no embedded text layer.
 *
 * Auth: x-ingest-secret header (same secret as /ingest-rows).
 * Body: multipart/form-data with field "file" = the PDF.
 * Query params (all optional):
 *   parcel_id  — if provided, upserts property_year_built into historical_observations
 *   observation_date — ISO date for the upsert (defaults to today)
 *
 * Returns: { success, yearBuilt, usedOcr, extraction } where extraction is the
 * full OMExtraction object for the caller to use as needed.
 */
router.post('/parse-om', memUpload.single('file'), async (req: Request, res: Response) => {
  const secret = process.env.ARCHIVE_INGEST_SECRET;
  if (!secret || req.headers['x-ingest-secret'] !== secret) {
    return res.status(401).json({ success: false, error: 'Invalid or missing x-ingest-secret header' });
  }

  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'No file uploaded. Send PDF as multipart field "file".' });
  }
  if (!file.originalname.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ success: false, error: 'Only PDF files are accepted.' });
  }

  const parcelId = (req.query['parcel_id'] as string | undefined)?.trim() || null;
  const observationDate = (req.query['observation_date'] as string | undefined)?.trim()
    || new Date().toISOString().slice(0, 10);

  logger.info('[archive/parse-om] Received OM for OCR extraction', {
    filename: file.originalname,
    sizeKb: Math.round(file.size / 1024),
    parcelId,
  });

  try {
    const result = await parseOM(file.buffer, file.originalname, {
      userId: req.user?.userId ?? '',
    });

    if (!result.success || !result.data) {
      return res.status(422).json({
        success: false,
        error: result.error ?? 'parseOM returned no data',
        usedOcr: result.meta?.usedOcr ?? false,
        ocrError: result.meta?.ocrError,
      });
    }

    const extraction = result.data;
    const yearBuilt: number | null = extraction.property?.yearBuilt ?? null;

    // Optional: write property_year_built back to historical_observations
    if (parcelId && yearBuilt !== null) {
      const pool = getPool();
      const existing = await pool.query(
        `SELECT id FROM historical_observations
         WHERE parcel_id = $1 AND observation_date = $2::DATE AND geography_level = 'parcel'
         LIMIT 1`,
        [parcelId, observationDate],
      );

      if (existing.rows[0]) {
        await pool.query(
          `UPDATE historical_observations
           SET property_year_built = $1,
               source_signals = array(SELECT DISTINCT unnest(source_signals || ARRAY['om'])),
               updated_at = NOW()
           WHERE id = $2`,
          [yearBuilt, existing.rows[0].id],
        );
        logger.info('[archive/parse-om] Updated property_year_built', { parcelId, yearBuilt });
      } else {
        await pool.query(
          `INSERT INTO historical_observations
             (parcel_id, observation_date, geography_level, observation_window,
              is_subject_property, source_signals, data_quality_tier, property_year_built,
              scope_id, redistribution_restricted)
           VALUES ($1, $2::DATE, 'parcel', 'monthly', false, ARRAY['om'], 'C2', $3, 'GLOBAL', FALSE)`,
          [parcelId, observationDate, yearBuilt],
        );
        logger.info('[archive/parse-om] Inserted new row with property_year_built', { parcelId, yearBuilt });
      }
    }

    return res.json({
      success: true,
      yearBuilt,
      usedOcr: result.meta?.usedOcr ?? false,
      propertyName: extraction.property?.name ?? null,
      units: extraction.property?.units ?? null,
      yearRenovated: extraction.property?.yearRenovated ?? null,
      address: extraction.property?.address ?? null,
      city: extraction.property?.city ?? null,
      state: extraction.property?.state ?? null,
      dbWritten: parcelId !== null && yearBuilt !== null,
      extraction,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive/parse-om] Unexpected error', { filename: file.originalname, error: msg });
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/v1/archive/update-pd
 *
 * Write extracted fields from parse-om to property_descriptions.
 * All mutable fields use LayeredValue JSONB with `layers.om` provenance.
 * CASE guard preserves manual_override values and skips null-resolved fields.
 *
 * Auth: x-ingest-secret header.
 * Body: {
 *   parcel_id: string,
 *   address?: string, city?: string, state?: string, zip?: string,
 *   year_built?: number, unit_count?: number, stories?: number,
 *   property_name?: string,
 *   -- New full-routing fields:
 *   asset_class?: string, construction_type?: string, parking_type?: string,
 *   parking_spaces?: number, parking_ratio?: number,
 *   property_type?: string, rentable_sqft?: number, building_count?: number,
 *   year_renovated?: number, county?: string,
 *   amenities?: string[],   -- mapped to has_pool/has_fitness/... boolean LVs
 *   narrative?: string      -- investment thesis text
 * }
 */
router.post('/update-pd', async (req: Request, res: Response) => {
  const secret = process.env.ARCHIVE_INGEST_SECRET;
  if (!secret || req.headers['x-ingest-secret'] !== secret) {
    return res.status(401).json({ success: false, error: 'Invalid or missing x-ingest-secret header' });
  }

  const {
    parcel_id, address, city, state, zip,
    year_built, unit_count, stories, property_name,
    asset_class, construction_type, parking_type,
    parking_spaces, parking_ratio,
    property_type, rentable_sqft, building_count,
    year_renovated, county,
    amenities,
    narrative,
  } = req.body;

  if (!parcel_id) {
    return res.status(400).json({ success: false, error: 'parcel_id is required' });
  }

  const now = new Date().toISOString();
  const pool = getPool();
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 0;

  // Helper: build a LayeredValue JSONB parameter and a CASE-guarded SET clause.
  // Fields with resolution_rule 'om_canonical' always take the OM value unless
  // a manual_override is present. Fields with 'highest_confidence' only fill
  // if the column is currently null/empty.
  function pushOmLV(
    col: string,
    value: unknown,
    rule: 'highest_confidence' | 'om_canonical' = 'highest_confidence',
  ) {
    if (value === undefined || value === null) return;
    idx++;
    const lv = JSON.stringify({
      resolved: value,
      layers: { om: { value, source_file_id: parcel_id, confidence: 0.8, extracted_at: now, source: 'om_pdf_extraction' } },
      resolution_rule: rule,
    });
    if (rule === 'om_canonical') {
      sets.push(`${col} = CASE WHEN (property_descriptions.${col}->>'resolution_rule') = 'manual_override' THEN property_descriptions.${col} ELSE $${idx}::jsonb END`);
    } else {
      sets.push(`${col} = CASE WHEN property_descriptions.${col} IS NULL OR (property_descriptions.${col}->>'resolved') IS NULL OR (property_descriptions.${col}->>'resolved') = '' THEN $${idx}::jsonb ELSE property_descriptions.${col} END`);
    }
    params.push(lv);
  }

  // ── Address ───────────────────────────────────────────────────────────────
  if (address && city) {
    idx++;
    const addrVal = { street: address, city, state: state || '', zip: zip || '' };
    const addrJson = JSON.stringify({
      resolved: addrVal,
      layers: { om: { value: addrVal, source_file_id: parcel_id, confidence: 0.8, extracted_at: now, source: 'om_pdf_extraction' } },
      resolution_rule: 'highest_confidence',
    });
    // Override garbage filename-derived addresses but preserve real addresses + manual overrides
    sets.push(`address = CASE WHEN property_descriptions.address IS NULL OR (property_descriptions.address->>'resolution_rule' IS DISTINCT FROM 'manual_override') AND (property_descriptions.address->'resolved'->>'street' IS NULL OR property_descriptions.address->'resolved'->>'street' ILIKE '%pdf%' OR property_descriptions.address->'resolved'->>'street' ILIKE '%RR%' OR property_descriptions.address->'resolved'->>'street' ILIKE '%Teaser%' OR property_descriptions.address->'resolved'->>'street' ILIKE '%T12%' OR property_descriptions.address->'resolved'->>'street' ILIKE '%modified%' OR property_descriptions.address->'resolved'->>'street' ILIKE '%Rent Roll%') THEN $${idx}::jsonb ELSE property_descriptions.address END`);
    params.push(addrJson);
  }

  // ── County ────────────────────────────────────────────────────────────────
  if (county) pushOmLV('county', county);

  // ── Physical: numeric LayeredValues ───────────────────────────────────────
  if (year_built !== undefined && year_built !== null) pushOmLV('year_built', year_built);
  if (year_renovated !== undefined && year_renovated !== null) pushOmLV('year_renovated', year_renovated);
  if (unit_count !== undefined && unit_count !== null) pushOmLV('unit_count', unit_count);
  if (stories !== undefined && stories !== null) pushOmLV('stories', stories);
  if (building_count !== undefined && building_count !== null) pushOmLV('building_count', building_count);
  if (rentable_sqft !== undefined && rentable_sqft !== null) pushOmLV('rentable_sqft', rentable_sqft);
  if (parking_spaces !== undefined && parking_spaces !== null) pushOmLV('parking_spaces', parking_spaces);
  if (parking_ratio !== undefined && parking_ratio !== null) pushOmLV('parking_ratio', parking_ratio);

  // ── Classification: OM is canonical for these (marketing context) ─────────
  if (asset_class) pushOmLV('asset_class', asset_class, 'om_canonical');
  if (construction_type) pushOmLV('construction_type', construction_type, 'om_canonical');
  if (parking_type) pushOmLV('parking_type', parking_type, 'om_canonical');
  if (property_type) pushOmLV('property_type', property_type, 'om_canonical');

  // ── Narrative (investment thesis) ─────────────────────────────────────────
  if (narrative) pushOmLV('narrative', narrative, 'om_canonical');

  // ── Amenities: string array → keep legacy column + map to boolean flags ────
  if (Array.isArray(amenities) && amenities.length > 0) {
    const lower = amenities.map((a: string) => a.toLowerCase());
    const matches = (keywords: string[]) => lower.some(a => keywords.some(k => a.includes(k)));

    const amenityMap: Record<string, boolean> = {
      has_pool:              matches(['pool', 'swimming']),
      has_fitness:           matches(['fitness', 'gym', 'workout']),
      has_clubhouse:         matches(['clubhouse', 'club house', 'club room', 'resident lounge', 'community room']),
      has_concierge:         matches(['concierge']),
      has_business_center:   matches(['business center', 'co-working', 'coworking', 'business lounge', 'work lounge']),
      has_dog_park:          matches(['dog park', 'pet park', 'bark park', 'dog run']),
      is_master_metered:     matches(['master meter', 'master-meter', 'master metered']),
      is_individual_metered: matches(['individual meter', 'sub-meter', 'submeter', 'individually metered']),
    };

    for (const [col, val] of Object.entries(amenityMap)) {
      pushOmLV(col, val, 'om_canonical');
    }

    // Also update the legacy array-valued amenities JSONB column
    pushOmLV('amenities', amenities, 'om_canonical');
  }

  // ── Property name ─────────────────────────────────────────────────────────
  if (property_name) {
    idx++;
    sets.push(`property_name = CASE WHEN property_descriptions.property_name IS NULL THEN $${idx}::jsonb ELSE property_descriptions.property_name END`);
    params.push(JSON.stringify({ resolved: property_name, layers: { om: { value: property_name, source_file_id: parcel_id, confidence: 0.8, extracted_at: now, source: 'om_pdf_extraction' } }, resolution_rule: 'highest_confidence' }));
  }

  if (sets.length === 0) {
    return res.status(400).json({ success: false, error: 'No fields to update' });
  }

  idx++;
  params.push(parcel_id);

  try {
    await pool.query(`UPDATE property_descriptions SET ${sets.join(', ')}, updated_at = NOW() WHERE parcel_id = $${idx}`, params);
    logger.info('[archive/update-pd] Updated', { parcel_id, address, city, year_built, unit_count, asset_class, construction_type, has_narrative: !!narrative, amenity_count: Array.isArray(amenities) ? amenities.length : 0 });
    return res.json({ success: true, parcel_id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive/update-pd] Error', { parcel_id, error: msg });
    return res.status(500).json({ success: false, error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /municipal-queue
// Returns properties that have clean addresses but haven't been municipally
// enriched yet. Leon's machine calls this, does the GIS lookups locally
// (bypassing Replit IP blocks), then POSTs results to /municipal-result.
//
// Auth: x-ingest-secret header.
// Query params:
//   limit   — max rows to return (default 50)
//   state   — filter to a specific state (e.g. GA, NC)
//   resume  — if "true", skip parcels that already have a municipal layer
// ─────────────────────────────────────────────────────────────────────────────
router.get('/municipal-queue', async (req: Request, res: Response) => {
  const secret = process.env.ARCHIVE_INGEST_SECRET;
  if (!secret || req.headers['x-ingest-secret'] !== secret) {
    return res.status(401).json({ success: false, error: 'Invalid or missing x-ingest-secret header' });
  }

  const limit  = Math.min(parseInt((req.query['limit']  as string) || '50', 10), 500);
  const state  = (req.query['state']  as string | undefined)?.trim().toUpperCase() || null;
  const resume = req.query['resume'] === 'true';

  const pool = getPool();

  const conditions: string[] = [
    // Must have a real street address (not a filename — real addresses start with a digit)
    `address->'resolved'->>'street' ~ '^[0-9]'`,
    `length(address->'resolved'->>'street') < 100`,
    `address->'resolved'->>'state' IS NOT NULL`,
    `length(address->'resolved'->>'state') = 2`,
  ];
  const params: unknown[] = [];

  if (state) {
    params.push(state);
    conditions.push(`address->'resolved'->>'state' = $${params.length}`);
  }

  if (resume) {
    // Skip parcels that already have a municipal layer on year_built
    conditions.push(`(year_built IS NULL OR year_built->'layers'->'municipal' IS NULL)`);
  }

  params.push(limit);

  const rows = await pool.query(
    `SELECT
       parcel_id,
       property_name,
       address->'resolved'->>'street' AS street,
       address->'resolved'->>'city'   AS city,
       address->'resolved'->>'state'  AS state,
       address->'resolved'->>'zip'    AS zip
     FROM property_descriptions
     WHERE ${conditions.join(' AND ')}
     ORDER BY parcel_id
     LIMIT $${params.length}`,
    params,
  );

  return res.json({
    success: true,
    count: rows.rows.length,
    properties: rows.rows,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /municipal-result
// Accepts GIS lookup results from Leon's machine and writes them back to
// property_descriptions as LayeredValue JSONB with municipal provenance.
//
// Auth: x-ingest-secret header.
// Body: {
//   parcel_id: string,
//   provider: string,          — e.g. "FultonCountyGA"
//   api_endpoint: string,      — ArcGIS endpoint URL used
//   year_built?: number,
//   unit_count?: number,
//   stories?: number,
//   total_sqft?: number,
//   lot_size_acres?: number,
//   zoning?: string,
//   address?: string,          — confirmed street address from assessor
//   city?: string,
//   state?: string,
//   zip?: string,
// }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/municipal-result', async (req: Request, res: Response) => {
  const secret = process.env.ARCHIVE_INGEST_SECRET;
  if (!secret || req.headers['x-ingest-secret'] !== secret) {
    return res.status(401).json({ success: false, error: 'Invalid or missing x-ingest-secret header' });
  }

  const {
    parcel_id, provider, api_endpoint,
    year_built, unit_count, stories, total_sqft, lot_size_acres, zoning,
    address, city, state, zip,
  } = req.body;

  if (!parcel_id) return res.status(400).json({ success: false, error: 'parcel_id is required' });
  if (!provider)  return res.status(400).json({ success: false, error: 'provider is required' });

  const now = new Date().toISOString();
  const pool = getPool();
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 0;

  const buildLayer = (value: unknown) => JSON.stringify({
    resolved: value,
    layers: {
      municipal: { value, source: provider, fetched_at: now, api_endpoint: api_endpoint || provider },
    },
    resolution_rule: 'municipal_canonical',
  });

  const pushField = (col: string, value: unknown) => {
    if (value === null || value === undefined) return;
    idx++;
    // municipal_canonical wins over everything except manual_override
    sets.push(
      `${col} = CASE
         WHEN ${col} IS NULL OR (${col}->>'resolution_rule' IS DISTINCT FROM 'manual_override')
         THEN $${idx}::jsonb
         ELSE ${col}
       END`,
    );
    params.push(buildLayer(value));
  };

  pushField('year_built',     year_built);
  pushField('unit_count',     unit_count);
  pushField('stories',        stories);
  pushField('total_sqft',     total_sqft);
  pushField('lot_size_acres', lot_size_acres);
  pushField('zoning_code',    zoning);

  if (address && city && state) {
    idx++;
    sets.push(
      `address = CASE
         WHEN address IS NULL OR (address->>'resolution_rule' IS DISTINCT FROM 'manual_override')
         THEN $${idx}::jsonb
         ELSE address
       END`,
    );
    params.push(JSON.stringify({
      resolved: { street: address, city, state, zip: zip || '' },
      layers: {
        municipal: {
          value: { street: address, city, state, zip: zip || '' },
          source: provider, fetched_at: now, api_endpoint: api_endpoint || provider,
        },
      },
      resolution_rule: 'municipal_canonical',
    }));
  }

  if (sets.length === 0) {
    return res.status(400).json({ success: false, error: 'No fields to write' });
  }

  idx++;
  params.push(parcel_id);

  try {
    await pool.query(
      `UPDATE property_descriptions SET ${sets.join(', ')}, updated_at = NOW() WHERE parcel_id = $${idx}`,
      params,
    );
    logger.info('[archive/municipal-result] Written', { parcel_id, provider, fields: sets.length });
    return res.json({ success: true, parcel_id, fieldsWritten: sets.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive/municipal-result] Error', { parcel_id, error: msg });
    return res.status(500).json({ success: false, error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/archive/files
// Paginated browse of all data_library_files with optional filters.
// Joins property_descriptions.property_name for display.
// Query params: parcel_id, document_type, parser_status, page (1-based), limit
// ─────────────────────────────────────────────────────────────────────────────
router.get('/files', requireAuth, async (req: Request, res: Response) => {
  const pool = getPool();
  const {
    parcel_id,
    document_type,
    parser_status,
    search,
    page = '1',
    limit = '50',
  } = req.query as Record<string, string>;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const offset   = (pageNum - 1) * limitNum;

  const conditions: string[] = [];
  const params: unknown[]    = [];
  let i = 1;

  if (parcel_id) {
    conditions.push(`f.parcel_id = $${i++}`);
    params.push(parcel_id);
  }
  if (document_type && document_type !== 'ALL') {
    conditions.push(`f.document_type = $${i++}`);
    params.push(document_type);
  }
  if (parser_status && parser_status !== 'ALL') {
    conditions.push(`f.parser_status = $${i++}`);
    params.push(parser_status);
  }
  if (search) {
    conditions.push(`(f.original_filename ILIKE $${i} OR f.parcel_id ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM data_library_files f ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT
         f.id, f.parcel_id, f.deal_id,
         f.original_filename, f.mime_type, f.size_bytes,
         f.storage_provider, f.storage_key, f.cdn_url,
         f.document_type, f.parser_used, f.parser_status,
         f.parser_error, f.uploaded_at, f.uploaded_by, f.source_signal,
         f.license_restricted,
         pd.property_name->>'resolved' AS property_display_name
       FROM data_library_files f
       LEFT JOIN property_descriptions pd ON pd.parcel_id = f.parcel_id
       ${where}
       ORDER BY f.uploaded_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limitNum, offset],
    );

    return res.json({
      files: dataResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive/files] Error', { error: msg });
    return res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/archive/files/:fileId/url
// Returns a download URL for a single file.
// Priority: cdn_url → R2 signed URL → local proxy download endpoint.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/files/:fileId/url', requireAuth, async (req: Request, res: Response) => {
  const pool = getPool();
  const { fileId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, original_filename, cdn_url, storage_key, storage_provider, mime_type
       FROM data_library_files WHERE id = $1`,
      [fileId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    // 1. CDN URL (fastest, no auth needed)
    if (file.cdn_url) {
      return res.json({
        url: file.cdn_url,
        filename: file.original_filename,
        mime_type: file.mime_type,
      });
    }

    // 2. R2 signed URL (if env vars present)
    if (file.storage_provider === 'r2' && file.storage_key) {
      const accountId = process.env.R2_ACCOUNT_ID;
      const bucket    = process.env.R2_BUCKET_NAME;
      if (accountId && bucket) {
        const url = `https://${bucket}.${accountId}.r2.cloudflarestorage.com/${file.storage_key}`;
        return res.json({ url, filename: file.original_filename, mime_type: file.mime_type });
      }
    }

    // 3. Local storage — return the authenticated proxy download endpoint URL.
    //    The client must call this URL with its session token; the /download
    //    endpoint streams the file directly from disk.
    if (file.storage_provider === 'local' && file.storage_key) {
      return res.json({
        url: `/api/v1/archive/files/${fileId}/download`,
        filename: file.original_filename,
        mime_type: file.mime_type,
        local: true,
      });
    }

    return res.status(404).json({
      error: 'No download URL available for this file',
      storage_key: file.storage_key,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/archive/files/:fileId/download
// Stream a locally-stored file directly from disk.
// Only serves files with storage_provider='local'; all other providers redirect
// callers to /url which returns a CDN/R2 URL.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/files/:fileId/download', requireAuth, async (req: Request, res: Response) => {
  const pool = getPool();
  const { fileId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, original_filename, cdn_url, storage_key, storage_provider, mime_type, size_bytes
       FROM data_library_files WHERE id = $1`,
      [fileId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    if (file.storage_provider !== 'local' || !file.storage_key) {
      return res.status(400).json({
        error: 'This file is not stored locally. Use /url endpoint to get a download URL.',
      });
    }

    // Reconstruct the absolute path from the relative storage_key.
    // storage_key is always "uploads/library/<uuid>.<ext>"
    const absPath = path.join(__dirname, '../../../../', file.storage_key as string);

    if (!fs.existsSync(absPath)) {
      logger.error('[archive/download] Local file missing from disk', { fileId, storage_key: file.storage_key });
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const safeName = path.basename(file.original_filename as string).replace(/[^\w.\- ]/g, '_');
    res.setHeader('Content-Type', file.mime_type ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    if (file.size_bytes) res.setHeader('Content-Length', String(file.size_bytes));

    fs.createReadStream(absPath).pipe(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive/download] Error', { fileId, error: msg });
    return res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/archive/upload
// Accept a user file upload, write to local disk, create data_library_files
// row and intake_jobs row inside a single DB transaction.
// Returns { file_id, job_id, filename }.
// Body: multipart/form-data — fields: file (required), parcel_id?, document_type?
// Uses the existing memUpload (memoryStorage, 100 MB) with an extra extension guard.
// ─────────────────────────────────────────────────────────────────────────────

const LIBRARY_UPLOAD_DIR = path.join(__dirname, '../../../../uploads/library');
if (!fs.existsSync(LIBRARY_UPLOAD_DIR)) {
  fs.mkdirSync(LIBRARY_UPLOAD_DIR, { recursive: true });
}

const ALLOWED_LIBRARY_EXTS = new Set(['.pdf', '.xlsx', '.xls', '.csv', '.docx', '.doc']);
const VALID_DOC_TYPES       = new Set(['OM', 'T12', 'RENT_ROLL', 'TAX_BILL', 'LEASING_STATS', 'OTHER']);

// Reuse the project-standard memUpload middleware (memory storage, 100 MB).
// Extension validation is enforced inline so we don't need a separate multer instance.
router.post('/upload', requireAuth, memUpload.single('file'), async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded. Attach file as multipart field "file".' });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_LIBRARY_EXTS.has(ext)) {
    return res.status(400).json({
      error: `File type not allowed: ${ext}. Allowed: ${[...ALLOWED_LIBRARY_EXTS].join(', ')}`,
    });
  }

  const parcelId = ((req.body.parcel_id as string | undefined) ?? '').trim() || null;
  const rawType  = ((req.body.document_type as string | undefined) ?? 'OTHER').trim().toUpperCase();
  const docType  = VALID_DOC_TYPES.has(rawType) ? rawType : 'OTHER';
  const userId   = (req as AuthenticatedRequest).user?.userId ?? null;

  // Write buffer to local disk before opening the DB transaction so the file
  // is durable before we start writing metadata rows.
  const uniqueName = `${crypto.randomUUID()}${ext}`;
  const localPath  = path.join(LIBRARY_UPLOAD_DIR, uniqueName);
  const storageKey = `uploads/library/${uniqueName}`;
  fs.writeFileSync(localPath, file.buffer);

  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const pool   = getPool();
  const client = await pool.connect();

  let committed = false;
  try {
    await client.query('BEGIN');

    // 1. data_library_files row — storage_provider='local', storage_key=relative path
    const fileRes = await client.query(
      `INSERT INTO data_library_files
         (original_filename, sha256, mime_type, size_bytes,
          storage_provider, storage_key,
          document_type, parser_status, parcel_id, uploaded_by, scope_id, redistribution_restricted)
       VALUES ($1, $2, $3, $4, 'local', $5, $6, 'unparsed', $7, $8, $9, FALSE)
       RETURNING id`,
      [
        file.originalname,
        sha256,
        file.mimetype,
        file.size,
        storageKey,
        docType,
        parcelId,
        userId,
        userId ? 'user:' + userId : 'GLOBAL',
      ],
    );
    const fileId = fileRes.rows[0].id as string;

    // 2. intake_jobs row — links back to the new file
    const jobRes = await client.query(
      `INSERT INTO intake_jobs (file_id, parcel_id, state, source_type, source_data)
       VALUES ($1, $2, 'pending', 'file_upload', $3::jsonb)
       RETURNING id`,
      [
        fileId,
        parcelId,
        JSON.stringify({
          original_filename: file.originalname,
          document_type: docType,
          size_bytes: file.size,
          mime_type: file.mimetype,
          uploaded_by: userId,
        }),
      ],
    );
    const jobId = jobRes.rows[0].id as string;

    await client.query('COMMIT');
    committed = true;

    logger.info('[archive/upload] File uploaded', {
      file_id: fileId, job_id: jobId, filename: file.originalname, size_bytes: file.size,
    });

    return res.status(201).json({
      file_id: fileId,
      job_id: jobId,
      filename: file.originalname,
      size_bytes: file.size,
      document_type: docType,
      parcel_id: parcelId,
      storage_key: storageKey,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // Delete the local file whenever the transaction did not commit — this covers
    // all failure points including failures after fileId was assigned.
    if (!committed) {
      try { fs.unlinkSync(localPath); } catch (_) {}
    }
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive/upload] Error', { error: msg });
    return res.status(500).json({ error: msg });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/archive/inbox
// Paginated list of intake_jobs with optional state filter.
// Query params: state (optional), page (1-based), limit
// Returns: { jobs, pagination, summary }
// ─────────────────────────────────────────────────────────────────────────────

router.get('/inbox', requireAuth, async (req: Request, res: Response) => {
  const { state, page = '1', limit = '50' } = req.query as Record<string, string>;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset   = (pageNum - 1) * limitNum;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (state && state !== 'ALL') {
    conditions.push(`ij.state = $${i++}`);
    params.push(state);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();

  try {
    const [countResult, dataResult, summaryResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM intake_jobs ij ${where}`, params),
      pool.query(
        `SELECT
           ij.id, ij.file_id, ij.parcel_id, ij.state,
           ij.block_reason, ij.user_input, ij.source_type,
           ij.source_data, ij.enrichment_log,
           ij.created_at, ij.updated_at,
           dlf.original_filename, dlf.document_type, dlf.size_bytes, dlf.mime_type
         FROM intake_jobs ij
         LEFT JOIN data_library_files dlf ON dlf.id = ij.file_id
         ${where}
         ORDER BY ij.updated_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limitNum, offset],
      ),
      pool.query(
        `SELECT state, COUNT(*)::text AS cnt FROM intake_jobs GROUP BY state ORDER BY state`,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    const summary: Record<string, number> = {};
    for (const r of summaryResult.rows) {
      summary[r.state as string] = parseInt(r.cnt, 10);
    }

    return res.json({
      jobs: dataResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
      summary,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive/inbox] GET error', { error: msg });
    return res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/archive/inbox/:jobId
// Supply missing information for a blocked_needs_user job.
// Body: { user_input: { parcel_id?, address?, property_name? } }
// Resets state to 'pending' so the orchestrator re-runs.
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/inbox/:jobId', requireAuth, async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const { user_input } = req.body as { user_input?: Record<string, string> };

  if (!user_input || typeof user_input !== 'object' || Array.isArray(user_input)) {
    return res.status(400).json({ error: 'Body must include user_input object with parcel_id, address, or property_name' });
  }

  // Use the first non-empty field as the new parcel_id if the job doesn't have one yet
  const newParcelId =
    (user_input.parcel_id || user_input.address || user_input.property_name || '').trim() || null;

  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE intake_jobs
       SET user_input    = $1::jsonb,
           state         = 'pending',
           block_reason  = NULL,
           parcel_id     = COALESCE($2, parcel_id),
           enrichment_log = '[]'::jsonb,
           updated_at    = NOW()
       WHERE id = $3
       RETURNING id, state, parcel_id, user_input, updated_at`,
      [JSON.stringify(user_input), newParcelId, jobId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    logger.info('[archive/inbox] Job requeued', { jobId, newParcelId });
    return res.json({ job: result.rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive/inbox] PATCH error', { jobId, error: msg });
    return res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/archive/files/signed-upload-url
// Generate a presigned R2 PUT URL so the browser can upload directly.
// Body: { original_filename, mime_type, size_bytes, file_ext? }
// Returns: { signed_url, storage_key, upload_method: 'PUT', expires_at }
// ─────────────────────────────────────────────────────────────────────────────

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

function buildR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error('R2_ACCOUNT_ID not configured');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  });
}

// ── R2 CORS initialization ────────────────────────────────────────────────────
// Ensures the bucket allows PUT uploads from all Replit browser origins.
// Called once at module load. Non-fatal — logs a warning on failure so the
// server still starts even if R2 credentials are not yet configured.
async function ensureR2CorsPolicy(): Promise<void> {
  const accountId  = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!accountId || !bucketName) {
    logger.debug('[r2-cors] R2_ACCOUNT_ID or R2_BUCKET_NAME not set — skipping CORS init');
    return;
  }
  const s3 = buildR2Client();
  await s3.send(new PutBucketCorsCommand({
    Bucket: bucketName,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: [
            'https://*.replit.dev',
            'https://*.repl.co',
            'https://*.replit.app',
            'http://localhost:3000',
            'http://localhost:5000',
          ],
          AllowedMethods: ['PUT', 'GET', 'HEAD'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }));
  logger.info('[r2-cors] CORS policy applied to R2 bucket', { bucket: bucketName });
}

ensureR2CorsPolicy().catch(err => {
  logger.warn(
    '[r2-cors] could not apply CORS policy — direct browser→R2 uploads may fail if CORS is not pre-configured',
    { error: err instanceof Error ? err.message : String(err) },
  );
});

// ── Proxy token helpers ───────────────────────────────────────────────────────
// A short-lived HMAC-SHA256 token is issued with each presigned URL and must
// be presented to /files/upload-proxy. This prevents any authenticated user
// from writing to arbitrary R2 paths via the proxy endpoint.

const PROXY_KEY_PATTERN = /^uploads\/library\/[0-9a-f-]{36}\.[a-z0-9]+$/;

function proxyTokenSecret(): string {
  return process.env.JWT_SECRET ?? process.env.SESSION_SECRET ?? 'r2-proxy-fallback-secret';
}

function signProxyToken(storageKey: string, userId: string, expiresAt: string): string {
  const payload = `${storageKey}|${userId}|${expiresAt}`;
  return crypto.createHmac('sha256', proxyTokenSecret()).update(payload).digest('hex');
}

function verifyProxyToken(
  token: string,
  storageKey: string,
  userId: string,
  expiresAt: string,
): boolean {
  const expected = signProxyToken(storageKey, userId, expiresAt);
  // Constant-time comparison to prevent timing attacks
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
}

router.post('/files/signed-upload-url', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { original_filename, mime_type, size_bytes, file_ext } = req.body as {
    original_filename?: string;
    mime_type?: string;
    size_bytes?: number;
    file_ext?: string;
  };

  if (!mime_type) {
    return res.status(400).json({ error: 'mime_type is required' });
  }

  if (size_bytes && size_bytes > MAX_UPLOAD_BYTES) {
    return res.status(400).json({
      error: `File too large: ${size_bytes} bytes. Maximum is ${MAX_UPLOAD_BYTES} bytes (100 MB).`,
      flagged_for_review: true,
    });
  }

  // Derive extension from filename or file_ext param
  let ext = '.bin';
  if (file_ext) {
    ext = file_ext.startsWith('.') ? file_ext.toLowerCase() : `.${file_ext.toLowerCase()}`;
  } else if (original_filename) {
    const parts = original_filename.split('.');
    if (parts.length > 1) ext = `.${parts.pop()!.toLowerCase()}`;
  }

  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    return res.status(500).json({ error: 'R2_BUCKET_NAME not configured' });
  }

  const storageKey = `uploads/library/${crypto.randomUUID()}${ext}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  try {
    const s3 = buildR2Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: mime_type,
      ...(size_bytes ? { ContentLength: size_bytes } : {}),
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    // Issue a proxy token so the fallback upload endpoint can verify this key
    // was legitimately minted for this user and hasn't expired.
    const userId = (req as AuthenticatedRequest).user?.userId ?? 'unknown';
    const proxyToken = signProxyToken(storageKey, userId, expiresAt);

    logger.info('[archive/signed-upload-url] issued presigned URL', {
      storage_key: storageKey,
      mime_type,
      size_bytes,
    });

    return res.json({
      signed_url:  signedUrl,
      storage_key: storageKey,
      upload_method: 'PUT',
      expires_at:  expiresAt,
      proxy_token: proxyToken,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive/signed-upload-url] error', { error: msg });
    return res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/archive/files/register
// Create (or deduplicate) a data_library_files row and matching intake_jobs row
// after the browser has completed the R2 PUT. sha256 is the dedup key.
//
// Body: { parcel_id?, sha256, original_filename, mime_type?, size_bytes?,
//         storage_key, document_type? }
// Returns: { file_id, status: 'registered'|'duplicate', intake_job_id,
//            linked_observations }
// ─────────────────────────────────────────────────────────────────────────────

router.post('/files/register', requireAuth, async (req: Request, res: Response) => {
  const {
    parcel_id,
    sha256,
    original_filename,
    mime_type,
    size_bytes,
    storage_key,
    document_type,
  } = req.body as {
    parcel_id?: string;
    sha256: string;
    original_filename: string;
    mime_type?: string;
    size_bytes?: number;
    storage_key: string;
    document_type?: string;
  };

  if (!sha256) return res.status(400).json({ error: 'sha256 is required' });
  if (!original_filename) return res.status(400).json({ error: 'original_filename is required' });
  if (!storage_key) return res.status(400).json({ error: 'storage_key is required' });

  const userId = (req as AuthenticatedRequest).user?.userId ?? null;

  try {
    const result = await registerUploadedFile({
      parcel_id:         parcel_id ?? null,
      sha256,
      original_filename,
      mime_type:         mime_type  ?? null,
      size_bytes:        size_bytes ?? null,
      storage_key,
      storage_bucket:    process.env.R2_BUCKET_NAME ?? null,
      document_type:     document_type ?? null,
      uploaded_by:       userId,
    });

    return res.status(result.status === 'registered' ? 201 : 200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive/files/register] error', { error: msg });
    return res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/archive/files/upload-proxy
// Backend-proxied upload to R2. Used as a fallback when the browser cannot
// PUT directly to R2 due to CORS restrictions. The client sends the raw file
// body with the storage_key provided as a query param or X-Storage-Key header.
// The presigned URL flow still runs first; this endpoint is only called if the
// direct PUT fails (e.g. preflight rejected).
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/files/upload-proxy',
  requireAuth,
  express.raw({ type: '*/*', limit: 100 * 1024 * 1024 /* 100 MB */ }),
  async (req: AuthenticatedRequest, res: Response) => {
    // ── Authorization ─────────────────────────────────────────────────────────
    // Validate the HMAC proxy token issued by /files/signed-upload-url.
    // This ensures the storage_key was legitimately minted for this user and
    // hasn't expired — preventing arbitrary-path writes via the proxy.

    const storageKey  = req.query.storage_key as string | undefined;
    const expiresAt   = req.query.expires_at  as string | undefined;
    const proxyToken  = req.query.proxy_token  as string | undefined;

    if (!storageKey || !expiresAt || !proxyToken) {
      return res.status(400).json({ error: 'storage_key, expires_at, and proxy_token are required' });
    }

    // Enforce key namespace — only keys minted by signed-upload-url are allowed
    if (!PROXY_KEY_PATTERN.test(storageKey)) {
      return res.status(403).json({ error: 'storage_key is outside the permitted namespace' });
    }

    // Check token expiry
    if (Date.now() > new Date(expiresAt).getTime()) {
      return res.status(403).json({ error: 'Upload token has expired' });
    }

    // Validate HMAC
    const userId = req.user?.userId ?? 'unknown';
    if (!verifyProxyToken(proxyToken, storageKey, userId, expiresAt)) {
      return res.status(403).json({ error: 'Invalid upload proxy token' });
    }

    // ── Upload ────────────────────────────────────────────────────────────────

    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ error: 'Request body is empty — expected raw binary file content' });
    }

    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) {
      return res.status(500).json({ error: 'R2_BUCKET_NAME not configured' });
    }

    const contentType = (req.headers['content-type'] ?? 'application/octet-stream').split(';')[0].trim();

    try {
      const s3 = buildR2Client();
      await s3.send(new PutObjectCommand({
        Bucket:        bucket,
        Key:           storageKey,
        Body:          body,
        ContentType:   contentType,
        ContentLength: body.length,
      }));

      logger.info('[archive/upload-proxy] proxied file to R2', {
        storage_key:  storageKey,
        size_bytes:   body.length,
        content_type: contentType,
      });

      return res.json({ ok: true, storage_key: storageKey });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[archive/upload-proxy] R2 PUT failed', { error: msg });
      return res.status(500).json({ error: msg });
    }
  },
);

export default router;
