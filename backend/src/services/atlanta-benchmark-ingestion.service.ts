import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

const ATLANTA_GIS_BASE = 'https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LandUsePlanning/MapServer';
const FULTON_TAX_BASE = 'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0';
const LAND_USE_AMENDMENTS_BASE = 'https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/Landuse_Amendments/MapServer/0';

const REZONING_LAYER = 10;
const SUP_LAYER = 11;
const ADMIN_PERMIT_LAYER = 23;

const ARCGIS_PAGE_SIZE = 1000;

interface TaxParcel {
  ParcelID: string;
  Address: string;
  Owner: string;
  LivUnits: number;
  LUCode: string;
  LandAcres: number;
  TotAssess: number;
  centroid: [number, number] | null;
}

interface RezoningCase {
  DOCKET_NO: string;
  FROM_ZONE: string;
  TO_ZONE: string;
  STATUS: string;
  CREATED_DATE: number | null;
  FINAL_UPDA: number | null;
  ORDINANCE: string | null;
  ORDHYPERLINK: string | null;
  ACRES: number | null;
}

interface SUPRecord {
  SUP_DOCKET: string;
  SUP_TYPE: string;
  DATE_APP: number | null;
  APPSTATUS: string;
  ORDINANCE: string | null;
  ADDRESS: string;
}

interface AdminPermitRecord {
  RECORD_ID: string;
  RECORD_TYP: string;
  OPEN_DATE_: number | null;
  PARCELID: string;
}

export interface IngestionStats {
  parcelsScanned: number;
  rezoningsMatched: number;
  districtsLinked: number;
  supsMatched: number;
  adminPermitsMatched: number;
  totalUpserted: number;
  errors: string[];
}

async function arcgisQuery(baseUrl: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${baseUrl}/query`);
  url.searchParams.set('f', 'json');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`ArcGIS query failed: ${resp.status}`);
  return resp.json();
}

async function arcgisQueryLayer(layerUrl: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${layerUrl}/query`);
  url.searchParams.set('f', 'json');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`ArcGIS query failed: ${resp.status}`);
  return resp.json();
}

async function paginatedQuery(baseUrl: string, where: string, outFields: string, returnGeometry: boolean = false, outSR: string = '4326'): Promise<any[]> {
  const allFeatures: any[] = [];
  let offset = 0;

  while (true) {
    const params: Record<string, string> = {
      where,
      outFields,
      returnGeometry: returnGeometry.toString(),
      outSR,
      resultOffset: offset.toString(),
      resultRecordCount: ARCGIS_PAGE_SIZE.toString(),
    };

    const data = await arcgisQueryLayer(baseUrl, params);
    const features = data.features || [];
    allFeatures.push(...features);

    if (features.length < ARCGIS_PAGE_SIZE) break;
    offset += ARCGIS_PAGE_SIZE;
  }

  return allFeatures;
}

function computeCentroid(geometry: any): [number, number] | null {
  if (!geometry) return null;

  if (geometry.x != null && geometry.y != null) {
    return [geometry.x, geometry.y];
  }

  if (geometry.rings && geometry.rings.length > 0) {
    const ring = geometry.rings[0];
    if (ring.length === 0) return null;
    const sumLng = ring.reduce((s: number, p: number[]) => s + p[0], 0);
    const sumLat = ring.reduce((s: number, p: number[]) => s + p[1], 0);
    return [sumLng / ring.length, sumLat / ring.length];
  }

  return null;
}

function mapStatus(status: string | null): string {
  if (!status) return 'unknown';
  const s = status.toUpperCase();
  if (s === 'COMPLETE' || s === 'APPROVED') return 'approved';
  if (s === 'DENIED') return 'denied';
  if (s === 'WITHDRAWN') return 'withdrawn';
  if (s === 'FILED' || s === 'PENDING' || s === 'IN REVIEW') return 'pending';
  return 'modified';
}

function normalizeZoneCode(raw: string | null): string | null {
  if (!raw) return null;
  let code = raw.trim();
  if (code.includes(',')) {
    code = code.split(',')[0].trim();
  }
  code = code.replace(/\s+/g, '-');
  return code;
}

