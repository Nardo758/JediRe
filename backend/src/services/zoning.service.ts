/**
 * Zoning Lookup Service
 * Implementation of lightweight zoning lookup from LIGHTWEIGHT_ARCHITECTURE.md
 */

import axios from 'axios';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

interface Coordinates {
  lat: number;
  lng: number;
  formatted_address?: string;
  confidence?: string;
}

interface Municipality {
  city: string;
  county: string;
  state: string;
  formatted: string;
}

interface ZoningLookupInput {
  address?: string;
  lat?: number;
  lng?: number;
  municipality?: string;
}

export class ZoningService {
  /**
   * Main entry point - get zoning for an address
   */
  async lookupZoning(input: ZoningLookupInput): Promise<any> {
    try {
      let coords: Coordinates;

      // Step 1: Get coordinates
      if (input.lat && input.lng) {
        coords = { lat: input.lat, lng: input.lng, confidence: 'high' };
      } else if (input.address) {
        coords = await this.geocode(input.address);
      } else {
        throw new AppError(400, 'Either address or coordinates required');
      }

      // Step 2: Determine municipality
      const municipality = await this.getMunicipality(coords, input.address);

      // Step 3: Find zoning district
      const district = await this.getZoningDistrict(coords, municipality);

      return {
        address: input.address || coords.formatted_address,
        coordinates: { lat: coords.lat, lng: coords.lng },
        municipality: municipality.formatted,
        zoningDistrict: district,
        confidence: coords.confidence || 'high',
      };
    } catch (error: any) {
      logger.error('Zoning lookup failed:', {
        message: error.message,
        code: error.code,
        status: error.status
      });
      throw error;
    }
  }

