/**
 * ArcGIS REST API Client
 * Generic client for querying ArcGIS MapServer and FeatureServer endpoints
 */

export interface ArcGISQueryOptions {
  where?: string;
  outFields?: string[] | '*';
  returnGeometry?: boolean;
  returnCentroid?: boolean;
  outSR?: number;
  resultOffset?: number;
  resultRecordCount?: number;
  orderByFields?: string;
  f?: 'json' | 'geojson';
}

export interface ArcGISQueryResult<T> {
  features: Array<{
    attributes: T;
    geometry?: unknown;
  }>;
  exceededTransferLimit?: boolean;
  objectIdFieldName?: string;
  globalIdFieldName?: string;
  fields?: Array<{
    name: string;
    type: string;
    alias: string;
  }>;
}

export interface ArcGISServiceInfo {
  currentVersion: number;
  id: number;
  name: string;
  type: string;
  description: string;
  maxRecordCount: number;
  fields: Array<{
    name: string;
    type: string;
    alias: string;
    length?: number;
  }>;
}

export class ArcGISClient {
  private baseUrl: string;
  private maxRetries: number;
  private retryDelay: number;
  
  constructor(baseUrl: string, options: { maxRetries?: number; retryDelay?: number } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
  }
  
  /**
   * Get service/layer info
   */
  async getServiceInfo(layerId?: number): Promise<ArcGISServiceInfo> {
    const url = layerId !== undefined 
      ? `${this.baseUrl}/${layerId}?f=json`
      : `${this.baseUrl}?f=json`;
    
    const response = await this.fetchWithRetry(url);
    return response;
  }
  
  /**
   * Get total record count
   */
  async getRecordCount(layerId: number, where: string = '1=1'): Promise<number> {
    const url = `${this.baseUrl}/${layerId}/query?` + new URLSearchParams({
      where,
      returnCountOnly: 'true',
      f: 'json'
    });
    
    const response = await this.fetchWithRetry(url);
    return response.count || 0;
  }
  
  /**
   * Query features from a layer
   */
  async query<T>(
    layerId: number,
    options: ArcGISQueryOptions = {}
  ): Promise<ArcGISQueryResult<T>> {
    // returnCentroid: if server doesn't support it, we fetch geometry and compute it
    const needGeometry = options.returnGeometry || options.returnCentroid;
    const params = new URLSearchParams({
      where: options.where || '1=1',
      outFields: Array.isArray(options.outFields) 
        ? options.outFields.join(',') 
        : options.outFields || '*',
      returnGeometry: String(needGeometry ?? false),
      f: options.f || 'json'
    });
    if (options.returnCentroid) params.set('returnCentroid', 'true');
    if (options.outSR) params.set('outSR', String(options.outSR));
    
    if (options.resultOffset !== undefined) {
      params.set('resultOffset', String(options.resultOffset));
    }
    if (options.resultRecordCount !== undefined) {
      params.set('resultRecordCount', String(options.resultRecordCount));
    }
    if (options.orderByFields) {
      params.set('orderByFields', options.orderByFields);
    }
    
    const url = `${this.baseUrl}/${layerId}/query?${params}`;
    return this.fetchWithRetry(url);
  }
  
  /**
   * Query all features with pagination
   */
  async queryAll<T>(
    layerId: number,
    options: ArcGISQueryOptions & { 
      batchSize?: number;
      maxRecords?: number;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<T[]> {
    const batchSize = options.batchSize || 1000;
    const maxRecords = options.maxRecords;
    const all: T[] = [];
    let offset = 0;
    let hasMore = true;
    
    // Get total count first
    const total = await this.getRecordCount(layerId, options.where || '1=1');
    const targetCount = maxRecords ? Math.min(total, maxRecords) : total;
    
    console.log(`[ArcGIS] Querying ${targetCount} records from layer ${layerId}`);
    
    while (hasMore && all.length < targetCount) {
      const result = await this.query<T>(layerId, {
        ...options,
        resultOffset: offset,
        resultRecordCount: batchSize
      });
      
      if (result.features && result.features.length > 0) {
        for (const feature of result.features) {
          if (maxRecords && all.length >= maxRecords) break;
          const geom = feature.geometry as any;

          // Try native centroid first; fall back to averaging ring vertices
          const nativeCentroid = (feature as any).centroid;
          if (options.returnCentroid) {
            let cx: number | undefined, cy: number | undefined;
            if (nativeCentroid?.x != null && nativeCentroid?.y != null) {
              cx = nativeCentroid.x; cy = nativeCentroid.y;
            } else if (geom?.rings?.length > 0) {
              const ring: number[][] = geom.rings[0];
              cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
              cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
            }
            all.push({ ...feature.attributes, centroid_x: cx ?? null, centroid_y: cy ?? null } as T);
          } else if (options.returnGeometry && geom !== undefined) {
            all.push({ ...feature.attributes, geometry: geom } as T);
          } else {
            all.push(feature.attributes);
          }
        }
        
        offset += result.features.length;
        
        if (options.onProgress) {
          options.onProgress(all.length, targetCount);
        }
        
        // Check if there are more records
        hasMore = result.exceededTransferLimit !== false && 
                  result.features.length === batchSize;
      } else {
        hasMore = false;
      }
      
      // Small delay between batches to be nice to the server
      if (hasMore) {
        await this.delay(100);
      }
    }
    
    console.log(`[ArcGIS] Retrieved ${all.length} records`);
    return all;
  }
  
  /**
   * Query features by IDs (for joining)
   */
  async queryByIds<T>(
    layerId: number,
    idField: string,
    ids: string[],
    outFields: string[] | '*' = '*'
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    // Batch IDs to avoid URL length limits
    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const whereClause = `${idField} IN (${batchIds.map(id => `'${id}'`).join(',')})`;
      
      const result = await this.query<T>(layerId, {
        where: whereClause,
        outFields,
        resultRecordCount: batchSize
      });
      
      for (const feature of result.features) {
        const id = (feature.attributes as any)[idField];
        if (id) {
          results.set(String(id), feature.attributes);
        }
      }
      
      if (i + batchSize < ids.length) {
        await this.delay(100);
      }
    }
    
    return results;
  }
  
  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(url: string, attempt: number = 1): Promise<any> {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
      }
      
      return data;
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.warn(`[ArcGIS] Retry ${attempt}/${this.maxRetries} for ${url}`);
        await this.delay(this.retryDelay * attempt);
        return this.fetchWithRetry(url, attempt + 1);
      }
      throw error;
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