function estimatePhases(totalDays: number) {
  return {
    pre_app_days: Math.round(totalDays * 0.10),
    site_plan_review_days: Math.round(totalDays * 0.20),
    zoning_hearing_days: Math.round(totalDays * 0.25),
    approval_days: Math.round(totalDays * 0.20),
    permit_issuance_days: Math.round(totalDays * 0.25),
  };
}

export class AtlantaBenchmarkIngestionService {
  private districtCache: Map<string, { id: string; district_code: string } | null> = new Map();

  private get pool() {
    return getPool();
  }

  async ingest(): Promise<IngestionStats> {
    const stats: IngestionStats = {
      parcelsScanned: 0,
      rezoningsMatched: 0,
      districtsLinked: 0,
      supsMatched: 0,
      adminPermitsMatched: 0,
      totalUpserted: 0,
      errors: [],
    };

    try {
      logger.info('[AtlantaIngestion] Step 1: Pulling 100+ unit tax parcels...');
      const parcels = await this.fetchTaxParcels();
      stats.parcelsScanned = parcels.length;
      logger.info(`[AtlantaIngestion] Found ${parcels.length} parcels with 100+ units`);

      logger.info('[AtlantaIngestion] Step 2: Fetching rezoning cases (last 5 years)...');
      const rezonings = await this.fetchRezoningCases();
      logger.info(`[AtlantaIngestion] Found ${rezonings.length} rezoning cases`);

      logger.info('[AtlantaIngestion] Step 3: Fetching SUPs...');
      const sups = await this.fetchSUPs();
      logger.info(`[AtlantaIngestion] Found ${sups.length} SUP records`);

      logger.info('[AtlantaIngestion] Step 4: Fetching admin permits...');
      const adminPermits = await this.fetchAdminPermits();
      logger.info(`[AtlantaIngestion] Found ${adminPermits.length} admin permit records`);

      const supsByAddress = new Map<string, SUPRecord[]>();
      for (const sup of sups) {
        if (!sup.ADDRESS) continue;
        const key = sup.ADDRESS.toUpperCase().trim();
        if (!supsByAddress.has(key)) supsByAddress.set(key, []);
        supsByAddress.get(key)!.push(sup);
      }

      const adminByParcel = new Map<string, AdminPermitRecord[]>();
      for (const ap of adminPermits) {
        if (!ap.PARCELID) continue;
        const key = ap.PARCELID.trim();
        if (!adminByParcel.has(key)) adminByParcel.set(key, []);
        adminByParcel.get(key)!.push(ap);
      }

      logger.info('[AtlantaIngestion] Step 5: Spatial-matching parcels to rezonings...');
      const parcelRezonings = this.spatialMatchParcelsToRezonings(parcels, rezonings);
      stats.rezoningsMatched = parcelRezonings.size;
      logger.info(`[AtlantaIngestion] Matched ${parcelRezonings.size} parcels to rezoning cases`);

      logger.info('[AtlantaIngestion] Step 6: Upserting benchmark records...');

      for (const [parcelIdx, matchedRezonings] of parcelRezonings.entries()) {
        const parcel = parcels[parcelIdx];

        for (const rz of matchedRezonings) {
          try {
            const result = await this.upsertBenchmarkFromRezoning(parcel, rz, supsByAddress, adminByParcel, stats);
            if (result) stats.totalUpserted++;
          } catch (err) {
            const msg = `Error upserting ${rz.DOCKET_NO}: ${(err as Error).message}`;
            stats.errors.push(msg);
            logger.error(`[AtlantaIngestion] ${msg}`);
          }
        }
      }

      for (const parcel of parcels) {
        const addrKey = parcel.Address?.toUpperCase().trim();
        const matchedSups = addrKey ? supsByAddress.get(addrKey) : undefined;
        if (!matchedSups) continue;

        const alreadyHasBenchmark = Array.from(parcelRezonings.values()).some(rzList =>
          rzList.some(rz => {
            const supMatch = addrKey ? supsByAddress.get(addrKey) : undefined;
            return supMatch && supMatch.some(s => s.SUP_DOCKET === matchedSups[0]?.SUP_DOCKET);
          })
        );

        for (const sup of matchedSups) {
          try {
            const existing = await this.pool.query(
              `SELECT id FROM benchmark_projects WHERE permit_number = $1 AND source = 'atlanta_gis'`,
              [sup.SUP_DOCKET]
            );
            if (existing.rows.length > 0) continue;

            await this.upsertBenchmarkFromSUP(parcel, sup, adminByParcel, stats);
            stats.totalUpserted++;
            stats.supsMatched++;
          } catch (err) {
            const msg = `Error upserting SUP ${sup.SUP_DOCKET}: ${(err as Error).message}`;
            stats.errors.push(msg);
          }
        }
      }

      logger.info(`[AtlantaIngestion] Complete. Upserted ${stats.totalUpserted} records.`);
    } catch (err) {
      const msg = `Ingestion failed: ${(err as Error).message}`;
      stats.errors.push(msg);
      logger.error(`[AtlantaIngestion] ${msg}`);
    }

    return stats;
  }

