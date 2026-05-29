/**
 * Florida Municipal Sale Comps Service — Task #1416 / D-COSTAR-4
 *
 * Fetches recorded sale transactions directly from FL county property appraiser
 * ArcGIS REST services (Hillsborough, Orange, Miami-Dade, Duval) and ingests them
 * into market_sale_comps with source='municipal' + county provenance tags.
 *
 * County endpoints (all publicly accessible, no auth required):
 *
 *   Hillsborough  — HCPA ArcGIS MapServer (sales layer)
 *     https://maps.hcpafl.org/arcgis/rest/services/PublicAccess/HCPAInfoLayers/MapServer/4/query
 *
 *   Orange        — OCPA ArcGIS MapServer (property sales)
 *     https://gisweb.ocpafl.org/arcgis/rest/services/Prod_AGOL/Property_Sales/MapServer/0/query
 *
 *   Miami-Dade    — Socrata Open Data (real property sales)
 *     https://opendata.miamidade.gov/resource/nev3-m88i.json
 *
 *   Duval         — JAXPA ArcGIS MapServer (property sales)
 *     https://duvalpa.maps.arcgis.com/apps/... → feature service:
 *     https://services1.arcgis.com/O1JpcwDW8sjYuddV/arcgis/rest/services/Duval_Property_Sales/FeatureServer/0/query
 *
 * Fulton County / Atlanta (464 Bishop) note:
 *   Georgia is a non-disclosure state — sale prices are NOT required to be
 *   reported to the county assessor. Fulton County's public ArcGIS layers
 *   (https://gisdata.fultoncountyga.gov) contain parcel geometry and
 *   assessment data but OMIT sale price fields. No equivalent public municipal
 *   feed exists for Atlanta-MSA sale prices. CoStar or broker feeds remain
 *   the only viable source for GA transaction comps.
 *
 * Quality tier: C1 — full transaction record from authoritative public source.
 * source_id format: {county_code}_{parcel_id}_{sale_date_yyyymmdd}
 * UPSERT: ON CONFLICT (source, source_id) WHERE source_id IS NOT NULL — idempotent.
 */

