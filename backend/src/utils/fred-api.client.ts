/**
 * Federal Reserve Economic Data (FRED) API Client
 * Fetches rate data: FFR, 10Y, mortgage rates, M2, DXY
 * Docs: https://fred.stlouisfed.org/docs/api/
 */

import axios, { AxiosInstance } from 'axios';

export interface FREDSeriesObservation {
  date: string;
  value: string;
}

export interface FREDSeriesData {
  series_id: string;
  observations: FREDSeriesObservation[];
}

export class FREDApiClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL = 'https://api.stlouisfed.org/fred';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FRED_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('FRED API key not configured. Set FRED_API_KEY environment variable.');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      params: {
        api_key: this.apiKey,
        file_type: 'json',
      },
    });
  }

  /**
   * Get series observations (data points)
   */
  async getSeries(
    seriesId: string,
    startDate?: string,
    endDate?: string,
    limit?: number
  ): Promise<FREDSeriesObservation[]> {
    try {
      const params: any = {
        series_id: seriesId,
      };

      if (startDate) params.observation_start = startDate;
      if (endDate) params.observation_end = endDate;
      if (limit) params.limit = limit;

      const response = await this.client.get('/series/observations', { params });
      
      return response.data.observations || [];
    } catch (error: any) {
      console.error(`FRED API error for series ${seriesId}:`, error.message);
      throw new Error(`Failed to fetch FRED series ${seriesId}: ${error.message}`);
    }
  }

  /**
   * Get the most recent observation for a series
   */
  async getLatest(seriesId: string): Promise<FREDSeriesObservation | null> {
    const observations = await this.getSeries(seriesId, undefined, undefined, 1);
    return observations.length > 0 ? observations[0] : null;
  }

  /**
   * Get multiple series in parallel
   */
  async getMultipleSeries(
    seriesIds: string[],
    startDate?: string,
    endDate?: string
  ): Promise<Record<string, FREDSeriesObservation[]>> {
    const promises = seriesIds.map(async (id) => {
      const data = await this.getSeries(id, startDate, endDate);
      return { id, data };
    });

    const results = await Promise.all(promises);
    
    const seriesData: Record<string, FREDSeriesObservation[]> = {};
    results.forEach(({ id, data }) => {
      seriesData[id] = data;
    });

    return seriesData;
  }

  /**
   * Get latest values for multiple series
   */
  async getMultipleLatest(seriesIds: string[]): Promise<Record<string, number | null>> {
    const promises = seriesIds.map(async (id) => {
      const latest = await this.getLatest(id);
      return { id, value: latest ? parseFloat(latest.value) : null };
    });

    const results = await Promise.all(promises);
    
    const values: Record<string, number | null> = {};
    results.forEach(({ id, value }) => {
      values[id] = value;
    });

    return values;
  }
}

// ═══════════════════════════════════════════════════════════════
// FRED Series IDs for M28
// ═══════════════════════════════════════════════════════════════

export const FRED_SERIES = {
  // Fed Policy
  FFR: 'DFF',              // Federal Funds Rate (daily)
  SOFR: 'SOFR',            // Secured Overnight Financing Rate
  
  // Treasury Yields
  T10Y: 'DGS10',           // 10-Year Treasury Constant Maturity Rate
  T30Y: 'DGS30',           // 30-Year Treasury
  
  // Mortgage Rates
  MTG30Y: 'MORTGAGE30US',  // 30-Year Fixed Rate Mortgage Average
  
  // Money Supply
  M2: 'M2SL',              // M2 Money Stock (billions, seasonally adjusted)
  M2_YOY: 'M2YOY',         // M2 Year-over-Year % Change (calculated series)
  
  // Fed Balance Sheet
  FED_ASSETS: 'WALCL',     // Fed Total Assets (billions)
  
  // Dollar Index
  DXY: 'DTWEXBGS',         // Trade Weighted U.S. Dollar Index: Broad, Goods
  
  // Spreads (calculated)
  // Cap spread = actual cap rate - 10Y (calculated in application)
} as const;

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate M2 YoY growth rate from M2 levels
 */
export function calculateM2YoY(
  m2Data: FREDSeriesObservation[]
): FREDSeriesObservation[] {
  if (m2Data.length < 13) return []; // Need 13 months for YoY

  const yoyData: FREDSeriesObservation[] = [];

  for (let i = 12; i < m2Data.length; i++) {
    const current = parseFloat(m2Data[i].value);
    const yearAgo = parseFloat(m2Data[i - 12].value);
    
    if (!isNaN(current) && !isNaN(yearAgo) && yearAgo > 0) {
      const yoy = ((current - yearAgo) / yearAgo) * 100;
      yoyData.push({
        date: m2Data[i].date,
        value: yoy.toFixed(2),
      });
    }
  }

  return yoyData;
}

/**
 * Determine policy stance based on FFR trend
 */
export function determinePolicyStance(
  ffrData: FREDSeriesObservation[]
): 'easing' | 'tightening' | 'neutral' | 'emergency' {
  if (ffrData.length < 2) return 'neutral';

  const latest = parseFloat(ffrData[ffrData.length - 1].value);
  const threeMonthsAgo = parseFloat(ffrData[Math.max(0, ffrData.length - 90)].value);
  const change = latest - threeMonthsAgo;

  // Emergency = FFR near zero or massive cuts
  if (latest < 0.5) return 'emergency';
  if (change < -1.0) return 'emergency';

  // Easing = cutting
  if (change < -0.25) return 'easing';

  // Tightening = hiking
  if (change > 0.25) return 'tightening';

  // Neutral = stable
  return 'neutral';
}

/**
 * Determine forward curve direction from 10Y vs FFR
 */
export function determineForwardDirection(
  ffr: number,
  t10y: number
): 'rising' | 'falling' | 'flat' {
  const spread = t10y - ffr;

  // Inverted or flat = expect rates to fall
  if (spread < 0.5) return 'falling';

  // Steep curve = expect rates to rise
  if (spread > 2.0) return 'rising';

  // Normal = stable
  return 'flat';
}

// Export singleton instance
export const fredApiClient = new FREDApiClient();