  private async fetchTaxParcels(): Promise<TaxParcel[]> {
    const features = await paginatedQuery(
      FULTON_TAX_BASE,
      'LivUnits >= 100',
      'ParcelID,Address,Owner,LivUnits,LUCode,LandAcres,TotAssess',
      true,
      '4326'
    );

    return features.map(f => ({
      ParcelID: f.attributes.ParcelID,
      Address: f.attributes.Address,
      Owner: f.attributes.Owner,
      LivUnits: f.attributes.LivUnits,
      LUCode: f.attributes.LUCode,
      LandAcres: f.attributes.LandAcres,
      TotAssess: f.attributes.TotAssess,
      centroid: computeCentroid(f.geometry),
    }));
  }

  private async fetchRezoningCases(): Promise<(RezoningCase & { geometry: any })[]> {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const ts = fiveYearsAgo.toISOString().split('T')[0];

    const features = await paginatedQuery(
      `${ATLANTA_GIS_BASE}/${REZONING_LAYER}`,
      `CREATED_DATE > timestamp '${ts} 00:00:00'`,
      'DOCKET_NO,FROM_ZONE,TO_ZONE,STATUS,CREATED_DATE,FINAL_UPDA,ORDINANCE,ORDHYPERLINK,ACRES',
      true,
      '4326'
    );

    return features.map(f => ({
      ...f.attributes,
      geometry: f.geometry,
    }));
  }

  private async fetchSUPs(): Promise<SUPRecord[]> {
    const features = await paginatedQuery(
      `${ATLANTA_GIS_BASE}/${SUP_LAYER}`,
      '1=1',
      'SUP_DOCKET,SUP_TYPE,DATE_APP,APPSTATUS,ORDINANCE,ADDRESS',
      false
    );

    return features.map(f => f.attributes);
  }

  private async fetchAdminPermits(): Promise<AdminPermitRecord[]> {
    const features = await paginatedQuery(
      `${ATLANTA_GIS_BASE}/${ADMIN_PERMIT_LAYER}`,
      '1=1',
      'RECORD_ID,RECORD_TYP,OPEN_DATE_,PARCELID',
      false
    );

    return features.map(f => f.attributes);
  }

  private spatialMatchParcelsToRezonings(
    parcels: TaxParcel[],
    rezonings: (RezoningCase & { geometry: any })[]
  ): Map<number, RezoningCase[]> {
    const matches = new Map<number, RezoningCase[]>();

    const validRezonings = rezonings.filter(rz =>
      rz.geometry?.rings && Array.isArray(rz.geometry.rings) && rz.geometry.rings.length > 0
      && Array.isArray(rz.geometry.rings[0]) && rz.geometry.rings[0].length > 2
    );

    logger.info(`[AtlantaIngestion] Spatial match: ${parcels.length} parcels, ${validRezonings.length} valid rezonings (of ${rezonings.length} total)`);

    let parcelsWithCentroid = 0;
    for (let i = 0; i < parcels.length; i++) {
      const centroid = parcels[i].centroid;
      if (!centroid) continue;
      parcelsWithCentroid++;

      const [lng, lat] = centroid;

      for (const rz of validRezonings) {
        try {
          if (this.pointInPolygon(lng, lat, rz.geometry.rings[0])) {
            if (!matches.has(i)) matches.set(i, []);
            matches.get(i)!.push(rz);
          }
        } catch {
        }
      }
    }

    logger.info(`[AtlantaIngestion] Parcels with centroids: ${parcelsWithCentroid}, matches found: ${matches.size}`);
    return matches;
  }

