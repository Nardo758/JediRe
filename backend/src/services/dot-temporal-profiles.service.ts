import { Pool } from 'pg';
import { logger } from '../utils/logger';
import * as fs from 'fs';

export interface TemporalProfile {
  id: number;
  state: string;
  region: string;
  road_functional_class: string;
  profile_type: 'hourly' | 'seasonal' | 'dow' | 'directional';
  factors: Record<string, number>;
  source_year: number;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemporalMultiplierResult {
  hourly_factor: number;
  seasonal_factor: number;
  dow_factor: number;
  combined: number;
  source: 'fdot_profile' | 'default';
}

const DEFAULT_HOURLY_FACTORS: Record<string, number> = {
  '0': 0.012, '1': 0.008, '2': 0.006, '3': 0.005, '4': 0.006, '5': 0.015,
  '6': 0.042, '7': 0.065, '8': 0.078, '9': 0.062, '10': 0.058, '11': 0.063,
  '12': 0.065, '13': 0.060, '14': 0.062, '15': 0.072, '16': 0.080, '17': 0.088,
  '18': 0.068, '19': 0.052, '20': 0.041, '21': 0.032, '22': 0.025, '23': 0.016
};

const DEFAULT_SEASONAL_FACTORS: Record<string, number> = {
  '1': 1.12, '2': 1.15, '3': 1.18, '4': 1.05, '5': 0.98, '6': 0.94,
  '7': 0.92, '8': 0.91, '9': 0.95, '10': 0.97, '11': 1.02, '12': 1.08
};

const DEFAULT_DOW_FACTORS: Record<string, number> = {
  '0': 0.79, '1': 1.02, '2': 1.04, '3': 1.05, '4': 1.06, '5': 1.12, '6': 0.92
};

const DEFAULT_DIRECTIONAL_FACTORS: Record<string, number> = {
  '0_inbound': 0.52, '0_outbound': 0.48,
  '1_inbound': 0.52, '1_outbound': 0.48,
  '2_inbound': 0.52, '2_outbound': 0.48,
  '3_inbound': 0.52, '3_outbound': 0.48,
  '4_inbound': 0.55, '4_outbound': 0.45,
  '5_inbound': 0.58, '5_outbound': 0.42,
  '6_inbound': 0.60, '6_outbound': 0.40,
  '7_inbound': 0.62, '7_outbound': 0.38,
  '8_inbound': 0.62, '8_outbound': 0.38,
  '9_inbound': 0.55, '9_outbound': 0.45,
  '10_inbound': 0.52, '10_outbound': 0.48,
  '11_inbound': 0.50, '11_outbound': 0.50,
  '12_inbound': 0.50, '12_outbound': 0.50,
  '13_inbound': 0.48, '13_outbound': 0.52,
  '14_inbound': 0.45, '14_outbound': 0.55,
  '15_inbound': 0.42, '15_outbound': 0.58,
  '16_inbound': 0.40, '16_outbound': 0.60,
  '17_inbound': 0.38, '17_outbound': 0.62,
  '18_inbound': 0.42, '18_outbound': 0.58,
  '19_inbound': 0.45, '19_outbound': 0.55,
  '20_inbound': 0.48, '20_outbound': 0.52,
  '21_inbound': 0.50, '21_outbound': 0.50,
  '22_inbound': 0.50, '22_outbound': 0.50,
  '23_inbound': 0.50, '23_outbound': 0.50
};

const ROAD_CLASS_ALIASES: Record<string, string> = {
  'interstate': 'Interstate',
  'expressway': 'Expressway',
  'freeway': 'Expressway',
  'arterial': 'Arterial',
  'principal arterial': 'Arterial',
  'minor arterial': 'Arterial',
  'collector': 'Collector',
  'major collector': 'Collector',
  'minor collector': 'Collector',
  'local': 'Local',
  'local road': 'Local',
};

export class DotTemporalProfilesService {
  private profileCache: Map<string, TemporalProfile> = new Map();
  private cacheLoadedAt: number = 0;
  private readonly CACHE_TTL_MS = 30 * 60 * 1000;

  constructor(private pool: Pool) {}

