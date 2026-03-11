/**
 * Environment Configuration & Validation
 * 
 * Centralized environment variable access with validation.
 * Fails fast if required variables are missing.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface EnvironmentConfig {
  // Server
  nodeEnv: string;
  port: number;
  apiVersion: string;
  
  // Database
  databaseUrl: string;
  dbPoolMin: number;
  dbPoolMax: number;
  
  // Redis
  redisUrl: string;
  
  // JWT
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  
  // Frontend
  frontendUrl: string;
  corsOrigin: string;
  
  // External APIs (optional)
  googleClientId?: string;
  googleClientSecret?: string;
  googleMapsApiKey?: string;
  mapboxAccessToken?: string;
  regridApiKey?: string;
  
  // LLM APIs (optional)
  claudeApiKey?: string;
  claudeModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  
  // Microsoft (optional)
  microsoftClientId?: string;
  microsoftClientSecret?: string;
  microsoftTenantId?: string;
  
  // WebSocket
  wsCorsOrigin: string;
  wsPingInterval: number;
  wsPingTimeout: number;
  
  // Logging
  logLevel: string;
  logFile: string;
  
  // Rate Limiting
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  
  // App Metadata
  appName: string;
  appVersion: string;
}

/**
 * Validates and loads environment variables
 */
class Environment {
  private config: EnvironmentConfig;
  
  constructor() {
    this.config = this.loadConfig();
    this.validate();
  }
  
  private loadConfig(): EnvironmentConfig {
    return {
      // Server
      nodeEnv: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3000', 10),
      apiVersion: process.env.API_VERSION || 'v1',
      
      // Database
      databaseUrl: process.env.DATABASE_URL || '',
      dbPoolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
      dbPoolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
      
      // Redis
      redisUrl: process.env.REDIS_URL || '',
      
      // JWT
      jwtSecret: process.env.JWT_SECRET || '',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
      jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
      jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      
      // Frontend
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      
      // External APIs
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN,
      regridApiKey: process.env.REGRID_API_KEY,
      
      // LLM APIs
      claudeApiKey: process.env.CLAUDE_API_KEY,
      claudeModel: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      openaiApiKey: process.env.OPENAI_API_KEY,
      openaiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      
      // Microsoft
      microsoftClientId: process.env.MICROSOFT_CLIENT_ID,
      microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      microsoftTenantId: process.env.MICROSOFT_TENANT_ID || 'common',
      
      // WebSocket
      wsCorsOrigin: process.env.WS_CORS_ORIGIN || 'http://localhost:3000',
      wsPingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10),
      wsPingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '20000', 10),
      
      // Logging
      logLevel: process.env.LOG_LEVEL || 'info',
      logFile: process.env.LOG_FILE || 'logs/jedire.log',
      
      // Rate Limiting
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      
      // App Metadata
      appName: process.env.APP_NAME || 'JEDI-RE',
      appVersion: process.env.APP_VERSION || '1.0.0',
    };
  }
  
  /**
   * Validates required environment variables
   * Fails fast if critical variables are missing
   */
  private validate(): void {
    const errors: string[] = [];
    
    // Required variables
    const required: (keyof EnvironmentConfig)[] = [
      'databaseUrl',
      'jwtSecret',
      'jwtRefreshSecret',
    ];
    
    for (const key of required) {
      if (!this.config[key]) {
        errors.push(`Missing required environment variable: ${key}`);
      }
    }
    
    // Validate JWT secrets in production
    if (this.config.nodeEnv === 'production') {
      if (this.config.jwtSecret === 'your-super-secret-jwt-key-CHANGE-THIS-TO-RANDOM-STRING') {
        errors.push('JWT_SECRET must be changed from default value in production');
      }
      
      if (this.config.jwtRefreshSecret === 'your-refresh-token-secret-CHANGE-THIS-TO-RANDOM-STRING') {
        errors.push('JWT_REFRESH_SECRET must be changed from default value in production');
      }
    }
    
    // Check for at least one LLM provider in production
    if (this.config.nodeEnv === 'production') {
      const hasLLM = this.config.claudeApiKey || this.config.openaiApiKey;
      if (!hasLLM) {
        console.warn('⚠️  WARNING: No LLM API key configured. AI features will be disabled.');
      }
    }
    
    if (errors.length > 0) {
      console.error('❌ Environment Configuration Errors:');
      errors.forEach(error => console.error(`  - ${error}`));
      console.error('\nPlease check your .env file and ensure all required variables are set.');
      console.error('See .env.example for reference.\n');
      process.exit(1);
    }
    
    console.log('✅ Environment configuration validated successfully');
  }
  
  /**
   * Get configuration
   */
  public get(): EnvironmentConfig {
    return this.config;
  }
  
  /**
   * Check if running in production
   */
  public isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }
  
  /**
   * Check if running in development
   */
  public isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }
  
  /**
   * Check if running in test mode
   */
  public isTest(): boolean {
    return this.config.nodeEnv === 'test';
  }
}

// Export singleton instance
export const env = new Environment();
export default env;