  private pointInPolygon(x: number, y: number, ring: number[][]): boolean {
    if (!ring || ring.length < 3) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];

      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  private async lookupDistrictId(zoneCode: string): Promise<string | null> {
    const normalized = normalizeZoneCode(zoneCode);
    if (!normalized) return null;

    if (this.districtCache.has(normalized)) {
      return this.districtCache.get(normalized)?.id || null;
    }

    const result = await this.pool.query(
      `SELECT id, district_code FROM zoning_districts
       WHERE UPPER(COALESCE(zoning_code, district_code)) = UPPER($1)
         AND (municipality = 'Atlanta' OR municipality ILIKE '%atlanta%')
       LIMIT 1`,
      [normalized]
    );

    const row = result.rows[0] || null;
    this.districtCache.set(normalized, row);
    return row?.id || null;
  }

  private async upsertBenchmarkFromRezoning(
    parcel: TaxParcel,
    rz: RezoningCase,
    supsByAddress: Map<string, SUPRecord[]>,
    adminByParcel: Map<string, AdminPermitRecord[]>,
    stats: IngestionStats
  ): Promise<boolean> {
    if (!rz.DOCKET_NO) return false;

    const fromCode = normalizeZoneCode(rz.FROM_ZONE);
    const toCode = normalizeZoneCode(rz.TO_ZONE);

    let totalDays: number | null = null;
    let applicationDate: Date | null = null;
    let approvalDate: Date | null = null;

    if (rz.CREATED_DATE) {
      applicationDate = new Date(rz.CREATED_DATE);
    }
    if (rz.FINAL_UPDA) {
      approvalDate = new Date(rz.FINAL_UPDA);
    }
    if (applicationDate && approvalDate) {
      totalDays = Math.round((approvalDate.getTime() - applicationDate.getTime()) / (1000 * 60 * 60 * 24));
      if (totalDays < 0) totalDays = null;
    }

    if (totalDays === null || totalDays === 0) {
      totalDays = 365;
    }

    const phases = estimatePhases(totalDays);
    const outcome = mapStatus(rz.STATUS);

    const fromDistrictId = fromCode ? await this.lookupDistrictId(fromCode) : null;
    const toDistrictId = toCode ? await this.lookupDistrictId(toCode) : null;

    if (fromDistrictId || toDistrictId) stats.districtsLinked++;

    const addrKey = parcel.Address?.toUpperCase().trim();
    const matchedSup = addrKey ? supsByAddress.get(addrKey)?.[0] : undefined;
    if (matchedSup) stats.supsMatched++;

    const parcelKey = parcel.ParcelID?.trim();
    const matchedAdmin = parcelKey ? adminByParcel.get(parcelKey)?.[0] : undefined;
    if (matchedAdmin) stats.adminPermitsMatched++;

    await this.pool.query(
      `INSERT INTO benchmark_projects (
        county, state, municipality, project_name, project_type, unit_count,
        entitlement_type, zoning_from, zoning_to,
        pre_app_days, site_plan_review_days, zoning_hearing_days, approval_days, permit_issuance_days,
        total_entitlement_days, outcome,
        application_date, approval_date, permit_number, source, source_url, confidence,
        zoning_from_district_id, zoning_to_district_id,
        parcel_id, address, land_acres, assessed_value, owner,
        docket_number, ordinance_number, ordinance_url,
        sup_docket, sup_type, admin_permit_id, admin_permit_type
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16,
        $17, $18, $19, $20, $21, $22,
        $23, $24,
        $25, $26, $27, $28, $29,
        $30, $31, $32,
        $33, $34, $35, $36
      )
      ON CONFLICT (permit_number, source) WHERE permit_number IS NOT NULL
      DO UPDATE SET
        unit_count = EXCLUDED.unit_count,
        zoning_from = EXCLUDED.zoning_from,
        zoning_to = EXCLUDED.zoning_to,
        zoning_from_district_id = EXCLUDED.zoning_from_district_id,
        zoning_to_district_id = EXCLUDED.zoning_to_district_id,
        total_entitlement_days = EXCLUDED.total_entitlement_days,
        outcome = EXCLUDED.outcome,
        assessed_value = EXCLUDED.assessed_value,
        updated_at = NOW()`,
      [
        'Fulton', 'GA', 'Atlanta',
        `${parcel.Address || 'Unknown'} (${rz.DOCKET_NO})`,
        'multifamily',
        parcel.LivUnits,
        'rezone',
        fromCode, toCode,
        phases.pre_app_days, phases.site_plan_review_days, phases.zoning_hearing_days,
        phases.approval_days, phases.permit_issuance_days,
        totalDays, outcome,
        applicationDate?.toISOString().split('T')[0] || null,
        approvalDate?.toISOString().split('T')[0] || null,
        rz.DOCKET_NO, 'atlanta_gis',
        `${ATLANTA_GIS_BASE}/${REZONING_LAYER}`,
        0.85,
        fromDistrictId, toDistrictId,
        parcel.ParcelID, parcel.Address,
        parcel.LandAcres, parcel.TotAssess, parcel.Owner,
        rz.DOCKET_NO, rz.ORDINANCE, rz.ORDHYPERLINK,
        matchedSup?.SUP_DOCKET || null, matchedSup?.SUP_TYPE || null,
        matchedAdmin?.RECORD_ID || null, matchedAdmin?.RECORD_TYP || null,
      ]
    );

    return true;
  }