  private normalizeRoadClass(roadClass: string | null | undefined): string {
    if (!roadClass) return 'Arterial';
    const lower = roadClass.toLowerCase().trim();
    return ROAD_CLASS_ALIASES[lower] || roadClass;
  }

  private cacheKey(state: string, region: string, roadClass: string, profileType: string): string {
    return `${state}:${region}:${roadClass}:${profileType}`;
  }

  private async ensureCache(): Promise<void> {
    if (Date.now() - this.cacheLoadedAt < this.CACHE_TTL_MS && this.profileCache.size > 0) {
      return;
    }
    await this.loadAllProfiles();
  }

  private async loadAllProfiles(): Promise<void> {
    try {
      const result = await this.pool.query('SELECT * FROM dot_temporal_profiles');
      this.profileCache.clear();
      for (const row of result.rows) {
        const key = this.cacheKey(row.state, row.region, row.road_functional_class, row.profile_type);
        this.profileCache.set(key, {
          id: row.id,
          state: row.state,
          region: row.region,
          road_functional_class: row.road_functional_class,
          profile_type: row.profile_type,
          factors: typeof row.factors === 'string' ? JSON.parse(row.factors) : row.factors,
          source_year: row.source_year,
          source_url: row.source_url,
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      }
      this.cacheLoadedAt = Date.now();
      logger.debug(`[DotTemporalProfiles] Loaded ${this.profileCache.size} profiles into cache`);
    } catch (err: any) {
      logger.error('[DotTemporalProfiles] Failed to load profiles', { error: err.message });
    }
  }

  private getProfile(roadClass: string, state: string, profileType: string, region: string = 'statewide'): TemporalProfile | null {
    const normalized = this.normalizeRoadClass(roadClass);
    const key = this.cacheKey(state, region, normalized, profileType);
    let profile = this.profileCache.get(key);
    if (profile) return profile;

    const statewideKey = this.cacheKey(state, 'statewide', normalized, profileType);
    profile = this.profileCache.get(statewideKey);
    if (profile) return profile;

    const anyClassKey = this.cacheKey(state, 'statewide', 'Arterial', profileType);
    profile = this.profileCache.get(anyClassKey);
    return profile || null;
  }

  async getHourlyFactor(roadClass: string, state: string, hour: number, region?: string): Promise<number> {
    await this.ensureCache();
    const profile = this.getProfile(roadClass, state, 'hourly', region);
    if (profile && profile.factors) {
      const val = profile.factors[String(hour)];
      if (val !== undefined) return val;
    }
    return DEFAULT_HOURLY_FACTORS[String(hour)] ?? 0.042;
  }

  async getSeasonalFactor(roadClass: string, state: string, month: number, region?: string): Promise<number> {
    await this.ensureCache();
    const profile = this.getProfile(roadClass, state, 'seasonal', region);
    if (profile && profile.factors) {
      const val = profile.factors[String(month)];
      if (val !== undefined) return val;
    }
    return DEFAULT_SEASONAL_FACTORS[String(month)] ?? 1.0;
  }

  async getDowFactor(roadClass: string, state: string, dayOfWeek: number, region?: string): Promise<number> {
    await this.ensureCache();
    const profile = this.getProfile(roadClass, state, 'dow', region);
    if (profile && profile.factors) {
      const val = profile.factors[String(dayOfWeek)];
      if (val !== undefined) return val;
    }
    return DEFAULT_DOW_FACTORS[String(dayOfWeek)] ?? 1.0;
  }

  async getDirectionalSplit(roadClass: string, state: string, hour: number, direction: 'inbound' | 'outbound', region?: string): Promise<number> {
    await this.ensureCache();
    const profile = this.getProfile(roadClass, state, 'directional', region);
    const key = `${hour}_${direction}`;
    if (profile && profile.factors) {
      const val = profile.factors[key];
      if (val !== undefined) return val;
    }
    return DEFAULT_DIRECTIONAL_FACTORS[key] ?? 0.50;
  }

  async getTemporalMultiplier(
    roadClass: string,
    state: string,
    hour: number,
    dayOfWeek: number,
    month: number,
    region?: string
  ): Promise<TemporalMultiplierResult> {
    await this.ensureCache();

    const hourlyFactor = await this.getHourlyFactor(roadClass, state, hour, region);
    const seasonalFactor = await this.getSeasonalFactor(roadClass, state, month, region);
    const dowFactor = await this.getDowFactor(roadClass, state, dayOfWeek, region);

    const hasProfile = this.getProfile(roadClass, state, 'hourly', region) !== null;

    return {
      hourly_factor: hourlyFactor,
      seasonal_factor: seasonalFactor,
      dow_factor: dowFactor,
      combined: hourlyFactor * seasonalFactor * dowFactor,
      source: hasProfile ? 'fdot_profile' : 'default',
    };
  }

  async getFullHourlyDistribution(roadClass: string, state: string, region?: string): Promise<Record<string, number>> {
    await this.ensureCache();
    const profile = this.getProfile(roadClass, state, 'hourly', region);
    if (profile && profile.factors) {
      return { ...profile.factors };
    }
    return { ...DEFAULT_HOURLY_FACTORS };
  }

  async seedDefaultProfiles(state: string = 'FL', region: string = 'statewide'): Promise<{ seeded: number; skipped: number }> {
    let seeded = 0;
    let skipped = 0;

    const roadClasses = ['Interstate', 'Expressway', 'Arterial', 'Collector', 'Local'];
    const profiles: Array<{ roadClass: string; profileType: string; factors: Record<string, number> }> = [];

    for (const rc of roadClasses) {
      let hourlyAdj = { ...DEFAULT_HOURLY_FACTORS };
      if (rc === 'Interstate' || rc === 'Expressway') {
        hourlyAdj['7'] = 0.075;
        hourlyAdj['8'] = 0.085;
        hourlyAdj['17'] = 0.095;
      } else if (rc === 'Local') {
        hourlyAdj['8'] = 0.065;
        hourlyAdj['17'] = 0.072;
        hourlyAdj['12'] = 0.070;
      }

      profiles.push({ roadClass: rc, profileType: 'hourly', factors: hourlyAdj });
      profiles.push({ roadClass: rc, profileType: 'seasonal', factors: { ...DEFAULT_SEASONAL_FACTORS } });
      profiles.push({ roadClass: rc, profileType: 'dow', factors: { ...DEFAULT_DOW_FACTORS } });
      profiles.push({ roadClass: rc, profileType: 'directional', factors: { ...DEFAULT_DIRECTIONAL_FACTORS } });
    }

    for (const p of profiles) {
      try {
        const result = await this.pool.query(
          `INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, source_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (state, region, road_functional_class, profile_type) DO NOTHING
           RETURNING id`,
          [
            state,
            region,
            p.roadClass,
            p.profileType,
            JSON.stringify(p.factors),
            2024,
            'https://tdaappsprod.dot.state.fl.us/fto/',
          ]
        );
        if (result.rowCount && result.rowCount > 0) {
          seeded++;
        } else {
          skipped++;
        }
      } catch (err: any) {
        logger.warn(`[DotTemporalProfiles] Seed error for ${p.roadClass}/${p.profileType}: ${err.message}`);
        skipped++;
      }
    }

    this.profileCache.clear();
    this.cacheLoadedAt = 0;
    logger.info(`[DotTemporalProfiles] Seeded ${seeded} profiles, skipped ${skipped}`);
    return { seeded, skipped };
  }

  async ingestProfiles(
    filePath: string,
    state: string = 'FL',
    region: string = 'statewide'
  ): Promise<{ inserted: number; updated: number; errors: string[] }> {
    const errors: string[] = [];
    let inserted = 0;
    let updated = 0;

    try {
      const ext = filePath.toLowerCase();
      let rows: Array<{ road_functional_class: string; profile_type: string; factors: Record<string, number> }> = [];

      if (ext.endsWith('.csv')) {
        rows = this.parseProfileCSV(filePath);
      } else if (ext.endsWith('.json')) {
        rows = this.parseProfileJSON(filePath);
      } else {
        throw new Error('Unsupported format. Use CSV or JSON.');
      }

      for (const row of rows) {
        try {
          const normalized = this.normalizeRoadClass(row.road_functional_class);
          const result = await this.pool.query(
            `INSERT INTO dot_temporal_profiles (state, region, road_functional_class, profile_type, factors, source_year, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (state, region, road_functional_class, profile_type) DO UPDATE SET
               factors = EXCLUDED.factors,
               source_year = EXCLUDED.source_year,
               updated_at = NOW()
             RETURNING (xmax = 0) AS is_insert`,
            [state, region, normalized, row.profile_type, JSON.stringify(row.factors), new Date().getFullYear()]
          );
          if (result.rows[0]?.is_insert) {
            inserted++;
          } else {
            updated++;
          }
        } catch (err: any) {
          errors.push(`${row.road_functional_class}/${row.profile_type}: ${err.message}`);
        }
      }

      this.profileCache.clear();
      this.cacheLoadedAt = 0;
      logger.info(`[DotTemporalProfiles] Ingestion complete: ${inserted} inserted, ${updated} updated, ${errors.length} errors`);
    } catch (err: any) {
      logger.error('[DotTemporalProfiles] Ingestion failed', { error: err.message });
      throw err;
    }

    return { inserted, updated, errors };
  }

  private parseProfileCSV(filePath: string): Array<{ road_functional_class: string; profile_type: string; factors: Record<string, number> }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const roadClassIdx = headers.indexOf('road_functional_class');
    const profileTypeIdx = headers.indexOf('profile_type');

    if (roadClassIdx === -1 || profileTypeIdx === -1) {
      throw new Error('CSV must have road_functional_class and profile_type columns');
    }

    const factorHeaders = headers.filter((h, i) => i !== roadClassIdx && i !== profileTypeIdx);
    const results: Array<{ road_functional_class: string; profile_type: string; factors: Record<string, number> }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < headers.length) continue;

      const factors: Record<string, number> = {};
      for (let j = 0; j < headers.length; j++) {
        if (j !== roadClassIdx && j !== profileTypeIdx) {
          const val = parseFloat(values[j]);
          if (!isNaN(val)) {
            factors[headers[j]] = val;
          }
        }
      }

      results.push({
        road_functional_class: values[roadClassIdx],
        profile_type: values[profileTypeIdx],
        factors,
      });
    }

