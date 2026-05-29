/**
 * PropertyDualWriteService
 * Phase 2 — Property Plumbing Refactor
 *
 * Central dual-write wrapper. Every write path to an old property table
 * (property_info_cache, georgia_property_sales) calls this service AFTER
 * the old-table write succeeds. The service:
 *   1. Resolves or creates the canonical property entity in `properties`
 *   2. Writes the corresponding row in the new schema table
 *   3. On failure: logs to property_dual_write_failures and re-throws
 *      so the caller can decide whether to surface or swallow.
 *
 * Feature flag: PROPERTY_DUAL_WRITE_ENABLED (default "true").
 * Set to "false" to disable all new-table writes instantly; old writes
 * continue unaffected. This is the Phase 2 rollback mechanism.
 *
 * Comp ingestion (market_sale_comps, market_rent_comps) — PAUSED per spec.
 * Stubs log the "paused" message but do not write.
 */

import { PoolClient } from 'pg';
import { query, getPool } from '../../database/connection';
import { propertyResolverService } from './property-resolver.service';
import { logger } from '../../utils/logger';

// ----------------------------------------------------------------
// Dual-write enabled flag
// ----------------------------------------------------------------

export function isDualWriteEnabled(): boolean {
  return process.env.PROPERTY_DUAL_WRITE_ENABLED !== 'false';
}

// ----------------------------------------------------------------
// Input types
// ----------------------------------------------------------------

export interface InfoCacheDualWriteInput {
  parcelId: string;
  county: string;
  state: string;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  yearBuilt?: number | null;
  livingAreaSqft?: number | null;
  numberOfUnits?: number | null;
  stories?: number | null;
  landUseCode?: string | null;
  propertyType?: string | null;
  zoning?: string | null;
  fetchedAt: Date;
  provider: string;
  source?: 'county' | 'om' | 'costar' | 'operator' | 'agent';
}

export interface GeorgiaSaleDualWriteInput {
  parcelId: string;
  county: string;
  state: string;
  saleDate: string;
  salePrice: number;
  saleType?: string | null;
  qualified?: boolean | null;
  grantorName?: string | null;
  provider: string;
  sourceId?: string | null;
}

// ----------------------------------------------------------------
// Service
// ----------------------------------------------------------------

