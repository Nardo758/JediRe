/**
 * Data Library Auto-Enrichment Service
 *
 * When a user uploads a deal with missing information, this service
 * automatically taps the appropriate APIs to fill in the gaps:
 * - Municipal APIs for property info (year built, units, SF, zoning, owner)
 * - Apartment Locator AI for rent data (unit mix, asking rents, occupancy)
 */

import { query as dbQuery } from '../../../database/connection';
import { getEnrichmentOrchestrator } from '../enrichment-orchestrator';
import { getPropertyDiscoveryService } from '../discovery/property-discovery.service';
import { getPropertyMatcherService } from '../matching/property-matcher.service';
import { PropertyInfo, RentData } from '../types';

export interface DataLibraryAsset {
  id: string;
  userId?: string;

  propertyName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;

  propertyType?: string;
  assetClass?: string;
  dealType?: string;

  units?: number;
  yearBuilt?: number;
  stories?: number;
  avgRent?: number;
  occupancyPct?: number;
  livingAreaSqFt?: number;

  capRate?: number;
  askingPrice?: number;
  noi?: number;

  dataQualityScore?: number;
  sourceDocument?: string;
  extractedAt?: Date;
}

export interface EnrichmentConflict {
  field: string;
  existingValue: unknown;
  enrichedValue: unknown;
  source: string;
}

export interface EnrichmentResult {
  assetId: string;
  success: boolean;
  fieldsEnriched: string[];
  fieldsStillMissing: string[];
  municipalApiUsed: boolean;
  municipalProvider?: string;
  apartmentLocatorUsed: boolean;
  apartmentLocatorId?: string;
  previousScore: number;
  newScore: number;
  enrichedData: Partial<DataLibraryAsset>;
  conflicts: EnrichmentConflict[];
  logId?: string;
}

export interface EnrichmentConfig {
  autoEnrichOnUpload: boolean;
  minDqScoreForAutoEnrich: number;
  enrichPropertyInfo: boolean;
  enrichRentData: boolean;
  overwriteExisting: boolean;
  requireConfirmation: boolean;
}

const DEFAULT_CONFIG: EnrichmentConfig = {
  autoEnrichOnUpload: true,
  minDqScoreForAutoEnrich: 50,
  enrichPropertyInfo: true,
  enrichRentData: true,
  overwriteExisting: false,
  requireConfirmation: true,
};

// Map DB columns -> in-memory DataLibraryAsset
function rowToAsset(row: Record<string, unknown>): DataLibraryAsset {
  return {
    id: row.id as string,
    userId: row.created_by as string | undefined,
    propertyName: (row.property_name as string) || undefined,
    address: (row.address as string) || undefined,
    city: (row.city as string) || undefined,
    state: (row.state as string) || undefined,
    zip: (row.zip_code as string) || undefined,
    county: (row.county as string) || undefined,
    propertyType: (row.property_type as string) || undefined,
    assetClass: (row.asset_class as string) || undefined,
    units: row.unit_count != null ? Number(row.unit_count) : undefined,
    yearBuilt: row.year_built != null ? Number(row.year_built) : undefined,
    stories: row.stories != null ? Number(row.stories) : undefined,
    avgRent: row.avg_rent != null ? Number(row.avg_rent) : undefined,
    occupancyPct: row.occupancy_rate != null ? Number(row.occupancy_rate) : undefined,
    livingAreaSqFt: row.net_rentable_sqft != null ? Number(row.net_rentable_sqft) : undefined,
    capRate: row.cap_rate != null ? Number(row.cap_rate) : undefined,
    askingPrice: row.sale_price != null ? Number(row.sale_price) : undefined,
    noi: row.noi != null ? Number(row.noi) : undefined,
    dataQualityScore: row.data_quality_score != null ? Number(row.data_quality_score) : 0,
  };
}

// Map asset field -> DB column
const ASSET_FIELD_TO_COLUMN: Record<string, string> = {
  propertyName: 'property_name',
  address: 'address',
  city: 'city',
  state: 'state',
  zip: 'zip_code',
  county: 'county',
  units: 'unit_count',
  yearBuilt: 'year_built',
  stories: 'stories',
  avgRent: 'avg_rent',
  occupancyPct: 'occupancy_rate',
  livingAreaSqFt: 'net_rentable_sqft',
  capRate: 'cap_rate',
  askingPrice: 'sale_price',
  noi: 'noi',
};

