/**
 * Municipal Open Data API Connectors
 * 
 * Connects to 17 cities with available APIs:
 * - 9 Socrata Open Data cities
 * - 8 ArcGIS REST API cities
 */

import axios from 'axios';
import { getPool } from '../database/connection';

const pool = getPool();

interface ZoningDistrictAPI {
  municipality_id: string;
  zoning_code: string;
  district_name: string;
  geometry?: any; // GeoJSON
  max_density_per_acre?: number;
  max_far?: number;
  max_height_feet?: number;
  max_stories?: number;
  min_parking_per_unit?: number;
  source: 'api';
  source_url: string;
}

/**
 * Socrata Open Data API Connector
 * Used by: Charlotte, Raleigh, Austin, Dallas, San Antonio, Nashville, Memphis, Richmond, New Orleans
 */
export class SocrataConnector {
  private baseUrl: string;
  private appToken?: string;

  constructor(baseUrl: string, appToken?: string) {
    this.baseUrl = baseUrl;
    this.appToken = appToken;
  }

  /**
   * Fetch zoning districts dataset
   */
  async fetchZoningDistricts(datasetId: string): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/resource/${datasetId}.json`;
      const headers: any = {
        'Accept': 'application/json',
      };

      if (this.appToken) {
        headers['X-App-Token'] = this.appToken;
      }

      const response = await axios.get(url, {
        headers,
        params: {
          $limit: 10000, // Socrata default limit
        },
      });

      console.log(`Fetched ${response.data.length} records from Socrata`);
      return response.data;

    } catch (error) {
      console.error('Socrata API error:', error);
      throw error;
    }
  }

  /**
   * Query zoning by address
   */
  async queryByAddress(datasetId: string, address: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/resource/${datasetId}.json`;
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          ...(this.appToken && { 'X-App-Token': this.appToken }),
        },
        params: {
          $where: `address like '%${address.replace(/'/g, "''")}%'`,
          $limit: 1,
        },
      });

      return response.data[0] || null;

    } catch (error) {
      console.error('Socrata query error:', error);
      return null;
    }
  }
}

/**
 * ArcGIS REST API Connector
 * Used by: Atlanta, Miami-Dade, Tampa, Houston, Charleston, Virginia Beach
 */
export class ArcGISConnector {
  private serviceUrl: string;
  private token?: string;

  constructor(serviceUrl: string, token?: string) {
    this.serviceUrl = serviceUrl;
    this.token = token;
  }

  /**
   * Fetch all features from a layer
   */
  async fetchLayer(layerId: number): Promise<any[]> {
    try {
      const url = `${this.serviceUrl}/${layerId}/query`;
      
      const response = await axios.get(url, {
        params: {
          where: '1=1', // All records
          outFields: '*',
          returnGeometry: 'true',
          f: 'json',
          ...(this.token && { token: this.token }),
        },
      });

      const features = response.data.features || [];
      console.log(`Fetched ${features.length} features from ArcGIS layer ${layerId}`);
      
      return features.map((f: any) => ({
        ...f.attributes,
        geometry: f.geometry,
      }));

    } catch (error) {
      console.error('ArcGIS API error:', error);
      throw error;
    }
  }

  /**
   * Query by location (lat/lng)
   */
  async queryByLocation(
    layerId: number, 
    lat: number, 
    lng: number
  ): Promise<any> {
    try {
      const url = `${this.serviceUrl}/${layerId}/query`;
      
      const response = await axios.get(url, {
        params: {
          geometry: `${lng},${lat}`,
          geometryType: 'esriGeometryPoint',
          spatialRel: 'esriSpatialRelIntersects',
          outFields: '*',
          returnGeometry: 'true',
          f: 'json',
          ...(this.token && { token: this.token }),
        },
      });

      const features = response.data.features || [];
      return features[0] ? {
        ...features[0].attributes,
        geometry: features[0].geometry,
      } : null;

    } catch (error) {
      console.error('ArcGIS query error:', error);
      return null;
    }
  }
}

/**
 * City-Specific API Configurations
 */
