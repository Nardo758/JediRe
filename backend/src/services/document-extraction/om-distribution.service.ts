/**
 * om-distribution — fans a parsed Broker OM out to platform-wide tables
 * (Task #383).
 *
 * Writes:
 *   - market_rent_comps           ← OMExtraction.marketComps.rentComps
 *   - market_sale_comps           ← OMExtraction.marketComps.saleComps
 *   - om_replacement_cost_data    ← OMExtraction.replacementCost
 *   - broker_narratives         ← OMExtraction.investmentThesis + investmentHighlights
 *
 * Every row carries `source = 'broker_om'` and `source_id = <file_id>` so the
 * provenance chain back to the originating Data Library file is preserved.
 *
 * Idempotent on retry: rows are scoped to (source_file_id) on cost_data and
 * narratives — the caller is responsible for clearing prior rows for the same
 * file before re-distributing (handled in dataLibrary.service.parseFileAsync).
 */

import { Pool, PoolClient } from 'pg';
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

/**
 * Map an OMExtraction (+ geo + optional distribute counts) into the flat
 * payload shape consumed by GraphIngestionListener.ingestOM.
 *
 * Exported so the same shape is built from both call sites
 * (om-distribution post-COMMIT, and data-router after routeOM) without
 * drift between the two.
 *
 * Best-effort: every field is permissive about nulls — the listener
 * itself decides which child nodes to create based on which fields
 * are populated.
 */
export function buildOmKgEventData(
  fileId: number | string,
  extraction: OMExtraction,
  geo: OmGeoTags,
  counts?: OmDistributionCounts,
): Record<string, any> {
  const property = extraction.property || ({} as any);
  const proforma = extraction.brokerProforma || ({} as any);
  const meta = extraction.metadata || ({} as any);
  const comps = extraction.marketComps || ({} as any);

  const narratives: any[] = [];
  if (extraction.investmentThesis) {
    narratives.push({
      id: 'thesis',
      kind: 'investment_thesis',
      source: 'om',
      text: extraction.investmentThesis,
      keyPoints: extraction.investmentHighlights || [],
      sentimentScore: null,
      marketOutlook: null,
    });
  }
  if (Array.isArray(extraction.investmentHighlights) && extraction.investmentHighlights.length > 0 && !extraction.investmentThesis) {
    narratives.push({
      id: 'highlights',
      kind: 'investment_highlights',
      source: 'om',
      text: extraction.investmentHighlights.join('\n'),
      keyPoints: extraction.investmentHighlights,
      sentimentScore: null,
      marketOutlook: null,
    });
  }

  const rentComps = (comps.rentComps || []).map((c: any, i: number) => ({
    id: `r${i}`,
    unitType: c?.name,
    rent: c?.avgRent,
    rentPerSf: null,
    units: c?.units,
    sqft: null,
    occupancy: c?.occupancy,
    yearBuilt: c?.yearBuilt,
    submarket: comps.submarketName || geo.submarketKey,
  }));

  const noi = proforma.stabilizedNOI ?? proforma.yearOneNOI ?? null;
  const capRate = proforma.goingInCapRate ?? meta.guidanceCapRate ?? null;
  const askingPrice = meta.askingPrice ?? null;

  // Expense data — partial signals from broker proforma. expenseRatio
  // is derived only when we have both NOI and asking price (rough proxy).
  const expenseData = (proforma.managementFeePct != null || proforma.replacementReservesPerUnit != null) ? {
    managementFeePct: proforma.managementFeePct,
    reservePerUnit: proforma.replacementReservesPerUnit,
    repairsPerUnit: null,
    taxPerUnit: null,
    insurancePerUnit: null,
    totalExpenses: null,
  } : null;

  return {
    fileId,
    propertyName: property.name ?? null,
    address: property.address ?? null,
    city: property.city ?? null,
    state: property.state ?? null,
    zip: property.zip ?? null,
    units: property.units ?? null,
    yearBuilt: property.yearBuilt ?? null,
    msaKey: geo.msaKey ?? null,
    submarketKey: geo.submarketKey ?? null,
    broker: meta.broker ?? null,
    askingPrice,
    capRate,
    noi,
    expenseRatio: null,
    expenseData,
    listingDate: meta.listingDate ?? null,
    brokerNarratives: narratives,
    rentComps,
    distributionCounts: counts ?? null,
  };
}

