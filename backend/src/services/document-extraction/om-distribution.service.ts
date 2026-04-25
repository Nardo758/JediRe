/**
 * om-distribution — fans a parsed Broker OM out to platform-wide tables
 * (Task #383).
 *
 * Writes:
 *   - market_rent_comps         ← OMExtraction.marketComps.rentComps
 *   - market_sale_comps         ← OMExtraction.marketComps.saleComps
 *   - data_library_cost_data    ← OMExtraction.replacementCost
 *   - broker_narratives         ← OMExtraction.investmentThesis + investmentHighlights
 *
 * Every row carries `source = 'broker_om'` and `source_id = <file_id>` so the
 * provenance chain back to the originating Data Library file is preserved.
 *
 * Idempotent on retry: rows are scoped to (source_file_id) on cost_data and
 * narratives — the caller is responsible for clearing prior rows for the same
 * file before re-distributing (handled in dataLibrary.service.parseFileAsync).
 */

import { Pool } from 'pg';
import { logger } from '../../utils/logger';
import type { OMExtraction } from './parsers/om-parser';
import type { OmGeoTags } from './om-geo';

export interface OmDistributionCounts {
  rentComps: number;
  saleComps: number;
  replacementCostRows: number;
  narratives: number;
}

export class OmDistributionError extends Error {
  constructor(
    message: string,
    public readonly partialCounts: OmDistributionCounts,
    public readonly failures: string[],
  ) {
    super(message);
    this.name = 'OmDistributionError';
  }
}

interface CategoryResult { inserted: number; errors: string[] }

interface DistributeArgs {
  pool: Pool;
  fileId: number;
  extraction: OMExtraction;
  geo: OmGeoTags;
  dealId?: string | null;
}

const SNAPSHOT_DATE = (): string => new Date().toISOString().slice(0, 10);

const ASSET_CLASS_FROM_TYPE = (t: string | null): string | null => {
  if (!t) return null;
  const v = t.toLowerCase();
  if (v.includes('garden')) return 'B';
  if (v.includes('mid')) return 'B';
  if (v.includes('high')) return 'A';
  return null;
};

async function distributeRentComps(
  pool: Pool, args: DistributeArgs,
): Promise<CategoryResult> {
  const { extraction, geo, fileId } = args;
  const errors: string[] = [];
  const rents = extraction.marketComps.rentComps ?? [];
  if (rents.length === 0) return { inserted: 0, errors };

  // Fall back to the OM property's own city/state for comp address scoping —
  // OM rent comps are normally local to the subject property's market.
  const city = extraction.property.city ?? '';
  const state = extraction.property.state ?? '';
  if (!city || !state) {
    logger.debug('[om-distribute] skipping rent comps — missing city/state on OM property');
    return { inserted: 0, errors };
  }

  let inserted = 0;
  const snapshot = SNAPSHOT_DATE();
  for (const c of rents) {
    if (!c?.name) continue;
    try {
      await pool.query(
        `INSERT INTO market_rent_comps
           (property_name, address, city, state, zip, msa, submarket,
            units, year_built, asset_class, snapshot_date,
            avg_asking_rent, occupancy_pct,
            source, source_id, source_page)
         VALUES ($1, $2, $3, $4, $5, $6, $7,
                 $8, $9, $10, $11,
                 $12, $13,
                 $14, $15, $16)`,
        [
          c.name,
          c.name,                       // address column is NOT NULL — no street ⇒ reuse name
          city,
          state,
          extraction.property.zip ?? null,
          geo.msaName ?? null,
          geo.submarketName ?? extraction.marketComps.submarketName ?? null,
          c.units ?? null,
          null,
          ASSET_CLASS_FROM_TYPE(extraction.property.propertyType),
          snapshot,
          c.avgRent ?? null,
          c.occupancy ?? null,
          'broker_om',
          String(fileId),
          c.pageNumber ?? null,
        ],
      );
      inserted++;
    } catch (err) {
      const msg = `rent comp "${c.name}": ${err instanceof Error ? err.message : String(err)}`;
      logger.warn('[om-distribute] rent comp insert failed', { fileId, error: msg });
      errors.push(msg);
    }
  }
  return { inserted, errors };
}