export class DataLibraryAutoEnrichmentService {
  private enrichmentOrchestrator = getEnrichmentOrchestrator();
  // Kept for downstream wiring; intentionally unused in this file:
  // private discoveryService = getPropertyDiscoveryService();
  // private matcherService = getPropertyMatcherService();

  /**
   * Load an asset from the DB by id
   */
  async loadAsset(assetId: string): Promise<DataLibraryAsset | null> {
    const r = await dbQuery(
      `SELECT id, created_by, property_name, address, city, state, zip_code, county,
              property_type, asset_class, unit_count, year_built, stories,
              avg_rent, occupancy_rate, net_rentable_sqft, cap_rate, sale_price, noi,
              data_quality_score
         FROM data_library_assets WHERE id = $1`,
      [assetId]
    );
    if (!r.rows[0]) return null;
    return rowToAsset(r.rows[0]);
  }

  /**
   * Enrich an asset by id (loads from DB, runs enrichment, persists log,
   * and—if no conflicts requiring confirmation—applies enrichment).
   */
  async enrichAssetById(
    assetId: string,
    config: Partial<EnrichmentConfig> = {}
  ): Promise<EnrichmentResult | null> {
    const asset = await this.loadAsset(assetId);
    if (!asset) return null;

    const cfg = { ...DEFAULT_CONFIG, ...config };
    const result = await this.enrichAsset(asset, cfg);

    // Always log the attempt
    const logId = await this.logEnrichment(asset, result, cfg);
    result.logId = logId;

    // Auto-apply only if no conflicts (or overwrite mode is on and confirmation not required)
    const shouldAutoApply =
      result.success &&
      (result.conflicts.length === 0 || (cfg.overwriteExisting && !cfg.requireConfirmation));

    if (shouldAutoApply) {
      await this.applyEnrichment(assetId, result);
      if (logId) {
        await dbQuery(
          `UPDATE data_library_enrichment_log SET status = 'applied', applied_at = NOW() WHERE id = $1`,
          [logId]
        );
      }
    }

    return result;
  }

  /**
   * Enrich a Data Library asset object with missing information (does not persist)
   */
  async enrichAsset(
    asset: DataLibraryAsset,
    config: Partial<EnrichmentConfig> = {}
  ): Promise<EnrichmentResult> {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    const result: EnrichmentResult = {
      assetId: asset.id,
      success: false,
      fieldsEnriched: [],
      fieldsStillMissing: [],
      municipalApiUsed: false,
      apartmentLocatorUsed: false,
      previousScore: asset.dataQualityScore || 0,
      newScore: asset.dataQualityScore || 0,
      enrichedData: {},
      conflicts: [],
    };

    if (!asset.address || !asset.city || !asset.state) {
      result.fieldsStillMissing = ['address', 'city', 'state'].filter(
        (f) => !asset[f as keyof DataLibraryAsset]
      );
      return result;
    }

    try {
      if (cfg.enrichPropertyInfo) {
        const propertyInfo = await this.fetchPropertyInfo(asset);
        if (propertyInfo) {
          result.municipalApiUsed = true;
          result.municipalProvider = propertyInfo.provider;
          this.applyPropertyInfo(asset, propertyInfo, result, cfg);
        }
      }

      if (cfg.enrichRentData) {
        const rentData = await this.fetchRentData(asset);
        if (rentData) {
          result.apartmentLocatorUsed = rentData.provider === 'apartment_locator';
          this.applyRentData(asset, rentData, result, cfg);
        }
      }

      result.newScore = this.calculateDataQualityScore(asset, result.enrichedData);
      result.fieldsStillMissing = this.getMissingFields(asset, result.enrichedData);
      result.success = result.fieldsEnriched.length > 0;
    } catch (error) {
      console.error(`[AutoEnrichment] Error enriching asset ${asset.id}:`, error);
    }

    return result;
  }

  private async fetchPropertyInfo(asset: DataLibraryAsset): Promise<PropertyInfo | null> {
    try {
      const orch = this.enrichmentOrchestrator as unknown as {
        fetchPropertyInfo: (
          a: string, c: string, s: string, z?: string, co?: string,
          coords?: { lat: number; lng: number }
        ) => Promise<{ info: PropertyInfo | null; provider: string | null }>;
      };
      const { info } = await orch.fetchPropertyInfo(
        asset.address!, asset.city!, asset.state!, asset.zip, asset.county, undefined
      );
      return info;
    } catch (e) {
      console.error('[AutoEnrichment] fetchPropertyInfo error:', e);
      return null;
    }
  }

