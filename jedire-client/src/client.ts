/**
 * JediRe API Client
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { AuthManager } from './auth';
import {
  JediReConfig,
  Deal,
  Property,
  Market,
  MarketIntelligence,
  Ranking,
  Analysis,
  ApiError,
  ListFilters,
  PaginatedResponse,
  AuthResponse,
} from './types';

export class JediReClient {
  private readonly httpClient: AxiosInstance;
  private readonly authManager: AuthManager;
  private readonly config: {
    baseUrl: string;
    token?: string;
    email?: string;
    password?: string;
    requestTimeout: number;
    maxRetries: number;
    retryDelay: number;
    logRequests: boolean;
  };

  constructor(config: JediReConfig = {}) {
    // Set defaults
    this.config = {
      baseUrl: config.baseUrl || process.env.JEDIRE_API_URL || 'http://localhost:5000',
      token: config.token || process.env.JEDIRE_API_TOKEN,
      email: config.email || process.env.JEDIRE_API_EMAIL,
      password: config.password || process.env.JEDIRE_API_PASSWORD,
      requestTimeout: config.requestTimeout || 30000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      logRequests: config.logRequests !== undefined ? config.logRequests : false,
    };

    // Initialize auth manager
    this.authManager = new AuthManager(
      this.config.baseUrl,
      this.config.email,
      this.config.password,
      this.config.token
    );

    // Initialize HTTP client
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.requestTimeout,
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use(async (config) => {
      try {
        const token = await this.authManager.getToken();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        // Continue without auth header if token unavailable
        console.warn('No authentication token available');
      }

      if (this.config.logRequests) {
        console.log(`[JediRe] ${config.method?.toUpperCase()} ${config.url}`);
      }

      return config;
    });

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (this.config.logRequests) {
          console.error(`[JediRe] Error: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Make a request with retry logic
   */
  private async requestWithRetry<T>(
    requestFn: () => Promise<T>,
    retries: number = this.config.maxRetries
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error: any) {
      if (retries > 0 && this.shouldRetry(error)) {
        await this.sleep(this.config.retryDelay);
        return this.requestWithRetry(requestFn, retries - 1);
      }
      throw this.normalizeError(error);
    }
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: any): boolean {
    if (!error.response) {
      return true; // Network error
    }
    const status = error.response.status;
    // Retry on 5xx errors and 429 (rate limit)
    return status >= 500 || status === 429;
  }

  /**
   * Sleep helper for retry delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Normalize error response
   */
  private normalizeError(error: any): Error {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.data?.error || error.message;
      return new Error(`API Error (${status}): ${message}`);
    }
    return new Error(`Network Error: ${error.message}`);
  }

  // ==================== Authentication ====================

  /**
   * Authenticate with email and password
   */
  async authenticate(email: string, password: string): Promise<AuthResponse> {
    return this.authManager.authenticate(email, password);
  }

  /**
   * Set authentication token manually
   */
  setToken(token: string): void {
    this.authManager.setToken(token);
  }

  // ==================== Deals ====================

  /**
   * Get a specific deal by ID
   */
  async getDeal(dealId: string): Promise<Deal> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.get<Deal>(`/api/deals/${dealId}`);
      return response.data;
    });
  }

  /**
   * List deals with optional filters
   */
  async getDeals(filters?: ListFilters): Promise<PaginatedResponse<Deal>> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.get<PaginatedResponse<Deal>>('/api/deals', {
        params: filters,
      });
      return response.data;
    });
  }

  /**
   * Create a new deal
   */
  async createDeal(dealData: Partial<Deal>): Promise<Deal> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.post<Deal>('/api/deals', dealData);
      return response.data;
    });
  }

  /**
   * Update a deal
   */
  async updateDeal(dealId: string, dealData: Partial<Deal>): Promise<Deal> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.put<Deal>(`/api/deals/${dealId}`, dealData);
      return response.data;
    });
  }

  /**
   * Delete a deal
   */
  async deleteDeal(dealId: string): Promise<void> {
    return this.requestWithRetry(async () => {
      await this.httpClient.delete(`/api/deals/${dealId}`);
    });
  }

  // ==================== Properties ====================

  /**
   * Get a specific property by ID
   */
  async getProperty(propertyId: string): Promise<Property> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.get<Property>(`/api/properties/${propertyId}`);
      return response.data;
    });
  }

  /**
   * List properties with optional filters
   */
  async getProperties(filters?: ListFilters): Promise<PaginatedResponse<Property>> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.get<PaginatedResponse<Property>>('/api/properties', {
        params: filters,
      });
      return response.data;
    });
  }

  /**
   * Create a new property
   */
  async createProperty(propertyData: Partial<Property>): Promise<Property> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.post<Property>('/api/properties', propertyData);
      return response.data;
    });
  }

  /**
   * Update a property
   */
  async updateProperty(propertyId: string, propertyData: Partial<Property>): Promise<Property> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.put<Property>(`/api/properties/${propertyId}`, propertyData);
      return response.data;
    });
  }

  // ==================== Market Intelligence ====================

  /**
   * Get market intelligence data for a specific market
   */
  async getMarketIntelligence(marketId: string): Promise<MarketIntelligence> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.get<MarketIntelligence>(`/api/markets/${marketId}/intelligence`);
      return response.data;
    });
  }

  /**
   * Get market details
   */
  async getMarket(marketId: string): Promise<Market> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.get<Market>(`/api/markets/${marketId}`);
      return response.data;
    });
  }

  /**
   * List markets
   */
  async getMarkets(filters?: ListFilters): Promise<PaginatedResponse<Market>> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.get<PaginatedResponse<Market>>('/api/markets', {
        params: filters,
      });
      return response.data;
    });
  }

  // ==================== Rankings ====================

  /**
   * Get PCS rankings for a specific market
   */
  async getRankings(marketId: string, filters?: ListFilters): Promise<PaginatedResponse<Ranking>> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.get<PaginatedResponse<Ranking>>(`/api/markets/${marketId}/rankings`, {
        params: filters,
      });
      return response.data;
    });
  }

  /**
   * Get top rankings across all markets
   */
  async getTopRankings(filters?: ListFilters): Promise<PaginatedResponse<Ranking>> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.get<PaginatedResponse<Ranking>>('/api/rankings', {
        params: filters,
      });
      return response.data;
    });
  }

  // ==================== Analysis ====================

  /**
   * Run analysis on a deal
   */
  async runAnalysis(dealId: string, analysisType: string, options?: any): Promise<Analysis> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.post<Analysis>(`/api/deals/${dealId}/analyze`, {
        type: analysisType,
        ...options,
      });
      return response.data;
    });
  }

  /**
   * Get analysis results
   */
  async getAnalysis(analysisId: string): Promise<Analysis> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.get<Analysis>(`/api/analysis/${analysisId}`);
      return response.data;
    });
  }

  /**
   * List analyses for a deal
   */
  async getDealAnalyses(dealId: string, filters?: ListFilters): Promise<PaginatedResponse<Analysis>> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.get<PaginatedResponse<Analysis>>(`/api/deals/${dealId}/analyses`, {
        params: filters,
      });
      return response.data;
    });
  }

  // ==================== Error Tracking ====================

  /**
   * Get recent API errors
   */
  async getErrors(limit: number = 50): Promise<ApiError[]> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.get<ApiError[]>('/api/errors', {
        params: { limit },
      });
      return response.data;
    });
  }

  /**
   * Get specific error details
   */
  async getError(errorId: string): Promise<ApiError> {
    return this.requestWithRetry(async () => {
      const response = await this.httpClient.get<ApiError>(`/api/errors/${errorId}`);
      return response.data;
    });
  }

  // ==================== Health & Status ====================

  /**
   * Check API health
   */
  async healthCheck(): Promise<any> {
    const response = await this.httpClient.get('/health');
    return response.data;
  }

  /**
   * Get API status
   */
  async getStatus(): Promise<any> {
    const response = await this.httpClient.get('/api/status');
    return response.data;
  }
}
