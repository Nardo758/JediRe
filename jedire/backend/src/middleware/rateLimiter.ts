/**
 * Rate Limiting Middleware
 * Prevent API abuse
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');

/**
 * Clean up old entries every 5 minutes
 */
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  }
}, 300000);

export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Get client identifier (IP or user ID)
  const identifier = req.ip || 'unknown';
  const now = Date.now();

  // Initialize or get existing record
  if (!store[identifier] || store[identifier].resetTime < now) {
    store[identifier] = {
      count: 1,
      resetTime: now + WINDOW_MS,
    };
    next();
    return;
  }

  // Increment counter
  store[identifier].count++;

  // Check if limit exceeded
  if (store[identifier].count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((store[identifier].resetTime - now) / 1000);

    logger.warn('Rate limit exceeded:', {
      identifier,
      count: store[identifier].count,
      path: req.path,
    });

    res.set('Retry-After', retryAfter.toString());
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter,
    });
    return;
  }

  // Set rate limit headers
  const remaining = Math.max(0, MAX_REQUESTS - store[identifier].count);
  res.set({
    'X-RateLimit-Limit': MAX_REQUESTS.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': new Date(store[identifier].resetTime).toISOString(),
  });

  next();
}
