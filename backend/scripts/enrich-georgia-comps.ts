/**
 * Task #1476 — Enrich Georgia sale comp database
 *
 * Pipeline:
 *   1. Run ArcGIS county ingestion → property_info_cache (units, sqft, year_built, stories)
 *   2. Backfill market_sale_comps attributes from property_info_cache via georgia_property_sales join
 *   3. Re-run promoteGeorgiaSales ETL to pick up newly-enriched parcel joins
 *   4. Run enrichCapitalMarkets (estimated units for large transactions still missing counts)
 *   5. Mark qualified=false where units < --min-units
 *   6. Print validation summary including Bishop deal comp pool size
 *
 * Re-runnable / idempotent — all updates are COALESCE-guarded or NULL-only fills.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/enrich-georgia-comps.ts
 *   cd backend && npx ts-node --transpile-only scripts/enrich-georgia-comps.ts --county=Gwinnett,Fulton
 *   cd backend && npx ts-node --transpile-only scripts/enrich-georgia-comps.ts --dry-run
 *   cd backend && npx ts-node --transpile-only scripts/enrich-georgia-comps.ts --skip-ingest
 *   cd backend && npx ts-node --transpile-only scripts/enrich-georgia-comps.ts --min-units=4
 *
 * Flags:
 *   --county=<csv>         Comma-separated county names to process (default: all four)
 *   --dry-run              Print what would be done; no writes
 *   --min-units=N          Minimum units to keep as a qualified comp (default: 4)
 *   --skip-ingest          Skip the ArcGIS county ingestion phase
 *   --skip-promote         Skip re-running promoteGeorgiaSales
 *   --skip-enrich          Skip enrichCapitalMarkets estimation phase
 *   --skip-mark-unqualified  Skip marking low-unit records qualified=false
 *   --multifamily-only     Filter ingestion to multifamily parcels only (default: true)
 */