async function distributeSaleComps(
  pool: Pool, args: DistributeArgs,
): Promise<CategoryResult> {
  const { extraction, geo, fileId } = args;
  const errors: string[] = [];
  const sales = extraction.marketComps.saleComps ?? [];
  if (sales.length === 0) return { inserted: 0, errors };

  const city = extraction.property.city ?? '';
  const state = extraction.property.state ?? '';
  if (!city || !state) return { inserted: 0, errors };

  let inserted = 0;
  for (const c of sales) {
    if (!c?.name || c.salePrice == null) continue;
    const saleDate = c.saleDate && /^\d{4}-\d{2}-\d{2}$/.test(c.saleDate)
      ? c.saleDate
      : SNAPSHOT_DATE();
    try {
      await pool.query(
        `INSERT INTO market_sale_comps
           (property_name, address, city, state, zip, msa, submarket,
            property_type, units, year_built, asset_class,
            sale_date, sale_price, price_per_unit, cap_rate,
            broker, source, source_id, source_page)
         VALUES ($1, $2, $3, $4, $5, $6, $7,
                 $8, $9, $10, $11,
                 $12, $13, $14, $15,
                 $16, $17, $18, $19)`,
        [
          c.name,
          c.name,
          city,
          state,
          extraction.property.zip ?? null,
          geo.msaName ?? null,
          geo.submarketName ?? extraction.marketComps.submarketName ?? null,
          'multifamily',
          c.units ?? null,
          null,
          ASSET_CLASS_FROM_TYPE(extraction.property.propertyType),
          saleDate,
          c.salePrice,
          c.pricePerUnit ?? (c.units ? Math.round(c.salePrice / c.units) : null),
          c.capRate ?? null,
          extraction.metadata.broker ?? null,
          'broker_om',
          String(fileId),
          c.pageNumber ?? null,
        ],
      );
      inserted++;
    } catch (err) {
      const msg = `sale comp "${c.name}": ${err instanceof Error ? err.message : String(err)}`;
      logger.warn('[om-distribute] sale comp insert failed', { fileId, error: msg });
      errors.push(msg);
    }
  }
  return { inserted, errors };
}

async function distributeReplacementCost(
  pool: Pool, args: DistributeArgs,
): Promise<CategoryResult> {
  const { extraction, geo, fileId } = args;
  const errors: string[] = [];
  const rc = extraction.replacementCost;

  // Skip rows with no actionable replacement-cost numbers — better to insert
  // nothing than to insert a row of all NULLs that would dilute medians.
  const hasAnyValue =
    rc.totalReplacementCost != null ||
    rc.replacementCostPerUnit != null ||
    rc.hardCostPSF != null ||
    rc.hardCostTotal != null ||
    rc.landValue != null;
  if (!hasAnyValue) return { inserted: 0, errors };

  try {
    await pool.query(
      `INSERT INTO data_library_cost_data
         (source_file_id, msa_key, submarket_key,
          property_name, property_type, units, year_built, net_rentable_sf,
          land_value, hard_cost_psf, hard_cost_total,
          soft_cost_pct, soft_cost_total,
          total_replacement_cost, replacement_cost_per_unit,
          cost_source, source, source_id, source_page)
       VALUES ($1, $2, $3,
               $4, $5, $6, $7, $8,
               $9, $10, $11,
               $12, $13,
               $14, $15,
               $16, $17, $18, $19)`,
      [
        fileId,
        geo.msaKey,
        geo.submarketKey,
        extraction.property.name,
        extraction.property.propertyType,
        extraction.property.units,
        extraction.property.yearBuilt,
        extraction.property.netRentableSF,
        rc.landValue,
        rc.hardCostPSF,
        rc.hardCostTotal,
        rc.softCostPct,
        rc.softCostTotal,
        rc.totalReplacementCost,
        rc.replacementCostPerUnit,
        rc.source,
        'broker_om',
        String(fileId),
        rc.pageNumber ?? null,
      ],
    );
    return { inserted: 1, errors };
  } catch (err) {
    const msg = `replacement cost: ${err instanceof Error ? err.message : String(err)}`;
    logger.warn('[om-distribute] replacement cost insert failed', { fileId, error: msg });
    errors.push(msg);
    return { inserted: 0, errors };
  }
}

