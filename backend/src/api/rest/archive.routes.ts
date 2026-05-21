/**
 * Archive Management Routes
 * 
 * Endpoints for scanning, ingesting, and querying archive deal data.
 * Used by Settings → Intelligence & Data and the CashFlow agent.
 */

import { Router, Request, Response } from 'express';
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
import multer from 'multer';
import { parseOM } from '../../services/document-extraction/parsers/om-parser';
import { classifyDocument } from '../../services/document-extraction/classifier';
import { createHash } from 'crypto';
import { uploadFile } from '../../services/storage/r2-client';

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
    
    const result = await ingestArchiveDeals(
      archivePath || DEFAULT_ARCHIVE_PATH,
      { 
        limit: limit ? parseInt(limit) : undefined,
        skipExisting: skipExisting !== false, // default true
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
        COUNT(*) FILTER (WHERE source_type = 'archive' AND trailing_noi IS NOT NULL) as with_noi,
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
        trailing_noi, trailing_revenue, trailing_opex, opex_ratio,
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
      ['opex_ratio', 'noi_per_unit', 'opex_per_unit', 'occupancy_pct', 'avg_rent'];
    
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
    const pool = getPool();

    // ── Part B: R2 upload + data_library_files registration ──────────────
    let fileId: string | null = null;
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const r2Ready = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_BUCKET_NAME);

    if (parcelId && r2Ready) {
      try {
        // Dedup — skip R2 upload if sha256 already registered
        const existingFile = await pool.query(
          `SELECT id FROM data_library_files WHERE sha256 = $1 LIMIT 1`,
          [sha256],
        );

        if (existingFile.rows[0]) {
          fileId = existingFile.rows[0].id as string;
          logger.info('[archive/parse-om] R2 skipped — sha256 match', { sha256: sha256.slice(0, 16), fileId });
        } else {
          const safeParcelId = parcelId.replace(/[^a-zA-Z0-9_\-]/g, '_');
          const storageKey = `oms/${safeParcelId}/${sha256.slice(0, 16)}_${file.originalname}`;
          const storageBucket = process.env.R2_BUCKET_NAME!;

          await uploadFile(storageKey, file.buffer, 'application/pdf');
          logger.info('[archive/parse-om] Uploaded to R2', { storageKey });

          const reg = await pool.query(
            `INSERT INTO data_library_files
               (parcel_id, original_filename, sha256, mime_type, size_bytes,
                storage_provider, storage_bucket, storage_key,
                document_type, parser_status, source_signal, license_restricted)
             VALUES ($1, $2, $3, 'application/pdf', $4,
                     'r2', $5, $6,
                     'OM', 'success', 'om_extraction', false)
             ON CONFLICT (sha256) DO UPDATE SET sha256 = EXCLUDED.sha256
             RETURNING id`,
            [parcelId, file.originalname, sha256, file.size, storageBucket, storageKey],
          );
          fileId = reg.rows[0]?.id as string ?? null;
          logger.info('[archive/parse-om] Registered in data_library_files', { fileId, parcelId });
        }
      } catch (r2Err) {
        const r2Msg = r2Err instanceof Error ? r2Err.message : String(r2Err);
        logger.warn('[archive/parse-om] R2 upload failed (non-fatal)', { parcelId, error: r2Msg });
      }
    }

    // ── Part A: write property_year_built to historical_observations ──────
    // SELECT fix: match on parcel_id only (no observation_date filter) to
    // prevent ghost stub creation on re-runs. Prefer C1 tier, newest date.
    let hoWritten = false;
    if (parcelId && yearBuilt !== null) {
      const existing = await pool.query(
        `SELECT id FROM historical_observations
         WHERE parcel_id = $1 AND geography_level = 'parcel'
         ORDER BY data_quality_tier ASC, observation_date DESC
         LIMIT 1`,
        [parcelId],
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
              is_subject_property, source_signals, data_quality_tier, property_year_built)
           VALUES ($1, $2::DATE, 'parcel', 'monthly', false, ARRAY['om'], 'C2', $3)`,
          [parcelId, observationDate, yearBuilt],
        );
        logger.info('[archive/parse-om] Inserted new row with property_year_built', { parcelId, yearBuilt });
      }
      hoWritten = true;
    }

    // ── Link source_file_ids on the observation row ───────────────────────
    if (parcelId && fileId) {
      await pool.query(
        `UPDATE historical_observations
         SET source_file_ids = array_append(COALESCE(source_file_ids, '{}'), $1::uuid)
         WHERE parcel_id = $2 AND geography_level = 'parcel'
           AND (source_file_ids IS NULL OR NOT (source_file_ids @> ARRAY[$1::uuid]))`,
        [fileId, parcelId],
      );
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
      dbWritten: hoWritten,
      fileId,
      storageKey: fileId ? `oms/${(parcelId ?? '').replace(/[^a-zA-Z0-9_\-]/g, '_')}/${sha256.slice(0, 16)}_${file.originalname}` : null,
      extraction,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive/parse-om] Unexpected error', { filename: file.originalname, error: msg });
    return res.status(500).json({ success: false, error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /files?parcel_id=X
// List all data_library_files rows for a parcel, newest first.
// Auth: requireAuth (JWT cookie)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/files', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parcelId = (req.query['parcel_id'] as string | undefined)?.trim();
  if (!parcelId) {
    return res.status(400).json({ success: false, error: 'parcel_id query param is required' });
  }

  const pool = getPool();
  const rows = await pool.query(
    `SELECT id, parcel_id, original_filename, mime_type, size_bytes, sha256,
            document_type, parser_status, storage_key, uploaded_at, created_at
     FROM data_library_files
     WHERE parcel_id = $1
     ORDER BY COALESCE(uploaded_at, created_at) DESC`,
    [parcelId],
  );

  return res.json({
    files: rows.rows.map((r) => ({
      id: r.id,
      parcelId: r.parcel_id,
      originalFilename: r.original_filename,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      sha256: r.sha256,
      documentType: r.document_type,
      parserStatus: r.parser_status,
      storageKey: r.storage_key,
      createdAt: r.uploaded_at ?? r.created_at,
    })),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /files/:fileId/signed-url
// Returns a 1-hour pre-signed R2 URL for inline viewing.
// Auth: requireAuth (JWT cookie)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/files/:fileId/signed-url', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { fileId } = req.params;

  const pool = getPool();
  const row = await pool.query(
    `SELECT storage_key FROM data_library_files WHERE id = $1 LIMIT 1`,
    [fileId],
  );

  if (!row.rows[0]) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }

  const storageKey = row.rows[0].storage_key as string;
  const { getSignedViewUrl } = await import('../../services/storage/r2-client');
  const url = await getSignedViewUrl(storageKey, 3600);

  return res.json({ url, expiresIn: 3600 });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /files/check?sha256=<hex>
// Lightweight dedup probe — batch script calls this before uploading each file
// to avoid sending large payloads for already-stored files.
// Auth: x-ingest-secret header.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/files/check', async (req: Request, res: Response) => {
  const secret = process.env.ARCHIVE_INGEST_SECRET;
  if (!secret || req.headers['x-ingest-secret'] !== secret) {
    return res.status(401).json({ success: false, error: 'Invalid or missing x-ingest-secret header' });
  }

  const sha256 = (req.query['sha256'] as string | undefined)?.trim();
  if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256)) {
    return res.status(400).json({ success: false, error: 'sha256 query param required (64 hex chars)' });
  }

  const pool = getPool();
  const row = await pool.query(
    `SELECT id, storage_key FROM data_library_files WHERE sha256 = $1 LIMIT 1`,
    [sha256],
  );

  return res.json({
    exists: row.rows.length > 0,
    fileId: row.rows[0]?.id ?? null,
    storageKey: row.rows[0]?.storage_key ?? null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /files/ingest
// Generic file upload: R2 + data_library_files registration + source_file_ids
// backlink. No AI extraction — use parse-om for OMs that need extraction.
//
// Auth: x-ingest-secret header.
// Body: multipart/form-data
//   file            — required
//   parcel_id       — required
//   document_type   — optional; auto-classified from filename if omitted
//   observation_date — optional ISO date (defaults to today)
//   parser_status   — optional (default: 'unparsed')
// ─────────────────────────────────────────────────────────────────────────────
router.post('/files/ingest', memUpload.single('file'), async (req: Request, res: Response) => {
  const secret = process.env.ARCHIVE_INGEST_SECRET;
  if (!secret || req.headers['x-ingest-secret'] !== secret) {
    return res.status(401).json({ success: false, error: 'Invalid or missing x-ingest-secret header' });
  }

  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'No file uploaded. Send file as multipart field "file".' });
  }

  const parcelId = (req.body?.parcel_id as string | undefined)?.trim();
  if (!parcelId) {
    return res.status(400).json({ success: false, error: 'parcel_id body field is required.' });
  }

  const observationDate = (req.body?.observation_date as string | undefined)?.trim()
    || new Date().toISOString().slice(0, 10);

  const parserStatus: string = (['success','partial','failed','unparsed'] as const)
    .includes(req.body?.parser_status)
    ? req.body.parser_status
    : 'unparsed';

  try {
    // Resolve document_type: explicit field → filename classifier → 'OTHER'
    let documentType: string = (req.body?.document_type as string | undefined)?.trim().toUpperCase() || '';
    if (!documentType) {
      const classified = await classifyDocument(file.buffer, file.originalname);
      documentType = classified.documentType === 'UNKNOWN' ? 'OTHER' : classified.documentType;
      logger.info('[archive/files/ingest] Auto-classified', {
        filename: file.originalname, documentType, confidence: classified.confidence,
      });
    }

    const pool = getPool();
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    // ── Dedup check ───────────────────────────────────────────────────────
    const existingFile = await pool.query(
      `SELECT id, storage_key FROM data_library_files WHERE sha256 = $1 LIMIT 1`,
      [sha256],
    );

    if (existingFile.rows[0]) {
      const fileId = existingFile.rows[0].id as string;
      const storageKey = existingFile.rows[0].storage_key as string;
      logger.info('[archive/files/ingest] Duplicate — skipping upload', {
        sha256: sha256.slice(0, 16), fileId, parcelId,
      });
      return res.json({
        success: true,
        duplicate: true,
        fileId,
        sha256,
        storageKey,
        metadata: { size_bytes: file.size, mime_type: file.mimetype },
      });
    }

    // ── R2 upload ─────────────────────────────────────────────────────────
    const r2Ready = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_BUCKET_NAME);
    if (!r2Ready) {
      return res.status(503).json({ success: false, error: 'R2 storage not configured. Set R2_* env vars.' });
    }

    const safeParcelId = parcelId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const storageKey = `${documentType.toLowerCase()}/${safeParcelId}/${sha256.slice(0, 16)}_${file.originalname}`;
    const storageBucket = process.env.R2_BUCKET_NAME!;
    const mimeType = file.mimetype || 'application/octet-stream';

    await uploadFile(storageKey, file.buffer, mimeType);
    logger.info('[archive/files/ingest] Uploaded to R2', { storageKey, parcelId });

    // ── Register in data_library_files ────────────────────────────────────
    const reg = await pool.query(
      `INSERT INTO data_library_files
         (parcel_id, original_filename, sha256, mime_type, size_bytes,
          storage_provider, storage_bucket, storage_key,
          document_type, parser_status, source_signal, license_restricted)
       VALUES ($1, $2, $3, $4, $5,
               'r2', $6, $7,
               $8, $9, $10, false)
       ON CONFLICT (sha256) DO UPDATE SET sha256 = EXCLUDED.sha256
       RETURNING id`,
      [
        parcelId, file.originalname, sha256, mimeType, file.size,
        storageBucket, storageKey,
        documentType, parserStatus, documentType.toLowerCase(),
      ],
    );
    const fileId = reg.rows[0]?.id as string;

    // ── Link source_file_ids on historical_observations ───────────────────
    const linked = await pool.query(
      `UPDATE historical_observations
       SET source_file_ids = array_append(COALESCE(source_file_ids, '{}'), $1::uuid)
       WHERE parcel_id = $2 AND geography_level = 'parcel'
         AND (source_file_ids IS NULL OR NOT (source_file_ids @> ARRAY[$1::uuid]))`,
      [fileId, parcelId],
    );

    logger.info('[archive/files/ingest] Registered', {
      fileId, parcelId, documentType, hoRowsLinked: linked.rowCount,
    });

    return res.json({
      success: true,
      duplicate: false,
      fileId,
      sha256,
      storageKey,
      metadata: { size_bytes: file.size, mime_type: mimeType },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive/files/ingest] Unexpected error', { filename: file.originalname, error: msg });
    return res.status(500).json({ success: false, error: msg });
  }
});

export default router;
