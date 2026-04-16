/**
 * JWT Authentication
 * Token generation and verification for secure API access
 *
 * Secrets are read lazily (inside functions) so they pick up values
 * loaded by dotenv.config() regardless of import order.
 */

import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'your-secret-key-change-this';
}
function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || '7d';
}
function getRefreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET || 'refresh-secret';
}
function getRefreshExpiresIn(): string {
  return process.env.JWT_REFRESH_EXPIRES_IN || '30d';
}

/**
 * Generate access token
 */
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiresIn() as string,
    issuer: 'jedire-api',
    audience: 'jedire-client',
  } as jwt.SignOptions);
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, getRefreshSecret(), {
    expiresIn: getRefreshExpiresIn() as string,
    issuer: 'jedire-api',
    audience: 'jedire-client',
  } as jwt.SignOptions);
}

/**
 * Generate token pair (access + refresh)
 */
export function generateTokenPair(payload: JWTPayload): TokenPair {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  const decoded = jwt.decode(accessToken) as any;
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

  return { accessToken, refreshToken, expiresIn };
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: 'jedire-api',
      audience: 'jedire-client',
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('Access token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid access token');
    }
    return null;
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getRefreshSecret(), {
      issuer: 'jedire-api',
      audience: 'jedire-client',
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    logger.warn('Invalid refresh token:', error);
    return null;
  }
}

/**
 * Decode token without verification (for inspection)
 */
export function decodeToken(token: string): any {
  try {
    return jwt.decode(token);
  } catch (error) {
    logger.error('Failed to decode token:', error);
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}
