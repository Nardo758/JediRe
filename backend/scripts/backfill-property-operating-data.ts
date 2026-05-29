/**
 * Backfill 4 — Property Operating Data
 * Phase 2: Property Plumbing Refactor
 *
 * Extracts T12 and rent roll data from deal_data JSONB for all deals,
 * creates property_operating_data rows.
 * Marks is_owned = true for M22 actuals (pipeline_stage = 'post_close').
 *
 * Re-runnable: skips (property_id + period_end + source) combos already present.
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/backfill-property-operating-data.ts
 * Flags:
 *   --dry-run     Print what would be written without inserting
 *   --limit=N     Process at most N deals
 */

import '../src/utils/env-loader';
import { query } from '../src/database/connection';
import { dealPropertyLinkService } from '../src/services/property-entity/deal-property-link.service';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = (() => {
  const f = args.find((a) => a.startsWith('--limit='));
  return f ? parseInt(f.split('=')[1], 10) : 0;
})();

const BATCH = 50;

// Safe number parser
function safeNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// Extract a T12 summary from deal_data JSONB
function extractT12(dealData: Record<string, unknown>): {
  noi: number | null;
  egr: number | null;
  opex: number | null;
  occupancy: number | null;
  periodEnd: string | null;
} | null {
  const t12 = dealData?.extraction_t12 as Record<string, unknown> | undefined;
  if (!t12) return null;

  // Support both flat and nested structures
  const periodEnd =
    (t12.period_end as string) ??
    (t12.trailing_months_end as string) ??
    null;

  const noi = safeNum(t12.noi ?? t12.net_operating_income);
  const egr = safeNum(t12.effective_gross_revenue ?? t12.total_revenue ?? t12.egr);
  const opex = safeNum(t12.total_expenses ?? t12.total_opex);
  const occupancy = safeNum(t12.occupancy ?? t12.physical_occupancy);

  if (noi == null && egr == null) return null;

  return { noi, egr, opex, occupancy: occupancy != null ? occupancy / 100 : null, periodEnd };
}

// Extract rent roll summary from deal_data JSONB
function extractRentRoll(dealData: Record<string, unknown>): {
  avgRent: number | null;
  occupancy: number | null;
  unitCount: number | null;
  periodEnd: string | null;
} | null {
  const rr = dealData?.extraction_rent_roll as Record<string, unknown> | undefined;
  if (!rr) return null;

  const avgRent = safeNum(rr.average_rent ?? rr.avg_rent_per_unit);
  const occupancy = safeNum(rr.occupancy ?? rr.physical_occupancy);
  const unitCount = safeNum(rr.total_units ?? rr.unit_count);
  const periodEnd = (rr.as_of_date as string) ?? (rr.report_date as string) ?? null;

  if (avgRent == null && occupancy == null) return null;

  return {
    avgRent,
    occupancy: occupancy != null && occupancy > 1 ? occupancy / 100 : occupancy,
    unitCount,
    periodEnd,
  };
}

async function main() {
  console.log(`[Backfill4] Starting — dry_run=${DRY_RUN} limit=${LIMIT || 'all'}`);

  // Load all deals with deal_data
  const dealsQuery = await query(
    `SELECT d.id, d.pipeline_stage, d.deal_data, d.property_id
     FROM deals d
     WHERE d.deal_data IS NOT NULL
       AND (d.deal_data->>'extraction_t12' IS NOT NULL
         OR d.deal_data->>'extraction_rent_roll' IS NOT NULL)
     ORDER BY d.created_at
     ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}`
  );

  const deals = dealsQuery.rows;
  console.log(`[Backfill4] ${deals.length} deals with T12 or rent-roll data`);

  let t12Inserted = 0;
  let rrInserted = 0;
  let skipped = 0;
  let noProperty = 0;

  for (const deal of deals) {
    const dealId = deal.id as string;
    const isOwned = (deal.pipeline_stage as string) === 'post_close';
    const dealData = (deal.deal_data as Record<string, unknown>) ?? {};

    // Resolve property_id
    let propertyId = deal.property_id as string | null;
    if (!propertyId) {
      const link = await dealPropertyLinkService.resolveDealProperty(dealId);
      propertyId = link?.propertyId ?? null;
    }

    if (!propertyId) {
      console.warn(`  [Backfill4] deal ${dealId}: no property_id — skipping`);
      noProperty++;
      continue;
    }

    // T12 operating data
    const t12 = extractT12(dealData);
    if (t12) {
      const periodEnd = t12.periodEnd ?? new Date().toISOString().split('T')[0];
      // Check for existing row
      const existing = await query(
        `SELECT id FROM property_operating_data
         WHERE property_id = $1 AND source = 't12' AND period_end = $2`,
        [propertyId, periodEnd]
      );

      if (existing.rows.length === 0) {
        if (DRY_RUN) {
          console.log(
            `  [dry-run] would insert t12 opdata for deal=${dealId} property=${propertyId} noi=${t12.noi}`
          );
        } else {
          try {
            await query(
              `INSERT INTO property_operating_data (
                property_id, period_type, period_end,
                noi, effective_gross_revenue, total_opex, occupancy,
                source, source_date, confidence, is_owned
              ) VALUES ($1,'ttm',$2,$3,$4,$5,$6,'t12',$2,0.90,$7)`,
              [
                propertyId,
                periodEnd,
                t12.noi,
                t12.egr,
                t12.opex,
                t12.occupancy,
                isOwned,
              ]
            );
            t12Inserted++;
          } catch (err) {
            console.warn(`  [Backfill4] t12 insert failed deal=${dealId}: ${err instanceof Error ? err.message : err}`);
            skipped++;
          }
        }
      }
    }

    // Rent roll operating data
    const rr = extractRentRoll(dealData);
    if (rr) {
      const periodEnd = rr.periodEnd ?? new Date().toISOString().split('T')[0];
      const existing = await query(
        `SELECT id FROM property_operating_data
         WHERE property_id = $1 AND source = 'rent_roll' AND period_end = $2`,
        [propertyId, periodEnd]
      );

      if (existing.rows.length === 0) {
        if (DRY_RUN) {
          console.log(
            `  [dry-run] would insert rent_roll opdata for deal=${dealId} property=${propertyId} avgRent=${rr.avgRent}`
          );
        } else {
          try {
            await query(
              `INSERT INTO property_operating_data (
                property_id, period_type, period_end,
                avg_rent_per_unit, occupancy,
                source, source_date, confidence, is_owned
              ) VALUES ($1,'point_in_time',$2,$3,$4,'rent_roll',$2,0.85,$5)`,
              [propertyId, periodEnd, rr.avgRent, rr.occupancy, isOwned]
            );
            rrInserted++;
          } catch (err) {
            console.warn(`  [Backfill4] rr insert failed deal=${dealId}: ${err instanceof Error ? err.message : err}`);
            skipped++;
          }
        }
      }
    }
  }

  console.log(
    `\n[Backfill4] Done: t12_inserted=${t12Inserted} rr_inserted=${rrInserted} skipped=${skipped} no_property=${noProperty}`
  );

  const totRes = await query(`SELECT COUNT(*) AS cnt FROM property_operating_data`);
  console.log(`[Backfill4] property_operating_data total rows: ${totRes.rows[0].cnt}`);

  const ownedRes = await query(
    `SELECT COUNT(*) AS cnt FROM property_operating_data WHERE is_owned = TRUE`
  );
  console.log(`[Backfill4] is_owned=TRUE rows: ${ownedRes.rows[0].cnt}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('[Backfill4] FATAL:', err);
  process.exit(1);
});
