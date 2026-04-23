/**
 * Base Rent Data Provider
 * Abstract class that all rent data providers extend
 */

import { RentData, RentDataProvider, ProviderConfig, UnitType } from '../types';

export abstract class BaseRentDataProvider implements RentDataProvider {
  abstract readonly config: ProviderConfig;
  
  /**
   * Check if this provider can handle the given property
   */
  abstract canHandle(
    address: string,
    city: string,
    state: string
  ): Promise<boolean>;
  
  /**
   * Fetch rent data from the provider
   */
  abstract fetchRentData(
    address: string,
    city: string,
    state: string,
    propertyName?: string
  ): Promise<RentData | null>;
  
  /**
   * Health check - verify provider is accessible
   */
  abstract healthCheck(): Promise<boolean>;
  
  /**
   * Calculate aggregate metrics from unit mix
   */
  protected calculateAggregates(unitMix: UnitType[]): {
    totalUnits: number;
    avgAskingRent: number;
    avgEffectiveRent?: number;
    avgRentPerSqFt?: number;
    minRent?: number;
    maxRent?: number;
  } {
    if (unitMix.length === 0) {
      return {
        totalUnits: 0,
        avgAskingRent: 0
      };
    }
    
    let totalUnits = 0;
    let totalRentWeighted = 0;
    let totalEffectiveWeighted = 0;
    let totalSqFtWeighted = 0;
    let hasEffective = false;
    let hasSqFt = false;
    let minRent = Infinity;
    let maxRent = -Infinity;
    
    for (const unit of unitMix) {
      const count = unit.unitCount || 1;
      totalUnits += count;
      totalRentWeighted += unit.askingRent * count;
      
      if (unit.effectiveRent !== undefined) {
        hasEffective = true;
        totalEffectiveWeighted += unit.effectiveRent * count;
      }
      
      if (unit.sqFt && unit.askingRent) {
        hasSqFt = true;
        totalSqFtWeighted += (unit.askingRent / unit.sqFt) * count;
      }
      
      minRent = Math.min(minRent, unit.askingRent);
      maxRent = Math.max(maxRent, unit.askingRent);
    }
    
    return {
      totalUnits,
      avgAskingRent: totalUnits > 0 ? Math.round(totalRentWeighted / totalUnits) : 0,
      avgEffectiveRent: hasEffective && totalUnits > 0 
        ? Math.round(totalEffectiveWeighted / totalUnits) 
        : undefined,
      avgRentPerSqFt: hasSqFt && totalUnits > 0 
        ? Math.round((totalSqFtWeighted / totalUnits) * 100) / 100 
        : undefined,
      minRent: minRent !== Infinity ? minRent : undefined,
      maxRent: maxRent !== -Infinity ? maxRent : undefined
    };
  }
  
  /**
   * Normalize property name for searching
   */
  protected normalizePropertyName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Clean and parse rent value
   */
  protected parseRent(value: string | number): number | null {
    if (typeof value === 'number') return value;
    
    const cleaned = value.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  
  /**
   * Parse bed count from various formats
   */
  protected parseBeds(value: string): number {
    const lower = value.toLowerCase();
    
    if (lower.includes('studio') || lower === '0' || lower === 'studio') {
      return 0;
    }
    
    const match = value.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }
  
  /**
   * Parse bath count from various formats
   */
  protected parseBaths(value: string): number {
    const match = value.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 1;
  }
  
  /**
   * Parse square footage
   */
  protected parseSqFt(value: string | number): number | null {
    if (typeof value === 'number') return value;
    
    const cleaned = value.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
  }
  
  /**
   * Calculate rent per square foot
   */
  protected calcRentPSF(rent: number, sqft: number): number | undefined {
    if (!sqft || sqft === 0) return undefined;
    return Math.round((rent / sqft) * 100) / 100;
  }
  
  /**
   * Parse occupancy percentage
   */
  protected parseOccupancy(value: string | number): number | null {
    if (typeof value === 'number') {
      return value > 1 ? value : value * 100;
    }
    
    const match = value.match(/(\d+\.?\d*)/);
    if (!match) return null;
    
    const num = parseFloat(match[1]);
    return num > 1 ? num : num * 100;
  }
  
  /**
   * Extract concession percentage from text
   */
  protected parseConcessionsFromText(text: string): {
    concession: string;
    value?: number;
    pct?: number;
  } | null {
    if (!text) return null;
    
    const lower = text.toLowerCase();
    
    // Look for "X weeks free" or "X months free"
    const weekMatch = lower.match(/(\d+)\s*weeks?\s*free/i);
    if (weekMatch) {
      const weeks = parseInt(weekMatch[1], 10);
      const pct = (weeks / 52) * 100;
      return {
        concession: `${weeks} weeks free`,
        pct: Math.round(pct * 100) / 100
      };
    }
    
    const monthMatch = lower.match(/(\d+\.?\d*)\s*months?\s*free/i);
    if (monthMatch) {
      const months = parseFloat(monthMatch[1]);
      const pct = (months / 12) * 100;
      return {
        concession: `${months} month${months > 1 ? 's' : ''} free`,
        pct: Math.round(pct * 100) / 100
      };
    }
    
    // Look for dollar amounts
    const dollarMatch = lower.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*off/i);
    if (dollarMatch) {
      const value = parseFloat(dollarMatch[1].replace(/,/g, ''));
      return {
        concession: `$${value} off`,
        value
      };
    }
    
    // Look for percentage off
    const pctMatch = lower.match(/(\d+)%\s*off/i);
    if (pctMatch) {
      const pct = parseInt(pctMatch[1], 10);
      return {
        concession: `${pct}% off`,
        pct
      };
    }
    
    return { concession: text };
  }
}
