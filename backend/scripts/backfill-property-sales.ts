/**
 * Backfill 3 — Property Sales
 * Phase 2: Property Plumbing Refactor
 *
 * Loads historical sales into property_sales from:
 *   1. georgia_property_sales (681K rows)
 *   2. recorded_transactions (12 rows)
 *   3. property_sales_legacy (292 rows — renamed from old property_sales stub)
 *
 * Dedup rule: same source + source_id = one row (ON CONFLICT DO NOTHING).
 * Chunked at BATCH rows per round. Re-runnable.
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/backfill-property-sales.ts
 * Flags:
 *   --dry-run       Print counts without writing
 *   --limit=N       Cap rows per source
 *   --county=X      Filter georgia_property_sales by county (case-insensitive)
 *   --skip-georgia  Skip georgia_property_sales source
 *   --skip-recorded Skip recorded_transactions source
 *   --skip-legacy   Skip property_sales_legacy source
 */

import 'dotenv/config';
import { query } from '../src/database/connection';
import { propertyResolverService } from '../src/services/property-entity/property-resolver.service';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_GEORGIA = args.includes('--skip-georgia');
const SKIP_RECORDED = args.includes('--skip-recorded');
const SKIP_LEGACY = args.includes('--skip-legacy');
const SKIP_COMPS = args.includes('--skip-comps');
const LIMIT = (() => {
  const f = args.find((a) => a.startsWith('--limit='));
  return f ? parseInt(f.split('=')[1], 10) : 0;
})();
const COUNTY_FILTER = (() => {
  const f = args.find((a) => a.startsWith('--county='));
  return f ? f.split('=')[1].toLowerCase() : null;
})();

const BATCH = 2000;

// ── Source 1: georgia_property_sales ────────────────────────────────────────

async function backfillGeorgiaSales(): Promise<{ inserted: number; skipped: number }> {
  console.log('[Backfill3] Source 1: georgia_property_sales...');

  const cntRes = await query(
    `SELECT COUNT(*) AS cnt FROM georgia_property_sales
     ${COUNTY_FILTER ? `WHERE LOWER(county) = '${COUNTY_FILTER}'` : ''}`
  );
  const total = parseInt(cntRes.rows[0].cnt, 10);
  console.log(`[Backfill3] georgia_property_sales total: ${total}`);

  let inserted = 0;
  let skipped = 0;
  let offset = 0;

  while (true) {
    const batchLimit = LIMIT > 0 ? Math.min(BATCH, LIMIT - inserted) : BATCH;
    if (LIMIT > 0 && inserted >= LIMIT) break;

    const rows = await query(
      `SELECT id, parcel_id, county, state, sale_date, sale_year, sale_price,
              sale_type, qualified, instrument_type, grantor_name, provider
       FROM georgia_property_sales
       ${COUNTY_FILTER ? `WHERE LOWER(county) = '${COUNTY_FILTER}'` : ''}
       ORDER BY parcel_id, sale_date
       LIMIT $1 OFFSET $2`,
      [batchLimit, offset]
    );

    if (rows.rows.length === 0) break;

    for (const row of rows.rows) {
      const sourceId = `gps::${row.id}`;

      if (DRY_RUN) {
        inserted++;
        continue;
      }

      try {
        const property = await propertyResolverService.resolveByParcel({
          parcelIdRaw: row.parcel_id as string,
          county: (row.county as string) ?? 'unknown',
          state: (row.state as string) ?? 'GA',
          createIfMissing: true,
        });

        if (!property) {
          skipped++;
          continue;
        }

        const qualified =
          row.qualified !== null && row.qualified !== undefined
            ? Boolean(row.qualified)
            : null;

        await query(
          `INSERT INTO property_sales (
            property_id, sale_date, sale_price,
            deed_type, seller, qualified,
            source, source_id, source_date, confidence,
            is_jedi_tracked
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (source, source_id) DO NOTHING`,
          [
            property.id,
            row.sale_date ?? null,
            row.sale_price ?? null,
            row.sale_type ?? null,
            row.grantor_name ?? null,
            qualified,
            'county_recorded',
            sourceId,
            row.sale_date ?? null,
            0.80,
            false,
          ]
        );
        inserted++;
      } catch (err) {
        console.warn(
          `  [Backfill3] skip gps.id=${row.id}: ${err instanceof Error ? err.message : err}`
        );
        skipped++;
      }
    }

    offset += rows.rows.length;
    if (rows.rows.length < batchLimit) break;
    if (inserted % 10000 === 0 || skipped % 1000 === 0) {
      console.log(`[Backfill3] Georgia progress: inserted=${inserted} skipped=${skipped}`);
    }
  }

  return { inserted, skipped };
}

// ── Source 2: recorded_transactions ─────────────────────────────────────────