  private async fetchRentData(asset: DataLibraryAsset): Promise<RentData | null> {
    const matched = await this.findApartmentLocatorMatch(asset);
    if (matched) return matched;
    try {
      const orch = this.enrichmentOrchestrator as unknown as {
        fetchRentData: (
          a: string, c: string, s: string, name?: string
        ) => Promise<{ data: RentData | null; provider: string | null }>;
      };
      const { data } = await orch.fetchRentData(
        asset.address!, asset.city!, asset.state!, asset.propertyName
      );
      return data;
    } catch (e) {
      console.error('[AutoEnrichment] fetchRentData error:', e);
      return null;
    }
  }

  /**
   * Find matching property in apartment_locator_properties table
   */
  private async findApartmentLocatorMatch(
    asset: DataLibraryAsset
  ): Promise<RentData | null> {
    try {
      const r = await dbQuery(
        `SELECT id, property_name, address, city, state, zip,
                avg_asking_rent, avg_effective_rent, min_rent, max_rent,
                unit_mix, occupancy_pct, available_units, total_units,
                management_company, source, fetched_at
           FROM apartment_locator_properties
          WHERE UPPER(state) = UPPER($1)
            AND UPPER(city) = UPPER($2)
            AND (
              address ILIKE $3
              OR ($4::text IS NOT NULL AND property_name ILIKE $4)
            )
          ORDER BY fetched_at DESC NULLS LAST
          LIMIT 1`,
        [
          asset.state!,
          asset.city!,
          `%${asset.address!.split(',')[0].trim()}%`,
          asset.propertyName ? `%${asset.propertyName}%` : null,
        ]
      );
      if (!r.rows[0]) return null;
      const row = r.rows[0];
      return {
        propertyName: row.property_name || undefined,
        address: row.address,
        city: row.city,
        state: row.state,
        zip: row.zip || undefined,
        totalUnits: row.total_units != null ? Number(row.total_units) : undefined,
        avgAskingRent: row.avg_asking_rent != null ? Number(row.avg_asking_rent) : undefined,
        avgEffectiveRent: row.avg_effective_rent != null ? Number(row.avg_effective_rent) : undefined,
        occupancyPct: row.occupancy_pct != null ? Number(row.occupancy_pct) : undefined,
        availableUnits: row.available_units != null ? Number(row.available_units) : undefined,
        unitMix: row.unit_mix || [],
        managementCompany: row.management_company || undefined,
        provider: 'apartment_locator',
        externalId: row.id,
        fetchedAt: row.fetched_at,
      } as unknown as RentData;
    } catch (e) {
      console.error('[AutoEnrichment] findApartmentLocatorMatch error:', e);
      return null;
    }
  }

  private applyPropertyInfo(
    asset: DataLibraryAsset,
    info: PropertyInfo,
    result: EnrichmentResult,
    config: EnrichmentConfig
  ): void {
    const mappings: Array<{ assetField: keyof DataLibraryAsset; infoField: keyof PropertyInfo }> = [
      { assetField: 'units', infoField: 'numberOfUnits' },
      { assetField: 'yearBuilt', infoField: 'yearBuilt' },
      { assetField: 'livingAreaSqFt', infoField: 'livingAreaSqFt' },
      { assetField: 'stories', infoField: 'stories' },
      { assetField: 'county', infoField: 'county' },
      { assetField: 'zip', infoField: 'zip' },
    ];

    for (const m of mappings) {
      const enrichedValue = info[m.infoField];
      if (enrichedValue === undefined || enrichedValue === null) continue;

      const existingValue = asset[m.assetField];
      if (existingValue !== undefined && existingValue !== null && existingValue !== enrichedValue) {
        if (config.overwriteExisting) {
          (result.enrichedData as Record<string, unknown>)[m.assetField] = enrichedValue;
          result.fieldsEnriched.push(m.assetField);
        }
        result.conflicts.push({
          field: m.assetField,
          existingValue,
          enrichedValue,
          source: info.provider || 'municipal_api',
        });
      } else if (existingValue === undefined || existingValue === null) {
        (result.enrichedData as Record<string, unknown>)[m.assetField] = enrichedValue;
        result.fieldsEnriched.push(m.assetField);
      }
    }
  }