    return results;
  }

  private parseProfileJSON(filePath: string): Array<{ road_functional_class: string; profile_type: string; factors: Record<string, number> }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        road_functional_class: item.road_functional_class || item.roadClass || 'Arterial',
        profile_type: item.profile_type || item.profileType || 'hourly',
        factors: item.factors || {},
      }));
    }

    return [];
  }

  async getProfileSummary(state?: string): Promise<{
    total_profiles: number;
    by_type: Record<string, number>;
    by_road_class: Record<string, number>;
    states: string[];
  }> {
    const whereClause = state ? 'WHERE state = $1' : '';
    const params = state ? [state] : [];

    const result = await this.pool.query(
      `SELECT state, road_functional_class, profile_type, COUNT(*) as cnt
       FROM dot_temporal_profiles ${whereClause}
       GROUP BY state, road_functional_class, profile_type`,
      params
    );

    const byType: Record<string, number> = {};
    const byRoadClass: Record<string, number> = {};
    const states = new Set<string>();

    for (const row of result.rows) {
      states.add(row.state);
      byType[row.profile_type] = (byType[row.profile_type] || 0) + parseInt(row.cnt);
      byRoadClass[row.road_functional_class] = (byRoadClass[row.road_functional_class] || 0) + parseInt(row.cnt);
    }

    return {
      total_profiles: result.rows.reduce((sum: number, r: any) => sum + parseInt(r.cnt), 0),
      by_type: byType,
      by_road_class: byRoadClass,
      states: Array.from(states),
    };
  }

  async deleteProfiles(state: string, region?: string): Promise<number> {
    let query = 'DELETE FROM dot_temporal_profiles WHERE state = $1';
    const params: any[] = [state];
    if (region) {
      query += ' AND region = $2';
      params.push(region);
    }
    const result = await this.pool.query(query, params);
    this.profileCache.clear();
    this.cacheLoadedAt = 0;
    return result.rowCount || 0;
  }
}

let dotTemporalProfilesServiceInstance: DotTemporalProfilesService | null = null;

export function getDotTemporalProfilesService(pool: Pool): DotTemporalProfilesService {
  if (!dotTemporalProfilesServiceInstance) {
    dotTemporalProfilesServiceInstance = new DotTemporalProfilesService(pool);
  }
  return dotTemporalProfilesServiceInstance;
}
