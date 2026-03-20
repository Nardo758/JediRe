/**
 * Apartment Locator AI Sync Service
 * 
 * Syncs rent data from Apartment Locator AI into JediRE properties
 * Base URL: https://apartment-locator-ai-real.replit.app/api/jedi/
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

const pool = getPool();

const APARTMENT_LOCATOR_URL = process.env.APARTMENT_LOCATOR_API_URL || 'https://apartment-locator-ai-real.replit.app';
const API_KEY = process.env.APARTMENT_LOCATOR_API_KEY || '';

interface ApartmentLocatorMarketData {
  location: {
    city: string;
    state: string;
  };
  supply: {
    total_properties: number;
    total_listings: number;
    available_units: number;
    avg_sqft: number;
  };
  pricing: {
    avg_rent: number;
    min_rent: number;
    max_rent: number;
    avg_rent_by_type: {
      studio: number;
      '1br': number;
      '2br': number;
      '3br': number;
    };
    concession_rate: number;
    avg_concession_value: number;
  };
  demand: {
    total_renters: number;
    avg_budget: number;
    lease_expirations_90d: number;
  };
  forecast: {
    units_delivering_30d: number;
    units_delivering_60d: number;
    units_delivering_90d: number;
  };
}

interface RentComp {
  property_id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  rent_per_sqft: number;
  units_available: number;
  concessions: string;
}

interface SupplyProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  rent: number;
  bedrooms: number;
  bathrooms: string;
  square_feet: number;
  total_units: number;
  units_available: number;
  concessions: string;
}

export class ApartmentLocatorSyncService {
  /**
   * Fetch market data for a city
   */
  async fetchMarketData(city: string, state: string): Promise<ApartmentLocatorMarketData | null> {
    try {
      const url = `${APARTMENT_LOCATOR_URL}/api/jedi/market-data?city=${encodeURIComponent(city)}&state=${state}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        logger.error(`Apartment Locator API error: ${response.status}`, { city, state });
        return null;
      }
      
      const result = await response.json();
      return result.success ? result.data : null;
      
    } catch (error: any) {
      logger.error('Failed to fetch market data', { error: error.message, city, state });
      return null;
    }
  }
  
  /**
   * Fetch rent comps for a city
   */
  async fetchRentComps(city: string, state: string): Promise<RentComp[]> {
    try {
      const url = `${APARTMENT_LOCATOR_URL}/api/jedi/rent-comps?city=${encodeURIComponent(city)}&state=${state}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        logger.error(`Apartment Locator API error: ${response.status}`, { city, state });
        return [];
      }
      
      const result = await response.json();
      return result.success ? result.data : [];
      
    } catch (error: any) {
      logger.error('Failed to fetch rent comps', { error: error.message, city, state });
      return [];
    }
  }
  
  /**
   * Fetch supply pipeline for a city
   */
  async fetchSupplyPipeline(city: string, state: string): Promise<SupplyProperty[]> {
    try {
      const url = `${APARTMENT_LOCATOR_URL}/api/jedi/supply-pipeline?city=${encodeURIComponent(city)}&state=${state}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        logger.error(`Apartment Locator API error: ${response.status}`, { city, state });
        return [];
      }
      
      const result = await response.json();
      return result.success ? result.data : [];
      
    } catch (error: any) {
      logger.error('Failed to fetch supply pipeline', { error: error.message, city, state });
      return [];
    }
  }
  
  async syncCity(city: string, state: string): Promise<{ success: boolean; stats: any }> {
    logger.info(`Starting ${city} sync from Apartment Locator AI...`);
    
    try {
      const marketData = await this.fetchMarketData(city, state);
      
      if (!marketData) {
        throw new Error('Failed to fetch market data');
      }
      
      logger.info('Market data fetched', {
        total_properties: marketData.supply.total_properties,
        avg_rent: marketData.pricing.avg_rent
      });
      
      await pool.query(`
        INSERT INTO apartment_market_snapshots (
          city, state, snapshot_date,
          total_properties, total_listings, available_units,
          avg_rent, min_rent, max_rent,
          studio_rent, one_br_rent, two_br_rent, three_br_rent,
          source
        ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'apartment_locator_ai')
        ON CONFLICT (city, state, snapshot_date) DO UPDATE SET
          total_properties = EXCLUDED.total_properties,
          total_listings = EXCLUDED.total_listings,
          available_units = EXCLUDED.available_units,
          avg_rent = EXCLUDED.avg_rent,
          updated_at = NOW()
      `, [
        city,
        state,
        marketData.supply.total_properties,
        marketData.supply.total_listings,
        marketData.supply.available_units,
        marketData.pricing.avg_rent,
        marketData.pricing.min_rent,
        marketData.pricing.max_rent,
        marketData.pricing.avg_rent_by_type?.studio,
        marketData.pricing.avg_rent_by_type?.['1br'],
        marketData.pricing.avg_rent_by_type?.['2br'],
        marketData.pricing.avg_rent_by_type?.['3br']
      ]);
      
      const rentComps = await this.fetchRentComps(city, state);
      logger.info(`Fetched ${rentComps.length} rent comps`);
      
      const supplyProps = await this.fetchSupplyPipeline(city, state);
      logger.info(`Fetched ${supplyProps.length} supply properties`);
      
      // 5. Merge supply properties into main properties table
      let inserted = 0;
      let updated = 0;
      
      const safeInt = (v: any): number | null => { const n = parseInt(v); return isNaN(n) ? null : n; };
      const safeFloat = (v: any): number | null => { const n = parseFloat(v); return isNaN(n) ? null : n; };

      for (const prop of supplyProps) {
        try {
          const units = safeInt(prop.total_units);
          const rent = safeFloat(prop.rent);
          const beds = safeInt(prop.bedrooms);
          const baths = safeFloat(prop.bathrooms);
          const sqft = safeInt(prop.square_feet);
          const avail = safeInt(prop.units_available);

          const existing = await pool.query(`
            SELECT id FROM properties
            WHERE LOWER(address_line1) = LOWER($1)
              AND LOWER(city) = LOWER($2)
              AND state_code = $3
            LIMIT 1
          `, [prop.address, prop.city, prop.state]);
          
          if (existing.rows.length > 0) {
            await pool.query(`
              UPDATE properties SET
                name = COALESCE($1, name),
                units = COALESCE($2, units),
                rent = COALESCE($3, rent),
                beds = COALESCE($4, beds),
                baths = COALESCE($5, baths),
                sqft = COALESCE($6, sqft),
                current_occupancy = CASE
                  WHEN $7 > 0 AND $8 > 0 THEN (($7 - $8)::float / $7) * 100
                  ELSE current_occupancy
                END,
                apartment_locator_id = $9,
                last_enriched_at = NOW(),
                updated_at = NOW()
              WHERE id = $10
            `, [
              prop.name,
              units,
              rent,
              beds,
              baths,
              sqft,
              units,
              avail,
              prop.id,
              existing.rows[0].id
            ]);
            updated++;
          } else {
            await pool.query(`
              INSERT INTO properties (
                name, address_line1, city, state_code, zip,
                property_type, units, rent, beds, baths, sqft,
                current_occupancy,
                apartment_locator_id, enrichment_source, enriched_at
              ) VALUES ($1, $2, $3, $4, $5, 'multi_family', $6, $7, $8, $9, $10, 
                CASE 
                  WHEN $6 > 0 AND $11 > 0 THEN (($6 - $11)::float / $6) * 100
                  ELSE NULL
                END,
                $12, 'apartment_locator_ai', NOW())
            `, [
              prop.name,
              prop.address,
              prop.city,
              prop.state,
              prop.zip_code,
              units,
              rent,
              beds,
              baths,
              sqft,
              avail,
              prop.id
            ]);
            inserted++;
          }
        } catch (error: any) {
          logger.error('Failed to sync property', { 
            property: prop.name, 
            error: error.message 
          });
        }
      }
      
      logger.info('Atlanta sync complete', { inserted, updated, total: supplyProps.length });
      
      return {
        success: true,
        stats: {
          market_data: marketData,
          rent_comps_count: rentComps.length,
          properties_inserted: inserted,
          properties_updated: updated,
          total_properties: supplyProps.length
        }
      };
      
    } catch (error: any) {
      logger.error(`${city} sync failed`, { error: error.message });
      return {
        success: false,
        stats: { error: error.message }
      };
    }
  }

  async syncAtlanta(): Promise<{ success: boolean; stats: any }> {
    return this.syncCity('Atlanta', 'GA');
  }
  
  async syncAllMetros(): Promise<{ success: boolean; results: any[] }> {
    const metros = [
      { city: 'Atlanta', state: 'GA' },
      { city: 'Houston', state: 'TX' },
      { city: 'Dallas', state: 'TX' },
      { city: 'Austin', state: 'TX' },
      { city: 'San Antonio', state: 'TX' },
      { city: 'Charlotte', state: 'NC' },
      { city: 'Nashville', state: 'TN' },
      { city: 'Orlando', state: 'FL' },
      { city: 'Tampa', state: 'FL' },
      { city: 'Jacksonville', state: 'FL' },
      { city: 'Miami', state: 'FL' },
    ];
    
    const results = [];
    
    for (const metro of metros) {
      try {
        const cityResult = await this.syncCity(metro.city, metro.state);
        
        results.push({
          metro: `${metro.city}, ${metro.state}`,
          success: cityResult.success,
          properties: cityResult.stats.total_properties || 0,
          inserted: cityResult.stats.properties_inserted || 0,
          updated: cityResult.stats.properties_updated || 0,
          avg_rent: cityResult.stats.market_data?.pricing?.avg_rent
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
      } catch (error: any) {
        logger.error(`Failed to sync ${metro.city}`, { error: error.message });
        results.push({
          metro: `${metro.city}, ${metro.state}`,
          success: false,
          error: error.message
        });
      }
    }
    
    const allSucceeded = results.every(r => r.success);
    return { success: allSucceeded, results };
  }
}

export const apartmentLocatorSyncService = new ApartmentLocatorSyncService();