export const CITY_APIS = {
  // SOCRATA CITIES (9)
  'charlotte-nc': {
    type: 'socrata',
    name: 'Charlotte',
    state: 'NC',
    baseUrl: 'https://data.charlottenc.gov',
    zoningDatasetId: 'mqn8-5tr8', // Example - need to verify actual ID
    fields: {
      code: 'zoning',
      name: 'zone_desc',
    },
  },
  'raleigh-nc': {
    type: 'socrata',
    name: 'Raleigh',
    state: 'NC',
    baseUrl: 'https://data.wakegov.com',
    zoningDatasetId: 'v6uk-5bq4',
    fields: {
      code: 'zoning',
      name: 'zone_name',
    },
  },
  'austin-tx': {
    type: 'socrata',
    name: 'Austin',
    state: 'TX',
    baseUrl: 'https://data.austintexas.gov',
    zoningDatasetId: '666d-9rbs',
    fields: {
      code: 'zoning_ztyp',
      name: 'zoning_ztyp',
    },
  },
  'dallas-tx': {
    type: 'socrata',
    name: 'Dallas',
    state: 'TX',
    baseUrl: 'https://www.dallasopendata.com',
    zoningDatasetId: 'nc6z-5m6r',
    fields: {
      code: 'zoning',
      name: 'zoning_name',
    },
  },
  'san-antonio-tx': {
    type: 'socrata',
    name: 'San Antonio',
    state: 'TX',
    baseUrl: 'https://data.sanantonio.gov',
    zoningDatasetId: '7afm-x3gc',
    fields: {
      code: 'zoning_code',
      name: 'zoning_desc',
    },
  },
  'nashville-tn': {
    type: 'socrata',
    name: 'Nashville',
    state: 'TN',
    baseUrl: 'https://data.nashville.gov',
    zoningDatasetId: 'n8fx-2vve',
    fields: {
      code: 'zoning',
      name: 'zone_overlay',
    },
  },
  'memphis-tn': {
    type: 'socrata',
    name: 'Memphis',
    state: 'TN',
    baseUrl: 'https://data.memphistn.gov',
    zoningDatasetId: 'p7ja-9xrj',
    fields: {
      code: 'zoning',
      name: 'zone_class',
    },
  },
  'richmond-va': {
    type: 'socrata',
    name: 'Richmond',
    state: 'VA',
    baseUrl: 'https://data.richmondva.gov',
    zoningDatasetId: 'vqwy-fqvw',
    fields: {
      code: 'zoning',
      name: 'zone_name',
    },
  },
  'new-orleans-la': {
    type: 'socrata',
    name: 'New Orleans',
    state: 'LA',
    baseUrl: 'https://data.nola.gov',
    zoningDatasetId: 'y8hr-48qf',
    fields: {
      code: 'zoning',
      name: 'zonedesc',
    },
  },

  // ARCGIS CITIES (8)
  'atlanta-ga': {
    type: 'arcgis',
    name: 'Atlanta',
    state: 'GA',
    serviceUrl: 'https://gis.atlantaga.gov/dpcd/rest/services',
    layerId: 0, // Zoning layer
    fields: {
      code: 'ZONE_CLASS',
      name: 'ZONE_NAME',
      density: 'MAX_DU_AC',
      height: 'MAX_HEIGHT',
    },
  },
  'miami-dade-fl': {
    type: 'arcgis',
    name: 'Miami-Dade',
    state: 'FL',
    serviceUrl: 'https://gis.mdc.opendata.arcgis.com/datasets',
    layerId: 0,
    fields: {
      code: 'ZONING',
      name: 'ZONING_NAME',
    },
  },
  'tampa-fl': {
    type: 'arcgis',
    name: 'Tampa',
    state: 'FL',
    serviceUrl: 'https://gis-hcpa.opendata.arcgis.com',
    layerId: 0,
    fields: {
      code: 'ZONING',
      name: 'ZONE_DESC',
    },
  },
  'houston-tx': {
    type: 'arcgis',
    name: 'Houston',
    state: 'TX',
    serviceUrl: 'https://cohgis-mycity.opendata.arcgis.com',
    layerId: 0,
    fields: {
      code: 'ZONING_CODE',
      name: 'ZONING_NAME',
    },
  },
  'charleston-sc': {
    type: 'arcgis',
    name: 'Charleston County',
    state: 'SC',
    serviceUrl: 'https://gis.charlestoncounty.org/arcgis/rest/services',
    layerId: 0,
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
    fields: {
      code: 'ZONING',
      name: 'ZONE_DESCRIPTION',
    },
  },
  'fulton-county-ga': {
    type: 'arcgis',
    name: 'Fulton County',
    state: 'GA',
    serviceUrl: 'https://gis.fultoncountyga.gov/arcgis/rest/services',
    layerId: 0,
    fields: {
      code: 'ZONING',
      name: 'ZONE_DESC',
    },
  },
  'orange-county-fl': {
    type: 'arcgis',
    name: 'Orange County',
    state: 'FL',
    serviceUrl: 'https://gis.occompt.com/arcgis/rest/services',
    layerId: 0,
    fields: {
      code: 'ZONING',
      name: 'ZONE_NAME',
    },
  },
};