import { getPool, connectDatabase } from '../src/database/connection';
import { logger } from '../src/utils/logger';
import { GeorgiaIngestionOrchestrator } from '../src/services/property-enrichment/georgia/georgia-orchestrator';
import { getFultonIngestionService } from '../src/services/property-enrichment/georgia/fulton-ingestion.service';
import { georgiaSaleCompsService } from '../src/services/saleComps/georgia-sale-comps.service';

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = args.find(a => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const DRY_RUN = hasFlag('dry-run');
const SKIP_INGEST = hasFlag('skip-ingest');
const SKIP_PROMOTE = hasFlag('skip-promote');
const SKIP_ENRICH = hasFlag('skip-enrich');
const SKIP_MARK_UNQUALIFIED = hasFlag('skip-mark-unqualified');
const MULTIFAMILY_ONLY = !hasFlag('no-multifamily-filter');

const MIN_UNITS = parseInt(getArg('min-units') ?? '4', 10);

const COUNTY_ARG = getArg('county');
const VALID_COUNTIES = ['cobb', 'gwinnett', 'dekalb', 'fulton'] as const;
type County = typeof VALID_COUNTIES[number];

const targetCounties: County[] = COUNTY_ARG
  ? (COUNTY_ARG.split(',').map(c => c.trim().toLowerCase()) as County[]).filter(c =>
      VALID_COUNTIES.includes(c)
    )
  : [...VALID_COUNTIES];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await connectDatabase();
  const pool = getPool();

  logger.info('[enrich-georgia-comps] Starting', {
    dryRun: DRY_RUN,
    counties: targetCounties,
    minUnits: MIN_UNITS,
    skipIngest: SKIP_INGEST,
    skipPromote: SKIP_PROMOTE,
    skipEnrich: SKIP_ENRICH,
    multifamilyOnly: MULTIFAMILY_ONLY,
  });

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  JEDI RE — Georgia Sale Comp Enrichment (Task #1476)');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Counties : ${targetCounties.join(', ')}`);
  console.log(`  Min units: ${MIN_UNITS}`);
  console.log(`  Dry run  : ${DRY_RUN}`);
  console.log('──────────────────────────────────────────────────────\n');

  // ── Apply DB migration (unit_mix columns) ───────────────────────────────────
  console.log('STEP 0: Ensuring unit_mix columns exist...');
  if (!DRY_RUN) {
    await pool.query(`
      ALTER TABLE market_sale_comps
        ADD COLUMN IF NOT EXISTS unit_mix JSONB;
      ALTER TABLE property_info_cache
        ADD COLUMN IF NOT EXISTS unit_mix JSONB;
    `);
    console.log('  ✓ unit_mix columns ready\n');
  } else {
    console.log('  [dry-run] Would add unit_mix columns\n');
  }

  // ── STEP 1: County ArcGIS ingestion → property_info_cache ──────────────────
  if (SKIP_INGEST) {
    console.log('STEP 1: Skipping county ingestion (--skip-ingest)\n');
  } else {
    console.log('STEP 1: Running county ArcGIS ingestion → property_info_cache');
    console.log(`  Multifamily filter: ${MULTIFAMILY_ONLY}\n`);

    if (!DRY_RUN) {
      const orchestrator = new GeorgiaIngestionOrchestrator();

      const orchResult = await orchestrator.ingestAll(
        { filterMultifamilyOnly: MULTIFAMILY_ONLY, batchSize: 1000 },
        { counties: targetCounties }
      );

      for (const [county, job] of Object.entries(orchResult.counties)) {
        if (!job) continue;
        const status = job.status === 'complete' ? '✓' : '✗';
        console.log(
          `  ${status} ${county.padEnd(10)} | ${fmt(job.processedRecords)} processed` +
          ` | ${fmt(job.insertedRecords)} upserted | ${job.errorCount} errors`
        );
        if (job.errors.length > 0) {
          job.errors.slice(0, 3).forEach(e => console.log(`      ! ${e}`));
        }
      }

      // Fulton structures spatial join (year_built, stories, sqft, live_units)
      if (targetCounties.includes('fulton')) {
        console.log('\n  Running Fulton structures → property_info_cache spatial join...');
        const fulton = getFultonIngestionService();
        const structResult = await fulton.ingestStructures();
        console.log(`  ✓ Fulton structures: ${fmt(structResult.ingested)} ingested, ${structResult.errors} errors`);
        const joinResult = await fulton.runSpatialJoin();
        console.log(`  ✓ Fulton spatial join: ${fmt(joinResult.updated)} property_info_cache rows updated`);
      }

      console.log(`\n  ✓ Ingestion complete`);
      console.log(`    Total processed : ${fmt(orchResult.summary.totalRecords)}`);
      console.log(`    Total inserted  : ${fmt(orchResult.summary.totalInserted)}`);
      console.log(`    Failed counties : ${orchResult.summary.failedCounties.join(', ') || 'none'}\n`);
    } else {
      console.log('  [dry-run] Would run GeorgiaIngestionOrchestrator for:', targetCounties.join(', '));
      if (targetCounties.includes('fulton')) {
        console.log('  [dry-run] Would run FultonIngestionService.ingestStructures() + runSpatialJoin()');
      }
      console.log();
    }
  }

  // ── STEP 2: Backfill market_sale_comps attributes from property_info_cache ──
  console.log('STEP 2: Backfilling market_sale_comps from property_info_cache...');

  // 2a. Update units + PPU + sqft + year_built + stories for records missing units
  const countyFilter2a = targetCounties.length < 4
    ? `AND LOWER(gps.county) = ANY(ARRAY[${targetCounties.map(c => `'${c}'`).join(',')}])`
    : '';

  const backfillUnitsSQL = `
    UPDATE market_sale_comps msc
    SET
      units          = pic.number_of_units,
      sqft           = COALESCE(msc.sqft,       pic.living_area_sqft::integer),
      year_built     = COALESCE(msc.year_built,  pic.year_built::integer),
      stories        = COALESCE(msc.stories,     pic.stories::integer),
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
      ${countyFilter2a}
    RETURNING msc.id
  `;

  // 2b. Backfill sqft / year_built / stories for records that already have units but
  //     are still missing building attributes (separate pass to avoid unit overwrite).
  const backfillAttrsSQL = `
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
      ${countyFilter2a}
    RETURNING msc.id
  `;

  if (!DRY_RUN) {
    const unitsRes = await pool.query(backfillUnitsSQL);
    console.log(`  ✓ Units backfilled   : ${fmt(unitsRes.rows.length)} rows`);

    const attrsRes = await pool.query(backfillAttrsSQL);
    console.log(`  ✓ Attrs backfilled   : ${fmt(attrsRes.rows.length)} rows (sqft/year_built/stories)\n`);
  } else {
    console.log('  [dry-run] Would run units backfill SQL');
    console.log('  [dry-run] Would run attributes backfill SQL\n');

    const candidateRes = await pool.query(`
      SELECT COUNT(*) AS cnt
      FROM market_sale_comps msc
      JOIN georgia_property_sales gps ON msc.source_id = gps.id::text
      JOIN property_info_cache pic
        ON  pic.parcel_id = gps.parcel_id
        AND pic.county    = gps.county
        AND pic.state     = gps.state
      WHERE msc.source = 'georgia_county'
        AND msc.units IS NULL
        AND pic.number_of_units IS NOT NULL
        AND pic.number_of_units >= ${MIN_UNITS}
        ${countyFilter2a}
    `);
    console.log(`  [dry-run] Units-eligible rows: ${fmt(parseInt(candidateRes.rows[0].cnt))}\n`);
  }

  // ── STEP 3: Re-run promoteGeorgiaSales ETL ──────────────────────────────────
  if (SKIP_PROMOTE) {
    console.log('STEP 3: Skipping promoteGeorgiaSales (--skip-promote)\n');
  } else {
    console.log('STEP 3: Re-running promoteGeorgiaSales ETL (picks up newly-enriched parcels)...');

    if (!DRY_RUN) {
      // Apply a per-session statement timeout for the promote step — each county
      // upsert can run for several minutes on 300K+ record tables. 10 minutes is
      // generous; adjust downward if you need a hard ceiling.
      await pool.query(`SET statement_timeout = '10min'`);
      try {
        for (const county of targetCounties) {
          const countyName = county.charAt(0).toUpperCase() + county.slice(1);
          console.log(`  → ${countyName}...`);
          const results = await georgiaSaleCompsService.promoteGeorgiaSales({
            county: countyName,
            state: 'GA',
            minSalePrice: 200_000,
            minUnits: MIN_UNITS,
          });
          for (const r of results) {
            console.log(`  ✓ ${r.county.padEnd(10)} | ${fmt(r.promoted)} comps upserted`);
          }
        }
      } finally {
        await pool.query(`RESET statement_timeout`);
      }
      console.log();
    } else {
      console.log('  [dry-run] Would call promoteGeorgiaSales for:', targetCounties.join(', '));
      console.log();
    }
  }

  // ── STEP 4: enrichCapitalMarkets (estimated units for large transactions) ───
  if (SKIP_ENRICH) {
    console.log('STEP 4: Skipping enrichCapitalMarkets (--skip-enrich)\n');
  } else {
    console.log('STEP 4: Running enrichCapitalMarkets (back-solves units for $5M+ transactions)...');

    if (!DRY_RUN) {
      const enrichResult = await georgiaSaleCompsService.enrichCapitalMarkets('GA');
      console.log(`  ✓ Candidates         : ${fmt(enrichResult.candidates)}`);
      console.log(`  ✓ Units estimated    : ${fmt(enrichResult.unitsUpdated)}`);
      console.log(`  ✓ PPU recomputed     : ${fmt(enrichResult.pricePerUnitUpdated)}`);
      console.log(`  ✓ Cap rate estimated : ${fmt(enrichResult.capRateUpdated)}`);
      console.log(`  ✓ Asset class filled : ${fmt(enrichResult.assetClassUpdated)}`);
      console.log(`  ✓ Seller backfilled  : ${fmt(enrichResult.sellerUpdated)}\n`);
    } else {
      const candRes = await pool.query(`
        SELECT COUNT(*)::int AS c FROM market_sale_comps
        WHERE state = 'GA' AND (units >= 4 OR sale_price >= 5000000)
      `);
      console.log(`  [dry-run] Would enrich ${fmt(candRes.rows[0].c)} candidates\n`);
    }
  }

  // ── STEP 5: Mark low-unit records as not qualified ─────────────────────────
  if (SKIP_MARK_UNQUALIFIED) {
    console.log('STEP 5: Skipping unqualified marking (--skip-mark-unqualified)\n');
  } else {
    console.log(`STEP 5: Marking comps with units < ${MIN_UNITS} as qualified=false...`);

    const markSQL = `
      UPDATE market_sale_comps
      SET qualified = false
      WHERE source = 'georgia_county'
        AND units IS NOT NULL
        AND units < ${MIN_UNITS}
        AND (qualified IS NULL OR qualified = true)
      RETURNING id
    `;

    if (!DRY_RUN) {
      const markRes = await pool.query(markSQL);
      console.log(`  ✓ Marked unqualified : ${fmt(markRes.rows.length)} rows\n`);
    } else {
      const countRes = await pool.query(`
        SELECT COUNT(*)::int AS cnt FROM market_sale_comps
        WHERE source = 'georgia_county'
          AND units IS NOT NULL
          AND units < ${MIN_UNITS}
          AND (qualified IS NULL OR qualified = true)
      `);
      console.log(`  [dry-run] Would mark ${fmt(countRes.rows[0].cnt)} rows unqualified\n`);
    }
  }

  // ── STEP 6: Validation report ───────────────────────────────────────────────
  console.log('STEP 6: Validation report');
  console.log('──────────────────────────────────────────────────────');

  // Overall GA coverage
  const coverageRes = await pool.query(`
    SELECT
      county,
      COUNT(*)::int                                                    AS total,
      COUNT(*) FILTER (WHERE units IS NOT NULL)::int                   AS with_units,
      COUNT(*) FILTER (WHERE units >= 4)::int                          AS mf_comps,
      COUNT(*) FILTER (WHERE price_per_unit > 0)::int                  AS with_ppu,
      COUNT(*) FILTER (WHERE year_built IS NOT NULL)::int              AS with_yr,
      COUNT(*) FILTER (WHERE sqft IS NOT NULL)::int                    AS with_sqft,
      ROUND(AVG(price_per_unit) FILTER (WHERE price_per_unit > 0))     AS avg_ppu
    FROM market_sale_comps
    WHERE source = 'georgia_county' AND state = 'GA'
    GROUP BY county
    ORDER BY county
  `);

  console.log('\n  Coverage by county (source=georgia_county):');
  console.log(`  ${'County'.padEnd(12)} ${'Total'.padStart(8)} ${'w/Units'.padStart(8)} ${'MF≥4'.padStart(8)} ${'w/PPU'.padStart(8)} ${'w/Yr'.padStart(7)} ${'w/Sqft'.padStart(7)} ${'Avg PPU'.padStart(10)}`);
  console.log(`  ${'-'.repeat(72)}`);
  for (const r of coverageRes.rows) {
    const avgPpu = r.avg_ppu ? `$${fmt(parseInt(r.avg_ppu))}` : '—';
    console.log(
      `  ${r.county.padEnd(12)} ` +
      `${fmt(r.total).padStart(8)} ` +
      `${fmt(r.with_units).padStart(8)} ` +
      `${fmt(r.mf_comps).padStart(8)} ` +
      `${fmt(r.with_ppu).padStart(8)} ` +
      `${fmt(r.with_yr).padStart(7)} ` +
      `${fmt(r.with_sqft).padStart(7)} ` +
      `${avgPpu.padStart(10)}`
    );
  }

  // Bishop deal validation
  const BISHOP_DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403';
  console.log('\n  Bishop deal comp pool (deal_id = Bishop):');

  const bishopRes = await pool.query(`
    SELECT d.id, p.latitude, p.longitude, p.units AS subj_units
    FROM deals d
    LEFT JOIN properties p ON p.deal_id = d.id
    WHERE d.id = $1
    LIMIT 1
  `, [BISHOP_DEAL_ID]);

  if (bishopRes.rows.length > 0 && bishopRes.rows[0].latitude) {
    const b = bishopRes.rows[0];
    const compPoolRes = await pool.query(`
      SELECT COUNT(*)::int AS cnt,
             COUNT(*) FILTER (WHERE price_per_unit > 0)::int AS with_ppu,
             ROUND(AVG(price_per_unit) FILTER (WHERE price_per_unit > 0)) AS avg_ppu
      FROM market_sale_comps t
      WHERE t.property_type = 'multifamily'
        AND t.sale_date >= NOW() - INTERVAL '24 months'
        AND (t.units IS NULL OR t.units >= 50)
        AND (t.units IS NULL OR t.units <= 500)
        AND t.sale_price > 0
        AND (t.qualified IS NULL OR t.qualified = true)
        AND t.latitude  IS NOT NULL
        AND t.longitude IS NOT NULL
        AND (
          point(t.longitude::float, t.latitude::float)
          <@> point($1::float, $2::float)
        ) <= 9
    `, [b.longitude, b.latitude]);

    const pool2 = compPoolRes.rows[0];
    console.log(`    Comps within 9mi (24mo, 50-500 units): ${fmt(pool2.cnt)}`);
    console.log(`    With PPU                              : ${fmt(pool2.with_ppu)}`);
    console.log(`    Average PPU                           : ${pool2.avg_ppu ? '$' + fmt(parseInt(pool2.avg_ppu)) : '—'}`);

    const pass = pool2.cnt >= 5;
    console.log(`    Target ≥ 5 comps                      : ${pass ? '✓ PASS' : '✗ FAIL (run full ingest for more data)'}`);
  } else {
    console.log('    Bishop deal not found or missing coordinates — skipping');
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Done.');
  console.log('══════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch(err => {
  logger.error('[enrich-georgia-comps] Fatal error', err);
  console.error('\n✗ Fatal:', err.message || err);
  process.exit(1);
});
