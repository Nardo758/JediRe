/**
 * Property Info Provider Registry
 * 
 * Manages all property info providers and routes requests to the appropriate one.
 */

import { PropertyInfo, PropertyInfoProvider, GeocodeResult } from '../types';
import { ArcGISFeatureServerProvider } from './arcgis-provider';
import { COUNTY_CONFIGS, getCountyConfig } from './county-configs';

export class PropertyInfoProviderRegistry {
  private providers: Map<string, PropertyInfoProvider> = new Map();
  private initialized = false;
  
  constructor() {
    this.initializeProviders();
  }
  
  /**
   * Initialize providers from county configs
   */
  private initializeProviders(): void {
    if (this.initialized) return;
    
    for (const config of COUNTY_CONFIGS) {
      if (config.disabled) continue; // skip dead/blocked endpoints
      const provider = new ArcGISFeatureServerProvider(config);
      const key = `${config.county.toLowerCase()}_${config.state.toLowerCase()}`;
      this.providers.set(key, provider);
    }
    
    this.initialized = true;
    console.log(`[PropertyInfoRegistry] Initialized ${this.providers.size} providers`);
  }
  
  /**
   * Get all registered providers
   */
  getProviders(): PropertyInfoProvider[] {
    return Array.from(this.providers.values());
  }
  
  /**
   * Get provider by county and state
   */
  getProvider(county: string, state: string): PropertyInfoProvider | undefined {
    const key = `${county.toLowerCase().replace(/\s+county$/i, '').trim()}_${state.toLowerCase()}`;
    return this.providers.get(key);
  }
  
  /**
   * Find providers that can handle a location
   */
  async findProviders(
    address: string,
    city: string,
    state: string,
    county?: string
  ): Promise<PropertyInfoProvider[]> {
    const candidates: PropertyInfoProvider[] = [];
    
    // If county is provided, try direct lookup first
    if (county) {
      const provider = this.getProvider(county, state);
      if (provider) {
        const canHandle = await provider.canHandle(address, city, state, county);
        if (canHandle) {
          candidates.push(provider);
        }
      }
    }
    
    // If no county or direct lookup failed, check all providers for this state
    if (candidates.length === 0) {
      const stateProviders = Array.from(this.providers.values()).filter(
        p => p.config.coverageStates?.includes(state.toUpperCase())
      );
      
      for (const provider of stateProviders) {
        const canHandle = await provider.canHandle(address, city, state, county);
        if (canHandle) {
          candidates.push(provider);
        }
      }
    }
    
    // Sort by priority (lower = higher priority)
    candidates.sort((a, b) => a.config.priority - b.config.priority);
    
    return candidates;
  }
  
  /**
   * Fetch property info, trying providers in priority order
   */
  async fetchPropertyInfo(
    address: string,
    city: string,
    state: string,
    zip?: string,
    county?: string,
    coordinates?: { lat: number; lng: number }
  ): Promise<{ info: PropertyInfo | null; provider: string | null }> {
    // Get applicable providers
    const providers = await this.findProviders(address, city, state, county);
    
    if (providers.length === 0) {
      console.log(`[PropertyInfoRegistry] No providers available for ${city}, ${state}`);
      return { info: null, provider: null };
    }
    
    // Try each provider in order
    for (const provider of providers) {
      console.log(`[PropertyInfoRegistry] Trying provider: ${provider.config.name}`);
      
      try {
        const info = await provider.fetchPropertyInfo(address, city, state, zip, coordinates);
        
        if (info) {
          console.log(`[PropertyInfoRegistry] Success with provider: ${provider.config.name}`);
          return { info, provider: provider.config.name };
        }
      } catch (error) {
        console.error(`[PropertyInfoRegistry] Error with ${provider.config.name}:`, error);
        // Continue to next provider
      }
    }
    
    return { info: null, provider: null };
  }
  
  /**
   * Check coverage for a location
   */
  checkCoverage(state: string, county?: string): {
    hasCoverage: boolean;
    providers: string[];
  } {
    const normalizedState = state.toUpperCase();
    
    const matchingProviders = Array.from(this.providers.values())
      .filter(p => {
        if (!p.config.coverageStates?.includes(normalizedState)) {
          return false;
        }
        if (county && p.config.coverageCounties) {
          const normalizedCounty = county.toUpperCase().replace(/\s+COUNTY$/i, '');
          return p.config.coverageCounties.some(
            c => c.toUpperCase().replace(/\s+COUNTY$/i, '') === normalizedCounty
          );
        }
        return true;
      })
      .map(p => p.config.name);
    
    return {
      hasCoverage: matchingProviders.length > 0,
      providers: matchingProviders
    };
  }
  
  /**
   * Health check all providers
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    await Promise.all(
      Array.from(this.providers.entries()).map(async ([key, provider]) => {
        try {
          const healthy = await provider.healthCheck();
          results.set(key, healthy);
        } catch {
          results.set(key, false);
        }
      })
    );
    
    return results;
  }
  
  /**
   * Get coverage statistics
   */
  getCoverageStats(): {
    totalProviders: number;
    byState: Record<string, number>;
    counties: string[];
  } {
    const byState: Record<string, number> = {};
    const counties: string[] = [];
    
    for (const config of COUNTY_CONFIGS) {
      byState[config.state] = (byState[config.state] || 0) + 1;
      counties.push(`${config.county}, ${config.state}`);
    }
    
    return {
      totalProviders: COUNTY_CONFIGS.length,
      byState,
      counties
    };
  }
}

// Singleton instance
let registryInstance: PropertyInfoProviderRegistry | null = null;

export function getPropertyInfoRegistry(): PropertyInfoProviderRegistry {
  if (!registryInstance) {
    registryInstance = new PropertyInfoProviderRegistry();
  }
  return registryInstance;
}
