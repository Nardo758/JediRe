import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

const ARCGIS_PAGE_SIZE = 1000;

interface CountyConfig {
  county: string;
  state: 'FL';
  municipalities: string[];
  hearings: {
    url: string;
    fields: {
      caseNumber: string;
      caseType: string;
      folio: string;
      address?: string;
      city?: string;
      year?: string;
      link?: string;
      status?: string;
    };
    where?: string;
  };
  permits?: {
    url: string;
    fields: {
      permitNumber: string;
      permitType: string;
      status: string;
      issued?: string;
      parcelNumber: string;
      address?: string;
      unitCount?: string;
      value?: string;
    };
    where?: string;
  };
  zoningUrl?: string;
  zoningLayerId?: number;
  zoningCodeField?: string;
}

const COUNTY_CONFIGS: Record<string, CountyConfig> = {
  'miami-dade': {
    county: 'Miami-Dade',
    state: 'FL',
    municipalities: ['Miami', 'Miami-Dade', 'Hialeah', 'Miami Beach', 'Coral Gables', 'Hollywood'],
    hearings: {
      url: 'https://gisweb.miamidade.gov/arcgis/rest/services/LandManagement/MD_ZoningLandManagementData/MapServer/0',
      fields: {
        caseNumber: 'PROC_NUM',
        caseType: 'CASE_TYPE',
        folio: 'FOLIO',
        address: 'LOC_ADDR',
        city: 'APPL_CITY',
        year: 'APPL_YEAR',
        link: 'APPL_LINK',
      },
      where: "APPL_YEAR >= '2020'",
    },
    zoningUrl: 'https://gisweb.miamidade.gov/arcgis/rest/services/LandManagement/MD_Zoning/MapServer',
    zoningLayerId: 1,
    zoningCodeField: 'ZONE',
  },
  'hillsborough': {
    county: 'Hillsborough',
    state: 'FL',
    municipalities: ['Tampa'],
    hearings: {
      url: 'https://maps.hillsboroughcounty.org/arcgis/rest/services/DSD_Zoning_Hearings/Zoning_Hearings/FeatureServer/0',
      fields: {
        caseNumber: 'AppNum',
        caseType: 'Type_',
        folio: 'FolioNumb',
        status: 'Status',
      },
      where: "Inactive <> 'Yes'",
    },
    permits: {
      url: 'https://maps.hillsboroughcounty.org/arcgis/rest/services/PermitsPlus/ResidentialCommericalIssuedPermitsCertOccMapService/FeatureServer/0',
      fields: {
        permitNumber: 'PERMIT__',
        permitType: 'PERMIT_TYPE',
        status: 'STATUS_1',
        issued: 'Issued',
        parcelNumber: 'PARCEL_NO',
        address: 'ADDRESS',
        unitCount: 'HOUSE_CNT',
        value: 'VAL_TOTAL',
      },
      where: "HOUSE_CNT >= 50",
    },
    zoningUrl: 'https://maps.hillsboroughcounty.org/arcgis/rest/services/DSD_Viewer_Services/DSD_Viewer_Zoning_Regulatory/FeatureServer',
    zoningLayerId: 1,
    zoningCodeField: 'NZONE',
  },
};

export interface FloridaIngestionStats {
  county: string;
  hearingsFetched: number;
  permitsFetched: number;
  recordsUpserted: number;
  districtsLinked: number;
  errors: string[];
}

async function arcgisQuery(url: string, params: Record<string, string>): Promise<any> {
  const queryUrl = new URL(`${url}/query`);
  queryUrl.searchParams.set('f', 'json');
  for (const [k, v] of Object.entries(params)) {
    queryUrl.searchParams.set(k, v);
  }

  const resp = await fetch(queryUrl.toString());
  if (!resp.ok) throw new Error(`ArcGIS query failed: ${resp.status}`);
  return resp.json();
}

async function paginatedQuery(url: string, where: string, outFields: string, returnGeometry: boolean = false): Promise<any[]> {
  const allFeatures: any[] = [];
  let offset = 0;

  while (true) {
    const data = await arcgisQuery(url, {
      where,
      outFields,
      returnGeometry: returnGeometry.toString(),
      outSR: '4326',
      resultOffset: offset.toString(),
      resultRecordCount: ARCGIS_PAGE_SIZE.toString(),
    });

    const features = data.features || [];
    allFeatures.push(...features);

    if (features.length < ARCGIS_PAGE_SIZE) break;
    offset += ARCGIS_PAGE_SIZE;
  }

  return allFeatures;
}

function mapStatus(status: string | null): string {
  if (!status) return 'unknown';
  const s = status.toUpperCase();
  if (s.includes('APPROVED') || s.includes('COMPLETE') || s === 'GRANTED') return 'approved';
  if (s.includes('DENIED') || s.includes('REJECT')) return 'denied';
  if (s.includes('WITHDRAWN') || s.includes('CANCEL')) return 'withdrawn';
  if (s.includes('PENDING') || s.includes('FILED') || s.includes('REVIEW') || s.includes('ACTIVE')) return 'pending';
  return 'unknown';
}

