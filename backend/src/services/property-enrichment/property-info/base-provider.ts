/**
 * Base Property Info Provider
 * Abstract class that all county providers extend
 */

import { PropertyInfo, PropertyInfoProvider, ProviderConfig } from '../types';

export abstract class BasePropertyInfoProvider implements PropertyInfoProvider {
  abstract readonly config: ProviderConfig;

  // Per-provider rate-limit state (in-memory; persists for process lifetime)
  private _requestLog: number[] = [];
  private _dailyResetAt: number = 0;
  private _dailyCount: number = 0;

  // DB-overridden rate limits (loaded lazily from property_data_providers).
  private _dbLimits: { requestsPerMinute?: number; requestsPerDay?: number } | null = null;
  private _dbLimitsLoadedAt: number = 0;
  private static readonly DB_LIMITS_TTL_MS = 5 * 60 * 1000; // refresh every 5 min

  /**
   * Load this provider's rate limits from the property_data_providers table.
   * Falls back silently to the static config values if the row is missing or
   * the DB lookup fails. Cached for DB_LIMITS_TTL_MS so we don't hammer PG.
   */
  private async loadDbLimits(): Promise<void> {
    const now = Date.now();
    if (this._dbLimits && (now - this._dbLimitsLoadedAt) < BasePropertyInfoProvider.DB_LIMITS_TTL_MS) {
      return;
    }
    try {
      const { query } = await import('../../../database/connection');
      const r = await query<{ requests_per_minute: number | null; requests_per_day: number | null }>(
        `SELECT requests_per_minute, requests_per_day
           FROM property_data_providers
          WHERE provider_name = $1 AND is_active = true
          LIMIT 1`,
        [this.config.name]
      );
      const row = r.rows[0];
      this._dbLimits = {
        requestsPerMinute: row?.requests_per_minute ?? this.config.requestsPerMinute,
        requestsPerDay: row?.requests_per_day ?? this.config.requestsPerDay,
      };
      this._dbLimitsLoadedAt = now;
    } catch {
      this._dbLimits = {
        requestsPerMinute: this.config.requestsPerMinute,
        requestsPerDay: this.config.requestsPerDay,
      };
      this._dbLimitsLoadedAt = now;
    }
  }

  /**
   * Effective rate limits: DB row overrides static config when available.
   */
  protected effectiveLimits(): { requestsPerMinute?: number; requestsPerDay?: number } {
    return {
      requestsPerMinute: this._dbLimits?.requestsPerMinute ?? this.config.requestsPerMinute,
      requestsPerDay: this._dbLimits?.requestsPerDay ?? this.config.requestsPerDay,
    };
  }

  /**
   * Enforce the provider's rate limits (requestsPerMinute and requestsPerDay).
   * Awaits until a request slot opens up. Throws if the daily cap is exhausted.
   */
  protected async enforceRateLimit(): Promise<void> {
    await this.loadDbLimits();
    const limits = this.effectiveLimits();
    const now = Date.now();

    // Daily cap (rolling 24h window)
    if (limits.requestsPerDay && limits.requestsPerDay > 0) {
      if (now > this._dailyResetAt) {
        this._dailyResetAt = now + 24 * 60 * 60 * 1000;
        this._dailyCount = 0;
      }
      if (this._dailyCount >= limits.requestsPerDay) {
        const waitMs = Math.max(1000, this._dailyResetAt - now);
        console.warn(`[${this.config.name}] Daily rate limit (${limits.requestsPerDay}) reached — queuing for ${Math.ceil(waitMs / 60000)} min`);
        await new Promise(r => setTimeout(r, waitMs));
        this._dailyResetAt = Date.now() + 24 * 60 * 60 * 1000;
        this._dailyCount = 0;
      }
    }

    // Per-minute cap
    if (limits.requestsPerMinute && limits.requestsPerMinute > 0) {
      const windowStart = now - 60_000;
      this._requestLog = this._requestLog.filter(t => t > windowStart);
      if (this._requestLog.length >= limits.requestsPerMinute) {
        const oldest = this._requestLog[0];
        const waitMs = Math.max(0, oldest + 60_000 - now) + 50;
        await new Promise(r => setTimeout(r, waitMs));
        this._requestLog = this._requestLog.filter(t => t > Date.now() - 60_000);
      }
      this._requestLog.push(Date.now());
    }

    if (limits.requestsPerDay && limits.requestsPerDay > 0) this._dailyCount++;
  }

  /**
   * Check if this provider can handle the given location
   */
  abstract canHandle(
    address: string,
    city: string,
    state: string,
    county?: string
  ): Promise<boolean>;
  
  /**
   * Fetch property info from the provider
   */
  abstract fetchPropertyInfo(
    address: string,
    city: string,
    state: string,
    zip?: string,
    coordinates?: { lat: number; lng: number }
  ): Promise<PropertyInfo | null>;
  
  /**
   * Health check - verify provider is accessible
   */
  abstract healthCheck(): Promise<boolean>;
  
