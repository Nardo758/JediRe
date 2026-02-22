/**
 * Secure Secrets Management
 * Load and validate environment secrets with fail-fast on missing values
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Throws error if environment variable is missing
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`FATAL: Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Gets optional environment variable with default
 */
function getEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

/**
 * Validates environment variable is not a placeholder
 */
function validateNotPlaceholder(key: string, value: string, placeholder: string): void {
  if (value === placeholder) {
    throw new Error(
      `FATAL: ${key} is still set to placeholder value. Please configure a real secret!`
    );
  }
}

/**
 * Secure configuration object
 */
export const secrets = {
  // ============================================
  // CRITICAL SECRETS (Required)
  // ============================================
  
  database: {
    url: requireEnv('DATABASE_URL'),
    poolMin: parseInt(getEnv('DB_POOL_MIN', '2'), 10),
    poolMax: parseInt(getEnv('DB_POOL_MAX', '20'), 10),
  },

  jwt: {
    secret: (() => {
      const secret = requireEnv('JWT_SECRET');
      validateNotPlaceholder(
        'JWT_SECRET',
        secret,
        'your-super-secret-jwt-key-CHANGE-THIS-TO-RANDOM-STRING'
      );
      if (secret.length < 32) {
        throw new Error('FATAL: JWT_SECRET must be at least 32 characters long');
      }
      return secret;
    })(),
    
    refreshSecret: (() => {
      const secret = requireEnv('JWT_REFRESH_SECRET');
      validateNotPlaceholder(
        'JWT_REFRESH_SECRET',
        secret,
        'your-refresh-token-secret-CHANGE-THIS-TO-RANDOM-STRING'
      );
      if (secret.length < 32) {
        throw new Error('FATAL: JWT_REFRESH_SECRET must be at least 32 characters long');
      }
      return secret;
    })(),
    
    expiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
    refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '30d'),
  },

  // ============================================
  // EXTERNAL API KEYS (Optional but recommended)
  // ============================================

  external: {
    // Google Services
    google: {
      clientId: getEnv('GOOGLE_CLIENT_ID'),
      clientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
      mapsApiKey: getEnv('GOOGLE_MAPS_API_KEY'),
    },

    // Mapbox
    mapbox: {
      accessToken: getEnv('MAPBOX_ACCESS_TOKEN'),
    },

    // RegGrid (Property Data)
    regrid: {
      apiKey: getEnv('REGRID_API_KEY'),
    },

    // Microsoft OAuth
    microsoft: {
      clientId: getEnv('MICROSOFT_CLIENT_ID'),
      clientSecret: getEnv('MICROSOFT_CLIENT_SECRET'),
      tenantId: getEnv('MICROSOFT_TENANT_ID', 'common'),
      redirectUri: getEnv('MICROSOFT_REDIRECT_URI'),
    },

    // LLM Providers
    ai: {
      claudeApiKey: getEnv('CLAUDE_API_KEY'),
      claudeModel: getEnv('CLAUDE_MODEL', 'claude-3-5-sonnet-20241022'),
      openaiApiKey: getEnv('OPENAI_API_KEY'),
      openaiModel: getEnv('OPENAI_MODEL', 'gpt-4-turbo-preview'),
      huggingfaceToken: getEnv('HF_TOKEN'),
    },

    // External Integrations
    apartmentLocator: {
      apiKey: getEnv('API_KEY_APARTMENT_LOCATOR'),
    },
  },

  // ============================================
  // SECURITY SETTINGS
  // ============================================

  security: {
    allowedOrigins: getEnv('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000')
      .split(',')
      .map(origin => origin.trim()),
    
    apiKeys: {
      apartmentLocator: getEnv('API_KEY_APARTMENT_LOCATOR'),
    },
    
    rateLimit: {
      windowMs: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10), // 15 min
      maxRequests: parseInt(getEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
    },
    
    strictRateLimit: {
      windowMs: parseInt(getEnv('STRICT_RATE_LIMIT_WINDOW_MS', '60000'), 10), // 1 min
      maxRequests: parseInt(getEnv('STRICT_RATE_LIMIT_MAX_REQUESTS', '10'), 10),
    },
  },

  // ============================================
  // APPLICATION SETTINGS
  // ============================================

  app: {
    nodeEnv: getEnv('NODE_ENV', 'development'),
    port: parseInt(getEnv('PORT', '3001'), 10),
    frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:5173'),
    apiVersion: getEnv('API_VERSION', 'v1'),
    appName: getEnv('APP_NAME', 'JEDI-RE'),
    appVersion: getEnv('APP_VERSION', '1.0.0'),
  },

  // ============================================
  // REDIS (Optional)
  // ============================================

  redis: {
    url: getEnv('REDIS_URL'),
  },

  // ============================================
  // LOGGING
  // ============================================

  logging: {
    level: getEnv('LOG_LEVEL', 'info'),
    file: getEnv('LOG_FILE', 'logs/jedire.log'),
  },
};

/**
 * Validates all secrets on startup
 */
export function validateSecrets(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check production-specific requirements
  if (secrets.app.nodeEnv === 'production') {
    // Ensure critical external services are configured
    if (!secrets.external.mapbox.accessToken) {
      warnings.push('MAPBOX_ACCESS_TOKEN not set - map features will be limited');
    }

    if (!secrets.external.ai.claudeApiKey && !secrets.external.ai.openaiApiKey) {
      warnings.push('No AI provider configured - AI features will be disabled');
    }

    // Ensure CORS is properly configured
    if (secrets.security.allowedOrigins.length === 0) {
      errors.push('ALLOWED_ORIGINS must be configured in production');
    }

    // Check for localhost in production CORS
    const hasLocalhost = secrets.security.allowedOrigins.some(
      origin => origin.includes('localhost') || origin.includes('127.0.0.1')
    );
    if (hasLocalhost) {
      errors.push('ALLOWED_ORIGINS contains localhost in production - security risk!');
    }
  }

  // Check JWT secrets strength
  if (secrets.jwt.secret === secrets.jwt.refreshSecret) {
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different!');
  }

  // Print warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  Configuration Warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
    console.warn('');
  }

  // Fail on errors
  if (errors.length > 0) {
    console.error('\n❌ Critical Configuration Errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('\nPlease check your .env file and fix these issues.\n');
    process.exit(1);
  }

  console.log('✅ All secrets validated successfully');
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
  return secrets.app.nodeEnv === 'production';
}

/**
 * Check if we're in development
 */
export function isDevelopment(): boolean {
  return secrets.app.nodeEnv === 'development';
}

/**
 * Get a secret safely (throws if missing in production)
 */
export function getSecret(key: string, required: boolean = false): string {
  const value = process.env[key];
  
  if (!value && required) {
    if (isProduction()) {
      throw new Error(`FATAL: Required secret ${key} is missing in production`);
    } else {
      console.warn(`⚠️  Warning: ${key} is not set (OK in development)`);
      return '';
    }
  }
  
  return value || '';
}

// Auto-validate on module load
validateSecrets();

export default secrets;