function mapCaseTypeToEntitlement(caseType: string | null): string {
  if (!caseType) return 'rezone';
  const ct = caseType.toUpperCase();
  if (ct.includes('REZONE') || ct.includes('REZONING') || ct.includes('MAP AMENDMENT') || ct.includes('ZM')) return 'rezone';
  if (ct.includes('VARIANCE') || ct.includes('ADMIN ADJUST')) return 'variance';
  if (ct.includes('SPECIAL USE') || ct.includes('CUP') || ct.includes('CONDITIONAL') || ct.includes('SUP')) return 'cup';
  if (ct.includes('VERIFICATION') || ct.includes('LETTER')) return 'verification';
  if (ct.includes('SITE PLAN')) return 'site_plan';
  return 'rezone';
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

export class FloridaBenchmarkIngestionService {
  private districtCache: Map<string, string | null> = new Map();

  private get pool() {
    return getPool();
  }

  getAvailableCounties(): string[] {
    return Object.keys(COUNTY_CONFIGS);
  }

  async ingest(countyId: string): Promise<FloridaIngestionStats> {
    const config = COUNTY_CONFIGS[countyId];
    if (!config) {
      throw new Error(`No configuration for county '${countyId}'. Available: ${Object.keys(COUNTY_CONFIGS).join(', ')}`);
    }

    const stats: FloridaIngestionStats = {
      county: config.county,
      hearingsFetched: 0,
      permitsFetched: 0,
      recordsUpserted: 0,
      districtsLinked: 0,
      errors: [],
    };

    try {
      logger.info(`[FL-Ingestion:${config.county}] Step 1: Fetching zoning hearings...`);
      const hearings = await this.fetchHearings(config);
      stats.hearingsFetched = hearings.length;
      logger.info(`[FL-Ingestion:${config.county}] Found ${hearings.length} zoning hearings`);

      logger.info(`[FL-Ingestion:${config.county}] Step 2: Upserting hearing records...`);
      for (const hearing of hearings) {
        try {
          const upserted = await this.upsertHearing(config, hearing);
          if (upserted) stats.recordsUpserted++;
        } catch (err) {
          const msg = `Error upserting hearing ${hearing.caseNumber}: ${(err as Error).message}`;
          stats.errors.push(msg);
        }
      }

      if (config.permits) {
        logger.info(`[FL-Ingestion:${config.county}] Step 3: Fetching permits...`);
        const permits = await this.fetchPermits(config);
        stats.permitsFetched = permits.length;
        logger.info(`[FL-Ingestion:${config.county}] Found ${permits.length} permits`);

        for (const permit of permits) {
          try {
            const upserted = await this.upsertPermit(config, permit);
            if (upserted) stats.recordsUpserted++;
          } catch (err) {
            const msg = `Error upserting permit ${permit.permitNumber}: ${(err as Error).message}`;
            stats.errors.push(msg);
          }
        }
      }

      logger.info(`[FL-Ingestion:${config.county}] Complete. Upserted ${stats.recordsUpserted} records.`);
    } catch (err) {
      const msg = `Ingestion failed: ${(err as Error).message}`;
      stats.errors.push(msg);
      logger.error(`[FL-Ingestion:${config.county}] ${msg}`);
    }

    return stats;
  }

  private async fetchHearings(config: CountyConfig): Promise<any[]> {
    const f = config.hearings.fields;
    const outFields = [f.caseNumber, f.caseType, f.folio, f.address, f.city, f.year, f.link, f.status]
      .filter(Boolean)
      .join(',');

    const features = await paginatedQuery(
      config.hearings.url,
      config.hearings.where || '1=1',
      outFields,
      true,
    );

    return features.map(feat => {
      const a = feat.attributes;
      return {
        caseNumber: a[f.caseNumber],
        caseType: a[f.caseType],
        folio: a[f.folio],
        address: f.address ? a[f.address] : null,
        city: f.city ? a[f.city] : null,
        year: f.year ? a[f.year] : null,
        link: f.link ? a[f.link] : null,
        status: f.status ? a[f.status] : null,
        geometry: feat.geometry,
      };
    }).filter(h => h.caseNumber);
  }

  private async fetchPermits(config: CountyConfig): Promise<any[]> {
    if (!config.permits) return [];

    const f = config.permits.fields;
    const outFields = [f.permitNumber, f.permitType, f.status, f.issued, f.parcelNumber, f.address, f.unitCount, f.value]
      .filter(Boolean)
      .join(',');

    const features = await paginatedQuery(
      config.permits.url,
      config.permits.where || '1=1',
      outFields,
      false,
    );

    return features.map(feat => {
      const a = feat.attributes;
      return {
        permitNumber: a[f.permitNumber],
        permitType: a[f.permitType],
        status: a[f.status],
        issued: f.issued ? a[f.issued] : null,
        parcelNumber: a[f.parcelNumber],
        address: f.address ? a[f.address] : null,
        unitCount: f.unitCount ? a[f.unitCount] : null,
        value: f.value ? a[f.value] : null,
      };
    }).filter(p => p.permitNumber);
  }

  private async lookupDistrictId(zoneCode: string, municipalities: string[]): Promise<string | null> {
    const normalized = zoneCode.trim().replace(/\s+/g, '-');
    const cacheKey = `${normalized}:${municipalities[0]}`;

    if (this.districtCache.has(cacheKey)) {
      return this.districtCache.get(cacheKey) || null;
    }

    const placeholders = municipalities.map((_, i) => `$${i + 2}`).join(',');
    const result = await this.pool.query(
      `SELECT id FROM zoning_districts
       WHERE UPPER(COALESCE(zoning_code, district_code)) = UPPER($1)
         AND municipality IN (${placeholders})
       LIMIT 1`,
      [normalized, ...municipalities]
    );

    const id = result.rows[0]?.id || null;
    this.districtCache.set(cacheKey, id);
    return id;
  }

  private async upsertHearing(config: CountyConfig, hearing: any): Promise<boolean> {
    if (!hearing.caseNumber) return false;

    const entitlementType = mapCaseTypeToEntitlement(hearing.caseType);
    if (entitlementType === 'verification') return false;

    const outcome = mapStatus(hearing.status);
    const municipality = hearing.city || config.municipalities[0];

    let applicationYear: number | null = null;
    if (hearing.year) {
      applicationYear = parseInt(hearing.year, 10);
      if (isNaN(applicationYear)) applicationYear = null;
    }

    const totalDays = 365;
    const phases = estimatePhases(totalDays);

    const applicationDate = applicationYear ? `${applicationYear}-01-01` : null;

    await this.pool.query(
      `INSERT INTO benchmark_projects (
        county, state, municipality, project_name, project_type,
        entitlement_type, total_entitlement_days, outcome,
        pre_app_days, site_plan_review_days, zoning_hearing_days, approval_days, permit_issuance_days,
        application_date, permit_number, source, source_url, confidence,
        address, docket_number
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20
      )
      ON CONFLICT (permit_number, source) WHERE permit_number IS NOT NULL
      DO UPDATE SET
        outcome = EXCLUDED.outcome,
        updated_at = NOW()`,
      [
        config.county, 'FL', municipality,
        `${hearing.address || hearing.folio || 'Unknown'} (${hearing.caseNumber})`,
        'multifamily',
        entitlementType, totalDays, outcome,
        phases.pre_app_days, phases.site_plan_review_days, phases.zoning_hearing_days,
        phases.approval_days, phases.permit_issuance_days,
        applicationDate,
        hearing.caseNumber, `florida_gis_${config.county.toLowerCase().replace(/[- ]/g, '_')}`,
        hearing.link || config.hearings.url,
        0.70,
        hearing.address, hearing.caseNumber,
      ]
    );

    return true;
  }

  private async upsertPermit(config: CountyConfig, permit: any): Promise<boolean> {
    if (!permit.permitNumber) return false;

    const totalDays = 180;
    const phases = estimatePhases(totalDays);
    const outcome = mapStatus(permit.status);

    let issuedDate: string | null = null;
    if (permit.issued) {
      const d = new Date(permit.issued);
      if (!isNaN(d.getTime())) {
        issuedDate = d.toISOString().split('T')[0];
      }
    }

    const unitCount = permit.unitCount ? Math.round(Number(permit.unitCount)) : null;
    const source = `florida_gis_${config.county.toLowerCase().replace(/[- ]/g, '_')}`;

    await this.pool.query(
      `INSERT INTO benchmark_projects (
        county, state, municipality, project_name, project_type, unit_count,
        entitlement_type, total_entitlement_days, outcome,
        pre_app_days, site_plan_review_days, zoning_hearing_days, approval_days, permit_issuance_days,
        approval_date, permit_number, source, source_url, confidence,
        parcel_id, address
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19,
        $20, $21
      )
      ON CONFLICT (permit_number, source) WHERE permit_number IS NOT NULL
      DO UPDATE SET
        unit_count = COALESCE(EXCLUDED.unit_count, benchmark_projects.unit_count),
        outcome = EXCLUDED.outcome,
        updated_at = NOW()`,
      [
        config.county, 'FL', config.municipalities[0],
        `${permit.address || permit.parcelNumber || 'Unknown'} (${permit.permitNumber})`,
        'multifamily',
        unitCount,
        'by_right', totalDays, outcome,
        phases.pre_app_days, phases.site_plan_review_days, phases.zoning_hearing_days,
        phases.approval_days, phases.permit_issuance_days,
        issuedDate,
        permit.permitNumber, source,
        config.permits!.url,
        0.60,
        permit.parcelNumber, permit.address,
      ]
    );

    return true;
  }
}

export const floridaBenchmarkIngestionService = new FloridaBenchmarkIngestionService();
