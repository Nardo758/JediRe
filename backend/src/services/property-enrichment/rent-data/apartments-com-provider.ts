/**
 * Apartments.com Rent Data Provider
 * 
 * Scrapes rent data from Apartments.com listings.
 * Uses structured data and page content to extract unit mix, rents, and amenities.
 */

import { RentData, ProviderConfig, UnitType } from '../types';
import { BaseRentDataProvider } from './base-provider';

export class ApartmentsComProvider extends BaseRentDataProvider {
  readonly config: ProviderConfig = {
    name: 'apartments_com',
    type: 'rent_data',
    enabled: true,
    priority: 100,
    requestsPerMinute: 10,
    requestsPerDay: 100,
  };
  
  private readonly searchUrl = 'https://www.apartments.com';
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  async canHandle(address: string, city: string, state: string): Promise<boolean> {
    // Apartments.com covers all US
    return true;
  }
  
  async fetchRentData(
    address: string,
    city: string,
    state: string,
    propertyName?: string
  ): Promise<RentData | null> {
    try {
      // Strategy 1: Search by property name if available
      if (propertyName) {
        const result = await this.searchByPropertyName(propertyName, city, state);
        if (result) return result;
      }
      
      // Strategy 2: Search by address
      const result = await this.searchByAddress(address, city, state);
      return result;
    } catch (error) {
      console.error('[ApartmentsCom] Error fetching rent data:', error);
      return null;
    }
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.searchUrl, {
        headers: { 'User-Agent': this.userAgent }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  // =========================================================================
  // SEARCH METHODS
  // =========================================================================
  
  private async searchByPropertyName(
    propertyName: string,
    city: string,
    state: string
  ): Promise<RentData | null> {
    // Build search URL
    const searchQuery = encodeURIComponent(`${propertyName} ${city} ${state}`);
    const searchUrl = `${this.searchUrl}/apartments/${city.toLowerCase().replace(/\s+/g, '-')}-${state.toLowerCase()}/?sk=${searchQuery}`;
    
    console.log(`[ApartmentsCom] Searching: ${searchUrl}`);
    
    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      
      if (!response.ok) {
        console.log(`[ApartmentsCom] Search returned ${response.status}`);
        return null;
      }
      
      const html = await response.text();
      
      // Look for property listing link
      const listingUrl = this.extractListingUrl(html, propertyName);
      
      if (listingUrl) {
        return this.fetchPropertyPage(listingUrl);
      }
      
      return null;
    } catch (error) {
      console.error('[ApartmentsCom] Search error:', error);
      return null;
    }
  }
  
  private async searchByAddress(
    address: string,
    city: string,
    state: string
  ): Promise<RentData | null> {
    // Normalize address for URL
    const streetNumber = address.match(/^(\d+)/)?.[1];
    const streetName = address.replace(/^\d+\s*/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Try direct URL construction (apartments.com uses SEO-friendly URLs)
    const citySlug = city.toLowerCase().replace(/\s+/g, '-');
    const stateSlug = state.toLowerCase();
    
    // Common patterns:
    // https://www.apartments.com/property-name-address-city-state/1234567/
    
    // For now, fall back to search
    const searchQuery = encodeURIComponent(`${address} ${city} ${state}`);
    const searchUrl = `${this.searchUrl}/apartments/${citySlug}-${stateSlug}/?sk=${searchQuery}`;
    
    console.log(`[ApartmentsCom] Address search: ${searchUrl}`);
    
    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html',
        }
      });
      
      if (!response.ok) return null;
      
      const html = await response.text();
      const listingUrl = this.extractListingUrlByAddress(html, streetNumber || '');
      
      if (listingUrl) {
        return this.fetchPropertyPage(listingUrl);
      }
      