// Internal — same shape as DistributeArgs but the writers run on a single
// transactional client so partial inserts can be rolled back atomically.
interface DistributeTxnArgs extends Omit<DistributeArgs, 'pool'> {
  client: PoolClient;
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
  args: DistributeTxnArgs,
): Promise<CategoryResult> {
  const { client, extraction, geo, fileId } = args;
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
  for (let i = 0; i < rents.length; i++) {
    const c = rents[i];
    if (!c?.name) continue;
    // Per-row SAVEPOINT so a single bad insert doesn't poison the txn for
    // the remaining rows. We still want to surface every failure, but we
    // never want a single malformed comp to abort the whole distribution
    // before the writers below get a chance to log their own failures.
    await client.query('SAVEPOINT row_sp');
    try {
      await client.query(
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
          // Per-row source_id keeps us safe under any future unique
          // constraint on (source, source_id) — multiple comps from the
          // same OM file would otherwise collide. Pattern: <fileId>:r<index>.
          `${fileId}:r${i}`,
          c.pageNumber ?? null,
        ],
      );
      await client.query('RELEASE SAVEPOINT row_sp');
      inserted++;
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT row_sp');
      const msg = `rent comp "${c.name}": ${err instanceof Error ? err.message : String(err)}`;
      logger.warn('[om-distribute] rent comp insert failed', { fileId, error: msg });
      errors.push(msg);
    }
  }
  return { inserted, errors };
}

async function distributeSaleComps(
  args: DistributeTxnArgs,
): Promise<CategoryResult> {
  const { client, extraction, geo, fileId } = args;
  const errors: string[] = [];
  const sales = extraction.marketComps.saleComps ?? [];
  if (sales.length === 0) return { inserted: 0, errors };

  const city = extraction.property.city ?? '';
  const state = extraction.property.state ?? '';
  if (!city || !state) return { inserted: 0, errors };

  let inserted = 0;
  for (let i = 0; i < sales.length; i++) {
    const c = sales[i];
    if (!c?.name || c.salePrice == null) continue;
    const saleDate = c.saleDate && /^\d{4}-\d{2}-\d{2}$/.test(c.saleDate)
      ? c.saleDate
      : SNAPSHOT_DATE();
    await client.query('SAVEPOINT row_sp');
    try {
      await client.query(
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
          // Required: idx_market_sale_comps_source_id is UNIQUE on
          // (source, source_id). All comps in one OM share the same fileId,
          // so we MUST disambiguate per-row or every comp after the first
          // would collide and abort distribution. Pattern: <fileId>:s<index>.
          `${fileId}:s${i}`,
          c.pageNumber ?? null,
        ],
      );
      await client.query('RELEASE SAVEPOINT row_sp');
      inserted++;
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT row_sp');
      const msg = `sale comp "${c.name}": ${err instanceof Error ? err.message : String(err)}`;
      logger.warn('[om-distribute] sale comp insert failed', { fileId, error: msg });
      errors.push(msg);
    }
  }
  return { inserted, errors };
}