/**
 * Universal API fetcher - detects type and calls appropriate connector
 */
export async function fetchZoningData(municipalityId: string): Promise<ZoningDistrictAPI[]> {
  const config = CITY_APIS[municipalityId];
  
  if (!config) {
    throw new Error(`No API configuration for ${municipalityId}`);
  }

  console.log(`Fetching zoning data for ${config.name}, ${config.state} via ${config.type.toUpperCase()} API...`);

  let rawData: any[] = [];

  if (config.type === 'socrata') {
    const connector = new SocrataConnector(config.baseUrl);
    rawData = await connector.fetchZoningDistricts(config.zoningDatasetId);
  } else if (config.type === 'arcgis') {
    const connector = new ArcGISConnector(config.serviceUrl);
    rawData = await connector.fetchLayer(config.layerId);
  }

  // Transform to standard format
  const districts: ZoningDistrictAPI[] = rawData.map((record) => {
    const code = record[config.fields.code];
    const name = record[config.fields.name];
    
    return {
      municipality_id: municipalityId,
      zoning_code: code,
      district_name: name || code,
      geometry: record.geometry || record.the_geom,
      max_density_per_acre: record[config.fields.density || 'max_density'],
      max_height_feet: record[config.fields.height || 'max_height'],
      source: 'api',
      source_url: config.type === 'socrata' 
        ? `${config.baseUrl}/resource/${config.zoningDatasetId}.json`
        : config.serviceUrl,
    };
  });

  console.log(`Transformed ${districts.length} zoning districts`);
  return districts;
}

/**
 * Lookup zoning by address using API
 */
export async function lookupZoningByAddress(
  municipalityId: string,
  address: string
): Promise<ZoningDistrictAPI | null> {
  const config = CITY_APIS[municipalityId];
  
  if (!config) {
    return null;
  }

  if (config.type === 'socrata') {
    const connector = new SocrataConnector(config.baseUrl);
    const result = await connector.queryByAddress(config.zoningDatasetId, address);
    
    if (result) {
      return {
        municipality_id: municipalityId,
        zoning_code: result[config.fields.code],
        district_name: result[config.fields.name],
        source: 'api',
        source_url: `${config.baseUrl}/resource/${config.zoningDatasetId}.json`,
      };
    }
  }
  
  return null;
}

/**
 * Lookup zoning by lat/lng using API
 */
export async function lookupZoningByLocation(
  municipalityId: string,
  lat: number,
  lng: number
): Promise<ZoningDistrictAPI | null> {
  const config = CITY_APIS[municipalityId];
  
  if (!config || config.type !== 'arcgis') {
    return null;
  }

  const connector = new ArcGISConnector(config.serviceUrl);
  const result = await connector.queryByLocation(config.layerId, lat, lng);
  
  if (result) {
    return {
      municipality_id: municipalityId,
      zoning_code: result[config.fields.code],
      district_name: result[config.fields.name],
      geometry: result.geometry,
      source: 'api',
      source_url: config.serviceUrl,
    };
  }
  
  return null;
}

/**
 * Save API-fetched districts to database
 */
export async function saveAPIDistricts(districts: ZoningDistrictAPI[]): Promise<number> {
  let saved = 0;

  for (const district of districts) {
    try {
      const cityConfig = CITY_APIS[district.municipality_id];
      const municipalityName = cityConfig?.name || district.municipality_id;
      const state = cityConfig?.state || '';

      await pool.query(
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
          district.max_density_per_acre || null,
          district.max_height_feet || null,
          district.source,
          district.source_url,
        ]
      );
      saved++;
    } catch (error: any) {
      console.error(`Error saving district ${district.zoning_code}:`, error.message);
    }
  }

  console.log(`Saved ${saved}/${districts.length} API districts to database`);
  return saved;
}
