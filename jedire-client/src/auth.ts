/**
 * JWT Token Management for JediRe API
 */

import axios, { AxiosInstance } from 'axios';
import { AuthResponse } from './types';

export class AuthManager {
  private token: string | null = null;
  private tokenExpiry: number | null = null;
  private readonly baseUrl: string;
  private readonly email?: string;
  private readonly password?: string;
  private readonly httpClient: AxiosInstance;

  constructor(
    baseUrl: string,
    email?: string,
    password?: string,
    initialToken?: string
  ) {
    this.baseUrl = baseUrl;
    this.email = email;
    this.password = password;
    this.token = initialToken || null;

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  /**
   * Get current token, refreshing if necessary
   */
  async getToken(): Promise<string> {
    if (this.token && !this.isTokenExpired()) {
      return this.token;
    }

    if (this.email && this.password) {
      await this.authenticate(this.email, this.password);
      return this.token!;
    }

    if (this.token) {
      // Token exists but might be expired, try to use it anyway
      return this.token;
    }

    throw new Error('No valid authentication credentials available');
  }

  /**
   * Authenticate with email and password
   */
  async authenticate(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.httpClient.post<AuthResponse>('/auth/login', {
        email,
        password,
      });

      this.token = response.data.access_token;
      
      // Set expiry (default to 1 hour if not provided)
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = Date.now() + (expiresIn * 1000);

      return response.data;
    } catch (error: any) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Set token manually
   */
  setToken(token: string, expiresIn?: number): void {
    this.token = token;
    if (expiresIn) {
      this.tokenExpiry = Date.now() + (expiresIn * 1000);
    }
  }

  /**
   * Clear token
   */
  clearToken(): void {
    this.token = null;
    this.tokenExpiry = null;
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) {
      return false; // No expiry set, assume valid
    }
    // Add 5-minute buffer to refresh before actual expiry
    return Date.now() >= (this.tokenExpiry - 300000);
  }

  /**
   * Get authorization header
   */
  getAuthHeader(): string {
    if (!this.token) {
      throw new Error('No authentication token available');
    }
    return `Bearer ${this.token}`;
  }
}
