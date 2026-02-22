/**
 * Enhanced Rate Limiting Middleware
 * Multiple tiers for different endpoint sensitivity
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { secrets } from '../config/secrets';

interface RateLimitRecord {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface RateLimitStore {
  [key: string]: RateLimitRecord;
}

const store: RateLimitStore = {};

/**
 * Clean up old entries every 5 minutes to prevent memory leak
 */
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key];
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug(`Rate limiter: Cleaned ${cleaned} expired entries`);
  }
}, 300000); // 5 minutes

/**
 * Get client identifier for rate limiting
 */
function getClientId(req: Request): string {
  // Try to get user ID from authenticated request
  const userId = (req as any).user?.userId;
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fall back to IP address
  const ip = req.headers['x-forwarded-for'] || 
             req.headers['x-real-ip'] || 
             req.socket.remoteAddress || 
             'unknown';
  
  return `ip:${ip}`;
}

/**
 * Generic rate limiter factory
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = getClientId(req);
    const key = `${identifier}:${windowMs}:${maxRequests}`;
    const now = Date.now();

    // Initialize or get existing record
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
        firstRequest: now,
      };
    }

    // Increment counter
    store[key].count++;

    // Calculate rate limit headers
    const remaining = Math.max(0, maxRequests - store[key].count);
    const resetTime = new Date(store[key].resetTime);

    // Set standard rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetTime.toISOString());

    // Check if limit exceeded
    if (store[key].count > maxRequests) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);

      logger.warn('Rate limit exceeded', {
        identifier,
        path: req.path,
        count: store[key].count,
        limit: maxRequests,
        windowMs,
      });

      res.setHeader('Retry-After', retryAfter.toString());
      res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfter,
        limit: maxRequests,
        windowMs,
      });
      return;
    }

    // Handle skip successful requests
    if (skipSuccessfulRequests) {
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        if (res.statusCode < 400) {
          // Decrement counter for successful requests
          store[key].count--;
        }
        return originalJson(body);
      };
    }

    next();
  };
}

// ============================================
// PREDEFINED RATE LIMITERS
// ============================================

/**
 * Standard API rate limiter
 * 100 requests per 15 minutes per client
 */
export const apiLimiter = createRateLimiter({
  windowMs: secrets.security.rateLimit.windowMs, // 15 minutes
  maxRequests: secrets.security.rateLimit.maxRequests, // 100 requests
  message: 'Too many API requests. Please try again in 15 minutes.',
});

/**
 * Strict rate limiter for sensitive endpoints
 * 10 requests per minute
 */
export const strictLimiter = createRateLimiter({
  windowMs: secrets.security.strictRateLimit.windowMs, // 1 minute
  maxRequests: secrets.security.strictRateLimit.maxRequests, // 10 requests
  message: 'Too many requests to sensitive endpoint. Please slow down.',
});

/**
 * Authentication rate limiter
 * Prevents brute force attacks on login
 * 5 attempts per 15 minutes
 */
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * AI/LLM endpoint limiter
 * Very expensive operations - heavily restricted
 * 5 requests per minute
 */
export const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  message: 'AI endpoint rate limit exceeded. These operations are expensive - please wait.',
});

/**
 * File upload limiter
 * 10 uploads per hour
 */
export const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  message: 'Too many file uploads. Please try again later.',
});

/**
 * Search limiter
 * 30 searches per minute
 */
export const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
  message: 'Too many search requests. Please slow down.',
});

/**
 * Email sending limiter
 * Prevents spam - 10 emails per hour
 */
export const emailLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  message: 'Email rate limit exceeded. Please try again later.',
});

/**
 * Per-user global limiter (more generous for authenticated users)
 * 500 requests per 15 minutes for authenticated users
 */
export const userLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 500,
  message: 'Your account has exceeded the rate limit. Please try again in 15 minutes.',
});

/**
 * Legacy rate limiter for backward compatibility
 */
export const rateLimiter = apiLimiter;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get current rate limit status for a client
 */
export function getRateLimitStatus(req: Request, options: {
  windowMs: number;
  maxRequests: number;
}): {
  count: number;
  remaining: number;
  resetTime: Date;
  isLimited: boolean;
} {
  const identifier = getClientId(req);
  const key = `${identifier}:${options.windowMs}:${options.maxRequests}`;
  const record = store[key];
  const now = Date.now();

  if (!record || record.resetTime < now) {
    return {
      count: 0,
      remaining: options.maxRequests,
      resetTime: new Date(now + options.windowMs),
      isLimited: false,
    };
  }

  return {
    count: record.count,
    remaining: Math.max(0, options.maxRequests - record.count),
    resetTime: new Date(record.resetTime),
    isLimited: record.count >= options.maxRequests,
  };
}

/**
 * Reset rate limit for a specific client (admin function)
 */
export function resetRateLimit(identifier: string): void {
  let cleared = 0;
  for (const key in store) {
    if (key.startsWith(identifier)) {
      delete store[key];
      cleared++;
    }
  }
  logger.info(`Reset rate limit for ${identifier} - cleared ${cleared} entries`);
}

/**
 * Get rate limit statistics (for monitoring)
 */
export function getRateLimitStats(): {
  totalEntries: number;
  activeClients: Set<string>;
  topOffenders: Array<{ identifier: string; count: number }>;
} {
  const activeClients = new Set<string>();
  const counts: { [identifier: string]: number } = {};

  for (const key in store) {
    const identifier = key.split(':')[0] + ':' + key.split(':')[1];
    activeClients.add(identifier);
    counts[identifier] = (counts[identifier] || 0) + store[key].count;
  }

  const topOffenders = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([identifier, count]) => ({ identifier, count }));

  return {
    totalEntries: Object.keys(store).length,
    activeClients,
    topOffenders,
  };
}

export default {
  apiLimiter,
  strictLimiter,
  authLimiter,
  aiLimiter,
  uploadLimiter,
  searchLimiter,
  emailLimiter,
  userLimiter,
  createRateLimiter,
  getRateLimitStatus,
  resetRateLimit,
  getRateLimitStats,
};
