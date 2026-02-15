import axios, { AxiosInstance } from 'axios';
import { Pool } from 'pg';

interface SyncResult {
  properties: number;
  marketSnapshot: boolean;
  rentComps: number;
  supplyPipeline: number;
  errors: string[];
  duration: number;
}

export class ApartmentDataSyncService {
  private pool: Pool;
  private baseURL: string;
  private apiKeys: string[];

  constructor(pool: Pool) {
    this.pool = pool;
    this.baseURL = process.env.APARTMENT_LOCATOR_API_URL || 'https://apartment-locator-ai-real.replit.app';
    this.apiKeys = [
      process.env.APARTMENT_LOCATOR_API_KEY || '',
      process.env.API_KEY_APARTMENT_LOCATOR || '',
    ].filter(k => k.length > 0);
    
    console.log(`ApartmentDataSync initialized with URL: ${this.baseURL}`);
  }

  private createClient(apiKey?: string): AxiosInstance {
    return axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
      },
    });
  }

  private isJsonResponse(data: any, contentType?: string): boolean {
    if (contentType && contentType.includes('text/html')) return false;
    if (typeof data === 'string' && data.trim().startsWith('<!DOCTYPE')) return false;
    if (typeof data === 'string' && data.trim().startsWith('<html')) return false;
    return true;
  }

  private async tryEndpoint(endpoint: string): Promise<any> {
    const noAuthClient = this.createClient();
    try {
      const response = await noAuthClient.get(endpoint);
      if (!this.isJsonResponse(response.data, response.headers['content-type'])) {
        throw { response: { status: 404 }, message: 'HTML response (SPA fallback)' };
      }
      return response.data;
    } catch (e: any) {
      if (e.response?.status === 401 || e.response?.status === 403) {
        for (const key of this.apiKeys) {
          try {
            const authClient = this.createClient(key);
            const response = await authClient.get(endpoint);
            if (!this.isJsonResponse(response.data, response.headers['content-type'])) {
              continue;
            }
            console.log(`Authenticated successfully with key for ${endpoint}`);
            return response.data;
          } catch (authErr: any) {
            console.log(`Auth key failed for ${endpoint}: ${authErr.response?.status || authErr.message}`);
            continue;
          }
        }
      }
      throw e;
    }
  }

  async syncAll(city: string = 'Atlanta', state: string = 'GA'): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      properties: 0,
      marketSnapshot: false,
      rentComps: 0,
      supplyPipeline: 0,
      errors: [],
      duration: 0,
    };

    console.log(`Starting full data sync for ${city}, ${state}...`);

    const syncTasks = [
      this.syncProperties(city, state, result),
      this.syncMarketData(city, state, result),
      this.syncRentComps(city, state, result),
      this.syncSupplyPipeline(city, state, result),
      this.syncAbsorptionRate(city, state, result),
    ];

    await Promise.allSettled(syncTasks);

    result.duration = Date.now() - startTime;
    
    await this.logSync(city, state, result);
    
    console.log(`Data sync complete in ${result.duration}ms:`, {
      properties: result.properties,
      marketSnapshot: result.marketSnapshot,
      rentComps: result.rentComps,
      supplyPipeline: result.supplyPipeline,
      errors: result.errors.length,
    });

    return result;
  }

  private async syncProperties(city: string, state: string, result: SyncResult): Promise<void> {
    try {
      console.log('Syncing properties...');
      
      const endpoints = [
        `/api/jedi/market-data?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
        `/api/admin/properties?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
        `/api/properties?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
        `/api/v1/properties?city=${encodeURIComponent(city)}`,
        `/api/admin/properties`,
        `/api/properties`,
        `/api/v1/properties`,
      ];

      let properties: any[] = [];
      
      for (const endpoint of endpoints) {
        try {
          const responseData = await this.tryEndpoint(endpoint);
          const data = responseData?.data || responseData?.properties || responseData;
          
          if (Array.isArray(data) && data.length > 0) {
            properties = data;
            console.log(`Found ${properties.length} properties from ${endpoint}`);
            break;
          }
        } catch (e: any) {
          console.log(`Endpoint ${endpoint} failed: ${e.response?.status || e.message}`);
        }
      }

      for (const prop of properties) {
        try {
          await this.pool.query(`
            INSERT INTO apartment_properties (
              external_id, name, address, city, state, zip_code,
              latitude, longitude, year_built, year_renovated,
              property_class, building_type, management_company,
              total_units, current_occupancy_percent, avg_days_to_lease,
              unit_count, avg_rent, min_rent, max_rent,
              concession_count, parking_fee_monthly, pet_rent_monthly,
              application_fee, admin_fee, synced_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10,
              $11, $12, $13,
              $14, $15, $16,
              $17, $18, $19, $20,
              $21, $22, $23,
              $24, $25, NOW(), NOW()
            )
            ON CONFLICT (external_id) DO UPDATE SET
              name = EXCLUDED.name,
              address = EXCLUDED.address,
              city = EXCLUDED.city,
              state = EXCLUDED.state,
              zip_code = EXCLUDED.zip_code,
              latitude = EXCLUDED.latitude,
              longitude = EXCLUDED.longitude,
              year_built = EXCLUDED.year_built,
              year_renovated = EXCLUDED.year_renovated,
              property_class = EXCLUDED.property_class,
              building_type = EXCLUDED.building_type,
              management_company = EXCLUDED.management_company,
              total_units = EXCLUDED.total_units,
              current_occupancy_percent = EXCLUDED.current_occupancy_percent,
              avg_days_to_lease = EXCLUDED.avg_days_to_lease,
              unit_count = EXCLUDED.unit_count,
              avg_rent = EXCLUDED.avg_rent,
              min_rent = EXCLUDED.min_rent,
              max_rent = EXCLUDED.max_rent,
              concession_count = EXCLUDED.concession_count,
              parking_fee_monthly = EXCLUDED.parking_fee_monthly,
              pet_rent_monthly = EXCLUDED.pet_rent_monthly,
              application_fee = EXCLUDED.application_fee,
              admin_fee = EXCLUDED.admin_fee,
              synced_at = NOW(),
              updated_at = NOW()
          `, [
            String(prop.id || prop.property_id || prop.external_id || `prop_${result.properties}`),
            prop.name || prop.property_name || 'Unknown',
            prop.address || prop.full_address || '',
            prop.city || city,
            prop.state || state,
            prop.zip_code || prop.zip || prop.postal_code || null,
            prop.latitude || prop.lat || null,
            prop.longitude || prop.lng || prop.lon || null,
            prop.year_built || null,
            prop.year_renovated || null,
            prop.property_class || prop.class || null,
            prop.building_type || prop.type || null,
            prop.management_company || prop.manager || null,
            prop.total_units || prop.units || null,
            prop.current_occupancy_percent || prop.occupancy || prop.occupancy_rate || null,
            prop.avg_days_to_lease || null,
            prop.unit_count || prop.total_units || prop.units || null,
            prop.avg_rent || prop.average_rent || null,
            prop.min_rent || prop.min_price || null,
            prop.max_rent || prop.max_price || null,
            prop.concession_count || prop.concessions || 0,
            prop.parking_fee_monthly || prop.parking_fee || null,
            prop.pet_rent_monthly || prop.pet_rent || null,
            prop.application_fee || null,
            prop.admin_fee || null,
          ]);
          result.properties++;
        } catch (e: any) {
          console.error(`Error inserting property ${prop.name}:`, e.message);
        }
      }
    } catch (error: any) {
      const msg = `Properties sync failed: ${error.message}`;
      console.error(msg);
      result.errors.push(msg);
    }
  }

  private async syncMarketData(city: string, state: string, result: SyncResult): Promise<void> {
    try {
      console.log('Syncing market data...');
      
      const endpoints = [
        `/api/jedi/market-data?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
        `/api/v1/market-data?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
        `/api/market-data?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
      ];

      let marketData: any = null;
      
      for (const endpoint of endpoints) {
        try {
          const responseData = await this.tryEndpoint(endpoint);
          marketData = responseData?.data || responseData;
          if (marketData && (marketData.supply || marketData.pricing || marketData.total_properties)) {
            console.log('Market data found from', endpoint);
            break;
          }
          marketData = null;
        } catch (e: any) {
          console.log(`Market endpoint ${endpoint} failed: ${e.response?.status || e.message}`);
        }
      }

      if (!marketData) {
        result.errors.push('No market data endpoint responded');
        return;
      }

      const supply = marketData.supply || {};
      const pricing = marketData.pricing || {};
      const demand = marketData.demand || {};
      const forecast = marketData.forecast || {};

      await this.pool.query(`
        INSERT INTO apartment_market_snapshots (
          city, state, total_properties, total_units, avg_occupancy,
          class_a_count, class_b_count, class_c_count,
          avg_rent_studio, avg_rent_1br, avg_rent_2br, avg_rent_3br,
          rent_growth_90d, rent_growth_180d, concession_rate, avg_concession_value,
          total_renters, avg_renter_budget, lease_expirations_90d,
          units_delivering_30d, units_delivering_60d, units_delivering_90d,
          snapshot_date, synced_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19,
          $20, $21, $22,
          CURRENT_DATE, NOW()
        )
        ON CONFLICT (city, state, snapshot_date) DO UPDATE SET
          total_properties = EXCLUDED.total_properties,
          total_units = EXCLUDED.total_units,
          avg_occupancy = EXCLUDED.avg_occupancy,
          class_a_count = EXCLUDED.class_a_count,
          class_b_count = EXCLUDED.class_b_count,
          class_c_count = EXCLUDED.class_c_count,
          avg_rent_studio = EXCLUDED.avg_rent_studio,
          avg_rent_1br = EXCLUDED.avg_rent_1br,
          avg_rent_2br = EXCLUDED.avg_rent_2br,
          avg_rent_3br = EXCLUDED.avg_rent_3br,
          rent_growth_90d = EXCLUDED.rent_growth_90d,
          rent_growth_180d = EXCLUDED.rent_growth_180d,
          concession_rate = EXCLUDED.concession_rate,
          avg_concession_value = EXCLUDED.avg_concession_value,
          total_renters = EXCLUDED.total_renters,
          avg_renter_budget = EXCLUDED.avg_renter_budget,
          lease_expirations_90d = EXCLUDED.lease_expirations_90d,
          units_delivering_30d = EXCLUDED.units_delivering_30d,
          units_delivering_60d = EXCLUDED.units_delivering_60d,
          units_delivering_90d = EXCLUDED.units_delivering_90d,
          synced_at = NOW()
      `, [
        city, state,
        supply.total_properties || null,
        supply.total_units || null,
        supply.avg_occupancy || null,
        supply.class_distribution?.a || null,
        supply.class_distribution?.b || null,
        supply.class_distribution?.c || null,
        pricing.avg_rent_by_type?.Studio || pricing.avg_rent_by_type?.studio || null,
        pricing.avg_rent_by_type?.['1BR'] || pricing.avg_rent_by_type?.['1br'] || null,
        pricing.avg_rent_by_type?.['2BR'] || pricing.avg_rent_by_type?.['2br'] || null,
        pricing.avg_rent_by_type?.['3BR'] || pricing.avg_rent_by_type?.['3br'] || null,
        pricing.rent_growth_90d || null,
        pricing.rent_growth_180d || null,
        pricing.concession_rate || null,
        pricing.avg_concession_value || null,
        demand.total_renters || null,
        demand.avg_budget || null,
        demand.lease_expirations_90d || null,
        forecast.units_delivering_30d || null,
        forecast.units_delivering_60d || null,
        forecast.units_delivering_90d || null,
      ]);
      
      result.marketSnapshot = true;
    } catch (error: any) {
      const msg = `Market data sync failed: ${error.message}`;
      console.error(msg);
      result.errors.push(msg);
    }
  }

  private async syncRentComps(city: string, state: string, result: SyncResult): Promise<void> {
    try {
      console.log('Syncing rent comps...');
      
      const endpoints = [
        `/api/jedi/rent-comps?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
        `/api/v1/rent-comps?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
        `/api/rent-comps?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
      ];

      let comps: any[] = [];
      
      for (const endpoint of endpoints) {
        try {
          const responseData = await this.tryEndpoint(endpoint);
          const data = responseData?.data || responseData;
          if (Array.isArray(data) && data.length > 0) {
            comps = data;
            console.log(`Found ${comps.length} rent comps from ${endpoint}`);
            break;
          }
        } catch (e: any) {
          console.log(`Rent comps endpoint ${endpoint} failed: ${e.response?.status || e.message}`);
        }
      }

      await this.pool.query(`DELETE FROM apartment_rent_comps WHERE city = $1 AND state = $2`, [city, state]);

      for (const comp of comps) {
        try {
          await this.pool.query(`
            INSERT INTO apartment_rent_comps (
              property_external_id, property_name, address, city, state,
              unit_type, square_feet, rent, rent_per_sqft,
              occupancy, year_built, property_class, concessions_active, synced_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
          `, [
            comp.property_id || null,
            comp.property_name || comp.name || '',
            comp.address || '',
            city,
            state,
            comp.unit_type || null,
            comp.square_feet || null,
            comp.rent || null,
            comp.rent_per_sqft || null,
            comp.occupancy || null,
            comp.year_built || null,
            comp.property_class || comp.class || null,
            comp.concessions_active || false,
          ]);
          result.rentComps++;
        } catch (e: any) {
          console.error(`Error inserting rent comp:`, e.message);
        }
      }
    } catch (error: any) {
      const msg = `Rent comps sync failed: ${error.message}`;
      console.error(msg);
      result.errors.push(msg);
    }
  }

  private async syncSupplyPipeline(city: string, state: string, result: SyncResult): Promise<void> {
    try {
      console.log('Syncing supply pipeline...');
      
      const endpoints = [
        `/api/jedi/supply-pipeline?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&days=365`,
        `/api/v1/supply-pipeline?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
        `/api/supply-pipeline?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
      ];

      let pipeline: any[] = [];
      
      for (const endpoint of endpoints) {
        try {
          const responseData = await this.tryEndpoint(endpoint);
          const data = responseData?.data || responseData;
          if (Array.isArray(data) && data.length > 0) {
            pipeline = data;
            console.log(`Found ${pipeline.length} supply pipeline entries from ${endpoint}`);
            break;
          }
        } catch (e: any) {
          console.log(`Supply pipeline endpoint ${endpoint} failed: ${e.response?.status || e.message}`);
        }
      }

      await this.pool.query(`DELETE FROM apartment_supply_pipeline WHERE city = $1 AND state = $2`, [city, state]);

      for (const item of pipeline) {
        try {
          await this.pool.query(`
            INSERT INTO apartment_supply_pipeline (
              external_id, name, address, city, state,
              total_units, property_class, available_date, units_delivering, synced_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          `, [
            item.id || null,
            item.name || '',
            item.address || '',
            city,
            state,
            item.total_units || null,
            item.property_class || item.class || null,
            item.available_date || null,
            item.units_delivering || null,
          ]);
          result.supplyPipeline++;
        } catch (e: any) {
          console.error(`Error inserting pipeline item:`, e.message);
        }
      }
    } catch (error: any) {
      const msg = `Supply pipeline sync failed: ${error.message}`;
      console.error(msg);
      result.errors.push(msg);
    }
  }

  private async syncAbsorptionRate(city: string, state: string, result: SyncResult): Promise<void> {
    try {
      console.log('Syncing absorption rate...');
      
      const endpoints = [
        `/api/jedi/absorption-rate?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
        `/api/v1/absorption-rate?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`,
      ];

      for (const endpoint of endpoints) {
        try {
          const responseData = await this.tryEndpoint(endpoint);
          const data = responseData?.data || responseData;
          
          if (data && (data.avg_days_to_lease !== undefined || data.monthly_absorption_rate !== undefined)) {
            await this.pool.query(`
              UPDATE apartment_market_snapshots 
              SET avg_days_to_lease = $1, monthly_absorption_rate = $2
              WHERE city = $3 AND state = $4 AND snapshot_date = CURRENT_DATE
            `, [
              data.avg_days_to_lease || null,
              data.monthly_absorption_rate || null,
              city,
              state,
            ]);
            console.log('Absorption rate synced');
            return;
          }
        } catch (e: any) {
          console.log(`Absorption endpoint ${endpoint} failed: ${e.message}`);
        }
      }
    } catch (error: any) {
      const msg = `Absorption rate sync failed: ${error.message}`;
      console.error(msg);
      result.errors.push(msg);
    }
  }

  private async logSync(city: string, state: string, result: SyncResult): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO apartment_api_sync_log (
          deal_id, sync_type, status, records_synced, api_endpoint, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        null,
        'full_sync',
        result.errors.length === 0 ? 'success' : 'partial',
        result.properties + result.rentComps + result.supplyPipeline,
        `${city},${state}`,
        result.errors.length > 0 ? result.errors.join('; ') : null,
      ]);
    } catch (e: any) {
      console.error('Error logging sync:', e.message);
    }
  }

  async getSyncStatus(): Promise<any> {
    const propCount = await this.pool.query('SELECT COUNT(*) as count FROM apartment_properties');
    const lastSync = await this.pool.query(
      `SELECT synced_at, status, records_synced, error_message 
       FROM apartment_api_sync_log 
       ORDER BY synced_at DESC LIMIT 1`
    );
    const marketSnaps = await this.pool.query('SELECT COUNT(*) as count FROM apartment_market_snapshots');
    const compsCount = await this.pool.query('SELECT COUNT(*) as count FROM apartment_rent_comps');
    const pipelineCount = await this.pool.query('SELECT COUNT(*) as count FROM apartment_supply_pipeline');

    return {
      totalProperties: parseInt(propCount.rows[0].count),
      marketSnapshots: parseInt(marketSnaps.rows[0].count),
      rentComps: parseInt(compsCount.rows[0].count),
      supplyPipeline: parseInt(pipelineCount.rows[0].count),
      lastSync: lastSync.rows[0] || null,
    };
  }
}
