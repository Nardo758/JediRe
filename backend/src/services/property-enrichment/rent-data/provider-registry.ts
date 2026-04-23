/**
 * Rent Data Provider Registry
 * 
 * Manages all rent data providers and routes requests to the appropriate one.
 */

import { RentData, RentDataProvider } from '../types';
import { ApartmentsComProvider } from './apartments-com-provider';

export class RentDataProviderRegistry {
  private providers: RentDataProvider[] = [];
  private initialized = false;
  
  constructor() {
    this.initializeProviders();
  }
  
  /**
   * Initialize all rent data providers
   */
  private initializeProviders(): void {
    if (this.initialized) return;
    
    // Add providers in priority order
    this.providers = [
      new ApartmentsComProvider(),
      // Future providers:
      // new CoStarAPIProvider(),
      // new ZillowProvider(),
      // new RentCafeProvider(),
    ];
    
    // Sort by priority
    this.providers.sort((a, b) => a.config.priority - b.config.priority);
    
    this.initialized = true;
    console.log(`[RentDataRegistry] Initialized ${this.providers.length} providers`);
  }
  
  /**
   * Get all registered providers
   */
  getProviders(): RentDataProvider[] {
    return [...this.providers];
  }
  
  /**
   * Get provider by name
   */
  getProvider(name: string): RentDataProvider | undefined {
    return this.providers.find(p => p.config.name === name);
  }
  
  /**
   * Add a custom provider (e.g., for a specific property management company)
   */
  addProvider(provider: RentDataProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.config.priority - b.config.priority);
  }
  
  /**
   * Find providers that can handle a property
   */
  async findProviders(
    address: string,
    city: string,
    state: string
  ): Promise<RentDataProvider[]> {
    const candidates: RentDataProvider[] = [];
    
    for (const provider of this.providers) {
      if (!provider.config.enabled) continue;
      
      const canHandle = await provider.canHandle(address, city, state);
      if (canHandle) {
        candidates.push(provider);
      }
    }
    
    return candidates;
  }
  
  /**
   * Fetch rent data, trying providers in priority order
   */
  async fetchRentData(
    address: string,
    city: string,
    state: string,
    propertyName?: string
  ): Promise<{ data: RentData | null; provider: string | null }> {
    const providers = await this.findProviders(address, city, state);
    
    if (providers.length === 0) {
      console.log(`[RentDataRegistry] No providers available for ${city}, ${state}`);
      return { data: null, provider: null };
    }
    
    // Try each provider in order
    for (const provider of providers) {
      console.log(`[RentDataRegistry] Trying provider: ${provider.config.name}`);
      
      try {
        const data = await provider.fetchRentData(address, city, state, propertyName);
        
        if (data && data.unitMix.length > 0) {
          console.log(`[RentDataRegistry] Success with provider: ${provider.config.name}`);
          return { data, provider: provider.config.name };
        }
      } catch (error) {
        console.error(`[RentDataRegistry] Error with ${provider.config.name}:`, error);
        // Continue to next provider
      }
    }
    
    return { data: null, provider: null };
  }
  
  /**
   * Health check all providers
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    await Promise.all(
      this.providers.map(async (provider) => {
        try {
          const healthy = await provider.healthCheck();
          results.set(provider.config.name, healthy);
        } catch {
          results.set(provider.config.name, false);
        }
      })
    );
    
    return results;
  }
  
  /**
   * Get provider stats
   */
  getStats(): {
    totalProviders: number;
    enabledProviders: number;
    providers: Array<{
      name: string;
      type: string;
      enabled: boolean;
      priority: number;
    }>;
  } {
    return {
      totalProviders: this.providers.length,
      enabledProviders: this.providers.filter(p => p.config.enabled).length,
      providers: this.providers.map(p => ({
        name: p.config.name,
        type: p.config.type,
        enabled: p.config.enabled,
        priority: p.config.priority
      }))
    };
  }
}

// Singleton instance
let registryInstance: RentDataProviderRegistry | null = null;

export function getRentDataRegistry(): RentDataProviderRegistry {
  if (!registryInstance) {
    registryInstance = new RentDataProviderRegistry();
  }
  return registryInstance;
}
