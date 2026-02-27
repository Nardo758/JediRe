import { Pool } from 'pg';
import { logger } from '../utils/logger';

interface CountyConnector {
  countyName: string;
  state: string;
  apiUrl: string;
  addressField: string;
  outFields: string[];
  fieldMappings: Record<string, string>;
  areaFromGeometry?: boolean;
  addressNormalizer?: (addr: string) => string;
}

interface EnrichmentResult {
  total: number;
  enriched: number;
  partiallyEnriched: number;
  failed: number;
  skipped: number;
  noConnector: number;
  byCounty: Record<string, { enriched: number; failed: number; skipped: number }>;
}

const COUNTY_CONNECTORS: CountyConnector[] = [
  {
    countyName: 'Fulton',
    state: 'GA',
    apiUrl: 'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query',
    addressField: 'Address',
    outFields: ['Address', 'LandAcres', 'ParcelID', 'TotAssess', 'LandAssess', 'ImprAssess', 'TotAppr', 'LandAppr', 'ImprAppr', 'TaxDist', 'LivUnits'],
    fieldMappings: {
      'LandAcres': 'land_acres',
      'ParcelID': 'parcel_id',
      'TotAssess': 'assessed_value',
      'LandAssess': 'assessed_land_value',
      'ImprAssess': 'assessed_improvement_value',
      'TotAppr': 'appraised_value',
      'TaxDist': 'tax_district',
      'LivUnits': '_units_backfill',
    },
  },
  {
    countyName: 'Hillsborough',
    state: 'FL',
    apiUrl: 'https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/HC_Parcels/MapServer/0/query',
    addressField: 'SITE_ADDR',
    outFields: ['SITE_ADDR', 'ACREAGE', 'HEAT_AR', 'ASD_VAL', 'TAX_VAL', 'MARKET_VAL', 'LAND', 'BLDG', 'tUNITS', 'tSTORIES', 'TAXDIST', 'S_AMT', 'S_DATE', 'FOLIO'],
    fieldMappings: {
      'ACREAGE': 'land_acres',
      'HEAT_AR': 'building_sf',
      'ASD_VAL': 'assessed_value',
      'LAND': 'assessed_land_value',
      'BLDG': 'assessed_improvement_value',
      'MARKET_VAL': 'appraised_value',
      'TAX_VAL': 'tax_value',
      'TAXDIST': 'tax_district',
      'S_AMT': 'last_sale_amount',
      'S_DATE': '_sale_date_epoch',
      'FOLIO': 'parcel_id',
      'tUNITS': '_units_backfill',
      'tSTORIES': '_stories_backfill',
    },
  },
  {
    countyName: 'Miami-Dade',
    state: 'FL',
    apiUrl: 'https://gis.miamidade.gov/arcgis/rest/services/LandManagement/MD_ZoningLandManagementViewer/MapServer/2/query',
    addressField: 'TRUE_SITE_ADDR',
    outFields: ['FOLIO', 'TRUE_SITE_ADDR', 'Shape.STArea()'],
    fieldMappings: {
      'FOLIO': 'parcel_id',
    },
    areaFromGeometry: true,
  },
];

function normalizeAddress(addr: string): string {
  return addr
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace(/,.*$/, '')
    .trim();
}

function extractStreetNumber(addr: string): string {
  const match = addr.match(/^(\d+)\s/);
  return match ? match[1] : '';
}

function extractStreetName(addr: string): string {
  return addr.replace(/^\d+\s+/, '').replace(/\s+(NW|NE|SW|SE|N|S|E|W)$/i, '').trim();
}