import axios, { AxiosError } from 'axios';
import { query as dbQuery, getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import {
  checkSaleCompDedup,
  type DedupCandidate,
  type DedupOptions,
} from '../valuation/comp-dedup.service';
import { propertyResolverService } from '../property-entity/property-resolver.service';
import { propertySalesService } from '../property-entity/property-sales.service';
import { isDualWriteEnabled } from '../property-entity/property-dual-write.service';

// ── Types ────────────────────────────────────────────────────────────────────

export type FLCounty = 'hillsborough' | 'orange' | 'miami_dade' | 'duval';

export interface MunicipalFetchOptions {
  county: FLCounty;
  dateFrom: string;  // YYYY-MM-DD
  dateTo: string;    // YYYY-MM-DD
  minSalePrice?: number;
  pageSize?: number;
}

export interface MunicipalFetchResult {
  county: FLCounty;
  state: 'FL';
  endpoint: string;
  totalFetched: number;
  inserted: number;
  skippedDup: number;
  skippedInvalid: number;
  dataAsOf: string;
  errors: string[];
}

export interface NormalizedSaleComp {
  address: string;
  city: string;
  state: string;
  county: string;
  msa: string;
  property_type: string;
  units: number | null;
  sqft: number | null;
  year_built: number | null;
  asset_class: string | null;
  sale_date: string;
  sale_price: number;
  price_per_unit: number | null;
  price_per_sqft: number | null;
  buyer: string | null;
  seller: string | null;
  source: 'municipal';
  source_id: string;
  qualified: boolean;
  latitude: number | null;
  longitude: number | null;
  data_as_of: string;
  source_labels: string[];
}

// ── County configurations ─────────────────────────────────────────────────────

interface ArcGISCountyConfig {
  type: 'arcgis';
  endpoint: string;
  msa: string;
  city: string;  // default city when not in feature
  countyCode: string;
  dateField: string;
  dateFormat: 'epoch_ms' | 'string';
  priceField: string;
  parcelField: string;
  addressField: string;
  cityField: string | null;
  sqftField: string | null;
  yearBuiltField: string | null;
  buyerField: string | null;
  sellerField: string | null;
  latField: string | null;
  lngField: string | null;
  landUseField: string | null;
  multifamilyLandUseCodes: string[];
}

interface SocrataCountyConfig {
  type: 'socrata';
  endpoint: string;
  msa: string;
  city: string;
  countyCode: string;
  dateField: string;
  priceField: string;
  parcelField: string;
  addressField: string;
  cityField: string | null;
  sqftField: string | null;
  yearBuiltField: string | null;
  buyerField: string | null;
  sellerField: string | null;
  latField: string | null;
  lngField: string | null;
  landUseField: string | null;
  multifamilyLandUseCodes: string[];
}

type CountyConfig = ArcGISCountyConfig | SocrataCountyConfig;

const COUNTY_CONFIGS: Record<FLCounty, CountyConfig> = {
  hillsborough: {
    type: 'arcgis',
    endpoint:
      'https://maps.hcpafl.org/arcgis/rest/services/PublicAccess/HCPAInfoLayers/MapServer/4/query',
    msa: 'Tampa-St. Petersburg-Clearwater, FL',
    city: 'Tampa',
    countyCode: 'HILLSBOROUGH',
    dateField: 'SALE_DATE',
    dateFormat: 'epoch_ms',
    priceField: 'SALE_PRC',
    parcelField: 'PARCEL_ID',
    addressField: 'SITE_ADDR',
    cityField: 'SITE_CITY',
    sqftField: 'TOT_LV_SQFT',
    yearBuiltField: 'YR_BLT',
    buyerField: 'GRNTEE',
    sellerField: 'GRNTR',
    latField: 'LAT',
    lngField: 'LONG',
    landUseField: 'DOR_CD',
    // Florida DOR land use codes for multifamily:
    // 08 = Multifamily < 10 units, 39 = Hotels/Motels excluded,
    // 07 = Miscellaneous residential, 04 = Condominium, 06 = Retirement homes
    multifamilyLandUseCodes: ['08', '007', '008', '04', '06', '38'],
  },

  orange: {
    type: 'arcgis',
    endpoint:
      'https://gisweb.ocpafl.org/arcgis/rest/services/Prod_AGOL/Property_Sales/MapServer/0/query',
    msa: 'Orlando-Kissimmee-Sanford, FL',
    city: 'Orlando',
    countyCode: 'ORANGE',
    dateField: 'SALE_DATE',
    dateFormat: 'epoch_ms',
    priceField: 'SALE_AMOUNT',
    parcelField: 'PARCEL_ID',
    addressField: 'PROP_ADDRESS',
    cityField: 'PROP_CITY',
    sqftField: 'TOTAL_LV_SQFT',
    yearBuiltField: 'YEAR_BUILT',
    buyerField: 'BUYER_NAME',
    sellerField: 'SELLER_NAME',
    latField: null,
    lngField: null,
    landUseField: 'DOR_CODE',
    multifamilyLandUseCodes: ['08', '007', '008', '04', '06', '38'],
  },

  miami_dade: {
    type: 'socrata',
    endpoint:
      'https://opendata.miamidade.gov/resource/nev3-m88i.json',
    msa: 'Miami-Fort Lauderdale-Pompano Beach, FL',
    city: 'Miami',
    countyCode: 'MIAMI-DADE',
    dateField: 'sale_date',
    priceField: 'sale_price',
    parcelField: 'folio_number',
    addressField: 'primary_zone',  // address field varies; use parcel as fallback
    cityField: 'municipality',
    sqftField: 'living_sqft',
    yearBuiltField: 'year_built',
    buyerField: 'buyer_1',
    sellerField: 'seller_1',
    latField: 'lat',
    lngField: 'lng',
    landUseField: 'dor_use_code',
    multifamilyLandUseCodes: ['08', '007', '008', '04', '06', '38'],
  },

  duval: {
    type: 'arcgis',
    endpoint:
      'https://services1.arcgis.com/O1JpcwDW8sjYuddV/arcgis/rest/services/Duval_Property_Sales/FeatureServer/0/query',
    msa: 'Jacksonville, FL',
    city: 'Jacksonville',
    countyCode: 'DUVAL',
    dateField: 'SALE_DATE',
    dateFormat: 'epoch_ms',
    priceField: 'SALE_PRICE',
    parcelField: 'RE_NUMBER',
    addressField: 'SITUS_ADDR',
    cityField: 'SITUS_CITY',
    sqftField: 'TOTAL_SQFT',
    yearBuiltField: 'YEAR_BUILT',
    buyerField: 'GRANTEE_NAME',
    sellerField: 'GRANTOR_NAME',
    latField: null,
    lngField: null,
    landUseField: 'DOR_CODE',
    multifamilyLandUseCodes: ['08', '007', '008', '04', '06', '38'],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeFloat(v: unknown): number | null {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[,$\s]/g, ''));
  return isNaN(n) ? null : n;
}

function safeInt(v: unknown): number | null {
  if (v == null) return null;
  const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? null : n;
}

/** Normalise epoch-ms or string date → YYYY-MM-DD */
function toIsoDate(v: unknown, format: 'epoch_ms' | 'string'): string | null {
  if (v == null) return null;
  try {
    if (format === 'epoch_ms') {
      const ms = typeof v === 'number' ? v : parseInt(String(v), 10);
      if (isNaN(ms)) return null;
      return new Date(ms).toISOString().slice(0, 10);
    }
    // string: try ISO or MM/DD/YYYY
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
    // ISO 8601 with T
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  } catch {
    return null;
  }
}

function assetClassFromYear(year: number | null): string | null {
  if (!year) return null;
  if (year >= 2010) return 'A';
  if (year >= 1995) return 'B';
  return 'C';
}

function buildSourceId(countyCode: string, parcelId: string, saleDate: string): string {
  return `${countyCode}_${parcelId}_${saleDate.replace(/-/g, '')}`;
}

// ── ArcGIS fetcher ────────────────────────────────────────────────────────────

async function fetchArcGISPage(
  config: ArcGISCountyConfig,
  dateFrom: string,
  dateTo: string,
  minSalePrice: number,
  offset: number,
  pageSize: number
): Promise<{ features: any[]; done: boolean }> {
  // Build ArcGIS where clause
  // Dates: epoch ms range for epoch_ms fields, string comparison for string fields
  let dateWhere: string;
  if (config.dateFormat === 'epoch_ms') {
    const fromMs = new Date(dateFrom).getTime();
    const toMs = new Date(dateTo + 'T23:59:59Z').getTime();
    dateWhere = `${config.dateField} >= ${fromMs} AND ${config.dateField} <= ${toMs}`;
  } else {
    dateWhere = `${config.dateField} >= '${dateFrom}' AND ${config.dateField} <= '${dateTo}'`;
  }

  const priceWhere = `${config.priceField} >= ${minSalePrice}`;
  const landUseWhere =
    config.landUseField && config.multifamilyLandUseCodes.length > 0
      ? ` AND ${config.landUseField} IN (${config.multifamilyLandUseCodes.map(c => `'${c}'`).join(',')})`
      : '';

  const where = `${dateWhere} AND ${priceWhere}${landUseWhere}`;

  const fields = [
    config.parcelField,
    config.dateField,
    config.priceField,
    config.addressField,
    config.cityField,
    config.sqftField,
    config.yearBuiltField,
    config.buyerField,
    config.sellerField,
    config.latField,
    config.lngField,
    config.landUseField,
  ]
    .filter(Boolean)
    .join(',');

  const params = new URLSearchParams({
    where,
    outFields: fields,
    returnGeometry: 'false',
    f: 'json',
    resultOffset: String(offset),
    resultRecordCount: String(pageSize),
  });

  const url = `${config.endpoint}?${params.toString()}`;
  const resp = await axios.get(url, { timeout: 30_000 });

  if (resp.data?.error) {
    throw new Error(`ArcGIS error: ${JSON.stringify(resp.data.error)}`);
  }

  const features: any[] = resp.data?.features ?? [];
  const exceededMax = resp.data?.exceededTransferLimit ?? false;

  return {
    features,
    done: features.length < pageSize && !exceededMax,
  };
}

function normalizeArcGISFeature(
  attrs: Record<string, unknown>,
  config: ArcGISCountyConfig,
  today: string
): NormalizedSaleComp | null {
  const parcelId = attrs[config.parcelField];
  if (!parcelId) return null;

  const saleDateRaw = attrs[config.dateField];
  const saleDate = toIsoDate(saleDateRaw, config.dateFormat);
  if (!saleDate) return null;

  const salePrice = safeFloat(attrs[config.priceField]);
  if (!salePrice || salePrice <= 0) return null;

  const address =
    (config.addressField ? String(attrs[config.addressField] ?? '').trim() : '') ||
    `Parcel ${parcelId}`;

  const city =
    (config.cityField ? String(attrs[config.cityField] ?? '').trim() : '') || config.city;

  const sqft = config.sqftField ? safeInt(attrs[config.sqftField]) : null;
  const yearBuilt = config.yearBuiltField ? safeInt(attrs[config.yearBuiltField]) : null;
  const buyer = config.buyerField ? String(attrs[config.buyerField] ?? '').trim() || null : null;
  const seller = config.sellerField ? String(attrs[config.sellerField] ?? '').trim() || null : null;
  const lat = config.latField ? safeFloat(attrs[config.latField]) : null;
  const lng = config.lngField ? safeFloat(attrs[config.lngField]) : null;

  const sourceId = buildSourceId(config.countyCode, String(parcelId), saleDate);
  const assetClass = assetClassFromYear(yearBuilt);

  return {
    address,
    city,
    state: 'FL',
    county: config.countyCode,
    msa: config.msa,
    property_type: 'multifamily',
    units: null,
    sqft,
    year_built: yearBuilt,
    asset_class: assetClass,
    sale_date: saleDate,
    sale_price: salePrice,
    price_per_unit: null,
    price_per_sqft: sqft && sqft > 0 ? Math.round((salePrice / sqft) * 100) / 100 : null,
    buyer,
    seller,
    source: 'municipal',
    source_id: sourceId,
    qualified: true,
    latitude: lat,
    longitude: lng,
    // data_as_of = county's transaction/recording date (not the fetch date)
    data_as_of: saleDate,
    source_labels: [`${config.countyCode} Property Appraiser`, config.endpoint],
  };
}

// ── Socrata fetcher (Miami-Dade) ──────────────────────────────────────────────

async function fetchSocrataPage(
  config: SocrataCountyConfig,
  dateFrom: string,
  dateTo: string,
  minSalePrice: number,
  offset: number,
  pageSize: number
): Promise<{ rows: any[]; done: boolean }> {
  const whereClause = `${config.dateField} >= '${dateFrom}' AND ${config.dateField} <= '${dateTo}' AND ${config.priceField} >= ${minSalePrice}`;

  const params = new URLSearchParams({
    $where: whereClause,
    $limit: String(pageSize),
    $offset: String(offset),
    $order: `${config.dateField} DESC`,
  });

  const url = `${config.endpoint}?${params.toString()}`;
  const resp = await axios.get(url, {
    timeout: 30_000,
    headers: { 'Accept': 'application/json' },
  });

  const rows: any[] = Array.isArray(resp.data) ? resp.data : [];
  return { rows, done: rows.length < pageSize };
}

function normalizeSocrataRow(
  row: Record<string, unknown>,
  config: SocrataCountyConfig,
  today: string
): NormalizedSaleComp | null {
  const parcelId = row[config.parcelField];
  if (!parcelId) return null;

  const saleDateRaw = row[config.dateField];
  const saleDate = toIsoDate(saleDateRaw, 'string');
  if (!saleDate) return null;

  const salePrice = safeFloat(row[config.priceField]);
  if (!salePrice || salePrice <= 0) return null;

  // Miami-Dade uses folio_number; address is in a separate column
  const address =
    (row['address'] ? String(row['address']).trim() : '') ||
    (config.addressField ? String(row[config.addressField] ?? '').trim() : '') ||
    `Parcel ${parcelId}`;

  const city = config.cityField
    ? String(row[config.cityField] ?? '').trim() || config.city
    : config.city;

  const sqft = config.sqftField ? safeInt(row[config.sqftField]) : null;
  const yearBuilt = config.yearBuiltField ? safeInt(row[config.yearBuiltField]) : null;
  const buyer = config.buyerField ? String(row[config.buyerField] ?? '').trim() || null : null;
  const seller = config.sellerField ? String(row[config.sellerField] ?? '').trim() || null : null;
  const lat = config.latField ? safeFloat(row[config.latField]) : null;
  const lng = config.lngField ? safeFloat(row[config.lngField]) : null;

  const sourceId = buildSourceId(config.countyCode, String(parcelId), saleDate);
  const assetClass = assetClassFromYear(yearBuilt);

  return {
    address,
    city,
    state: 'FL',
    county: config.countyCode,
    msa: config.msa,
    property_type: 'multifamily',
    units: null,
    sqft,
    year_built: yearBuilt,
    asset_class: assetClass,
    sale_date: saleDate,
    sale_price: salePrice,
    price_per_unit: null,
    price_per_sqft: sqft && sqft > 0 ? Math.round((salePrice / sqft) * 100) / 100 : null,
    buyer,
    seller,
    source: 'municipal',
    source_id: sourceId,
    qualified: true,
    latitude: lat,
    longitude: lng,
    // data_as_of = county's transaction/recording date (not the fetch date)
    data_as_of: saleDate,
    source_labels: [`${config.countyCode} Property Appraiser`, config.endpoint],
  };
}

// ── DB upsert with D-COSTAR-3 cross-source dedup ─────────────────────────────

/**
 * Upsert a batch of normalized municipal comps into market_sale_comps.
 *
 * Two-phase dedup (D-COSTAR-3):
 *   Phase 1 — Cross-source check: call checkSaleCompDedup against existing
 *     non-municipal rows (address + geocode tiers). If a match is found,
 *     annotate the existing row's source_labels with 'municipal' and skip
 *     the insert — the authoritative row lives once under its original source.
 *     NOTE: The existing dedup service explicitly excludes costar_upload rows
 *     from its tier-2/tier-3 queries; CoStar ↔ municipal cross-source dedup
 *     requires a future extension to D-COSTAR-3 (task #1440 scope).
 *
 *   Phase 2 — Source-local idempotency: ON CONFLICT (source, source_id)
 *     handles re-runs of the same municipal ingest without double-counting.
 */
async function upsertComps(comps: NormalizedSaleComp[]): Promise<{ inserted: number; skipped: number }> {
  if (comps.length === 0) return { inserted: 0, skipped: 0 };

  const pool = getPool();
  let inserted = 0;
  let skipped = 0;

  for (const comp of comps) {
    // ── Phase 1: Cross-source dedup via D-COSTAR-3 ───────────────────────────
    const dedupCandidate: DedupCandidate = {
      address:    comp.address,
      city:       comp.city,
      state:      comp.state,
      sale_date:  comp.sale_date,
      latitude:   comp.latitude,
      longitude:  comp.longitude,
      source_id:  comp.source_id,
      data_as_of: comp.data_as_of,
      sqft:       comp.sqft,
      year_built: comp.year_built,
      msa:        comp.msa,
      county:     comp.county,
      sale_price: comp.sale_price,
      price_per_sqft: comp.price_per_sqft,
      buyer:  comp.buyer,
      seller: comp.seller,
    };

    // checkAllSources=true: municipal ingest checks against ALL existing rows,
    // including costar_upload, to prevent CoStar ↔ municipal duplicates.
    const dedupOpts: DedupOptions = { checkAllSources: true };
    const dedupResult = await checkSaleCompDedup(pool, dedupCandidate, dedupOpts);

    if (dedupResult.matched && dedupResult.existingId) {
      // Cross-source duplicate found — annotate existing row's source_labels
      // to include 'municipal' and record the dedup method; skip insert.
      await dbQuery(
        `UPDATE market_sale_comps
         SET source_labels     = ARRAY(
               SELECT DISTINCT unnest(COALESCE(source_labels, ARRAY[]::text[]) || $2::text[])
             ),
             dedup_match_method = $3
         WHERE id = $1`,
        [
          dedupResult.existingId,
          comp.source_labels,
          dedupResult.method ?? 'address',
        ]
      );
      skipped++;
      continue;
    }

    // ── Phase 2: Source-local upsert (idempotency for repeated ingestion) ────
    const res = await dbQuery(
      `INSERT INTO market_sale_comps (
        address, city, state, county, msa,
        property_type, units, sqft, year_built, asset_class,
        sale_date, sale_price, price_per_unit, price_per_sqft,
        buyer, seller,
        source, source_id, qualified,
        latitude, longitude,
        data_as_of, source_labels
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16,
        $17, $18, $19,
        $20, $21,
        $22, $23
      )
      ON CONFLICT (source, source_id) WHERE source_id IS NOT NULL
      DO UPDATE SET
        sale_price     = EXCLUDED.sale_price,
        price_per_sqft = EXCLUDED.price_per_sqft,
        sqft           = COALESCE(market_sale_comps.sqft, EXCLUDED.sqft),
        year_built     = COALESCE(market_sale_comps.year_built, EXCLUDED.year_built),
        asset_class    = COALESCE(market_sale_comps.asset_class, EXCLUDED.asset_class),
        latitude       = COALESCE(market_sale_comps.latitude, EXCLUDED.latitude),
        longitude      = COALESCE(market_sale_comps.longitude, EXCLUDED.longitude),
        data_as_of     = EXCLUDED.data_as_of,
        source_labels  = EXCLUDED.source_labels
      RETURNING (xmax = 0) AS was_inserted`,
      [
        comp.address, comp.city, comp.state, comp.county, comp.msa,
        comp.property_type, comp.units, comp.sqft, comp.year_built, comp.asset_class,
        comp.sale_date, comp.sale_price, comp.price_per_unit, comp.price_per_sqft,
        comp.buyer, comp.seller,
        comp.source, comp.source_id, comp.qualified,
        comp.latitude, comp.longitude,
        comp.data_as_of, comp.source_labels,
      ]
    );

    const wasInserted = res.rows[0]?.was_inserted;
    if (wasInserted) {
      inserted++;
      // Phase 5 dual-write: also write to property_sales (new canonical schema)
      if (isDualWriteEnabled()) {
        dualWriteToPropertySales(comp).catch(err => {
          logger.warn('[FloridaMunicipalSaleComps] property_sales dual-write failed', {
            sourceId: comp.source_id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    } else {
      skipped++;
    }
  }

  return { inserted, skipped };
}

/**
 * Phase 5 — Dual-write a normalized FL municipal comp into property_sales.
 * Non-fatal: errors are swallowed by the caller.
 */
async function dualWriteToPropertySales(comp: NormalizedSaleComp): Promise<void> {
  const property = await propertyResolverService.resolveByAddress({
    address: comp.address,
    city: comp.city,
    state: comp.state,
    createIfMissing: true,
  });
  if (!property) return;

  await propertySalesService.upsertBySourceId({
    propertyId: property.id,
    saleDate: comp.sale_date,
    salePrice: comp.sale_price,
    pricePerUnit: comp.price_per_unit,
    pricePerSf: comp.price_per_sqft,
    buyer: comp.buyer,
    seller: comp.seller,
    source: 'county_recorded',
    sourceId: `fl_municipal::${comp.source_id}`,
    sourceDate: comp.data_as_of,
    confidence: 0.90,
    isJediTracked: false,
    qualified: comp.qualified,
  });
}

// ── Main service class ────────────────────────────────────────────────────────

class FloridaMunicipalSaleCompsService {
  /**
   * Fetch municipal sale comps for a given FL county and date range.
   * Pages through the county API, normalizes to market_sale_comps schema,
   * and upserts with C1 provenance.
   *
   * Returns a summary suitable for agent tool output.
   */
  async fetchAndIngest(opts: MunicipalFetchOptions): Promise<MunicipalFetchResult> {
    const {
      county,
      dateFrom,
      dateTo,
      minSalePrice = 500_000,
      pageSize = 100,
    } = opts;

    const config = COUNTY_CONFIGS[county];
    if (!config) {
      throw new Error(`Unknown FL county: ${county}. Valid values: hillsborough, orange, miami_dade, duval`);
    }

    const today = new Date().toISOString().slice(0, 10);
    const result: MunicipalFetchResult = {
      county,
      state: 'FL',
      endpoint: config.endpoint,
      totalFetched: 0,
      inserted: 0,
      skippedDup: 0,
      skippedInvalid: 0,
      dataAsOf: today,
      errors: [],
    };

    logger.info('[FloridaMunicipalSaleComps] Starting ingestion', {
      county,
      dateFrom,
      dateTo,
      minSalePrice,
    });

    let offset = 0;
    let done = false;

    while (!done) {
      try {
        let rawItems: any[];
        let pageDone: boolean;

        if (config.type === 'arcgis') {
          const page = await fetchArcGISPage(
            config as ArcGISCountyConfig,
            dateFrom,
            dateTo,
            minSalePrice,
            offset,
            pageSize
          );
          rawItems = page.features.map((f: any) => f.attributes ?? f);
          pageDone = page.done;
        } else {
          const page = await fetchSocrataPage(
            config as SocrataCountyConfig,
            dateFrom,
            dateTo,
            minSalePrice,
            offset,
            pageSize
          );
          rawItems = page.rows;
          pageDone = page.done;
        }

        if (rawItems.length === 0) break;
        result.totalFetched += rawItems.length;

        // Normalize
        const normalized: NormalizedSaleComp[] = [];
        for (const item of rawItems) {
          let comp: NormalizedSaleComp | null = null;
          if (config.type === 'arcgis') {
            comp = normalizeArcGISFeature(item, config as ArcGISCountyConfig, today);
          } else {
            comp = normalizeSocrataRow(item, config as SocrataCountyConfig, today);
          }

          if (!comp) {
            result.skippedInvalid++;
            continue;
          }
          normalized.push(comp);
        }

        // Upsert batch
        const { inserted, skipped } = await upsertComps(normalized);
        result.inserted += inserted;
        result.skippedDup += skipped;

        offset += rawItems.length;
        done = pageDone;

        logger.debug('[FloridaMunicipalSaleComps] Page processed', {
          county,
          offset,
          pageInserted: inserted,
          pageDup: skipped,
        });
      } catch (err) {
        const msg = err instanceof AxiosError
          ? `HTTP ${err.response?.status}: ${err.message} (${config.endpoint})`
          : String(err);
        result.errors.push(msg);
        logger.error('[FloridaMunicipalSaleComps] Page fetch error', { county, offset, error: msg });
        // Stop pagination on error — avoid partial-page loops
        break;
      }
    }

    logger.info('[FloridaMunicipalSaleComps] Ingestion complete', {
      county,
      totalFetched: result.totalFetched,
      inserted: result.inserted,
      skippedDup: result.skippedDup,
      skippedInvalid: result.skippedInvalid,
      errors: result.errors.length,
    });

    return result;
  }

  /**
   * Coverage stats for municipal comps already in the pool.
   */
  async getMunicipalStats(): Promise<Array<{
    county: string;
    state: string;
    total_comps: number;
    earliest_sale: string | null;
    latest_sale: string | null;
  }>> {
    const res = await dbQuery(`
      SELECT
        county, state,
        COUNT(*)::int                 AS total_comps,
        MIN(sale_date)::text          AS earliest_sale,
        MAX(sale_date)::text          AS latest_sale
      FROM market_sale_comps
      WHERE source = 'municipal'
      GROUP BY county, state
      ORDER BY state, county
    `);
    return res.rows;
  }
}

export const floridaMunicipalSaleCompsService = new FloridaMunicipalSaleCompsService();

/**
 * Fulton County / Atlanta municipal data availability note:
 *
 * Georgia is a "non-disclosure" state under O.C.G.A. § 48-5-15.
 * Property appraisers are NOT required to report sale prices.
 * Fulton County's ArcGIS open data layers:
 *   https://gisdata.fultoncountyga.gov/datasets/
 * expose parcel geometry, zoning, and assessment values but intentionally
 * omit sale price fields. Deed recordings (Clerk of Superior Court) list
 * grantor/grantee but not consideration (sale amount) in the public database.
 *
 * Conclusion: No equivalent municipal price feed exists for Atlanta-MSA (Fulton
 * County). CoStar, Real Capital Analytics, or broker network data remain the
 * only reliable sources for GA transaction pricing.
 */