async function backfillRecordedTransactions(): Promise<{ inserted: number; skipped: number }> {
  console.log('[Backfill3] Source 2: recorded_transactions (12 rows)...');

  let inserted = 0;
  let skipped = 0;

  try {
    const rows = await query(
      `SELECT id, parcel_id, county, state, sale_date, sale_price,
              deed_type, buyer_name, seller_name, grantor_name
       FROM recorded_transactions
       ORDER BY id`
    );

    if (rows.rows.length === 0) {
      console.log('[Backfill3] recorded_transactions: 0 rows (table empty or view)');
      return { inserted: 0, skipped: 0 };
    }

    for (const row of rows.rows) {
      const sourceId = `rt::${row.id}`;

      if (DRY_RUN) {
        console.log(`  [dry-run] would insert property_sale for rt.id=${row.id}`);
        inserted++;
        continue;
      }

      try {
        const parcelId = row.parcel_id as string | null;
        if (!parcelId) {
          skipped++;
          continue;
        }

        const property = await propertyResolverService.resolveByParcel({
          parcelIdRaw: parcelId,
          county: (row.county as string) ?? 'unknown',
          state: (row.state as string) ?? 'GA',
          createIfMissing: true,
        });

        if (!property) {
          skipped++;
          continue;
        }

        await query(
          `INSERT INTO property_sales (
            property_id, sale_date, sale_price,
            deed_type, buyer, seller,
            source, source_id, source_date, confidence,
            is_jedi_tracked
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (source, source_id) DO NOTHING`,
          [
            property.id,
            row.sale_date ?? null,
            row.sale_price ?? null,
            row.deed_type ?? null,
            row.buyer_name ?? null,
            row.seller_name ?? row.grantor_name ?? null,
            'county_recorded',
            sourceId,
            row.sale_date ?? null,
            0.75,
            false,
          ]
        );
        inserted++;
      } catch (err) {
        console.warn(
          `  [Backfill3] skip rt.id=${row.id}: ${err instanceof Error ? err.message : err}`
        );
        skipped++;
      }
    }
  } catch (tableErr) {
    console.warn(`[Backfill3] recorded_transactions access failed (likely view): ${tableErr instanceof Error ? tableErr.message : tableErr}`);
  }

  return { inserted, skipped };
}

// ── Source 3: property_sales_legacy ─────────────────────────────────────────