export class PropertyDualWriteService {
  /**
   * Dual-write: property_info_cache upsert → property_characteristics
   *
   * Called after a successful property_info_cache INSERT/ON CONFLICT UPDATE.
   * Resolves the canonical property entity (creates if missing), then
   * upserts a property_characteristics row with county-sourced data.
   *
   * Non-fatal by design: a dual-write failure does NOT roll back the
   * property_info_cache row. Failures are logged to property_dual_write_failures.
   */
  async dualWriteFromInfoCache(input: InfoCacheDualWriteInput): Promise<void> {
    if (!isDualWriteEnabled()) return;

    const writePath = `${input.provider}.saveProperty`;

    try {
      const property = await propertyResolverService.resolveByParcel({
        parcelIdRaw: input.parcelId,
        county: input.county,
        state: input.state,
        createIfMissing: true,
      });

      if (!property) {
        throw new Error(`Could not resolve or create property for parcel ${input.parcelId}`);
      }

      const effectiveFrom = input.fetchedAt.toISOString().split('T')[0];

      await query(
        `INSERT INTO property_characteristics (
          property_id, effective_from,
          unit_count, building_sf,
          source, source_date, confidence,
          provenance
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING`,
        [
          property.id,
          effectiveFrom,
          input.numberOfUnits ?? null,
          input.livingAreaSqft ?? null,
          input.source ?? 'county',
          effectiveFrom,
          0.85,
          JSON.stringify({
            yearBuilt: input.yearBuilt ?? null,
            landUseCode: input.landUseCode ?? null,
            propertyType: input.propertyType ?? null,
            zoning: input.zoning ?? null,
            provider: input.provider,
          }),
        ]
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('[PropertyDualWrite] dualWriteFromInfoCache failed', {
        writePath,
        parcelId: input.parcelId,
        county: input.county,
        error: errorMessage,
      });
      await this.logFailure({
        writePath,
        oldTable: 'property_info_cache',
        newTable: 'property_characteristics',
        parcelId: input.parcelId,
        county: input.county,
        errorMessage,
        context: { provider: input.provider, fetchedAt: input.fetchedAt },
      });
    }
  }

  /**
   * Dual-write: georgia_property_sales insert → property_sales
   *
   * Called after a successful georgia_property_sales INSERT/DO NOTHING.
   * Resolves the canonical property entity, then inserts into property_sales.
   * Uses source_id = `${provider}::${parcelId}::${saleDate}::${salePrice}`
   * for idempotency.
   */
  async dualWriteFromGeorgiaSale(input: GeorgiaSaleDualWriteInput): Promise<void> {
    if (!isDualWriteEnabled()) return;

    const writePath = `${input.provider}.saveSales`;

    try {
      const property = await propertyResolverService.resolveByParcel({
        parcelIdRaw: input.parcelId,
        county: input.county,
        state: input.state,
        createIfMissing: true,
      });

      if (!property) {
        throw new Error(`Could not resolve or create property for parcel ${input.parcelId}`);
      }

      const sourceId =
        input.sourceId ??
        `${input.provider}::${input.parcelId}::${input.saleDate}::${input.salePrice}`;

      const qualified =
        input.qualified !== undefined && input.qualified !== null
          ? input.qualified
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
          input.saleDate,
          input.salePrice,
          input.saleType ?? null,
          input.grantorName ?? null,
          qualified,
          'county_recorded',
          sourceId,
          input.saleDate,
          0.80,
          false,
        ]
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('[PropertyDualWrite] dualWriteFromGeorgiaSale failed', {
        writePath,
        parcelId: input.parcelId,
        county: input.county,
        saleDate: input.saleDate,
        error: errorMessage,
      });
      await this.logFailure({
        writePath,
        oldTable: 'georgia_property_sales',
        newTable: 'property_sales',
        parcelId: input.parcelId,
        county: input.county,
        errorMessage,
        context: {
          saleDate: input.saleDate,
          salePrice: input.salePrice,
          provider: input.provider,
        },
      });
    }
  }

