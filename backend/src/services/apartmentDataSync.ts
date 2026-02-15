import axios, { AxiosInstance } from 'axios';
import { Pool } from 'pg';

interface SyncResult {
  properties: number;
  marketSnapshot: boolean;
  rentComps: number;
  supplyPipeline: number;
  absorptionRate: boolean;
  trends: boolean;
  submarkets: boolean;
  userStats: boolean;
  userActivity: boolean;
  demandSignals: boolean;
  searchTrends: boolean;
  userPreferences: boolean;
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
            if (authErr.response?.status === 500) {
              const errorMsg = authErr.response?.data?.error || authErr.response?.data?.message || 'Internal server error';
              console.log(`Server error (500) for ${endpoint}: ${errorMsg} (auth succeeded but server failed)`);
              throw new Error(`Remote server error: ${errorMsg}`);
            }
            console.log(`Auth key failed for ${endpoint}: ${authErr.response?.status || authErr.message}`);
            continue;
          }
        }
      }
      if (e.response?.status === 500) {
        const errorMsg = e.response?.data?.error || e.response?.data?.message || 'Internal server error';
        throw new Error(`Remote server error: ${errorMsg}`);
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
      absorptionRate: false,
      trends: false,
      submarkets: false,
      userStats: false,
      userActivity: false,
      demandSignals: false,
      searchTrends: false,
      userPreferences: false,
      errors: [],
      duration: 0,
    };

    console.log(`Starting full data sync for ${city}, ${state}...`);

    const syncTasks = [
      this.syncMarketData(city, state, result),
      this.syncTrends(city, result),
      this.syncSubmarkets(city, result),
      this.syncRentComps(city, state, result),
      this.syncSupplyPipeline(city, state, result),
      this.syncAbsorptionRate(city, state, result),
      this.syncUserStats(result),
      this.syncUserActivity(result),
      this.syncDemandSignals(result),
      this.syncSearchTrends(result),
      this.syncUserPreferences(result),
    ];

    await Promise.allSettled(syncTasks);

    result.duration = Date.now() - startTime;
    
    await this.logSync(city, state, result);
    
    console.log(`Data sync complete in ${result.duration}ms:`, {
      marketSnapshot: result.marketSnapshot,
      properties: result.properties,
      rentComps: result.rentComps,
      supplyPipeline: result.supplyPipeline,
      absorptionRate: result.absorptionRate,
      trends: result.trends,
      submarkets: result.submarkets,
      userStats: result.userStats,
      userActivity: result.userActivity,
      demandSignals: result.demandSignals,
      searchTrends: result.searchTrends,
      userPreferences: result.userPreferences,
      errors: result.errors.length,
    });

    return result;
  }

  private async syncMarketData(city: string, state: string, result: SyncResult): Promise<void> {
    try {
      console.log(`[syncMarketData] Fetching market data for ${city}, ${state}...`);
      const endpoint = `/api/jedi/market-data?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`;
      const responseData = await this.tryEndpoint(endpoint);
      const marketData = responseData?.data || responseData;

      if (!marketData) {
        result.errors.push('Market data endpoint returned empty response');
        return;
      }

      console.log(`[syncMarketData] Received market data, storing snapshot...`);

      const ms = marketData.market_summary || marketData;
      const vacancy = ms.vacancy_rate ?? null;
      const avgOccupancy = vacancy !== null ? (1 - vacancy) : null;

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
        ms.total_properties || marketData.total_properties || null,
        ms.total_units || marketData.total_units || null,
        avgOccupancy,
        null,
        null,
        null,
        ms.avg_rent_studio || null,
        ms.avg_rent_1bed || null,
        ms.avg_rent_2bed || null,
        ms.avg_rent_3bed || null,
        ms.rent_growth_rate_90d || null,
        null,
        ms.concessions_prevalence || ms.avg_concessions_pct || null,
        ms.avg_savings_potential || null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]);
      
      result.marketSnapshot = true;
      console.log(`[syncMarketData] Market snapshot stored successfully`);
    } catch (error: any) {
      const msg = `Market data sync failed: ${error.message}`;
      console.error(`[syncMarketData] ${msg}`);
      result.errors.push(msg);
    }
  }

  private async syncTrends(city: string, result: SyncResult): Promise<void> {
    try {
      console.log(`[syncTrends] Fetching rent trends for ${city}...`);
      const endpoint = `/api/jedi/trends?city=${encodeURIComponent(city)}`;
      const responseData = await this.tryEndpoint(endpoint);
      const data = responseData?.data || responseData;

      if (!data) {
        result.errors.push('Trends endpoint returned empty response');
        return;
      }

      await this.pool.query(
        `DELETE FROM apartment_trends WHERE city = $1 AND snapshot_date = CURRENT_DATE`,
        [city]
      );

      await this.pool.query(
        `INSERT INTO apartment_trends (city, snapshot_date, data, synced_at) VALUES ($1, CURRENT_DATE, $2, NOW())`,
        [city, JSON.stringify(data)]
      );

      result.trends = true;
      console.log(`[syncTrends] Trends data stored successfully for ${city}`);
    } catch (error: any) {
      const msg = `Trends sync failed: ${error.message}`;
      console.error(`[syncTrends] ${msg}`);
      result.errors.push(msg);
    }
  }

  private async syncSubmarkets(city: string, result: SyncResult): Promise<void> {
    try {
      console.log(`[syncSubmarkets] Fetching submarkets for ${city}...`);
      const endpoint = `/api/jedi/submarkets?city=${encodeURIComponent(city)}`;
      const responseData = await this.tryEndpoint(endpoint);
      const data = responseData?.data || responseData;

      if (!data) {
        result.errors.push('Submarkets endpoint returned empty response');
        return;
      }

      await this.pool.query(
        `DELETE FROM apartment_submarkets WHERE city = $1 AND snapshot_date = CURRENT_DATE`,
        [city]
      );

      await this.pool.query(
        `INSERT INTO apartment_submarkets (city, snapshot_date, data, synced_at) VALUES ($1, CURRENT_DATE, $2, NOW())`,
        [city, JSON.stringify(data)]
      );

      result.submarkets = true;
      console.log(`[syncSubmarkets] Submarkets data stored successfully for ${city}`);
    } catch (error: any) {
      const msg = `Submarkets sync failed: ${error.message}`;
      console.error(`[syncSubmarkets] ${msg}`);
      result.errors.push(msg);
    }
  }

  private async syncRentComps(city: string, state: string, result: SyncResult): Promise<void> {
    try {
      console.log(`[syncRentComps] Fetching rent comps for ${city}, ${state}...`);
      const endpoint = `/api/jedi/rent-comps?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`;
      const responseData = await this.tryEndpoint(endpoint);
      const comps = responseData?.data || responseData;

      if (!Array.isArray(comps)) {
        console.log(`[syncRentComps] Response is not an array, skipping`);
        result.errors.push('Rent comps endpoint did not return an array');
        return;
      }

      console.log(`[syncRentComps] Received ${comps.length} rent comps, storing...`);

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
            comp.property_id || comp.id || null,
            comp.property_name || comp.name || '',
            comp.address || '',
            city,
            state,
            comp.unit_type || comp.beds || null,
            comp.square_feet || comp.sqft || null,
            comp.rent || null,
            comp.rent_per_sqft || null,
            comp.occupancy || null,
            comp.year_built || null,
            comp.property_class || comp.class || null,
            comp.concessions_active || false,
          ]);
          result.rentComps++;
        } catch (e: any) {
          console.error(`[syncRentComps] Error inserting rent comp: ${e.message}`);
        }
      }

      console.log(`[syncRentComps] Stored ${result.rentComps} rent comps`);
    } catch (error: any) {
      const msg = `Rent comps sync failed: ${error.message}`;
      console.error(`[syncRentComps] ${msg}`);
      result.errors.push(msg);
    }
  }

  private async syncSupplyPipeline(city: string, state: string, result: SyncResult): Promise<void> {
    try {
      console.log(`[syncSupplyPipeline] Fetching supply pipeline for ${city}, ${state}...`);
      const endpoint = `/api/jedi/supply-pipeline?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`;
      const responseData = await this.tryEndpoint(endpoint);
      const pipeline = responseData?.data || responseData;

      if (!Array.isArray(pipeline)) {
        console.log(`[syncSupplyPipeline] Response is not an array, skipping`);
        result.errors.push('Supply pipeline endpoint did not return an array');
        return;
      }

      console.log(`[syncSupplyPipeline] Received ${pipeline.length} pipeline entries, storing...`);

      await this.pool.query(`DELETE FROM apartment_supply_pipeline WHERE city = $1 AND state = $2`, [city, state]);

      for (const item of pipeline) {
        try {
          await this.pool.query(`
            INSERT INTO apartment_supply_pipeline (
              external_id, name, address, city, state,
              total_units, property_class, available_date, units_delivering, synced_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          `, [
            item.id || item.external_id || null,
            item.name || item.property_name || '',
            item.address || '',
            city,
            state,
            item.total_units || item.unit_count || null,
            item.property_class || item.class || null,
            item.available_date || item.year_built || null,
            item.units_delivering || item.total_units || null,
          ]);
          result.supplyPipeline++;
        } catch (e: any) {
          console.error(`[syncSupplyPipeline] Error inserting pipeline item: ${e.message}`);
        }
      }

      console.log(`[syncSupplyPipeline] Stored ${result.supplyPipeline} pipeline entries`);
    } catch (error: any) {
      const msg = `Supply pipeline sync failed: ${error.message}`;
      console.error(`[syncSupplyPipeline] ${msg}`);
      result.errors.push(msg);
    }
  }

  private async syncAbsorptionRate(city: string, state: string, result: SyncResult): Promise<void> {
    try {
      console.log(`[syncAbsorptionRate] Fetching absorption rate for ${city}, ${state}...`);
      const endpoint = `/api/jedi/absorption-rate?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`;
      const responseData = await this.tryEndpoint(endpoint);
      const data = responseData?.data || responseData;

      if (!data) {
        result.errors.push('Absorption rate endpoint returned empty response');
        return;
      }

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

      result.absorptionRate = true;
      console.log(`[syncAbsorptionRate] Absorption rate stored successfully`);
    } catch (error: any) {
      const msg = `Absorption rate sync failed: ${error.message}`;
      console.error(`[syncAbsorptionRate] ${msg}`);
      result.errors.push(msg);
    }
  }

  private async syncUserStats(result: SyncResult): Promise<void> {
    try {
      console.log(`[syncUserStats] Fetching user stats...`);
      const endpoint = `/api/jedi/user-stats`;
      const responseData = await this.tryEndpoint(endpoint);
      const data = responseData?.data || responseData;

      if (!data) {
        result.errors.push('User stats endpoint returned empty response');
        return;
      }

      await this.pool.query(
        `DELETE FROM apartment_user_analytics WHERE analytics_type = $1 AND snapshot_date = CURRENT_DATE`,
        ['user-stats']
      );

      await this.pool.query(
        `INSERT INTO apartment_user_analytics (analytics_type, snapshot_date, data, synced_at) VALUES ($1, CURRENT_DATE, $2, NOW())`,
        ['user-stats', JSON.stringify(data)]
      );

      result.userStats = true;
      console.log(`[syncUserStats] User stats stored successfully`);
    } catch (error: any) {
      const msg = `User stats sync failed: ${error.message}`;
      console.error(`[syncUserStats] ${msg}`);
      result.errors.push(msg);
    }
  }

  private async syncUserActivity(result: SyncResult): Promise<void> {
    try {
      console.log(`[syncUserActivity] Fetching user activity...`);
      const endpoint = `/api/jedi/user-activity?days=30`;
      const responseData = await this.tryEndpoint(endpoint);
      const data = responseData?.data || responseData;

      if (!data) {
        result.errors.push('User activity endpoint returned empty response');
        return;
      }

      await this.pool.query(
        `DELETE FROM apartment_user_analytics WHERE analytics_type = $1 AND snapshot_date = CURRENT_DATE`,
        ['user-activity']
      );

      await this.pool.query(
        `INSERT INTO apartment_user_analytics (analytics_type, snapshot_date, data, synced_at) VALUES ($1, CURRENT_DATE, $2, NOW())`,
        ['user-activity', JSON.stringify(data)]
      );

      result.userActivity = true;
      console.log(`[syncUserActivity] User activity stored successfully`);
    } catch (error: any) {
      const msg = `User activity sync failed: ${error.message}`;
      console.error(`[syncUserActivity] ${msg}`);
      result.errors.push(msg);
    }
  }

  private async syncDemandSignals(result: SyncResult): Promise<void> {
    try {
      console.log(`[syncDemandSignals] Fetching demand signals...`);
      const endpoint = `/api/jedi/demand-signals`;
      const responseData = await this.tryEndpoint(endpoint);
      const data = responseData?.data || responseData;

      if (!data) {
        result.errors.push('Demand signals endpoint returned empty response');
        return;
      }

      await this.pool.query(
        `DELETE FROM apartment_user_analytics WHERE analytics_type = $1 AND snapshot_date = CURRENT_DATE`,
        ['demand-signals']
      );

      await this.pool.query(
        `INSERT INTO apartment_user_analytics (analytics_type, snapshot_date, data, synced_at) VALUES ($1, CURRENT_DATE, $2, NOW())`,
        ['demand-signals', JSON.stringify(data)]
      );

      result.demandSignals = true;
      console.log(`[syncDemandSignals] Demand signals stored successfully`);
    } catch (error: any) {
      const msg = `Demand signals sync failed: ${error.message}`;
      console.error(`[syncDemandSignals] ${msg}`);
      result.errors.push(msg);
    }
  }

  private async syncSearchTrends(result: SyncResult): Promise<void> {
    try {
      console.log(`[syncSearchTrends] Fetching search trends...`);
      const endpoint = `/api/jedi/search-trends?days=30`;
      const responseData = await this.tryEndpoint(endpoint);
      const data = responseData?.data || responseData;

      if (!data) {
        result.errors.push('Search trends endpoint returned empty response');
        return;
      }

      await this.pool.query(
        `DELETE FROM apartment_user_analytics WHERE analytics_type = $1 AND snapshot_date = CURRENT_DATE`,
        ['search-trends']
      );

      await this.pool.query(
        `INSERT INTO apartment_user_analytics (analytics_type, snapshot_date, data, synced_at) VALUES ($1, CURRENT_DATE, $2, NOW())`,
        ['search-trends', JSON.stringify(data)]
      );

      result.searchTrends = true;
      console.log(`[syncSearchTrends] Search trends stored successfully`);
    } catch (error: any) {
      const msg = `Search trends sync failed: ${error.message}`;
      console.error(`[syncSearchTrends] ${msg}`);
      result.errors.push(msg);
    }
  }

  private async syncUserPreferences(result: SyncResult): Promise<void> {
    try {
      console.log(`[syncUserPreferences] Fetching user preferences aggregate...`);
      const endpoint = `/api/jedi/user-preferences-aggregate`;
      const responseData = await this.tryEndpoint(endpoint);
      const data = responseData?.data || responseData;

      if (!data) {
        result.errors.push('User preferences endpoint returned empty response');
        return;
      }

      await this.pool.query(
        `DELETE FROM apartment_user_analytics WHERE analytics_type = $1 AND snapshot_date = CURRENT_DATE`,
        ['user-preferences']
      );

      await this.pool.query(
        `INSERT INTO apartment_user_analytics (analytics_type, snapshot_date, data, synced_at) VALUES ($1, CURRENT_DATE, $2, NOW())`,
        ['user-preferences', JSON.stringify(data)]
      );

      result.userPreferences = true;
      console.log(`[syncUserPreferences] User preferences stored successfully`);
    } catch (error: any) {
      const msg = `User preferences sync failed: ${error.message}`;
      console.error(`[syncUserPreferences] ${msg}`);
      result.errors.push(msg);
    }
  }

  private async logSync(city: string, state: string, result: SyncResult): Promise<void> {
    try {
      const totalRecords = result.properties + result.rentComps + result.supplyPipeline;
      const boolSyncs = [
        result.marketSnapshot, result.absorptionRate, result.trends, result.submarkets,
        result.userStats, result.userActivity, result.demandSignals, result.searchTrends, result.userPreferences,
      ].filter(Boolean).length;

      await this.pool.query(`
        INSERT INTO apartment_api_sync_log (
          deal_id, sync_type, status, records_synced, api_endpoint, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        null,
        'full_sync',
        result.errors.length === 0 ? 'success' : 'partial',
        totalRecords + boolSyncs,
        `${city},${state}`,
        result.errors.length > 0 ? result.errors.join('; ') : null,
      ]);
    } catch (e: any) {
      console.error('[logSync] Error logging sync:', e.message);
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
    const trendsCount = await this.pool.query('SELECT COUNT(*) as count FROM apartment_trends');
    const submarketsCount = await this.pool.query('SELECT COUNT(*) as count FROM apartment_submarkets');
    const analyticsCount = await this.pool.query('SELECT COUNT(*) as count FROM apartment_user_analytics');

    return {
      totalProperties: parseInt(propCount.rows[0].count),
      marketSnapshots: parseInt(marketSnaps.rows[0].count),
      rentComps: parseInt(compsCount.rows[0].count),
      supplyPipeline: parseInt(pipelineCount.rows[0].count),
      trends: parseInt(trendsCount.rows[0].count),
      submarkets: parseInt(submarketsCount.rows[0].count),
      userAnalytics: parseInt(analyticsCount.rows[0].count),
      lastSync: lastSync.rows[0] || null,
    };
  }
}
