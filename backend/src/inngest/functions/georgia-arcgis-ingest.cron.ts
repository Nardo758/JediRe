/**
 * Inngest Cron: Weekly Georgia ArcGIS County Ingestion (Task #1477)
 *
 * Fires weekly on Sunday at 02:00 UTC.
 * Ingests real unit counts (LivUnits / NUMDWLG) from Fulton and Gwinnett
 * county ArcGIS endpoints into property_info_cache, then backfills
 * market_sale_comps so Bishop comps show actual building sizes rather
 * than back-solved estimates.
 *
 * Pipeline:
 *   Step 1 — Fulton parcel data → property_info_cache (LivUnits field)
 *   Step 2 — Fulton parcel geometry staging (prerequisite for spatial join)
 *   Step 3 — Fulton structure footprints staging
 *   Step 4 — Fulton PostGIS spatial join (year_built / stories / live_units)
 *   Step 5 — Gwinnett full ingestion → property_info_cache (NUMDWLG field)
 *   Step 6 — Backfill market_sale_comps units + PPU from property_info_cache
 *   Step 7 — Log summary
 *
 * Re-runnable / idempotent — all upserts use ON CONFLICT DO UPDATE with
 * COALESCE guards so existing real data is never overwritten by NULLs.
 */

import { inngest } from '../../lib/inngest';
import { getFultonIngestionService } from '../../services/property-enrichment/georgia/fulton-ingestion.service';
import { getGwinnettIngestionService } from '../../services/property-enrichment/georgia/gwinnett-ingestion.service';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

const MIN_UNITS = 4;