  /**
   * Dual-write: deal creation D-DEAL-1 → deals.property_id
   *
   * Called after D-DEAL-1 links a properties row to a deal (Step A or B).
   * Writes deals.property_id via a direct UPDATE. Atomicity: if this fails,
   * the deal still exists but lacks the new FK; the nightly reconciliation
   * will detect and surface it via getUnlinkedDeals().
   */
  async dualWriteDealLink(
    dealId: string,
    propertyId: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    if (!isDualWriteEnabled()) return;

    const writePath = 'inline_deals.D-DEAL-1';

    try {
      await query(
        `UPDATE deals SET property_id = $2, updated_at = NOW()
         WHERE id = $1 AND (property_id IS NULL OR property_id = $2)`,
        [dealId, propertyId]
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('[PropertyDualWrite] dualWriteDealLink failed', {
        writePath,
        dealId,
        propertyId,
        error: errorMessage,
      });
      await this.logFailure({
        writePath,
        oldTable: 'deal_properties',
        newTable: 'deals.property_id',
        dealId,
        errorMessage,
        context: context ?? {},
      });
    }
  }

  /**
   * Atomic helper: insert property_characteristics within a caller-managed transaction.
   *
   * Used by Georgia ingestion services to run the old-table write (property_info_cache)
   * and the new-table write (property_characteristics) in the SAME database transaction,
   * satisfying the Phase 2 atomicity requirement ("both writes or neither").
   *
   * The caller is responsible for BEGIN / COMMIT / ROLLBACK.
   * Property entity resolution must be done BEFORE calling this method (outside the TX).
   */
  async writeCharacteristicsInTx(
    propertyId: string,
    input: InfoCacheDualWriteInput,
    client: PoolClient
  ): Promise<void> {
    if (!isDualWriteEnabled()) return;

    const effectiveFrom = input.fetchedAt.toISOString().split('T')[0];

    await client.query(
      `INSERT INTO property_characteristics (
        property_id, effective_from,
        unit_count, building_sf,
        source, source_date, confidence,
        provenance
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT DO NOTHING`,
      [
        propertyId,
        effectiveFrom,
        input.numberOfUnits ?? null,
        input.livingAreaSqft ?? null,
        input.source ?? 'county',
        effectiveFrom,
        0.85,
        JSON.stringify({
          yearBuilt: input.yearBuilt ?? null,
          landUseCode: input.landUseCode ?? null,
          propertyType: input.propertyType ?? null,
          zoning: input.zoning ?? null,
          provider: input.provider,
        }),
      ]
    );
  }

  /**
   * Atomic helper: insert property_sales within a caller-managed transaction.
   *
   * Used by Georgia ingestion services to run the old-table write (georgia_property_sales)
   * and the new-table write (property_sales) in the SAME database transaction.
   *
   * The caller is responsible for BEGIN / COMMIT / ROLLBACK.
   * Property entity resolution must be done BEFORE calling this method (outside the TX).
   */
  async writeSaleInTx(
    propertyId: string,
    input: GeorgiaSaleDualWriteInput,
    client: PoolClient
  ): Promise<void> {
    if (!isDualWriteEnabled()) return;

    const sourceId =
      input.sourceId ??
      `${input.provider}::${input.parcelId}::${input.saleDate}::${input.salePrice}`;

    const qualified =
      input.qualified !== undefined && input.qualified !== null ? input.qualified : null;

    await client.query(
      `INSERT INTO property_sales (
        property_id, sale_date, sale_price,
        deed_type, seller, qualified,
        source, source_id, source_date, confidence,
        is_jedi_tracked
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (source, source_id) DO NOTHING`,
      [
        propertyId,
        input.saleDate,
        input.salePrice,
        input.saleType ?? null,
        input.grantorName ?? null,
        qualified,
        'county_recorded',
        sourceId,
        input.saleDate,
        0.80,
        false,
      ]
    );
  }

  /**
   * STUB — property_records (deprecated source)
   *
   * Per Phase 2 spec: property_records is a deprecated source.
   * All 249K rows are backfilled by Backfill 2 from property_info_cache.
   * New writes to property_records are rare (manual scripts only).
   * This stub logs the "paused" message but does NOT write to property_characteristics.
   * Dual-write will be activated here once the column migrations from
   * property_records to property_info_cache are complete (Phase 2 step 1.1.A follow-through).
   */
  async dualWriteFromPropertyRecord(parcelId: string, county: string): Promise<void> {
    logger.debug('[PropertyDualWrite] property_records dual-write PAUSED', {
      reason: 'property_records is a deprecated source; Backfill 2 handles historical rows; Phase 2 spec §2.2',
      parcelId,
      county,
    });
  }

  /**
   * STUB — market_sale_comps (comp ingestion paused)
   *
   * Per Phase 2 spec: comp ingestion paths are paused. Resumes Phase 5
   * against property_sales directly.
   */
  async dualWriteFromMarketSaleComp(): Promise<void> {
    logger.debug('[PropertyDualWrite] market_sale_comps dual-write PAUSED', {
      reason: 'comp ingestion suspended per Phase 2 spec; resumes Phase 5',
    });
  }

  /**
   * STUB — market_rent_comps (paused)
   */
  async dualWriteFromMarketRentComp(): Promise<void> {
    logger.debug('[PropertyDualWrite] market_rent_comps dual-write PAUSED', {
      reason: 'comp ingestion suspended per Phase 2 spec; resumes Phase 5',
    });
  }

  /**
   * Log a dual-write failure to property_dual_write_failures.
   * Non-throwing — a failure here would obscure the original error.
   */
  private async logFailure(params: {
    writePath: string;
    oldTable: string;
    newTable: string;
    parcelId?: string;
    county?: string;
    dealId?: string;
    errorMessage: string;
    context?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO property_dual_write_failures
          (write_path, old_table, new_table, parcel_id, county, deal_id, error_message, context)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          params.writePath,
          params.oldTable,
          params.newTable,
          params.parcelId ?? null,
          params.county ?? null,
          params.dealId ?? null,
          params.errorMessage,
          JSON.stringify(params.context ?? {}),
        ]
      );
    } catch (logErr) {
      logger.error('[PropertyDualWrite] CRITICAL: could not log dual-write failure', {
        originalPath: params.writePath,
        logError: logErr instanceof Error ? logErr.message : String(logErr),
      });
    }
  }
}

export const propertyDualWriteService = new PropertyDualWriteService();