async function distributeReplacementCost(
  args: DistributeTxnArgs,
): Promise<CategoryResult> {
  const { client, extraction, geo, fileId } = args;
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

  await client.query('SAVEPOINT row_sp');
  try {
    await client.query(
      `INSERT INTO om_replacement_cost_data
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
    await client.query('RELEASE SAVEPOINT row_sp');
    return { inserted: 1, errors };
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT row_sp');
    const msg = `replacement cost: ${err instanceof Error ? err.message : String(err)}`;
    logger.warn('[om-distribute] replacement cost insert failed', { fileId, error: msg });
    errors.push(msg);
    return { inserted: 0, errors };
  }
}

async function distributeNarratives(
  args: DistributeTxnArgs,
): Promise<CategoryResult> {
  const { client, extraction, geo, fileId, dealId } = args;
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
    await client.query('SAVEPOINT row_sp');
    try {
      await client.query(
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
      await client.query('RELEASE SAVEPOINT row_sp');
      inserted++;
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT row_sp');
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
 *
 * Runs on the caller's client (transactional) so the clear + subsequent
 * inserts are committed atomically — a half-cleared file row is impossible.
 */
async function clearOmDistributionTxn(client: PoolClient, fileId: number): Promise<void> {
  const fileIdStr = String(fileId);
  const prefix = `${fileId}:%`;
  await client.query(
    `DELETE FROM market_rent_comps
      WHERE source = 'broker_om' AND (source_id = $1 OR source_id LIKE $2)`,
    [fileIdStr, prefix],
  );
  await client.query(
    `DELETE FROM market_sale_comps
      WHERE source = 'broker_om' AND (source_id = $1 OR source_id LIKE $2)`,
    [fileIdStr, prefix],
  );
  await client.query(
    `DELETE FROM om_replacement_cost_data WHERE source_file_id = $1`,
    [fileId],
  );
  await client.query(
    `DELETE FROM broker_narratives WHERE source_file_id = $1`,
    [fileId],
  );
}

/**
 * Public wrapper kept for backward compatibility with any external callers
 * that wipe rows outside the pipeline (e.g. admin tooling). Acquires its
 * own client and commits.
 */
export async function clearOmDistribution(pool: Pool, fileId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await clearOmDistributionTxn(client, fileId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fan an OM extraction out to all platform-wide tables. Runs the clear +
 * all four category writers inside a single transaction so any failure
 * leaves the market tables in their pre-distribution state — eliminates
 * the "distribute_failed but partial comps survived" race the architect
 * flagged in T383 review.
 *
 * Per-row SAVEPOINTs let us collect every insert failure for diagnostics
 * without aborting subsequent rows. If errors.length > 0 the whole
 * transaction ROLLBACKs and OmDistributionError is thrown — counts in
 * the error reflect would-have-been inserts (now rolled back).
 */
export async function distributeOmExtraction(
  args: DistributeArgs,
): Promise<OmDistributionCounts> {
  const { pool } = args;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await clearOmDistributionTxn(client, args.fileId);

    const txnArgs: DistributeTxnArgs = {
      client,
      fileId: args.fileId,
      extraction: args.extraction,
      geo: args.geo,
      dealId: args.dealId,
    };

    // Sequential (not parallel) — savepoint state is per-connection so we
    // cannot fan out concurrently on a single client without risking
    // savepoint name collisions.
    const rent = await distributeRentComps(txnArgs);
    const sale = await distributeSaleComps(txnArgs);
    const rc = await distributeReplacementCost(txnArgs);
    const narr = await distributeNarratives(txnArgs);

    const counts: OmDistributionCounts = {
      rentComps: rent.inserted,
      saleComps: sale.inserted,
      replacementCostRows: rc.inserted,
      narratives: narr.inserted,
    };
    const failures = [...rent.errors, ...sale.errors, ...rc.errors, ...narr.errors];

    if (failures.length > 0) {
      await client.query('ROLLBACK');
      logger.warn('[om-distribute] rolled back — partial failures', {
        fileId: args.fileId, failureCount: failures.length,
      });
      throw new OmDistributionError(
        `Distribution had ${failures.length} insert failure(s): ${failures.slice(0, 3).join('; ')}` +
        (failures.length > 3 ? ` (+${failures.length - 3} more)` : ''),
        // counts are now zeros from the rollback's perspective, but we
        // surface the would-have-been counts so the operator sees what
        // the OM yielded before the abort.
        counts,
        failures,
      );
    }

    await client.query('COMMIT');
    logger.info('[om-distribute] completed', {
      fileId: args.fileId, ...counts, failureCount: 0,
      msaKey: args.geo.msaKey, submarketKey: args.geo.submarketKey,
    });

    // Fan OM intelligence into the Knowledge Graph as typed nodes/edges
    // (Document → BrokerNarrative / RentComp / SaleComp / ExpenseBenchmark).
    // Best-effort: a graph failure must not roll back the SQL writes that
    // already committed above.
    try {
      const { getGraphIngestionListener } = await import('../neural-network/graph-ingestion-listener');
      const { getPool: _getPool } = await import('../../database/connection');
      const listener = getGraphIngestionListener(_getPool());
      await listener.handleEvent({
        type: 'om.processed',
        entityId: String(args.fileId),
        entityType: 'Document',
        timestamp: new Date(),
        data: buildOmKgEventData(args.fileId, args.extraction, args.geo, counts),
      });
    } catch (graphErr) {
      logger.warn('[om-distribute] KG fan-out failed', {
        fileId: args.fileId,
        error: graphErr instanceof Error ? graphErr.message : String(graphErr),
      });
    }

    return counts;
  } catch (err) {
    // Best-effort rollback; if we already rolled back above, this is a no-op
    // that pg silently tolerates.
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
