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
      const municipality = await this.getMunicipality(coords);

      // Step 3: Find zoning district
      const district = await this.getZoningDistrict(coords, municipality);

      return {
        address: input.address || coords.formatted_address,
        coordinates: { lat: coords.lat, lng: coords.lng },
        municipality: municipality.formatted,
        zoningDistrict: district,
        confidence: coords.confidence || 'high',
      };
    } catch (error) {
      logger.error('Zoning lookup failed:', error);
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
    } catch (error) {
      logger.warn('Google geocoding failed, trying Mapbox...', error);
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
    } catch (error) {
      logger.error('Mapbox geocoding failed:', error);
    }

    throw new AppError(404, 'Geocoding failed for address: ' + address);
  }

  /**
   * Reverse geocode to get municipality
   */
  private async getMunicipality(coords: Coordinates): Promise<Municipality> {
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

        // Extract city
        const cityComponent = components.find((c: any) =>
          c.types.includes('locality')
        );

        // Extract county
        const countyComponent = components.find((c: any) =>
          c.types.includes('administrative_area_level_2')
        );

        // Extract state
        const stateComponent = components.find((c: any) =>
          c.types.includes('administrative_area_level_1')
        );

        const city = cityComponent?.long_name || '';
        const county = countyComponent?.long_name || '';
        const state = stateComponent?.short_name || '';

        return {
          city,
          county,
          state,
          formatted: `${city}, ${state}`,
        };
      }
    } catch (error) {
      logger.error('Reverse geocoding failed:', error);
    }

    throw new AppError(404, 'Could not determine municipality');
  }

  /**
   * Query database to find zoning district
   */
  private async getZoningDistrict(
    coords: Coordinates,
    municipality: Municipality
  ): Promise<any> {
    try {
      // Point-in-polygon query using PostGIS
      const result = await query(
        `SELECT id, district_code, district_name, municipality, state_code,
                boundary_geojson
         FROM zoning_district_boundaries
         WHERE municipality ILIKE $1
           AND ST_Contains(
             boundary,
             ST_SetSRID(ST_Point($2, $3), 4326)
           )
         LIMIT 1`,
        [municipality.city, coords.lng, coords.lat]
      );

      if (result.rows.length === 0) {
        throw new AppError(
          404,
          `No zoning district found for coordinates in ${municipality.formatted}`
        );
      }

      const district = result.rows[0];

      // Get rules for this district
      const rulesResult = await query(
        'SELECT * FROM zoning_rules WHERE district_id = $1 LIMIT 1',
        [district.id]
      );

      return {
        id: district.id,
        districtCode: district.district_code,
        districtName: district.district_name,
        municipality: district.municipality,
        stateCode: district.state_code,
        rules: rulesResult.rows[0] || null,
      };
    } catch (error) {
      logger.error('Zoning district lookup failed:', error);
      throw error;
    }
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
        throw new AppError(400, 'Lot size required for analysis');
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
    } catch (error) {
      logger.error('Property analysis failed:', error);
      throw error;
    }
  }
}
