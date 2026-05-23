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
              is_subject_property, source_signals, data_quality_tier, property_year_built)
           VALUES ($1, $2::DATE, 'parcel', 'monthly', false, ARRAY['om'], 'C2', $3)`,
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
 * Write extracted address/fields from parse-om to property_descriptions.
 * Accepts parcel_id + extracted address/city/state/yearBuilt/units as JSON body.
 * UPSERTs with LayeredValue JSONB format, COALESCE so manual overrides are preserved.
 *
 * Auth: x-ingest-secret header (same as /ingest-rows).
 * Body: {
 *   parcel_id: string,
 *   address?: string, city?: string, state?: string, zip?: string,
 *   year_built?: number, unit_count?: number, stories?: number,
 *   property_name?: string
 * }
 */
router.post('/update-pd', async (req: Request, res: Response) => {
  const secret = process.env.ARCHIVE_INGEST_SECRET;
  if (!secret || req.headers['x-ingest-secret'] !== secret) {
    return res.status(401).json({ success: false, error: 'Invalid or missing x-ingest-secret header' });
  }

  const { parcel_id, address, city, state, zip, year_built, unit_count, stories, property_name } = req.body;
  if (!parcel_id) {
    return res.status(400).json({ success: false, error: 'parcel_id is required' });
  }

  const now = new Date().toISOString();
  const pool = getPool();
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 0;

  // Address
  if (address && city) {
    idx++;
    const addrJson = JSON.stringify({
      resolved: { street: address, city, state: state || '', zip: zip || '' },
      layers: {
        om: { value: { street: address, city, state: state || '', zip: zip || '' }, source_file_id: parcel_id, confidence: 0.8, extracted_at: now, source: 'om_pdf_extraction' }
      },
      resolution_rule: 'highest_confidence'
    });
    sets.push(`address = CASE WHEN property_descriptions.address IS NULL OR (property_descriptions.address->>'resolution_rule' IS DISTINCT FROM 'manual_override') OR (property_descriptions.address->>'resolution_rule' IS NULL AND property_descriptions.address->'resolved'->>'street' IS NOT NULL AND (property_descriptions.address->'resolved'->>'street' ILIKE '%pdf%' OR property_descriptions.address->'resolved'->>'street' ILIKE '%RR%' OR property_descriptions.address->'resolved'->>'street' ILIKE '%Teaser%' OR property_descriptions.address->'resolved'->>'street' ILIKE '%T12%' OR property_descriptions.address->'resolved'->>'street' ILIKE '%modified%' OR property_descriptions.address->'resolved'->>'street' ILIKE '%Rent Roll%')) THEN $${idx}::jsonb ELSE property_descriptions.address END`);
    params.push(addrJson);
  }

  // year_built
  if (year_built !== undefined && year_built !== null) {
    idx++;
    const ybJson = JSON.stringify({
      resolved: year_built,
      layers: { om: { value: year_built, source_file_id: parcel_id, confidence: 0.8, extracted_at: now, source: 'om_pdf_extraction' } },
      resolution_rule: 'highest_confidence'
    });
    sets.push(`year_built = CASE WHEN property_descriptions.year_built IS NULL OR (property_descriptions.year_built->>'resolved' IS NULL) OR property_descriptions.year_built->>'resolved' = '' THEN $${idx}::jsonb ELSE property_descriptions.year_built END`);
    params.push(ybJson);
  }

  // unit_count
  if (unit_count !== undefined && unit_count !== null) {
    idx++;
    const ucJson = JSON.stringify({
      resolved: unit_count,
      layers: { om: { value: unit_count, source_file_id: parcel_id, confidence: 0.8, extracted_at: now, source: 'om_pdf_extraction' } },
      resolution_rule: 'highest_confidence'
    });
    sets.push(`unit_count = CASE WHEN property_descriptions.unit_count IS NULL OR (property_descriptions.unit_count->>'resolved' IS NULL) OR property_descriptions.unit_count->>'resolved' = '' THEN $${idx}::jsonb ELSE property_descriptions.unit_count END`);
    params.push(ucJson);
  }

  // stories
  if (stories !== undefined && stories !== null) {
    idx++;
    const stJson = JSON.stringify({
      resolved: stories,
      layers: { om: { value: stories, source_file_id: parcel_id, confidence: 0.8, extracted_at: now, source: 'om_pdf_extraction' } },
      resolution_rule: 'highest_confidence'
    });
    sets.push(`stories = CASE WHEN property_descriptions.stories IS NULL OR (property_descriptions.stories->>'resolved' IS NULL) THEN $${idx}::jsonb ELSE property_descriptions.stories END`);
    params.push(stJson);
  }

  if (sets.length === 0) {
    return res.status(400).json({ success: false, error: 'No fields to update' });
  }

  // Property name (not LayeredValue, just plain text)
  if (property_name) {
    idx++;
    sets.push(`property_name = CASE WHEN property_descriptions.property_name IS NULL THEN $${idx} ELSE property_descriptions.property_name END`);
    params.push(property_name);
  }

  idx++;
  params.push(parcel_id);

  try {
    await pool.query(`UPDATE property_descriptions SET ${sets.join(', ')}, updated_at = NOW() WHERE parcel_id = $${idx}`, params);
    logger.info('[archive/update-pd] Updated', { parcel_id, address, city, year_built, unit_count });
    return res.json({ success: true, parcel_id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[archive/update-pd] Error', { parcel_id, error: msg });
    return res.status(500).json({ success: false, error: msg });
  }
});

export default router;
