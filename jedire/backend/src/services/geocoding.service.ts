/**
 * Geocoding Service - Mapbox Integration
 * Converts addresses to coordinates and vice versa
 * Supports batch processing, retry logic, and fallback strategies
 */

import { logger } from '../utils/logger';

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
  country?: string;
  confidence?: number; // 0-1 score
  placeType?: string; // address, poi, neighborhood, place, etc.
}

export interface BatchGeocodingResult {
  address: string;
  result: GeocodingResult | null;
  error?: string;
}

export interface ReverseGeocodingResult extends GeocodingResult {
  formatted: string;
}

class GeocodingService {
  private mapboxToken: string;
  private useMapbox: boolean;
  private nominatimBaseUrl = 'https://nominatim.openstreetmap.org';
  private maxRetries = 3;
  private retryDelay = 1000; // ms
  
  constructor() {
    this.mapboxToken = process.env.MAPBOX_TOKEN || '';
    this.useMapbox = !!this.mapboxToken;
    
    if (!this.useMapbox) {
      logger.warn('Mapbox token not found. Falling back to OpenStreetMap Nominatim (rate-limited).');
    }
  }
  
  /**
   * Geocode a single address to coordinates
   */
  async geocode(address: string): Promise<GeocodingResult | null> {
    if (!address || address.trim().length === 0) {
      return null;
    }
    
    try {
      if (this.useMapbox) {
        return await this.geocodeMapbox(address);
      } else {
        return await this.geocodeNominatim(address);
      }
    } catch (error) {
      logger.error('Geocoding error:', { address, error });
      return null;
    }
  }
  
  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodingResult | null> {
    if (!lat || !lng || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }
    
    try {
      if (this.useMapbox) {
        return await this.reverseGeocodeMapbox(lat, lng);
      } else {
        return await this.reverseGeocodeNominatim(lat, lng);
      }
    } catch (error) {
      logger.error('Reverse geocoding error:', { lat, lng, error });
      return null;
    }
  }
  
  /**
   * Batch geocode multiple addresses
   * Processes with rate limiting and retry logic
   */
  async batchGeocode(addresses: string[]): Promise<BatchGeocodingResult[]> {
    const results: BatchGeocodingResult[] = [];
    
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      
      try {
        const result = await this.geocodeWithRetry(address);
        results.push({ address, result });
        
        // Rate limiting: wait between requests
        if (i < addresses.length - 1) {
          await this.delay(this.useMapbox ? 100 : 1000);
        }
      } catch (error: any) {
        results.push({
          address,
          result: null,
          error: error.message,
        });
      }
    }
    
    return results;
  }
  
  /**
   * Geocode with exponential backoff retry
   */
  private async geocodeWithRetry(address: string, attempt = 1): Promise<GeocodingResult | null> {
    try {
      return await this.geocode(address);
    } catch (error: any) {
      if (attempt >= this.maxRetries) {
        throw error;
      }
      
      const delay = this.retryDelay * Math.pow(2, attempt - 1);
      logger.warn(`Geocoding attempt ${attempt} failed. Retrying in ${delay}ms...`, { address });
      
      await this.delay(delay);
      return this.geocodeWithRetry(address, attempt + 1);
    }
  }
  
  /**
   * Mapbox Geocoding API
   * https://docs.mapbox.com/api/search/geocoding/
   */
  private async geocodeMapbox(address: string): Promise<GeocodingResult | null> {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${this.mapboxToken}&limit=1&country=US`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mapbox geocoding failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return null;
    }
    
    const feature = data.features[0];
    const [lng, lat] = feature.center;
    
    // Extract context (city, state, etc.)
    const context = feature.context || [];
    const getContext = (type: string) => {
      const item = context.find((c: any) => c.id.startsWith(type));
      return item ? item.text : undefined;
    };
    
    return {
      lat,
      lng,
      displayName: feature.place_name,
      address: feature.address ? `${feature.address} ${feature.text}` : feature.text,
      city: getContext('place'),
      state: getContext('region'),
      zipCode: getContext('postcode'),
      county: getContext('district'),
      country: getContext('country'),
      confidence: feature.relevance || 0.5,
      placeType: feature.place_type ? feature.place_type[0] : undefined,
    };
  }
  
  /**
   * Mapbox Reverse Geocoding
   */
  private async reverseGeocodeMapbox(lat: number, lng: number): Promise<ReverseGeocodingResult | null> {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${this.mapboxToken}&limit=1`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mapbox reverse geocoding failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return null;
    }
    
    const feature = data.features[0];
    const context = feature.context || [];
    
    const getContext = (type: string) => {
      const item = context.find((c: any) => c.id.startsWith(type));
      return item ? item.text : undefined;
    };
    
    return {
      lat,
      lng,
      displayName: feature.place_name,
      formatted: feature.place_name,
      address: feature.address ? `${feature.address} ${feature.text}` : feature.text,
      city: getContext('place'),
      state: getContext('region'),
      zipCode: getContext('postcode'),
      county: getContext('district'),
      country: getContext('country'),
      confidence: feature.relevance || 0.5,
      placeType: feature.place_type ? feature.place_type[0] : undefined,
    };
  }
  
  /**
   * OpenStreetMap Nominatim Geocoding (fallback)
   * Rate limited to 1 request/second
   */
  private async geocodeNominatim(address: string): Promise<GeocodingResult | null> {
    const response = await fetch(
      `${this.nominatimBaseUrl}/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'JEDI-RE/1.0 (Real Estate Intelligence Platform)',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Nominatim geocoding failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return null;
    }
    
    const result = data[0];
    const addressParts = result.address || {};
    
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: result.display_name,
      address: addressParts.road
        ? `${addressParts.house_number || ''} ${addressParts.road}`.trim()
        : undefined,
      city: addressParts.city || addressParts.town || addressParts.village,
      state: addressParts.state,
      zipCode: addressParts.postcode,
      county: addressParts.county,
      country: addressParts.country,
      confidence: parseFloat(result.importance || '0.5'),
      placeType: result.type,
    };
  }
  
  /**
   * OpenStreetMap Nominatim Reverse Geocoding (fallback)
   */
  private async reverseGeocodeNominatim(lat: number, lng: number): Promise<ReverseGeocodingResult | null> {
    const response = await fetch(
      `${this.nominatimBaseUrl}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'JEDI-RE/1.0 (Real Estate Intelligence Platform)',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Nominatim reverse geocoding failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result || result.error) {
      return null;
    }
    
    const addressParts = result.address || {};
    
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: result.display_name,
      formatted: result.display_name,
      address: addressParts.road
        ? `${addressParts.house_number || ''} ${addressParts.road}`.trim()
        : undefined,
      city: addressParts.city || addressParts.town || addressParts.village,
      state: addressParts.state,
      zipCode: addressParts.postcode,
      county: addressParts.county,
      country: addressParts.country,
      confidence: parseFloat(result.importance || '0.5'),
      placeType: result.type,
    };
  }
  
  /**
   * Validate if an address is specific enough (street-level)
   */
  isAddressSpecific(result: GeocodingResult): boolean {
    if (!result.placeType) return false;
    
    const specificTypes = ['address', 'poi', 'postcode'];
    return specificTypes.includes(result.placeType);
  }
  
  /**
   * Utility: delay for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const geocodingService = new GeocodingService();
