/**
 * Property Matcher Service
 * 
 * Matches discovered municipal properties with Apartment Locator AI rent data.
 * Uses multiple matching strategies: address, coordinates, owner name, property name.
 */

import { DiscoveredProperty } from '../discovery/property-discovery.service';

export interface ApartmentLocatorProperty {
  id: string;
  propertyName: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  
  // Location
  latitude?: number;
  longitude?: number;
  
  // Property Data
  totalUnits?: number;
  yearBuilt?: number;
  
  // Rent Data
  avgRent?: number;
  unitMix?: Array<{
    beds: number;
    baths: number;
    sqFt: number;
    rent: number;
    count: number;
  }>;
  occupancy?: number;
  
  // Management
  managementCompany?: string;
  
  // Metadata
  lastUpdated?: Date;
  source: string;
}

export interface MatchResult {
  discoveredPropertyId: string;
  apartmentLocatorId: string;
  
  // Match Quality
  confidence: number; // 0-100
  matchMethod: 'exact_address' | 'fuzzy_address' | 'coordinates' | 'owner_name' | 'property_name' | 'composite';
  matchReasons: string[];
  
  // Comparison Data
  addressMatch: boolean;
  coordinateMatch: boolean;
  ownerNameMatch: boolean;
  propertyNameMatch: boolean;
  unitCountMatch: boolean;
  yearBuiltMatch: boolean;
  
  // Delta
  unitCountDelta?: number;
  yearBuiltDelta?: number;
  distanceMeters?: number;
  
  // Status
  status: 'auto_matched' | 'review_required' | 'rejected';
  reviewNotes?: string;
}

export class PropertyMatcherService {
  
  /**
   * Match a discovered property to Apartment Locator data
   */
  async matchProperty(
    discovered: DiscoveredProperty,
    apartmentLocatorProperties: ApartmentLocatorProperty[]
  ): Promise<MatchResult | null> {
    const candidates: Array<{ property: ApartmentLocatorProperty; score: number; reasons: string[] }> = [];
    
    for (const alProp of apartmentLocatorProperties) {
      const { score, reasons } = this.scoreMatch(discovered, alProp);
      
      if (score > 0) {
        candidates.push({ property: alProp, score, reasons });
      }
    }
    
    if (candidates.length === 0) {
      return null;
    }
    
    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    
    const best = candidates[0];
    const result = this.buildMatchResult(discovered, best.property, best.score, best.reasons);
    
    return result;
  }
  
  /**
   * Match all discovered properties in a county
   */
  async matchCounty(
    county: string,
    state: string,
    options: {
      minConfidence?: number;
      autoMatchThreshold?: number;
    } = {}
  ): Promise<{
    total: number;
    matched: number;
    reviewRequired: number;
    unmatched: number;
    results: MatchResult[];
  }> {
    const minConfidence = options.minConfidence ?? 50;
    const autoMatchThreshold = options.autoMatchThreshold ?? 85;
    
    // Get discovered properties
    const discovered = await this.getDiscoveredProperties(county, state);
    
    // Get Apartment Locator properties for this area
    const alProperties = await this.getApartmentLocatorProperties(county, state);
    
    const results: MatchResult[] = [];
    let matched = 0;
    let reviewRequired = 0;
    
    for (const prop of discovered) {
      const match = await this.matchProperty(prop, alProperties);
      
      if (match && match.confidence >= minConfidence) {
        results.push(match);
        
        if (match.confidence >= autoMatchThreshold) {
          match.status = 'auto_matched';
          matched++;
        } else {
          match.status = 'review_required';
          reviewRequired++;
        }
      }
    }
    
    return {
      total: discovered.length,
      matched,
      reviewRequired,
      unmatched: discovered.length - matched - reviewRequired,
      results
    };
  }
  
