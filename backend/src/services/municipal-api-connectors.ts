import { query as dbQuery } from '../database/connection';

export interface CityAPIConfig {
  type: string;
  apiType?: string;
  name: string;
  state: string;
  serviceUrl: string;
  layerId: number;
  verified: boolean;
  fields: Record<string, string>;
}

export interface ZoningDistrictAPI {
  municipality_id: string;
  zoning_code: string;
  district_name: string;
  source: 'api';
  source_url: string;
  max_density?: number;
  max_height?: number;
}

export class ArcGISConnector {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async fetchLayer(layerId: number, outFields: string = '*'): Promise<Record<string, any>[]> {
    const allFeatures: Record<string, any>[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const queryUrl = `${this.baseUrl}/${layerId}/query`;
      const params = new URLSearchParams({
        where: '1=1',
        outFields,
        returnGeometry: 'false',
        f: 'json',
        resultOffset: offset.toString(),
        resultRecordCount: batchSize.toString(),
      });

      const response = await fetch(`${queryUrl}?${params.toString()}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(`ArcGIS Error: ${data.error.message}`);
      }

      const features = data.features || [];
      for (const feature of features) {
        allFeatures.push(feature.attributes || {});
      }

      if (features.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }

    console.log(`Fetched ${allFeatures.length} features from ArcGIS layer ${layerId}`);
    return allFeatures;
  }

  async queryByLocation(layerId: number, lat: number, lng: number, outFields: string = '*'): Promise<Record<string, any>[]> {
    const queryUrl = `${this.baseUrl}/${layerId}/query`;
    const params = new URLSearchParams({
      geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      outFields,
      returnGeometry: 'false',
      f: 'json',
    });

    const response = await fetch(`${queryUrl}?${params.toString()}`);
    const data = await response.json();

    if (data.error) {
      throw new Error(`ArcGIS Error: ${data.error.message}`);
    }

    return (data.features || []).map((f: any) => f.attributes || {});
  }
}

export const CITY_APIS: Record<string, CityAPIConfig> = {
  'atlanta-ga': {
    type: 'arcgis',
    name: 'Atlanta',
    state: 'GA',
    serviceUrl: 'https://dpcd.atlantaga.gov/arcgis/rest/services/OpenData/FeatureServer',
    layerId: 12,
    verified: true,
    fields: {
      code: 'ZONING_',
      name: 'NAME',
    },
  },
  'charlotte-nc': {
    type: 'arcgis',
    name: 'Charlotte',
    state: 'NC',
    serviceUrl: 'https://gisags.charlottenc.gov/arcgis/rest/services/OpenData/OpenData_Planning/MapServer',
    layerId: 0,
    verified: true,
    fields: {
      code: 'ZONE_CLASS',
      name: 'ZONE_CLASS',
    },
  },
  'dallas-tx': {
    type: 'arcgis',
    name: 'Dallas',
    state: 'TX',
    serviceUrl: 'https://gis.dallascityhall.com/arcgis/rest/services/OpenData/OpenData_Planning/MapServer',
    layerId: 0,
    verified: true,
    fields: {
      code: 'ZONE_DIST',
      name: 'ZONE_DIST',
    },
  },
  'san-antonio-tx': {
    type: 'arcgis',
    name: 'San Antonio',
    state: 'TX',
    serviceUrl: 'https://gis.sanantonio.gov/arcgis/rest/services/Planning/Zoning/MapServer',
    layerId: 0,
    verified: true,
    fields: {
      code: 'ZONING',
      name: 'ZONING',
    },
  },
  'nashville-tn': {
    type: 'arcgis',
    name: 'Nashville',
    state: 'TN',
    serviceUrl: 'https://maps.nashville.gov/arcgis/rest/services/Planning/Zoning/MapServer',
    layerId: 0,
    verified: true,
    fields: {
      code: 'ZONE_DESC',
      name: 'ZONE_DESC',
    },
  },
  'memphis-tn': {
    type: 'arcgis',
    name: 'Memphis',
    state: 'TN',
    serviceUrl: 'https://ags2.memphisn.gov/arcgis/rest/services/External/Planning/MapServer',
    layerId: 0,
    verified: true,
    fields: {
      code: 'ZONE_TYPE',
      name: 'ZONE_TYPE',
    },
  },
  'new-orleans-la': {
    type: 'arcgis',
    name: 'New Orleans',
    state: 'LA',
    serviceUrl: 'https://gis.nola.gov/arcgis/rest/services/apps/ZoningLookup/MapServer',
    layerId: 0,
    verified: true,
    fields: {
      code: 'BASE_ZONE',
      name: 'BASE_ZONE',
    },
  },
  'savannah-ga': {
    type: 'arcgis',
    name: 'Savannah',
    state: 'GA',
    serviceUrl: 'https://gismaps.savannahga.gov/arcgis/rest/services/OpenData/MapServer',
    layerId: 0,
    verified: true,
    fields: {
      code: 'ZONE',
      name: 'ZONE',
    },
  },
  'miami-dade-fl': {
    type: 'arcgis',
    name: 'Miami-Dade',
    state: 'FL',
    serviceUrl: 'https://gisweb.miamidade.gov/arcgis/rest/services/LandManagement/MD_Zoning/MapServer',
    layerId: 1,
    verified: true,
    fields: {
      code: 'ZONE',
      name: 'ZONE_DESC',
    },
  },
  'tampa-fl': {
    type: 'arcgis',
    name: 'Tampa',
    state: 'FL',
    serviceUrl: 'https://maps.hillsboroughcounty.org/arcgis/rest/services/DSD_Viewer_Services/DSD_Viewer_Zoning_Regulatory/FeatureServer',
    layerId: 1,
    verified: true,
    fields: {
      code: 'NZONE',
      name: 'NZONE_DESC',
    },
  },
  'fort-lauderdale-fl': {
    type: 'arcgis',
    name: 'Fort Lauderdale',
    state: 'FL',
    serviceUrl: 'https://gis.fortlauderdale.gov/arcgis/rest/services/GeneralPurpose/gisdata/MapServer',
    layerId: 108,
    verified: true,
    fields: {
      code: 'ZONECLASS',
      name: 'ZONEDESC',
    },
  },
  'palm-beach-fl': {
    type: 'arcgis',
    name: 'Palm Beach County',
    state: 'FL',
    serviceUrl: 'https://gis.pbcgov.org/arcgis/rest/services/PropertyAppraiser/PA_Parcels/MapServer',
    layerId: 0,
    verified: false,
    fields: {
      code: 'CURRENT_ZONING',
      name: 'CURRENT_ZONING',
    },
  },
  'pinellas-fl': {
    type: 'arcgis',
    name: 'Pinellas County',
    state: 'FL',
    serviceUrl: 'https://egis.pinellas.gov/gis/rest/services/AGO/PPC_Data/MapServer',
    layerId: 0,
    verified: true,
    fields: {
      code: 'ZONING',
      name: 'ZONING',
    },
  },
  'duval-fl': {
    type: 'arcgis',
    name: 'Duval County',
    state: 'FL',
    serviceUrl: 'https://maps.coj.net/coj/rest/services/CityBiz/Parcels/MapServer',
    layerId: 0,
    verified: true,
    fields: {
      code: 'ZON_LABEL',
      name: 'ZON_LABEL',
    },
  },
  'lee-fl': {
    type: 'arcgis',
    name: 'Lee County',
    state: 'FL',
    serviceUrl: 'https://gismapserver.leegov.com/gisserver910/rest/services/Layers/DCD_Zoning/MapServer',
    layerId: 0,
    verified: true,
    fields: {
      code: 'ZONING',
      name: 'ZONING',
    },
  },
  'polk-fl': {
    type: 'arcgis',
    name: 'Polk County',
    state: 'FL',
    serviceUrl: 'https://gis.polk-county.net/portal/sharing/rest/services',
    layerId: 0,
    verified: false,
    fields: {
      code: 'ZONING',
      name: 'ZONING',
    },
  },
  'brevard-fl': {
    type: 'arcgis',
    name: 'Brevard County',
    state: 'FL',
    serviceUrl: 'https://gis.brevardfl.gov/gissrv/rest/services/Planning_Development/Zoning_WKID2881/MapServer',
    layerId: 0,
    verified: true,
    fields: {
      code: 'ZONING',
      name: 'ZONING',
    },
  },
  'richmond-va': {
    type: 'arcgis',
    name: 'Richmond',
    state: 'VA',
    serviceUrl: 'https://services6.arcgis.com/StPsG80YRtvnlCJ8/arcgis/rest/services/Zoning/FeatureServer',
    layerId: 0,
    verified: true,
    fields: {
      code: 'Name',
      name: 'Name',
    },
  },
  'austin-tx': {
    type: 'arcgis',
    name: 'Austin',
    state: 'TX',
    serviceUrl: 'https://services.arcgis.com/0L95CJ0VTaxqcmED/ArcGIS/rest/services/ZONING/FeatureServer',
    layerId: 0,
    verified: false,
    fields: {
      code: 'ZONING_ZTYP',
      name: 'ZONING_ZTYP',
    },
  },
  'raleigh-nc': {
    type: 'arcgis',
    name: 'Raleigh',
    state: 'NC',
    serviceUrl: 'https://mapstest.raleighnc.gov/arcgis/rest/services/Planning/Zoning/MapServer',
    layerId: 0,
    verified: false,
    fields: {
      code: 'ZONING',
      name: 'ZONE_NAME',
    },
  },
  'charleston-sc': {
    type: 'arcgis',
    name: 'Charleston County',
    state: 'SC',
    serviceUrl: 'https://gis.charlestoncounty.org/arcgis/rest/services',
    layerId: 0,
    verified: false,
    fields: {
      code: 'ZONE_CLASS',
      name: 'ZONE_NAME',
    },
  },
  'virginia-beach-va': {
    type: 'arcgis',
    name: 'Virginia Beach',
    state: 'VA',
    serviceUrl: 'https://gis.vbgov.com/arcgis/rest/services',
    layerId: 0,
    verified: false,
    fields: {
      code: 'ZONING',
      name: 'ZONE_DESCRIPTION',
    },
  },
  'fulton-county-ga': {
    type: 'arcgis',
    apiType: 'assessment',
    name: 'Fulton County',
    state: 'GA',
    serviceUrl: 'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer',
    layerId: 0,
    verified: true,
    fields: {
      parcelId: 'ParcelID',
      address: 'Address',
      luCode: 'LUCode',
      classCode: 'ClassCode',
      owner: 'Owner',
      totalAssessed: 'TotAssess',
    },
  },
  'dekalb-county-ga': {
    type: 'arcgis',
    apiType: 'assessment',
    name: 'DeKalb County',
    state: 'GA',
    serviceUrl: 'https://gis.dekalbcountyga.gov/arcgis/rest/services/PropertyInformation/MapServer',
    layerId: 0,
    verified: true,
    fields: {
      parcelId: 'ParcelID',
      address: 'Address',
      owner: 'Owner',
    },
  },
  'orange-county-fl': {
    type: 'arcgis',
    name: 'Orange County',
    state: 'FL',
    serviceUrl: 'https://ocgis4.ocfl.net/arcgis/rest/services/Public_Dynamic/MapServer',
    layerId: 66,
    verified: true,
    fields: {
      code: 'ZONING',
      name: 'ZONING',
    },
  },
};

export async function fetchZoningData(municipalityId: string): Promise<ZoningDistrictAPI[]> {
  const config = CITY_APIS[municipalityId];
  
  if (!config) {
    throw new Error(`No API configuration for ${municipalityId}`);
  }

  if (config.apiType === 'assessment') {
    throw new Error(`${municipalityId} is an assessment API, not a zoning API. Use a different method to fetch parcel data.`);
  }

  if (!config.fields.code || !config.fields.name) {
    throw new Error(`${municipalityId} config is missing required fields.code or fields.name`);
  }

  console.log(`Fetching zoning data for ${config.name}, ${config.state} via ArcGIS API...`);

  const codeField = config.fields.code;
  const nameField = config.fields.name;
  const connector = new ArcGISConnector(config.serviceUrl);
  const rawData = await connector.fetchLayer(config.layerId, `${codeField},${nameField}`);

  const uniqueCodes = new Map<string, string>();
  for (const record of rawData) {
    const code = record[codeField];
    const name = record[nameField];
    if (code && !uniqueCodes.has(code)) {
      uniqueCodes.set(code, name || code);
    }
  }

  const districts: ZoningDistrictAPI[] = Array.from(uniqueCodes.entries()).map(([code, name]) => ({
    municipality_id: municipalityId,
    zoning_code: code,
    district_name: name,
    source: 'api' as const,
    source_url: config.serviceUrl,
  }));

  console.log(`Extracted ${districts.length} unique zoning districts from ${rawData.length} features`);
  return districts;
}

export async function lookupZoningByLocation(municipalityId: string, lat: number, lng: number): Promise<Record<string, any> | null> {
  const config = CITY_APIS[municipalityId];
  if (!config) return null;

  try {
    const connector = new ArcGISConnector(config.serviceUrl);
    const results = await connector.queryByLocation(config.layerId, lat, lng);
    if (results.length > 0) {
      return results[0];
    }
  } catch (error) {
    console.error(`Zoning lookup failed for ${municipalityId}:`, error);
  }
  return null;
}

export async function saveAPIDistricts(districts: ZoningDistrictAPI[]): Promise<number> {
  let saved = 0;

  for (const district of districts) {
    try {
      const cityConfig = CITY_APIS[district.municipality_id];
      const municipalityName = cityConfig?.name || district.municipality_id;
      const state = cityConfig?.state || '';

      await dbQuery(
        `INSERT INTO zoning_districts (
          municipality, state, district_code, district_name,
          municipality_id, zoning_code, category,
          max_units_per_acre, max_density_per_acre,
          max_building_height_ft, max_height_feet,
          source, source_url
        ) VALUES ($1, $2, $3, $4, $5, $3, 'api', $6, $6, $7, $7, $8, $9)
        ON CONFLICT (municipality, state, district_code)
        DO UPDATE SET
          district_name = EXCLUDED.district_name,
          municipality_id = EXCLUDED.municipality_id,
          zoning_code = EXCLUDED.zoning_code,
          max_units_per_acre = COALESCE(EXCLUDED.max_units_per_acre, zoning_districts.max_units_per_acre),
          max_density_per_acre = COALESCE(EXCLUDED.max_density_per_acre, zoning_districts.max_density_per_acre),
          max_building_height_ft = COALESCE(EXCLUDED.max_building_height_ft, zoning_districts.max_building_height_ft),
          max_height_feet = COALESCE(EXCLUDED.max_height_feet, zoning_districts.max_height_feet),
          source = EXCLUDED.source,
          source_url = EXCLUDED.source_url,
          updated_at = NOW()`,
        [
          municipalityName,
          state,
          district.zoning_code,
          district.district_name,
          district.municipality_id,
          district.max_density || null,
          district.max_height || null,
          district.source,
          district.source_url,
        ]
      );
      saved++;
    } catch (error: any) {
      console.error(`Failed to save district ${district.zoning_code}:`, error.message);
    }
  }

  console.log(`Saved ${saved}/${districts.length} API districts to database`);
  return saved;
}