export const georgiaArcGisIngestCron = inngest.createFunction(
  {
    id: 'georgia-arcgis-ingest-weekly',
    name: 'Georgia: weekly ArcGIS county ingestion — Fulton + Gwinnett unit counts',
    triggers: [{ cron: '0 2 * * 0' }],
    retries: 2,
    timeouts: {
      finish: '90m',
    },
  },
  async ({ step }) => {
    const fulton = getFultonIngestionService();
    const gwinnett = getGwinnettIngestionService();

    // ── Step 1: Fulton parcel data (LivUnits → number_of_units) ──────────────
    const fultonJob = await step.run('fulton-ingest-parcels-and-sales', async () => {
      try {
        logger.info('[georgia-arcgis-ingest] Starting Fulton parcel ingestion');
        const job = await fulton.ingestAll({ batchSize: 1000 });
        logger.info('[georgia-arcgis-ingest] Fulton parcel ingestion complete', {
          status: job.status,
          processed: job.processedRecords,
          inserted: job.insertedRecords,
          errors: job.errorCount,
        });
        return {
          status: job.status,
          processed: job.processedRecords,
          inserted: job.insertedRecords,
          errors: job.errorCount,
          firstErrors: job.errors.slice(0, 3),
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[georgia-arcgis-ingest] Fulton parcel ingestion failed', { error: msg });
        return { status: 'failed', processed: 0, inserted: 0, errors: 1, firstErrors: [msg] };
      }
    });

    // ── Step 2: Fulton parcel geometry staging ────────────────────────────────
    const fultonGeom = await step.run('fulton-ingest-parcel-geometry', async () => {
      try {
        logger.info('[georgia-arcgis-ingest] Starting Fulton parcel geometry staging');
        const result = await fulton.ingestParcelGeometry({ batchSize: 1000 });
        logger.info('[georgia-arcgis-ingest] Fulton parcel geometry complete', result);
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[georgia-arcgis-ingest] Fulton parcel geometry failed', { error: msg });
        return { ingested: 0, errors: 1 };
      }
    });

    // ── Step 3: Fulton structure footprints ───────────────────────────────────
    const fultonStructures = await step.run('fulton-ingest-structures', async () => {
      try {
        logger.info('[georgia-arcgis-ingest] Starting Fulton structure ingestion');
        const result = await fulton.ingestStructures({ batchSize: 1000 });
        logger.info('[georgia-arcgis-ingest] Fulton structure ingestion complete', result);
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[georgia-arcgis-ingest] Fulton structure ingestion failed', { error: msg });
        return { ingested: 0, errors: 1 };
      }
    });

    // ── Step 4: Fulton spatial join (year_built / stories / live_units) ───────
    const spatialJoin = await step.run('fulton-spatial-join', async () => {
      try {
        const pool = getPool();
        const geomCheck = await pool.query(
          `SELECT COUNT(*) AS cnt FROM fulton_parcels WHERE geometry IS NOT NULL`
        );
        const geomCount = parseInt(geomCheck.rows[0].cnt, 10);

        if (geomCount === 0) {
          logger.warn('[georgia-arcgis-ingest] Fulton parcel geometry empty — skipping spatial join');
          return { updated: 0, skipped: true };
        }

        const result = await fulton.runSpatialJoin();
        logger.info('[georgia-arcgis-ingest] Fulton spatial join complete', result);
        return { updated: result.updated, skipped: false };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[georgia-arcgis-ingest] Fulton spatial join failed', { error: msg });
        return { updated: 0, skipped: false };
      }
    });

    // ── Step 5: Gwinnett full ingestion (NUMDWLG → number_of_units) ───────────
    const gwinnettJob = await step.run('gwinnett-ingest-all', async () => {
      try {
        logger.info('[georgia-arcgis-ingest] Starting Gwinnett ingestion');
        const job = await gwinnett.ingestAll({ batchSize: 1000 });
        logger.info('[georgia-arcgis-ingest] Gwinnett ingestion complete', {
          status: job.status,
          processed: job.processedRecords,
          inserted: job.insertedRecords,
          errors: job.errorCount,
        });
        return {
          status: job.status,
          processed: job.processedRecords,
          inserted: job.insertedRecords,
          errors: job.errorCount,
          firstErrors: job.errors.slice(0, 3),
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[georgia-arcgis-ingest] Gwinnett ingestion failed', { error: msg });
        return { status: 'failed', processed: 0, inserted: 0, errors: 1, firstErrors: [msg] };
      }
    });

    // ── Step 6: Backfill market_sale_comps from fresh property_info_cache ─────
    const backfill = await step.run('backfill-market-sale-comps', async () => {
      const pool = getPool();

      // 6a: Fill in units + price_per_unit for comps still missing unit counts
      const unitsRes = await pool.query(`
        UPDATE market_sale_comps msc
        SET
          units          = pic.number_of_units,
          sqft           = COALESCE(msc.sqft,      pic.living_area_sqft::integer),
          year_built     = COALESCE(msc.year_built, pic.year_built::integer),
          stories        = COALESCE(msc.stories,    pic.stories::integer),
          asset_class    = CASE
            WHEN COALESCE(msc.year_built, pic.year_built::integer) >= 2010 THEN 'A'
            WHEN COALESCE(msc.year_built, pic.year_built::integer) >= 1995 THEN 'B'
            ELSE 'C'
          END,
          price_per_unit = CASE WHEN pic.number_of_units > 0
            THEN ROUND(msc.sale_price::numeric / pic.number_of_units, 2)
          END,
          price_per_sqft = CASE WHEN COALESCE(msc.sqft, pic.living_area_sqft::integer) > 0
            THEN ROUND(msc.sale_price::numeric / COALESCE(msc.sqft, pic.living_area_sqft::integer), 2)
          END
        FROM georgia_property_sales gps
        JOIN property_info_cache pic
          ON  pic.parcel_id = gps.parcel_id
          AND pic.county    = gps.county
          AND pic.state     = gps.state
        WHERE msc.source    = 'georgia_county'
          AND msc.source_id = gps.id::text
          AND msc.units     IS NULL
          AND pic.number_of_units IS NOT NULL
          AND pic.number_of_units >= ${MIN_UNITS}
          AND LOWER(gps.county) IN ('fulton', 'gwinnett')
        RETURNING msc.id
      `);

      // 6b: Fill in building attributes for comps that already have units
      const attrsRes = await pool.query(`
        UPDATE market_sale_comps msc
        SET
          sqft       = COALESCE(msc.sqft,      pic.living_area_sqft::integer),
          year_built = COALESCE(msc.year_built, pic.year_built::integer),
          stories    = COALESCE(msc.stories,    pic.stories::integer),
          asset_class = COALESCE(
            msc.asset_class,
            CASE
              WHEN pic.year_built::integer >= 2010 THEN 'A'
              WHEN pic.year_built::integer >= 1995 THEN 'B'
              ELSE 'C'
            END
          ),
          price_per_sqft = CASE
            WHEN msc.price_per_sqft IS NULL
              AND msc.sale_price > 0
              AND COALESCE(msc.sqft, pic.living_area_sqft::integer) > 0
            THEN ROUND(msc.sale_price::numeric / COALESCE(msc.sqft, pic.living_area_sqft::integer), 2)
            ELSE msc.price_per_sqft
          END
        FROM georgia_property_sales gps
        JOIN property_info_cache pic
          ON  pic.parcel_id = gps.parcel_id
          AND pic.county    = gps.county
          AND pic.state     = gps.state
        WHERE msc.source    = 'georgia_county'
          AND msc.source_id = gps.id::text
          AND (msc.sqft IS NULL OR msc.year_built IS NULL OR msc.stories IS NULL)
          AND (pic.living_area_sqft IS NOT NULL OR pic.year_built IS NOT NULL)
          AND LOWER(gps.county) IN ('fulton', 'gwinnett')
        RETURNING msc.id
      `);

      const unitsUpdated = unitsRes.rows.length;
      const attrsUpdated = attrsRes.rows.length;

      logger.info('[georgia-arcgis-ingest] market_sale_comps backfill complete', {
        unitsUpdated,
        attrsUpdated,
      });

      return { unitsUpdated, attrsUpdated };
    });

    // ── Step 7: Summary ───────────────────────────────────────────────────────
    await step.run('log-summary', async () => {
      logger.info('[georgia-arcgis-ingest] Weekly run complete', {
        fulton: {
          parcelsInserted: fultonJob.inserted,
          parcelsProcessed: fultonJob.processed,
          geometryStaged: fultonGeom.ingested,
          structuresStaged: fultonStructures.ingested,
          spatialJoinUpdated: spatialJoin.updated,
          spatialJoinSkipped: spatialJoin.skipped,
        },
        gwinnett: {
          inserted: gwinnettJob.inserted,
          processed: gwinnettJob.processed,
        },
        backfill: {
          compsUnitsUpdated: backfill.unitsUpdated,
          compsAttrsUpdated: backfill.attrsUpdated,
        },
      });
    });

    return {
      success: fultonJob.status !== 'failed' || gwinnettJob.status !== 'failed',
      fulton: {
        parcelsProcessed: fultonJob.processed,
        parcelsInserted: fultonJob.inserted,
        geometryStaged: fultonGeom.ingested,
        structuresStaged: fultonStructures.ingested,
        spatialJoinUpdated: spatialJoin.updated,
      },
      gwinnett: {
        processed: gwinnettJob.processed,
        inserted: gwinnettJob.inserted,
      },
      backfill: {
        unitsUpdated: backfill.unitsUpdated,
        attrsUpdated: backfill.attrsUpdated,
      },
    };
  }
);