  /**
   * Normalize address for searching
   */
  protected normalizeAddress(address: string): string {
    return address
      .toUpperCase()
      .trim()
      // Standardize directionals
      .replace(/\bNORTH\b/g, 'N')
      .replace(/\bSOUTH\b/g, 'S')
      .replace(/\bEAST\b/g, 'E')
      .replace(/\bWEST\b/g, 'W')
      .replace(/\bNORTHEAST\b/g, 'NE')
      .replace(/\bNORTHWEST\b/g, 'NW')
      .replace(/\bSOUTHEAST\b/g, 'SE')
      .replace(/\bSOUTHWEST\b/g, 'SW')
      // Standardize street types
      .replace(/\bSTREET\b/g, 'ST')
      .replace(/\bAVENUE\b/g, 'AVE')
      .replace(/\bBOULEVARD\b/g, 'BLVD')
      .replace(/\bDRIVE\b/g, 'DR')
      .replace(/\bLANE\b/g, 'LN')
      .replace(/\bROAD\b/g, 'RD')
      .replace(/\bCOURT\b/g, 'CT')
      .replace(/\bCIRCLE\b/g, 'CIR')
      .replace(/\bPLACE\b/g, 'PL')
      .replace(/\bTERRACE\b/g, 'TER')
      .replace(/\bPARKWAY\b/g, 'PKWY')
      .replace(/\bHIGHWAY\b/g, 'HWY')
      // Remove unit/apt
      .replace(/\s+(APT|UNIT|STE|SUITE|#)\s*\S+$/i, '')
      // Normalize spaces
      .replace(/\s+/g, ' ');
  }
  
  /**
   * Extract street number from address
   */
  protected extractStreetNumber(address: string): string | null {
    const match = address.match(/^(\d+)/);
    return match ? match[1] : null;
  }
  
  /**
   * Extract street name from address
   */
  protected extractStreetName(address: string): string | null {
    // Remove street number and normalize
    const normalized = this.normalizeAddress(address);
    const withoutNumber = normalized.replace(/^\d+\s+/, '');
    
    // Try to extract just the base street name
    const parts = withoutNumber.split(/\s+/);
    if (parts.length >= 2) {
      // Return everything except the last part (street type)
      return parts.slice(0, -1).join(' ');
    }
    return withoutNumber;
  }
  
  /**
   * Parse year from various formats
   */
  protected parseYear(value: unknown): number | undefined {
    if (!value) return undefined;
    
    const str = String(value).trim();
    const year = parseInt(str.slice(0, 4), 10);
    
    if (year >= 1800 && year <= new Date().getFullYear() + 5) {
      return year;
    }
    return undefined;
  }
  
  /**
   * Parse number from various formats
   */
  protected parseNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[,\$]/g, ''));
    return isNaN(num) ? undefined : num;
  }
  
  /**
   * Parse boolean from various formats
   */
  protected parseBoolean(value: unknown): boolean | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    
    const str = String(value).toLowerCase().trim();
    if (['yes', 'y', 'true', '1'].includes(str)) return true;
    if (['no', 'n', 'false', '0'].includes(str)) return false;
    return undefined;
  }
  
  /**
   * Parse date from various formats
   */
  protected parseDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    
    // Unix timestamp (milliseconds)
    if (typeof value === 'number') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return date;
    }
    
    // String date
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return date;
    }
    
    return undefined;
  }
  
  /**
   * Detect property type from land use code/description
   */
  protected detectPropertyType(
    landUseCode?: string,
    landUseDesc?: string
  ): PropertyInfo['propertyType'] {
    const code = landUseCode?.toLowerCase() || '';
    const desc = landUseDesc?.toLowerCase() || '';
    const combined = `${code} ${desc}`;
    
    // Multifamily
    if (
      combined.includes('multifamily') ||
      combined.includes('multi-family') ||
      combined.includes('apartment') ||
      combined.includes('multi family') ||
      code.startsWith('003') || // Common MF codes
      code.startsWith('04') ||
      code.startsWith('100')
    ) {
      return 'multifamily';
    }
    
    // Office
    if (
      combined.includes('office') ||
      code.startsWith('017') ||
      code.startsWith('18')
    ) {
      return 'office';
    }
    
    // Retail
    if (
      combined.includes('retail') ||
      combined.includes('shopping') ||
      combined.includes('store') ||
      code.startsWith('011') ||
      code.startsWith('12')
    ) {
      return 'retail';
    }
    
    // Industrial
    if (
      combined.includes('industrial') ||
      combined.includes('warehouse') ||
      combined.includes('manufacturing') ||
      code.startsWith('04') ||
      code.startsWith('29')
    ) {
      return 'industrial';
    }
    
    // Land
    if (
      combined.includes('vacant') ||
      combined.includes('land') ||
      code.startsWith('00') ||
      code.startsWith('10')
    ) {
      return 'land';
    }
    
    // Mixed Use
    if (
      combined.includes('mixed') ||
      combined.includes('mixed-use')
    ) {
      return 'mixed_use';
    }
    
    return 'other';
  }
  
  /**
   * Clean string value
   */
  protected cleanString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    const str = String(value).trim();
    return str === '' ? undefined : str;
  }
}