async function distributeNarratives(
  pool: Pool, args: DistributeArgs,
): Promise<CategoryResult> {
  const { extraction, geo, fileId, dealId } = args;
  const errors: string[] = [];
  const rows: Array<{ kind: 'thesis' | 'highlight'; text: string }> = [];

  if (extraction.investmentThesis && extraction.investmentThesis.trim().length > 0) {
    rows.push({ kind: 'thesis', text: extraction.investmentThesis.trim() });
  }
  for (const h of extraction.investmentHighlights ?? []) {
    if (typeof h === 'string' && h.trim().length > 0) {
      rows.push({ kind: 'highlight', text: h.trim() });
    }
  }
  if (rows.length === 0) return { inserted: 0, errors };

  let inserted = 0;
  for (const r of rows) {
    try {
      await pool.query(
        `INSERT INTO broker_narratives
           (source_file_id, msa_key, submarket_key, deal_id,
            kind, text, broker, property_name, source_page)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          fileId,
          geo.msaKey,
          geo.submarketKey,
          dealId ?? null,
          r.kind,
          r.text,
          extraction.metadata.broker,
          extraction.property.name,
          // Narrative-level page numbers are not extracted by the AI prompt
          // today; column exists so future versions can populate without
          // another migration.
          null,
        ],
      );
      inserted++;
    } catch (err) {
      const msg = `narrative (${r.kind}): ${err instanceof Error ? err.message : String(err)}`;
      logger.warn('[om-distribute] narrative insert failed', { fileId, error: msg });
      errors.push(msg);
    }
  }
  return { inserted, errors };
}

/**
 * Wipe all distributed rows tied to a Data Library file. Called before a
 * re-parse so duplicates don't accumulate when an upload is retried.
 */
export async function clearOmDistribution(pool: Pool, fileId: number): Promise<void> {
  const fileIdStr = String(fileId);
  await pool.query(
    `DELETE FROM market_rent_comps WHERE source = 'broker_om' AND source_id = $1`,
    [fileIdStr],
  );
  await pool.query(
    `DELETE FROM market_sale_comps WHERE source = 'broker_om' AND source_id = $1`,
    [fileIdStr],
  );
  await pool.query(
    `DELETE FROM data_library_cost_data WHERE source_file_id = $1`,
    [fileId],
  );
  await pool.query(
    `DELETE FROM broker_narratives WHERE source_file_id = $1`,
    [fileId],
  );
}

/**
 * Fan an OM extraction out to all platform-wide tables.
 * Throws OmDistributionError if any individual row insert failed — the caller
 * (parseFileAsync) maps this to a non-complete `parsing_stage` so the operator
 * sees the partial-failure rather than a misleading "complete" status.
 */
export async function distributeOmExtraction(
  args: DistributeArgs,
): Promise<OmDistributionCounts> {
  const { pool } = args;
  await clearOmDistribution(pool, args.fileId);

  const [rent, sale, rc, narr] = await Promise.all([
    distributeRentComps(pool, args),
    distributeSaleComps(pool, args),
    distributeReplacementCost(pool, args),
    distributeNarratives(pool, args),
  ]);

  const counts: OmDistributionCounts = {
    rentComps: rent.inserted,
    saleComps: sale.inserted,
    replacementCostRows: rc.inserted,
    narratives: narr.inserted,
  };
  const failures = [...rent.errors, ...sale.errors, ...rc.errors, ...narr.errors];

  logger.info('[om-distribute] completed', {
    fileId: args.fileId, ...counts, failureCount: failures.length,
    msaKey: args.geo.msaKey, submarketKey: args.geo.submarketKey,
  });

  if (failures.length > 0) {
    throw new OmDistributionError(
      `Distribution had ${failures.length} insert failure(s): ${failures.slice(0, 3).join('; ')}` +
      (failures.length > 3 ? ` (+${failures.length - 3} more)` : ''),
      counts,
      failures,
    );
  }

  return counts;
}
