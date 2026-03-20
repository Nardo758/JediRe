"use strict";
/**
 * JWT Authentication
 * Token generation and verification for secure API access
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.generateTokenPair = generateTokenPair;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.decodeToken = decodeToken;
exports.extractTokenFromHeader = extractTokenFromHeader;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
/**
 * Generate access token
 */
function generateAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'jedire-api',
        audience: 'jedire-client',
    });
}
/**
 * Generate refresh token
 */
function generateRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_REFRESH_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        issuer: 'jedire-api',
        audience: 'jedire-client',
    });
}
/**
 * Generate token pair (access + refresh)
 */
function generateTokenPair(payload) {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    // Calculate expiration timestamp
    const decoded = jsonwebtoken_1.default.decode(accessToken);
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    return {
        accessToken,
        refreshToken,
        expiresIn,
    };
}
/**
 * Verify access token
 */
function verifyAccessToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, {
            issuer: 'jedire-api',
            audience: 'jedire-client',
        });
        return decoded;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            logger_1.logger.debug('Access token expired');
        }
        else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            logger_1.logger.warn('Invalid access token');
        }
        return null;
    }
}
/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET, {
            issuer: 'jedire-api',
            audience: 'jedire-client',
        });
        return decoded;
    }
    catch (error) {
        logger_1.logger.warn('Invalid refresh token:', error);
        return null;
    }
}
/**
 * Decode token without verification (for inspection)
 */
function decodeToken(token) {
    try {
        return jsonwebtoken_1.default.decode(token);
    }
    catch (error) {
        logger_1.logger.error('Failed to decode token:', error);
        return null;
    }
}
/**
 * Extract token from Authorization header
 */
function extractTokenFromHeader(authHeader) {
    if (!authHeader)
        return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }
    return parts[1];
}
//# sourceMappingURL=jwt.js.map