      return null;
    } catch (error) {
      console.error('[ApartmentsCom] Address search error:', error);
      return null;
    }
  }
  
  // =========================================================================
  // PAGE PARSING
  // =========================================================================
  
  private async fetchPropertyPage(url: string): Promise<RentData | null> {
    console.log(`[ApartmentsCom] Fetching property page: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html',
        }
      });
      
      if (!response.ok) return null;
      
      const html = await response.text();
      return this.parsePropertyPage(html, url);
    } catch (error) {
      console.error('[ApartmentsCom] Property page error:', error);
      return null;
    }
  }
  
  private parsePropertyPage(html: string, url: string): RentData | null {
    try {
      // Extract property name
      const nameMatch = html.match(/<h1[^>]*class="[^"]*propertyName[^"]*"[^>]*>([^<]+)</i) ||
                       html.match(/<title>([^|<]+)/);
      const propertyName = nameMatch?.[1]?.trim().replace(/\s+Apartments.*$/i, '');
      
      // Extract unit types from floor plans section
      const unitMix = this.extractUnitMix(html);
      
      // Extract amenities
      const unitAmenities = this.extractAmenities(html, 'unit');
      const communityAmenities = this.extractAmenities(html, 'community');
      
      // Extract specials/concessions
      const concessions = this.extractConcessions(html);
      
      // Extract contact info
      const phoneMatch = html.match(/tel:([+\d-]+)/);
      const phone = phoneMatch?.[1];
      
      // Calculate aggregates
      const aggregates = this.calculateAggregates(unitMix);
      
      if (unitMix.length === 0) {
        console.log('[ApartmentsCom] No unit data found');
        return null;
      }
      
      return {
        propertyName,
        unitMix,
        ...aggregates,
        concessions: concessions?.concession,
        concessionPct: concessions?.pct,
        unitAmenities,
        communityAmenities,
        phoneNumber: phone,
        propertyWebsite: url,
        provider: this.config.name,
        asOfDate: new Date(),
        fetchedAt: new Date()
      };
    } catch (error) {
      console.error('[ApartmentsCom] Parse error:', error);
      return null;
    }
  }
  
  private extractUnitMix(html: string): UnitType[] {
    const units: UnitType[] = [];
    
    // Try to find JSON-LD structured data first
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonStr = match.replace(/<\/?script[^>]*>/gi, '');
          const data = JSON.parse(jsonStr);
          
          if (data['@type'] === 'ApartmentComplex' && data.containsPlace) {
            for (const unit of data.containsPlace) {
              if (unit['@type'] === 'Apartment') {
                const beds = this.parseBeds(unit.numberOfBedrooms || '1');
                const baths = this.parseBaths(unit.numberOfBathroomsTotal || '1');
                const sqFt = this.parseSqFt(unit.floorSize?.value || '0') || 0;
                
                let rent = 0;
                if (unit.potentialAction?.priceSpecification) {
                  rent = this.parseRent(unit.potentialAction.priceSpecification.price) || 0;
                }
                
                if (rent > 0) {
                  units.push({
                    beds,
                    baths,
                    sqFt,
                    unitCount: 1,
                    askingRent: rent,
                    rentPerSqFt: this.calcRentPSF(rent, sqFt),
                    floorPlanName: unit.name
                  });
                }
              }
            }
          }
        } catch {
          // Continue to HTML parsing
        }
      }
    }
    
    // If JSON-LD didn't work, parse HTML
    if (units.length === 0) {
      // Look for pricing table rows
      // Pattern: <div class="pricingColumn">...<span class="rentLabel">$1,450</span>...
      const floorPlanSections = html.match(/<div[^>]*class="[^"]*availabilityInfo[^"]*"[^>]*>[\s\S]*?<\/div>/gi);
      
      if (floorPlanSections) {
        for (const section of floorPlanSections) {
          const bedMatch = section.match(/(\d+)\s*(?:bed|br|bedroom)/i) || 
                          section.match(/studio/i);
          const bathMatch = section.match(/(\d+\.?\d*)\s*(?:bath|ba)/i);
          const sqftMatch = section.match(/(\d{3,4})\s*(?:sq\s*ft|sqft|sf)/i);
          const rentMatch = section.match(/\$(\d{1,2},?\d{3})/);
          
          if (rentMatch) {
            const beds = bedMatch ? 
              (bedMatch[0].toLowerCase().includes('studio') ? 0 : parseInt(bedMatch[1], 10)) : 1;
            const baths = bathMatch ? parseFloat(bathMatch[1]) : 1;
            const sqFt = sqftMatch ? parseInt(sqftMatch[1], 10) : 0;
            const rent = parseInt(rentMatch[1].replace(',', ''), 10);
            
            units.push({
              beds,
              baths,
              sqFt,
              unitCount: 1,
              askingRent: rent,
              rentPerSqFt: this.calcRentPSF(rent, sqFt)
            });
          }
        }
      }
    }
    
    // Consolidate units by bed/bath
    const consolidated = this.consolidateUnits(units);
    
    return consolidated;
  }
  
  private consolidateUnits(units: UnitType[]): UnitType[] {
    const map = new Map<string, UnitType>();
    
    for (const unit of units) {
      const key = `${unit.beds}-${unit.baths}`;
      const existing = map.get(key);
      
      if (existing) {
        // Average the values
        const totalCount = existing.unitCount + unit.unitCount;
        existing.askingRent = Math.round(
          (existing.askingRent * existing.unitCount + unit.askingRent * unit.unitCount) / totalCount
        );
        existing.sqFt = Math.round(
          (existing.sqFt * existing.unitCount + unit.sqFt * unit.unitCount) / totalCount
        );
        existing.unitCount = totalCount;
        if (existing.sqFt) {
          existing.rentPerSqFt = this.calcRentPSF(existing.askingRent, existing.sqFt);
        }
      } else {
        map.set(key, { ...unit });
      }
    }
    
    return Array.from(map.values()).sort((a, b) => a.beds - b.beds);
  }
  
  private extractAmenities(html: string, type: 'unit' | 'community'): string[] {
    const amenities: string[] = [];
    
    // Look for amenity lists
    const pattern = type === 'unit' 
      ? /(?:unit|apartment)\s*(?:features|amenities)[^<]*<ul[^>]*>([\s\S]*?)<\/ul>/gi
      : /(?:community|property)\s*(?:features|amenities)[^<]*<ul[^>]*>([\s\S]*?)<\/ul>/gi;
    
    const match = html.match(pattern);
    if (match) {
      const listMatch = match[0].match(/<li[^>]*>([^<]+)<\/li>/gi);
      if (listMatch) {
        for (const item of listMatch) {
          const text = item.replace(/<[^>]+>/g, '').trim();
          if (text) {
            amenities.push(text);
          }
        }
      }
    }
    
    return amenities.slice(0, 20); // Limit to 20
  }
  
  private extractConcessions(html: string): { concession: string; pct?: number } | null {
    // Look for specials section
    const specialsMatch = html.match(/(?:special|deal|offer|promotion)[^<]*:?\s*([^<]+)/i);
    if (specialsMatch) {
      const text = specialsMatch[1].trim();
      return this.parseConcessionsFromText(text);
    }
    
    // Look for "X weeks/months free" anywhere
    const freeMatch = html.match(/(\d+\.?\d*)\s*(week|month)s?\s*free/i);
    if (freeMatch) {
      const num = parseFloat(freeMatch[1]);
      const unit = freeMatch[2].toLowerCase();
      const pct = unit === 'month' ? (num / 12) * 100 : (num / 52) * 100;
      return {
        concession: `${num} ${unit}${num > 1 ? 's' : ''} free`,
        pct: Math.round(pct * 100) / 100
      };
    }
    
    return null;
  }
  
  // =========================================================================
  // URL EXTRACTION
  // =========================================================================
  
  private extractListingUrl(html: string, propertyName: string): string | null {
    // Look for listing cards
    const normalizedName = this.normalizePropertyName(propertyName);
    
    // Pattern: <a href="/property-name-city-state/123456/" class="property-link">
    const linkPattern = /<a\s+href="(\/[^"]+\/\d+\/)"[^>]*>[\s\S]*?<\/a>/gi;
    
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      const url = match[1];
      const context = match[0];
      
      // Check if this listing matches our property name
      const contextNormalized = this.normalizePropertyName(context);
      if (contextNormalized.includes(normalizedName) || 
          normalizedName.includes(contextNormalized.split(/\s+/).slice(0, 3).join(' '))) {
        return `${this.searchUrl}${url}`;
      }
    }
    
    return null;
  }
  
  private extractListingUrlByAddress(html: string, streetNumber: string): string | null {
    // Look for listings containing the street number
    const pattern = new RegExp(
      `<a\\s+href="(/[^"]+/${streetNumber}[^"]*)"[^>]*>`,
      'i'
    );
    
    const match = html.match(pattern);
    if (match) {
      return `${this.searchUrl}${match[1]}`;
    }
    
    return null;
  }
}