  private applyRentData(
    asset: DataLibraryAsset,
    rentData: RentData,
    result: EnrichmentResult,
    config: EnrichmentConfig
  ): void {
    const rd = rentData as unknown as Record<string, unknown>;
    const provider = (rd.provider as string) || 'rent_data';

    const set = (assetField: keyof DataLibraryAsset, value: unknown) => {
      if (value === null || value === undefined) return;
      const existing = asset[assetField];
      if (existing !== undefined && existing !== null && existing !== value) {
        if (config.overwriteExisting) {
          (result.enrichedData as Record<string, unknown>)[assetField] = value;
          result.fieldsEnriched.push(assetField);
        }
        result.conflicts.push({ field: assetField, existingValue: existing, enrichedValue: value, source: provider });
      } else if (existing === undefined || existing === null) {
        (result.enrichedData as Record<string, unknown>)[assetField] = value;
        result.fieldsEnriched.push(assetField);
      }
    };

    if (rd.avgAskingRent != null) set('avgRent', Math.round(Number(rd.avgAskingRent)));
    if (rd.occupancyPct != null) set('occupancyPct', Number(rd.occupancyPct));
    if (rd.totalUnits != null) set('units', Number(rd.totalUnits));
    if (rd.propertyName && !asset.propertyName) set('propertyName', rd.propertyName);
  }

  private calculateDataQualityScore(
    asset: DataLibraryAsset,
    enriched: Partial<DataLibraryAsset>
  ): number {
    const combined = { ...asset, ...enriched };
    const weights: Record<string, number> = {
      address: 10, city: 5, state: 5, propertyName: 5,
      units: 15, yearBuilt: 10, livingAreaSqFt: 8,
      avgRent: 12, occupancyPct: 10,
      capRate: 8, askingPrice: 7, noi: 5,
    };
    let score = 0;
    for (const [field, weight] of Object.entries(weights)) {
      const v = combined[field as keyof DataLibraryAsset];
      if (v !== undefined && v !== null && v !== '') score += weight;
    }
    return Math.min(score, 100);
  }

  private getMissingFields(asset: DataLibraryAsset, enriched: Partial<DataLibraryAsset>): string[] {
    const combined = { ...asset, ...enriched };
    const critical = ['address', 'city', 'state', 'propertyName', 'units', 'yearBuilt', 'avgRent', 'occupancyPct'];
    return critical.filter((f) => !combined[f as keyof DataLibraryAsset]);
  }