  /**
   * Score how well two properties match
   */
  private scoreMatch(
    discovered: DiscoveredProperty,
    alProp: ApartmentLocatorProperty
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    
    // 1. Address Matching (up to 40 points)
    const addressScore = this.scoreAddressMatch(
      discovered.address,
      discovered.city,
      discovered.state,
      alProp.address,
      alProp.city,
      alProp.state
    );
    
    if (addressScore >= 95) {
      score += 40;
      reasons.push('Exact address match');
    } else if (addressScore >= 80) {
      score += 30;
      reasons.push('Strong address match');
    } else if (addressScore >= 60) {
      score += 20;
      reasons.push('Partial address match');
    }
    
    // 2. Property Name Matching (up to 25 points)
    if (discovered.propertyName && alProp.propertyName) {
      const nameScore = this.scoreFuzzyMatch(
        discovered.propertyName,
        alProp.propertyName
      );
      
      if (nameScore >= 90) {
        score += 25;
        reasons.push('Exact property name match');
      } else if (nameScore >= 70) {
        score += 15;
        reasons.push('Similar property names');
      } else if (nameScore >= 50) {
        score += 8;
        reasons.push('Partial property name match');
      }
    }
    
    // 3. Unit Count Matching (up to 15 points)
    if (discovered.numberOfUnits && alProp.totalUnits) {
      const unitDiff = Math.abs(discovered.numberOfUnits - alProp.totalUnits);
      const unitPct = unitDiff / Math.max(discovered.numberOfUnits, alProp.totalUnits);
      
      if (unitPct <= 0.05) {
        score += 15;
        reasons.push('Unit count matches exactly');
      } else if (unitPct <= 0.15) {
        score += 10;
        reasons.push('Unit count similar');
      } else if (unitPct <= 0.25) {
        score += 5;
        reasons.push('Unit count within 25%');
      }
    }
    
    // 4. Year Built Matching (up to 10 points)
    if (discovered.yearBuilt && alProp.yearBuilt) {
      const yearDiff = Math.abs(discovered.yearBuilt - alProp.yearBuilt);
      
      if (yearDiff === 0) {
        score += 10;
        reasons.push('Year built matches');
      } else if (yearDiff <= 2) {
        score += 7;
        reasons.push('Year built within 2 years');
      } else if (yearDiff <= 5) {
        score += 3;
        reasons.push('Year built within 5 years');
      }
    }
    
    // 5. Owner/Management Matching (up to 10 points)
    if (discovered.ownerName && alProp.managementCompany) {
      const ownerScore = this.scoreFuzzyMatch(
        discovered.ownerName,
        alProp.managementCompany
      );
      
      if (ownerScore >= 70) {
        score += 10;
        reasons.push('Owner/management company match');
      } else if (ownerScore >= 50) {
        score += 5;
        reasons.push('Partial owner/management match');
      }
    }
    
    return { score, reasons };
  }
  
  /**
   * Score address match (0-100)
   */
  private scoreAddressMatch(
    addr1: string,
    city1: string,
    state1: string,
    addr2: string,
    city2: string,
    state2: string
  ): number {
    // State must match
    if (state1.toUpperCase() !== state2.toUpperCase()) {
      return 0;
    }
    
    // City should match (fuzzy)
    const cityScore = this.scoreFuzzyMatch(city1, city2);
    if (cityScore < 80) {
      return Math.min(cityScore, 30); // Cap at 30 if city doesn't match well
    }
    
    // Address matching
    const norm1 = this.normalizeAddress(addr1);
    const norm2 = this.normalizeAddress(addr2);
    
    // Extract street number
    const num1 = norm1.match(/^(\d+)/)?.[1];
    const num2 = norm2.match(/^(\d+)/)?.[1];
    
    // Street numbers must match
    if (num1 && num2 && num1 !== num2) {
      return 20; // Different street numbers
    }
    
    // Compare full normalized addresses
    const addressScore = this.scoreFuzzyMatch(norm1, norm2);
    
    return addressScore;
  }
  
  /**
   * Fuzzy string matching (0-100)
   */
  private scoreFuzzyMatch(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 100;
    if (!s1 || !s2) return 0;
    
    // Levenshtein distance based score
    const maxLen = Math.max(s1.length, s2.length);
    const distance = this.levenshteinDistance(s1, s2);
    const similarity = ((maxLen - distance) / maxLen) * 100;
    
    return Math.round(similarity);
  }
  