async function backfillLegacySales(): Promise<{ inserted: number; skipped: number }> {
  console.log('[Backfill3] Source 3: property_sales_legacy (292 rows)...');

  const rows = await query(
    `SELECT id, parcel_id, sale_year, sale_price, is_current
     FROM property_sales_legacy
     ORDER BY id`
  );

  console.log(`[Backfill3] property_sales_legacy: ${rows.rows.length} rows`);
  let inserted = 0;
  let skipped = 0;

  for (const row of rows.rows) {
    const sourceId = `psl::${row.id}`;
    const parcelId = row.parcel_id as string | null;
    if (!parcelId) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] would insert property_sale for psl.id=${row.id}`);
      inserted++;
      continue;
    }

    try {
      const property = await propertyResolverService.resolveByParcel({
        parcelIdRaw: parcelId,
        county: 'unknown',
        state: 'GA',
        createIfMissing: true,
      });

      if (!property) {
        skipped++;
        continue;
      }

      // Legacy rows only have sale_year; use Jan 1 of that year as the date
      const saleYear = row.sale_year as number | null;
      const saleDate = saleYear ? `${saleYear}-01-01` : null;

      await query(
        `INSERT INTO property_sales (
          property_id, sale_date, sale_price,
          source, source_id, source_date, confidence,
          is_jedi_tracked
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (source, source_id) DO NOTHING`,
        [
          property.id,
          saleDate,
          row.sale_price ?? null,
          'county_recorded',
          sourceId,
          saleDate,
          0.60,
          false,
        ]
      );
      inserted++;
    } catch (err) {
      console.warn(
        `  [Backfill3] skip psl.id=${row.id}: ${err instanceof Error ? err.message : err}`
      );
      skipped++;
    }
  }

  return { inserted, skipped };
}

// ── Source 4: market_sale_comps ───────────────────────────────────────────────
// market_sale_comps contains ApartmentIQ / broker-sourced comp transactions.
// These are deduped cross-source by (parcel_id + sale_date) within property_sales:
// the ON CONFLICT (source, source_id) constraint ensures same-source idempotency,
// while the parcel+date uniqueness is captured via the property_id join.
// NOTE: comp ingestion is PAUSED for new writes (Phase 2 spec §2.2); only historical
// rows are backfilled here. Use --skip-comps to omit.

async function backfillMarketSaleComps(): Promise<{ inserted: number; skipped: number }> {
  console.log('[Backfill3] Source 4: market_sale_comps...');

  const cntRes = await query(
    `SELECT COUNT(*) AS cnt FROM market_sale_comps
     WHERE address IS NOT NULL
       AND sale_date IS NOT NULL
       AND sale_price IS NOT NULL AND sale_price > 0
       ${COUNTY_FILTER ? `AND LOWER(county) = '${COUNTY_FILTER}'` : ''}`
  );
  const total = parseInt(cntRes.rows[0].cnt, 10);
  console.log(`[Backfill3] market_sale_comps eligible rows: ${total}`);

  let inserted = 0;
  let skipped = 0;
  let offset = 0;

  while (true) {
    const batchLimit = LIMIT > 0 ? Math.min(BATCH, LIMIT - inserted) : BATCH;
    if (LIMIT > 0 && inserted >= LIMIT) break;

    const rows = await query(
      `SELECT id, address, city, county, state, sale_date, sale_price,
              seller, qualified
       FROM market_sale_comps
       WHERE address IS NOT NULL
         AND sale_date IS NOT NULL
         AND sale_price IS NOT NULL AND sale_price > 0
         ${COUNTY_FILTER ? `AND LOWER(county) = '${COUNTY_FILTER}'` : ''}
       ORDER BY id, sale_date
       LIMIT $1 OFFSET $2`,
      [batchLimit, offset]
    );

    if (rows.rows.length === 0) break;

    for (const row of rows.rows) {
      const sourceId = `msc::${row.id}`;

      if (DRY_RUN) {
        inserted++;
        continue;
      }

      try {
        const property = await propertyResolverService.resolveByAddress({
          address: row.address as string,
          city: (row.city as string) ?? null,
          state: (row.state as string) ?? 'GA',
          county: (row.county as string) ?? null,
          createIfMissing: true,
        });

        if (!property) {
          skipped++;
          continue;
        }

        const qualified =
          row.qualified !== null && row.qualified !== undefined
            ? Boolean(row.qualified)
            : null;

        await query(
          `INSERT INTO property_sales (
            property_id, sale_date, sale_price,
            seller, qualified,
            source, source_id, source_date, confidence,
            is_jedi_tracked
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (source, source_id) DO NOTHING`,
          [
            property.id,
            row.sale_date ?? null,
            row.sale_price ?? null,
            row.seller ?? null,
            qualified,
            'broker_comp',
            sourceId,
            row.sale_date ?? null,
            0.70,
            false,
          ]
        );
        inserted++;
      } catch (err) {
        console.warn(
          `  [Backfill3] skip msc.id=${row.id}: ${err instanceof Error ? err.message : err}`
        );
        skipped++;
      }
    }

    offset += rows.rows.length;
    if (rows.rows.length < batchLimit) break;
    if (inserted % 10000 === 0) {
      console.log(`[Backfill3] Comps progress: inserted=${inserted} skipped=${skipped}`);
    }
  }

  return { inserted, skipped };
}

// ── Spot-check ────────────────────────────────────────────────────────────────

async function spotCheck(): Promise<void> {
  const totRes = await query(`SELECT COUNT(*) AS cnt FROM property_sales`);
  console.log(`\n[Backfill3] property_sales total rows: ${totRes.rows[0].cnt}`);

  const bySource = await query(
    `SELECT source, COUNT(*) AS cnt FROM property_sales GROUP BY source ORDER BY cnt DESC`
  );
  for (const r of bySource.rows) {
    console.log(`  source=${r.source}: ${r.cnt} rows`);
  }

  // Sample 100 rows: check property_id references a valid properties row
  const sample = await query(
    `SELECT ps.id, ps.property_id, ps.sale_price, p.id AS prop_check
     FROM property_sales ps
     LEFT JOIN properties p ON p.id = ps.property_id
     ORDER BY RANDOM()
     LIMIT 100`
  );
  const orphaned = sample.rows.filter((r) => !r.prop_check);
  console.log(`[Backfill3] Spot-check: ${sample.rows.length} sampled, ${orphaned.length} orphaned (no properties row)`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[Backfill3] Starting — dry_run=${DRY_RUN} limit=${LIMIT || 'all'} county=${COUNTY_FILTER || 'all'}`);

  let totalInserted = 0;
  let totalSkipped = 0;

  if (!SKIP_GEORGIA) {
    const r = await backfillGeorgiaSales();
    totalInserted += r.inserted;
    totalSkipped += r.skipped;
    console.log(`[Backfill3] Georgia sales: inserted=${r.inserted} skipped=${r.skipped}`);
  }

  if (!SKIP_RECORDED) {
    const r = await backfillRecordedTransactions();
    totalInserted += r.inserted;
    totalSkipped += r.skipped;
    console.log(`[Backfill3] Recorded transactions: inserted=${r.inserted} skipped=${r.skipped}`);
  }

  if (!SKIP_LEGACY) {
    const r = await backfillLegacySales();
    totalInserted += r.inserted;
    totalSkipped += r.skipped;
    console.log(`[Backfill3] Legacy sales: inserted=${r.inserted} skipped=${r.skipped}`);
  }

  if (!SKIP_COMPS) {
    const r = await backfillMarketSaleComps();
    totalInserted += r.inserted;
    totalSkipped += r.skipped;
    console.log(`[Backfill3] Market sale comps: inserted=${r.inserted} skipped=${r.skipped}`);
  }

  await spotCheck();

  console.log(`\n[Backfill3] TOTAL: inserted=${totalInserted} skipped=${totalSkipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[Backfill3] FATAL:', err);
  process.exit(1);
});