  private async upsertBenchmarkFromSUP(
    parcel: TaxParcel,
    sup: SUPRecord,
    adminByParcel: Map<string, AdminPermitRecord[]>,
    stats: IngestionStats
  ): Promise<void> {
    let totalDays = 180;
    let applicationDate: Date | null = null;

    if (sup.DATE_APP) {
      applicationDate = new Date(sup.DATE_APP);
    }

    const outcome = mapStatus(sup.APPSTATUS);
    const phases = estimatePhases(totalDays);

    const parcelKey = parcel.ParcelID?.trim();
    const matchedAdmin = parcelKey ? adminByParcel.get(parcelKey)?.[0] : undefined;
    if (matchedAdmin) stats.adminPermitsMatched++;

    await this.pool.query(
      `INSERT INTO benchmark_projects (
        county, state, municipality, project_name, project_type, unit_count,
        entitlement_type, total_entitlement_days, outcome,
        pre_app_days, site_plan_review_days, zoning_hearing_days, approval_days, permit_issuance_days,
        application_date, permit_number, source, source_url, confidence,
        parcel_id, address, land_acres, assessed_value, owner,
        sup_docket, sup_type, admin_permit_id, admin_permit_type
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24,
        $25, $26, $27, $28
      )
      ON CONFLICT (permit_number, source) WHERE permit_number IS NOT NULL
      DO NOTHING`,
      [
        'Fulton', 'GA', 'Atlanta',
        `${parcel.Address || 'Unknown'} (${sup.SUP_DOCKET})`,
        'multifamily',
        parcel.LivUnits,
        'cup',
        totalDays, outcome,
        phases.pre_app_days, phases.site_plan_review_days, phases.zoning_hearing_days,
        phases.approval_days, phases.permit_issuance_days,
        applicationDate?.toISOString().split('T')[0] || null,
        sup.SUP_DOCKET, 'atlanta_gis',
        `${ATLANTA_GIS_BASE}/${SUP_LAYER}`,
        0.70,
        parcel.ParcelID, parcel.Address,
        parcel.LandAcres, parcel.TotAssess, parcel.Owner,
        sup.SUP_DOCKET, sup.SUP_TYPE,
        matchedAdmin?.RECORD_ID || null, matchedAdmin?.RECORD_TYP || null,
      ]
    );
  }
}

export const atlantaBenchmarkIngestionService = new AtlantaBenchmarkIngestionService();