  /**
   * Geocode address to lat/lng
   */
  private async geocode(address: string): Promise<Coordinates> {
    // Try Google Geocoding API first
    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          params: {
            address,
            key: process.env.GOOGLE_MAPS_API_KEY,
          },
        }
      );

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng,
          formatted_address: response.data.results[0].formatted_address,
          confidence: 'high',
        };
      }
    } catch (error: any) {
      logger.warn('Google geocoding failed, trying Mapbox...', { 
        message: error.message,
        code: error.code 
      });
    }

    // Fallback to Mapbox Geocoding API
    try {
      const response = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`,
        {
          params: {
            access_token: process.env.MAPBOX_ACCESS_TOKEN,
          },
        }
      );

      if (response.data.features && response.data.features.length > 0) {
        const [lng, lat] = response.data.features[0].center;
        return {
          lat,
          lng,
          formatted_address: response.data.features[0].place_name,
          confidence: 'medium',
        };
      }
    } catch (error: any) {
      logger.error('Mapbox geocoding failed:', {
        message: error.message,
        code: error.code
      });
    }

    throw new AppError(404, 'Geocoding failed for address: ' + address);
  }

  /**
   * Reverse geocode to get municipality
   */
  private async getMunicipality(coords: Coordinates, address?: string): Promise<Municipality> {
    // Strategy 1: Google reverse geocoding
    if (process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const response = await axios.get(
          'https://maps.googleapis.com/maps/api/geocode/json',
          {
            params: {
              latlng: `${coords.lat},${coords.lng}`,
              key: process.env.GOOGLE_MAPS_API_KEY,
            },
          }
        );

        if (response.data.status === 'OK' && response.data.results.length > 0) {
          const components = response.data.results[0].address_components;
          const cityComponent = components.find((c: any) => c.types.includes('locality'));
          const countyComponent = components.find((c: any) => c.types.includes('administrative_area_level_2'));
          const stateComponent = components.find((c: any) => c.types.includes('administrative_area_level_1'));
          const city = cityComponent?.long_name || '';
          const county = countyComponent?.long_name || '';
          const state = stateComponent?.short_name || '';
          if (city) {
            return { city, county, state, formatted: `${city}, ${state}` };
          }
        }
      } catch (error) {
        logger.warn('Google reverse geocoding failed, trying fallbacks...');
      }
    }

    // Strategy 2: Mapbox reverse geocoding
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
    if (mapboxToken) {
      try {
        const response = await axios.get(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json`,
          { params: { access_token: mapboxToken, types: 'place', limit: 1 } }
        );
        if (response.data.features && response.data.features.length > 0) {
          const feature = response.data.features[0];
          const city = feature.text || '';
          const regionCtx = (feature.context || []).find((c: any) => c.id?.startsWith('region'));
          const state = regionCtx?.short_code?.replace('US-', '') || '';
          const countyCtx = (feature.context || []).find((c: any) => c.id?.startsWith('district'));
          const county = countyCtx?.text || '';
          if (city) {
            return { city, county, state, formatted: `${city}, ${state}` };
          }
        }
      } catch (error) {
        logger.warn('Mapbox reverse geocoding failed, trying address parsing...');
      }
    }

    // Strategy 3: Parse city from the address string
    if (address) {
      const parsed = this.parseCityFromAddress(address);
      if (parsed) {
        return parsed;
      }
    }

    // Strategy 4: Parse city from formatted_address (set during forward geocoding)
    if (coords.formatted_address) {
      const parsed = this.parseCityFromAddress(coords.formatted_address);
      if (parsed) {
        return parsed;
      }
    }

    throw new AppError(404, 'Could not determine municipality');
  }

  private parseCityFromAddress(address: string): Municipality | null {
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const city = parts[parts.length - 3] || parts[parts.length - 2] || '';
      const stateZip = parts[parts.length - 2] || parts[parts.length - 1] || '';
      const stateMatch = stateZip.match(/([A-Z]{2})\s*\d*/);
      const state = stateMatch ? stateMatch[1] : '';
      const cityClean = city.replace(/\d+/g, '').trim();
      if (cityClean && state) {
        return { city: cityClean, county: '', state, formatted: `${cityClean}, ${state}` };
      }
    }
    return null;
  }

  /**
   * Query database to find zoning district
   */
  private async getZoningDistrict(
    coords: Coordinates,
    municipality: Municipality
  ): Promise<any> {
    // Strategy 1: ArcGIS municipal API point query
    const arcgisResult = await this.queryArcGISZoning(coords, municipality);
    if (arcgisResult) {
      const dbMatch = await query(
        `SELECT id, district_code, district_name, municipality, state,
                permitted_uses, conditional_uses, prohibited_uses,
                min_lot_size_sqft, max_lot_coverage, max_building_height_ft,
                max_stories, min_front_setback_ft, min_side_setback_ft,
                min_rear_setback_ft, max_units_per_acre
         FROM zoning_districts
         WHERE municipality ILIKE $1 AND district_code ILIKE $2
         LIMIT 1`,
        [municipality.city, arcgisResult.districtCode]
      );
      const dbDistrict = dbMatch.rows[0];
      if (dbDistrict) {
        return {
          id: dbDistrict.id,
          districtCode: dbDistrict.district_code,
          districtName: dbDistrict.district_name || arcgisResult.districtName,
          municipality: dbDistrict.municipality,
          stateCode: dbDistrict.state,
          rules: {
            permitted_uses: dbDistrict.permitted_uses,
            conditional_uses: dbDistrict.conditional_uses,
            prohibited_uses: dbDistrict.prohibited_uses,
            min_lot_size_sqft: dbDistrict.min_lot_size_sqft,
            max_lot_coverage: dbDistrict.max_lot_coverage,
            max_building_height_ft: dbDistrict.max_building_height_ft,
            max_stories: dbDistrict.max_stories,
            min_front_setback_ft: dbDistrict.min_front_setback_ft,
            min_side_setback_ft: dbDistrict.min_side_setback_ft,
            min_rear_setback_ft: dbDistrict.min_rear_setback_ft,
            max_units_per_acre: dbDistrict.max_units_per_acre,
          },
          source: 'arcgis+db',
        };
      }
      return {
        id: null,
        districtCode: arcgisResult.districtCode,
        districtName: arcgisResult.districtName || arcgisResult.districtCode,
        municipality: municipality.city,
        stateCode: municipality.state,
        rules: null,
        source: 'arcgis',
      };
    }

    // Strategy 2: Bounding box lookup on zoning_district_boundaries
    try {
      const bboxResult = await query(
        `SELECT id, district_code, municipality, state, boundary_geojson
         FROM zoning_district_boundaries
         WHERE municipality ILIKE $1
           AND min_lat <= $2 AND max_lat >= $2
           AND min_lng <= $3 AND max_lng >= $3
         LIMIT 1`,
        [municipality.city, coords.lat, coords.lng]
      );
      if (bboxResult.rows.length > 0) {
        const district = bboxResult.rows[0];
        return {
          id: district.id,
          districtCode: district.district_code,
          districtName: district.district_code,
          municipality: district.municipality,
          stateCode: district.state,
          rules: null,
          source: 'boundaries_bbox',
        };
      }
    } catch (error) {
      logger.warn('Boundary bbox lookup failed, trying district table...');
    }

    // Strategy 3: Return municipality zoning info from zoning_districts table
    try {
      const distResult = await query(
        `SELECT id, district_code, district_name, municipality, state
         FROM zoning_districts
         WHERE municipality ILIKE $1
         ORDER BY district_code
         LIMIT 1`,
        [municipality.city]
      );
      if (distResult.rows.length > 0) {
        const d = distResult.rows[0];
        return {
          id: d.id,
          districtCode: d.district_code,
          districtName: d.district_name || d.district_code,
          municipality: d.municipality,
          stateCode: d.state,
          rules: null,
          source: 'district_table_fallback',
          note: `Matched municipality but could not determine exact district. ${municipality.city} has zoning districts on file.`,
        };
      }
    } catch (error) {
      logger.warn('District table lookup failed');
    }

    throw new AppError(
      404,
      `No zoning district found for coordinates in ${municipality.formatted}`
    );
  }

  private async queryArcGISZoning(coords: Coordinates, municipality: Municipality): Promise<{ districtCode: string; districtName: string } | null> {
    const connectors: Record<string, { serviceUrl: string; layerId: number; fields: { code: string; name: string } }> = {
      'Atlanta': { serviceUrl: 'https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LotsWithZoning/MapServer', layerId: 0, fields: { code: 'ZONING_CLASSIFICATION', name: 'ZONINGCODE' } },
      'Charlotte': { serviceUrl: 'https://gis.charlottenc.gov/arcgis/rest/services/ODP/Parcel_Zoning_Lookup/MapServer', layerId: 0, fields: { code: 'Zoning', name: 'Zoning' } },
      'Miami': { serviceUrl: 'https://gis.miamidade.gov/arcgis/rest/services/Zoning/MapServer', layerId: 0, fields: { code: 'ZONE', name: 'ZONE' } },
      'Jacksonville': { serviceUrl: 'https://maps.coj.net/arcgis/rest/services/Zoning/MapServer', layerId: 0, fields: { code: 'ZONING', name: 'ZONING' } },
      'Tampa': { serviceUrl: 'https://maps.tampagov.net/arcgis/rest/services/Zoning/MapServer', layerId: 0, fields: { code: 'ZONE_DIST', name: 'ZONE_DESC' } },
    };

    const connector = connectors[municipality.city];
    if (!connector) return null;

    try {
      const url = `${connector.serviceUrl}/${connector.layerId}/query`;
      const response = await axios.get(url, {
        params: {
          geometry: `${coords.lng},${coords.lat}`,
          geometryType: 'esriGeometryPoint',
          inSR: '4326',
          spatialRel: 'esriSpatialRelIntersects',
          outFields: `${connector.fields.code},${connector.fields.name}`,
          returnGeometry: false,
          f: 'json',
        },
        timeout: 10000,
      });

      if (response.data?.features?.length > 0) {
        const attrs = response.data.features[0].attributes;
        return {
          districtCode: attrs[connector.fields.code] || '',
          districtName: attrs[connector.fields.name] || attrs[connector.fields.code] || '',
        };
      }
    } catch (error: any) {
      logger.warn(`ArcGIS zoning query failed for ${municipality.city}:`, error.message);
    }

    return null;
  }

  /**
   * Analyze development potential for a property
   */
  async analyzeProperty(input: {
    propertyId?: string;
    lotSizeSqft?: number;
    question?: string;
    userId: string;
  }): Promise<any> {
    try {
      // This is a placeholder - full implementation would use Claude API
      // to interpret zoning rules and answer development questions

      let property: any;
      let lotSize: number;

      if (input.propertyId) {
        const result = await query(
          'SELECT * FROM properties WHERE id = $1',
          [input.propertyId]
        );

        if (result.rows.length === 0) {
          throw new AppError(404, 'Property not found');
        }

        property = result.rows[0];
        lotSize = property.lot_size_sqft || input.lotSizeSqft || 0;
      } else {
        lotSize = input.lotSizeSqft || 0;
      }

      if (lotSize === 0) {
        // Estimate lot size if we have building sqft (rough estimate)
        if (property?.building_sqft && property.building_sqft > 0) {
          // Estimate: assume 30% lot coverage as typical
          lotSize = Math.round(property.building_sqft / 0.3);
          logger.warn(`Estimated lot size from building sqft: ${lotSize}`, { 
            propertyId: input.propertyId,
            buildingSqft: property.building_sqft 
          });
        } else {
          throw new AppError(400, 'Lot size required for analysis. Please provide lotSizeSqft or ensure property has lot_size_sqft or building_sqft data.');
        }
      }

      // Placeholder analysis result
      const analysis = {
        lotSizeSqft: lotSize,
        maxUnits: Math.floor(lotSize / 2000), // Simple calculation
        maxBuildableSqft: lotSize * 0.4, // 40% coverage
        maxHeight: 35, // feet
        parkingRequired: Math.floor(lotSize / 2000) * 2,
        opportunityScore: 75,
        confidenceScore: 85,
      };

      // Store analysis result
      if (input.propertyId) {
        await query(
          `INSERT INTO property_analyses (
            property_id, user_id, agent_type, results,
            opportunity_score, confidence_score, status
          ) VALUES ($1, $2, 'zoning', $3, $4, $5, 'completed')`,
          [
            input.propertyId,
            input.userId,
            JSON.stringify(analysis),
            analysis.opportunityScore,
            analysis.confidenceScore,
          ]
        );
      }

      return analysis;
    } catch (error: any) {
      logger.error('Property analysis failed:', {
        message: error.message,
        code: error.code,
        status: error.status
      });
      throw error;
    }
  }
}