function sanitizeForArcGIS(value: string): string {
  return value.replace(/'/g, "''").replace(/[;\\]/g, '').substring(0, 100);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class BenchmarkEnrichmentService {
  constructor(private pool: Pool) {}

  getConnectorForCounty(county: string, state?: string): CountyConnector | null {
    const normalized = county.trim();
    return COUNTY_CONNECTORS.find(c => {
      const nameMatch = c.countyName.toLowerCase() === normalized.toLowerCase();
      if (state) {
        return nameMatch && c.state.toLowerCase() === state.trim().toLowerCase();
      }
      return nameMatch;
    }) || null;
  }

  private buildWhereClause(connector: CountyConnector, address: string): string {
    const normalized = normalizeAddress(address);
    const streetNum = sanitizeForArcGIS(extractStreetNumber(normalized));
    const streetName = sanitizeForArcGIS(extractStreetName(normalized));

    if (connector.countyName === 'Hillsborough' && streetNum) {
      const cleanStreet = streetName
        .replace(/\s+(BLVD|AVE|ST|DR|CT|LN|RD|WAY|PL|CIR|TRL|PKWY|HWY)$/i, '')
        .trim();
      if (cleanStreet) {
        return `str_num='${sanitizeForArcGIS(streetNum)}' AND str='${sanitizeForArcGIS(cleanStreet)}'`;
      }
    }

    if (connector.countyName === 'Fulton' && streetNum && streetName) {
      return `Address LIKE '${streetNum} ${streetName}%'`;
    }

    if (streetNum && streetName) {
      return `${connector.addressField} LIKE '${streetNum} ${streetName}%'`;
    }

    return `${connector.addressField} LIKE '${sanitizeForArcGIS(normalized)}%'`;
  }

  private async queryArcGIS(connector: CountyConnector, address: string): Promise<Record<string, any> | null> {
    const normalized = normalizeAddress(address);
    const whereClause = this.buildWhereClause(connector, address);

    const params = new URLSearchParams({
      where: whereClause,
      outFields: connector.outFields.join(','),
      f: 'json',
      returnGeometry: connector.areaFromGeometry ? 'false' : 'false',
    });

    if (connector.areaFromGeometry) {
      params.set('returnGeometry', 'false');
    }

    const url = `${connector.apiUrl}?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        logger.warn(`ArcGIS query failed for ${connector.countyName}: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json() as any;

      if (data.error) {
        logger.warn(`ArcGIS query error for ${connector.countyName}: ${data.error.message}`);
        return null;
      }

      const features = data.features || [];
      if (features.length === 0) {
        return null;
      }

      if (features.length === 1) {
        return features[0].attributes;
      }

      const exactMatch = features.find((f: any) => {
        const apiAddr = normalizeAddress(f.attributes[connector.addressField] || '');
        return apiAddr === normalized;
      });

      if (exactMatch) {
        return exactMatch.attributes;
      }

      return features[0].attributes;
    } catch (err: any) {
      logger.error(`ArcGIS fetch error for ${connector.countyName}: ${err.message}`);
      return null;
    }
  }

  private mapFieldsToUpdate(connector: CountyConnector, attributes: Record<string, any>): Record<string, any> {
    const updates: Record<string, any> = {};

    for (const [sourceField, targetColumn] of Object.entries(connector.fieldMappings)) {
      const rawKey = sourceField;
      let value = attributes[rawKey];

      if (value === undefined) {
        const altKey = Object.keys(attributes).find(k => k.toLowerCase() === rawKey.toLowerCase());
        if (altKey) value = attributes[altKey];
      }

      if (value === null || value === undefined) continue;

      if (targetColumn === '_sale_date_epoch' && typeof value === 'number') {
        updates['last_sale_date'] = new Date(value).toISOString().split('T')[0];
        continue;
      }

      if (targetColumn === '_units_backfill') {
        updates['_units_backfill'] = typeof value === 'number' ? Math.round(value) : null;
        continue;
      }

      if (targetColumn === '_stories_backfill') {
        updates['_stories_backfill'] = typeof value === 'number' ? Math.round(value) : null;
        continue;
      }

      updates[targetColumn] = value;
    }

    if (connector.areaFromGeometry) {
      const areaKey = Object.keys(attributes).find(k =>
        k.includes('STArea') || k.includes('Shape__Area') || k.includes('Shape.STArea')
      );
      if (areaKey && attributes[areaKey] && attributes[areaKey] > 0) {
        updates['land_acres'] = Math.round((attributes[areaKey] / 43560) * 10000) / 10000;
      }
    }

    return updates;
  }

  async enrichBenchmarkProjects(county?: string): Promise<EnrichmentResult> {
    const result: EnrichmentResult = {
      total: 0,
      enriched: 0,
      partiallyEnriched: 0,
      failed: 0,
      skipped: 0,
      noConnector: 0,
      byCounty: {},
    };

    let query = `
      SELECT id, address, county, state, unit_count, stories, land_acres, total_sf
      FROM benchmark_projects
      WHERE address IS NOT NULL AND address != ''
      AND enriched_at IS NULL
    `;
    const params: any[] = [];

    if (county) {
      query += ` AND county = $1`;
      params.push(county);
    }

    query += ` ORDER BY county, id`;

    const { rows } = await this.pool.query(query, params);
    result.total = rows.length;

    logger.info(`Benchmark enrichment: ${rows.length} records to process${county ? ` (county: ${county})` : ''}`);

    for (const row of rows) {
      const countyName = row.county;

      if (!result.byCounty[countyName]) {
        result.byCounty[countyName] = { enriched: 0, failed: 0, skipped: 0 };
      }

      const connector = this.getConnectorForCounty(countyName, row.state);
      if (!connector) {
        result.noConnector++;
        result.byCounty[countyName].skipped++;
        continue;
      }

      await sleep(500);

      try {
        const attributes = await this.queryArcGIS(connector, row.address);
        if (!attributes) {
          result.failed++;
          result.byCounty[countyName].failed++;
          logger.debug(`No ArcGIS match for: ${row.address} (${countyName})`);
          continue;
        }

        const updates = this.mapFieldsToUpdate(connector, attributes);

        const unitsBackfill = updates['_units_backfill'];
        const storiesBackfill = updates['_stories_backfill'];
        delete updates['_units_backfill'];
        delete updates['_stories_backfill'];

        if (unitsBackfill && (row.unit_count === null || row.unit_count === undefined || row.unit_count === 0)) {
          updates['unit_count'] = unitsBackfill;
        }
        if (storiesBackfill && (row.stories === null || row.stories === undefined || row.stories === 0)) {
          updates['stories'] = storiesBackfill;
        }

        if (updates['building_sf'] && (row.total_sf === null || row.total_sf === undefined || row.total_sf === 0)) {
          updates['total_sf'] = updates['building_sf'];
        }

        const landAcres = updates['land_acres'] !== undefined ? updates['land_acres'] : row.land_acres;
        const unitCount = updates['unit_count'] !== undefined ? updates['unit_count'] : row.unit_count;
        const buildingSf = updates['building_sf'] || updates['total_sf'] || row.total_sf;

        if (landAcres !== null && landAcres !== undefined && landAcres > 0 && unitCount !== null && unitCount !== undefined && unitCount > 0) {
          updates['density_achieved'] = Math.round((unitCount / landAcres) * 100) / 100;
        }
        if (landAcres !== null && landAcres !== undefined && landAcres > 0 && buildingSf !== null && buildingSf !== undefined && buildingSf > 0) {
          updates['far_achieved'] = Math.round((buildingSf / (landAcres * 43560)) * 1000) / 1000;
        }

        updates['enrichment_source'] = `arcgis_${connector.countyName.toLowerCase().replace(/[^a-z]/g, '_')}`;
        updates['enriched_at'] = new Date().toISOString();

        const validUpdates = Object.entries(updates).filter(([_, v]) => v !== null && v !== undefined);
        if (validUpdates.length === 0) {
          result.skipped++;
          result.byCounty[countyName].skipped++;
          continue;
        }

        const setClauses = validUpdates.map(([col], i) => `${col} = $${i + 2}`);
        const values = validUpdates.map(([_, v]) => v);

        await this.pool.query(
          `UPDATE benchmark_projects SET ${setClauses.join(', ')} WHERE id = $1`,
          [row.id, ...values]
        );

        const enrichedFieldCount = validUpdates.filter(([k]) => k !== 'enrichment_source' && k !== 'enriched_at').length;
        if (enrichedFieldCount >= 3) {
          result.enriched++;
        } else {
          result.partiallyEnriched++;
        }
        result.byCounty[countyName].enriched++;
      } catch (err: any) {
        result.failed++;
        result.byCounty[countyName].failed++;
        logger.error(`Enrichment error for record ${row.id} (${row.address}): ${err.message}`);
      }

      if ((result.enriched + result.partiallyEnriched + result.failed) % 50 === 0) {
        logger.info(`Enrichment progress: ${result.enriched + result.partiallyEnriched} enriched, ${result.failed} failed of ${result.total}`);
      }
    }

    logger.info(`Benchmark enrichment complete: ${JSON.stringify(result)}`);
    return result;
  }

  async enrichProperty(propertyId: string): Promise<{ enriched: boolean; reason?: string; fieldsUpdated?: number }> {
    const { rows } = await this.pool.query(
      `SELECT id, address_line1, county, state_code FROM properties WHERE id = $1`,
      [propertyId]
    );

    if (rows.length === 0) {
      return { enriched: false, reason: 'property_not_found' };
    }

    const property = rows[0];
    if (!property.address_line1) {
      return { enriched: false, reason: 'no_address' };
    }

    if (!property.county) {
      return { enriched: false, reason: 'no_county' };
    }

    const connector = this.getConnectorForCounty(property.county, property.state_code);
    if (!connector) {
      return { enriched: false, reason: 'no_connector_for_county' };
    }

    const attributes = await this.queryArcGIS(connector, property.address_line1);
    if (!attributes) {
      return { enriched: false, reason: 'no_arcgis_match' };
    }

    const fieldMap = this.mapFieldsToUpdate(connector, attributes);

    const propUpdates: Record<string, any> = {};
    const propFieldMap: Record<string, string> = {
      'land_acres': 'lot_acres',
      'parcel_id': 'parcel_id',
      'assessed_value': 'assessed_value',
      'assessed_land_value': 'assessed_land',
      'assessed_improvement_value': 'assessed_improvements',
      'appraised_value': 'appraised_value',
      'tax_district': 'tax_district',
      'building_sf': 'building_sf',
      'last_sale_amount': 'last_sale_amount',
      'last_sale_date': 'last_sale_date',
    };

    for (const [benchmarkCol, propCol] of Object.entries(propFieldMap)) {
      if (fieldMap[benchmarkCol] !== undefined && fieldMap[benchmarkCol] !== null) {
        propUpdates[propCol] = fieldMap[benchmarkCol];
      }
    }

    propUpdates['enrichment_source'] = `arcgis_${connector.countyName.toLowerCase().replace(/[^a-z]/g, '_')}`;
    propUpdates['enriched_at'] = new Date().toISOString();

    const validUpdates = Object.entries(propUpdates).filter(([_, v]) => v !== null && v !== undefined);
    if (validUpdates.length <= 2) {
      return { enriched: false, reason: 'no_useful_data_from_api' };
    }

    const setClauses = validUpdates.map(([col], i) => `${col} = $${i + 2}`);
    const values = validUpdates.map(([_, v]) => v);

    await this.pool.query(
      `UPDATE properties SET ${setClauses.join(', ')} WHERE id = $1`,
      [propertyId, ...values]
    );

    return {
      enriched: true,
      fieldsUpdated: validUpdates.filter(([k]) => k !== 'enrichment_source' && k !== 'enriched_at').length,
    };
  }
}
