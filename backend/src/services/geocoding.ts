interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
  municipality?: string;
  state?: string;
  country?: string;
}

export class GeocodingService {
  private nominatimBaseUrl = 'https://nominatim.openstreetmap.org';

  async geocode(address: string): Promise<GeocodingResult | null> {
    try {
      const response = await fetch(
        `${this.nominatimBaseUrl}/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'JediRE/1.0 (contact@jedire.com)',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || data.length === 0) {
        return null;
      }

      const result = data[0];
      const address_parts = result.address || {};

      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
        municipality: address_parts.city || address_parts.town || address_parts.village || address_parts.county,
        state: address_parts.state,
        country: address_parts.country,
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
    try {
      const response = await fetch(
        `${this.nominatimBaseUrl}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'JediRE/1.0 (contact@jedire.com)',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result || result.error) {
        return null;
      }

      const address_parts = result.address || {};

      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
        municipality: address_parts.city || address_parts.town || address_parts.village || address_parts.county,
        state: address_parts.state,
        country: address_parts.country,
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }
}

export const geocodingService = new GeocodingService();