  /**
   * Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1, // substitution
            dp[i - 1][j] + 1,     // deletion
            dp[i][j - 1] + 1      // insertion
          );
        }
      }
    }
    
    return dp[m][n];
  }
  
  /**
   * Normalize address for comparison
   */
  private normalizeAddress(address: string): string {
    return address
      .toUpperCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\bSTREET\b/g, 'ST')
      .replace(/\bAVENUE\b/g, 'AVE')
      .replace(/\bBOULEVARD\b/g, 'BLVD')
      .replace(/\bDRIVE\b/g, 'DR')
      .replace(/\bLANE\b/g, 'LN')
      .replace(/\bROAD\b/g, 'RD')
      .replace(/\bCOURT\b/g, 'CT')
      .replace(/\bCIRCLE\b/g, 'CIR')
      .replace(/\bNORTH\b/g, 'N')
      .replace(/\bSOUTH\b/g, 'S')
      .replace(/\bEAST\b/g, 'E')
      .replace(/\bWEST\b/g, 'W')
      .replace(/\s+(APT|UNIT|STE|SUITE|#)\s*\S+$/i, '')
      .replace(/\s+/g, ' ');
  }
  
  /**
   * Build match result
   */
  private buildMatchResult(
    discovered: DiscoveredProperty,
    alProp: ApartmentLocatorProperty,
    confidence: number,
    reasons: string[]
  ): MatchResult {
    const addressMatch = this.scoreAddressMatch(
      discovered.address, discovered.city, discovered.state,
      alProp.address, alProp.city, alProp.state
    ) >= 80;
    
    const propertyNameMatch = discovered.propertyName && alProp.propertyName
      ? this.scoreFuzzyMatch(discovered.propertyName, alProp.propertyName) >= 70
      : false;
    
    const unitCountDelta = discovered.numberOfUnits && alProp.totalUnits
      ? Math.abs(discovered.numberOfUnits - alProp.totalUnits)
      : undefined;
    
    const yearBuiltDelta = discovered.yearBuilt && alProp.yearBuilt
      ? Math.abs(discovered.yearBuilt - alProp.yearBuilt)
      : undefined;
    
    // Determine match method
    let matchMethod: MatchResult['matchMethod'] = 'composite';
    if (addressMatch && confidence >= 90) {
      matchMethod = reasons[0]?.includes('Exact') ? 'exact_address' : 'fuzzy_address';
    } else if (propertyNameMatch) {
      matchMethod = 'property_name';
    }
    
    return {
      discoveredPropertyId: discovered.id,
      apartmentLocatorId: alProp.id,
      
      confidence,
      matchMethod,
      matchReasons: reasons,
      
      addressMatch,
      coordinateMatch: false, // TODO: Calculate if coordinates available
      ownerNameMatch: false,  // TODO: Check owner name
      propertyNameMatch,
      unitCountMatch: unitCountDelta !== undefined ? unitCountDelta <= 5 : false,
      yearBuiltMatch: yearBuiltDelta !== undefined ? yearBuiltDelta <= 2 : false,
      
      unitCountDelta,
      yearBuiltDelta,
      
      status: confidence >= 85 ? 'auto_matched' : 'review_required'
    };
  }
  
  /**
   * Get discovered properties from database
   */
  private async getDiscoveredProperties(
    county: string,
    state: string
  ): Promise<DiscoveredProperty[]> {
    // TODO: Query discovered_properties table
    // WHERE county = $1 AND state = $2 AND match_status = 'unmatched'
    return [];
  }
  
  /**
   * Get Apartment Locator properties from database
   */
  private async getApartmentLocatorProperties(
    county: string,
    state: string
  ): Promise<ApartmentLocatorProperty[]> {
    // TODO: Query apartment_locator_properties table
    // WHERE state = $1 AND (county = $2 OR city IN (SELECT city FROM discovered_properties WHERE county = $2))
    return [];
  }
  
  /**
   * Confirm a match
   */
  async confirmMatch(
    matchResultId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    // TODO: Update match in database
    // UPDATE property_matches SET status = 'confirmed', confirmed_by = $2, confirmed_at = NOW()
    // Also update discovered_properties.match_status = 'matched'
  }
  
  /**
   * Reject a match
   */
  async rejectMatch(
    matchResultId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    // TODO: Update match in database
    // UPDATE property_matches SET status = 'rejected', rejected_by = $2, rejection_reason = $3
  }
}

// Singleton
let matcherInstance: PropertyMatcherService | null = null;

export function getPropertyMatcherService(): PropertyMatcherService {
  if (!matcherInstance) {
    matcherInstance = new PropertyMatcherService();
  }
  return matcherInstance;
}