  /**
   * Persist an enrichment attempt for audit / future application
   */
  private async logEnrichment(
    asset: DataLibraryAsset,
    result: EnrichmentResult,
    _cfg: EnrichmentConfig
  ): Promise<string | undefined> {
    try {
      // Status enum: pending|applied|partial|rejected|failed
      const status =
        result.conflicts.length > 0
          ? 'pending'   // awaiting conflict resolution
          : result.success
          ? 'pending'   // ready to apply (will be flipped to 'applied' by applyEnrichmentFromLog)
          : 'failed';

      const r = await dbQuery(
        `INSERT INTO data_library_enrichment_log (
            asset_id, user_id, fields_enriched, fields_still_missing,
            municipal_api_used, municipal_provider,
            apartment_locator_used, apartment_locator_id,
            previous_score, new_score,
            enriched_data, conflicts, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          asset.id,
          asset.userId || null,
          result.fieldsEnriched,
          result.fieldsStillMissing,
          result.municipalApiUsed,
          result.municipalProvider || null,
          result.apartmentLocatorUsed,
          (result.apartmentLocatorId as string | undefined) || null,
          result.previousScore,
          result.newScore,
          JSON.stringify(result.enrichedData),
          JSON.stringify(result.conflicts),
          status,
        ]
      );
      return r.rows[0]?.id as string | undefined;
    } catch (e) {
      console.error('[AutoEnrichment] logEnrichment error:', e);
      return undefined;
    }
  }

  /**
   * Apply the enriched data to data_library_assets
   */
  async applyEnrichment(
    assetId: string,
    result: EnrichmentResult,
    resolvedConflicts?: Record<string, 'keep' | 'overwrite'>
  ): Promise<void> {
    const updateData: Record<string, unknown> = { ...(result.enrichedData as Record<string, unknown>) };

    if (resolvedConflicts) {
      for (const conflict of result.conflicts) {
        if (resolvedConflicts[conflict.field] === 'overwrite') {
          updateData[conflict.field] = conflict.enrichedValue;
        }
      }
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [field, value] of Object.entries(updateData)) {
      const col = ASSET_FIELD_TO_COLUMN[field];
      if (!col) continue;
      sets.push(`${col} = $${i++}`);
      values.push(value);
    }

    if (sets.length === 0) return;

    sets.push(`data_quality_score = $${i++}`);
    values.push(result.newScore);
    sets.push(`updated_at = NOW()`);
    values.push(assetId);

    await dbQuery(
      `UPDATE data_library_assets SET ${sets.join(', ')} WHERE id = $${i}`,
      values
    );

    if (result.logId) {
      await dbQuery(
        `UPDATE data_library_enrichment_log
            SET status = 'applied', applied_at = NOW(),
                conflicts_resolved = $1, conflict_resolutions = $2
          WHERE id = $3`,
        [
          !!resolvedConflicts,
          resolvedConflicts ? JSON.stringify(resolvedConflicts) : null,
          result.logId,
        ]
      );
    }
  }

  /**
   * Apply a previously-logged enrichment with user-resolved conflicts
   */
  async applyEnrichmentFromLog(
    logId: string,
    resolvedConflicts?: Record<string, 'keep' | 'overwrite'>
  ): Promise<{ applied: boolean }> {
    const r = await dbQuery(
      `SELECT id, asset_id, enriched_data, conflicts, new_score
         FROM data_library_enrichment_log WHERE id = $1`,
      [logId]
    );
    if (!r.rows[0]) return { applied: false };
    const row = r.rows[0];

    const result: EnrichmentResult = {
      assetId: row.asset_id,
      success: true,
      fieldsEnriched: [],
      fieldsStillMissing: [],
      municipalApiUsed: false,
      apartmentLocatorUsed: false,
      previousScore: 0,
      newScore: Number(row.new_score) || 0,
      enrichedData: row.enriched_data || {},
      conflicts: row.conflicts || [],
      logId: row.id,
    };
    await this.applyEnrichment(row.asset_id, result, resolvedConflicts);
    return { applied: true };
  }

  async batchEnrich(
    assets: DataLibraryAsset[],
    config: Partial<EnrichmentConfig> = {}
  ): Promise<{ total: number; enriched: number; failed: number; results: EnrichmentResult[] }> {
    const results: EnrichmentResult[] = [];
    let enriched = 0;
    let failed = 0;
    for (const asset of assets) {
      try {
        const r = await this.enrichAssetById(asset.id, config);
        if (r) {
          results.push(r);
          if (r.success) enriched++;
        }
      } catch (e) {
        failed++;
        console.error(`[AutoEnrichment] Failed to enrich asset ${asset.id}:`, e);
      }
      await new Promise((res) => setTimeout(res, 500));
    }
    return { total: assets.length, enriched, failed, results };
  }

  /**
   * Find assets that need enrichment (low DQ score)
   */
  async getAssetsNeedingEnrichment(
    userId?: string,
    minScore: number = 50,
    limit: number = 50
  ): Promise<DataLibraryAsset[]> {
    const params: unknown[] = [minScore];
    let where = `(data_quality_score IS NULL OR data_quality_score < $1)
                 AND address IS NOT NULL AND city IS NOT NULL AND state IS NOT NULL`;
    if (userId) {
      params.push(userId);
      where += ` AND created_by = $${params.length}`;
    }
    params.push(limit);
    const r = await dbQuery(
      `SELECT id, created_by, property_name, address, city, state, zip_code, county,
              property_type, asset_class, unit_count, year_built, stories,
              avg_rent, occupancy_rate, net_rentable_sqft, cap_rate, sale_price, noi,
              data_quality_score
         FROM data_library_assets
        WHERE ${where}
        ORDER BY COALESCE(data_quality_score, 0) ASC, updated_at DESC
        LIMIT $${params.length}`,
      params
    );
    return r.rows.map(rowToAsset);
  }
}

let autoEnrichmentInstance: DataLibraryAutoEnrichmentService | null = null;
export function getDataLibraryAutoEnrichmentService(): DataLibraryAutoEnrichmentService {
  if (!autoEnrichmentInstance) autoEnrichmentInstance = new DataLibraryAutoEnrichmentService();
  return autoEnrichmentInstance;
}

// Re-export getters used elsewhere
export { getPropertyDiscoveryService, getPropertyMatcherService };
